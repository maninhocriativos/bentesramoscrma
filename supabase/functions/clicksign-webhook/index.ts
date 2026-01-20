import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Messages for Isa to send based on contract status
const CONTRACT_MESSAGES = {
  created: (clientName: string, contractLink: string) => 
    `Olá ${clientName}! 📄✨\n\n` +
    `Ótimas notícias! Seu contrato foi gerado e está pronto para assinatura.\n\n` +
    `🔗 Acesse aqui para assinar: ${contractLink}\n\n` +
    `A assinatura é digital, rápida e segura. Qualquer dúvida, estou à disposição!\n\n` +
    `*Bentes & Ramos Advocacia*`,
  
  reminder_soft: (clientName: string, contractLink: string) => 
    `Oi ${clientName}! 👋\n\n` +
    `Passando para lembrar que seu contrato ainda aguarda assinatura.\n\n` +
    `🔗 Link para assinar: ${contractLink}\n\n` +
    `É bem rapidinho, leva menos de 2 minutos! 😊\n\n` +
    `*Bentes & Ramos Advocacia*`,
  
  reminder_urgent: (clientName: string, contractLink: string) => 
    `${clientName}, seu contrato precisa de atenção! ⚠️\n\n` +
    `Percebemos que ainda não houve a assinatura. Para darmos continuidade ao seu processo, ` +
    `*é essencial que você assine o contrato hoje*.\n\n` +
    `🔗 Assine agora: ${contractLink}\n\n` +
    `Sem a assinatura, não podemos iniciar os trabalhos. Por favor, priorize isso! 📝\n\n` +
    `*Bentes & Ramos Advocacia*`,
  
  signed: (clientName: string) => 
    `Perfeito, ${clientName}! ✅🎉\n\n` +
    `Recebemos sua assinatura com sucesso!\n\n` +
    `Nossa equipe jurídica já está ciente e daremos início aos procedimentos.\n\n` +
    `Fique tranquilo(a), manteremos você informado(a) sobre cada etapa.\n\n` +
    `*Bentes & Ramos Advocacia*`,
  
  finalized: (clientName: string) => 
    `${clientName}, tudo certo! 📋✨\n\n` +
    `O contrato foi finalizado e todas as assinaturas foram coletadas.\n\n` +
    `Você receberá uma cópia do documento por e-mail.\n\n` +
    `Nossa equipe já está trabalhando no seu caso! 💼\n\n` +
    `*Bentes & Ramos Advocacia*`,
};

async function sendWhatsAppMessage(
  supabase: any,
  phone: string,
  message: string,
  leadId: string
): Promise<boolean> {
  try {
    console.log(`[Clicksign Webhook] Sending WhatsApp to ${phone}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/zapi-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        to_phone: phone,
        message: message,
        provider: 'zapi',
        lead_id: leadId,
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      console.log(`[Clicksign Webhook] WhatsApp sent successfully`);
      return true;
    } else {
      console.error(`[Clicksign Webhook] WhatsApp failed:`, result.error);
      return false;
    }
  } catch (error) {
    console.error(`[Clicksign Webhook] Error sending WhatsApp:`, error);
    return false;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const event = await req.json();
    console.log("Clicksign webhook received:", JSON.stringify(event, null, 2));

    const { document, event: eventData } = event;
    
    if (!document || !eventData) {
      console.log("Invalid webhook payload");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const documentKey = document.key;
    const documentFilename = document.filename || '';
    const eventName = eventData.name;

    // Build the contract signing URL
    const contractLink = `https://app.clicksign.com/sign/${documentKey}`;

    console.log(`Processing event: ${eventName} for document: ${documentKey}`);

    // Map Clicksign status to our status
    let newStatus: string | null = null;
    let messageType: string | null = null;
    
    switch (eventName) {
      case "upload":
        newStatus = "Documento Enviado";
        messageType = 'created';
        break;
      case "add_signer":
        newStatus = "Aguardando Assinatura";
        messageType = 'created'; // Also send notification when signer is added
        break;
      case "sign":
        // Check if all signers have signed
        const allSigned = document.signers?.every((s: any) => s.signed_at !== null);
        newStatus = allSigned ? "Assinado" : "Assinatura Parcial";
        messageType = 'signed';
        break;
      case "close":
        newStatus = "Finalizado";
        messageType = 'finalized';
        break;
      case "deadline":
        newStatus = "Prazo Expirado";
        messageType = 'reminder_urgent';
        break;
      case "cancel":
        newStatus = "Cancelado";
        break;
      case "refuse":
        newStatus = "Recusado";
        break;
      default:
        console.log(`Unhandled event: ${eventName}`);
    }

    if (newStatus) {
      // Try to find lead by document key in link_contrato
      let leads: any[] = [];
      
      // First, search by exact document key
      const { data: leadsByKey, error: leadsKeyError } = await supabase
        .from("leads_juridicos")
        .select("id, nome, telefone, link_contrato, status, lead_state")
        .ilike("link_contrato", `%${documentKey}%`);

      if (!leadsKeyError && leadsByKey && leadsByKey.length > 0) {
        leads = leadsByKey;
      } else {
        // Try to find by signer email or phone
        const signers = document.signers || [];
        for (const signer of signers) {
          if (signer.email) {
            const { data: leadsByEmail } = await supabase
              .from("leads_juridicos")
              .select("id, nome, telefone, link_contrato, status, lead_state")
              .ilike("email", signer.email);
            
            if (leadsByEmail && leadsByEmail.length > 0) {
              leads = [...leads, ...leadsByEmail];
            }
          }
          
          if (signer.phone_number) {
            const cleanPhone = signer.phone_number.replace(/\D/g, '');
            const { data: leadsByPhone } = await supabase
              .from("leads_juridicos")
              .select("id, nome, telefone, link_contrato, status, lead_state")
              .or(`telefone.ilike.%${cleanPhone}%,telefone.ilike.%${cleanPhone.slice(-9)}%`);
            
            if (leadsByPhone && leadsByPhone.length > 0) {
              leads = [...leads, ...leadsByPhone];
            }
          }
        }
        
        // Remove duplicates
        leads = leads.filter((lead, index, self) => 
          index === self.findIndex(l => l.id === lead.id)
        );
      }

      console.log(`Found ${leads.length} leads for document ${documentKey}`);
      
      for (const lead of leads) {
        const leadId = lead.id;
        const clientName = lead.nome?.split(' ')[0] || 'Cliente';
        const phone = lead.telefone;
        
        // Update lead with contract link if not already set
        if (!lead.link_contrato || !lead.link_contrato.includes(documentKey)) {
          const { error: updateLinkError } = await supabase
            .from("leads_juridicos")
            .update({ 
              link_contrato: contractLink,
              contract_sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", leadId);

          if (updateLinkError) {
            console.error("Error updating lead contract link:", updateLinkError);
          } else {
            console.log(`Lead ${leadId} updated with contract link: ${contractLink}`);
          }
        }
        
        // Update lead state based on contract status
        if (newStatus === "Assinado" || newStatus === "Finalizado") {
          // Update to CONTRACT_SIGNED state and Ganho status
          const { error: updateLeadError } = await supabase
            .from("leads_juridicos")
            .update({ 
              status: "Ganho",
              lead_state: "CONTRACT_SIGNED",
              contract_signed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", leadId);

          if (updateLeadError) {
            console.error("Error updating lead status to Ganho:", updateLeadError);
          } else {
            console.log(`Lead ${leadId} atualizado para Ganho - contrato assinado`);
            
            // Record state transition
            await supabase.from("lead_state_history").insert({
              lead_id: leadId,
              from_state: lead.lead_state || 'CONTRACT_SENT',
              to_state: 'CONTRACT_SIGNED',
              changed_by: 'clicksign_webhook',
              reason: `Contrato assinado via Clicksign (${documentKey})`
            });
          }
        } else if (newStatus === "Documento Enviado" || newStatus === "Aguardando Assinatura") {
          // Update to CONTRACT_SENT state
          const { error: updateStateError } = await supabase
            .from("leads_juridicos")
            .update({ 
              lead_state: "CONTRACT_SENT",
              status: "Aguardando Contrato",
              updated_at: new Date().toISOString()
            })
            .eq("id", leadId)
            .not("lead_state", "in", "(CONTRACT_SIGNED,DOCS_PENDING,READY_FOR_LAWYER)");

          if (!updateStateError) {
            console.log(`Lead ${leadId} state updated to CONTRACT_SENT`);
          }
        }

        // Create interaction for the event
        const { error: interactionError } = await supabase
          .from("interacoes")
          .insert({
            cliente_id: leadId,
            tipo: "Documento",
            resumo: `Contrato: ${newStatus}`,
            detalhes: `Evento Clicksign: ${eventName}. Status: ${newStatus}. Link: ${contractLink}`,
            direcao: "Sistema",
          });

        if (interactionError) {
          console.error("Error creating interaction:", interactionError);
        }

        // Send WhatsApp notification if we have phone and a message type
        if (phone && messageType) {
          let message = '';
          
          if (messageType === 'created') {
            message = CONTRACT_MESSAGES.created(clientName, contractLink);
          } else if (messageType === 'reminder_soft') {
            message = CONTRACT_MESSAGES.reminder_soft(clientName, contractLink);
          } else if (messageType === 'reminder_urgent') {
            message = CONTRACT_MESSAGES.reminder_urgent(clientName, contractLink);
          } else if (messageType === 'signed') {
            message = CONTRACT_MESSAGES.signed(clientName);
          } else if (messageType === 'finalized') {
            message = CONTRACT_MESSAGES.finalized(clientName);
          }
          
          if (message) {
            // Don't send duplicate notifications for signed events (only when all signed)
            if (messageType === 'signed' && newStatus !== "Assinado") {
              console.log(`Skipping signed notification - partial signature`);
            } else {
              await sendWhatsAppMessage(supabase, phone, message, leadId);
              
              // Log the notification
              await supabase.from("system_events").insert({
                tipo: "contrato",
                acao: `notification_${messageType}`,
                fonte: "clicksign_webhook",
                lead_id: leadId,
                dados: {
                  document_key: documentKey,
                  event_name: eventName,
                  status: newStatus,
                  phone: phone.slice(-4), // Only log last 4 digits
                }
              });
            }
          }
        } else if (!phone) {
          console.log(`Lead ${leadId} has no phone - skipping WhatsApp notification`);
        }
      }

      // If no leads found but we have signer info, try to create a record
      if (leads.length === 0 && document.signers?.length > 0) {
        const signer = document.signers[0];
        console.log(`No leads found. Signer info:`, signer);
        
        // Log this event for manual review
        await supabase.from("system_events").insert({
          tipo: "contrato",
          acao: "orphan_contract",
          fonte: "clicksign_webhook",
          dados: {
            document_key: documentKey,
            document_name: documentFilename,
            event_name: eventName,
            signer_name: signer.name,
            signer_email: signer.email,
            signer_phone: signer.phone_number,
          }
        });
      }
    }

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in clicksign-webhook function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});