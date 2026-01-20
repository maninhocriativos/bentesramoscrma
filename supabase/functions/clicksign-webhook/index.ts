import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const eventName = eventData.name;

    console.log(`Processing event: ${eventName} for document: ${documentKey}`);

    // Map Clicksign status to our status
    let newStatus: string | null = null;
    
    switch (eventName) {
      case "upload":
        newStatus = "Documento Enviado";
        break;
      case "add_signer":
        newStatus = "Aguardando Assinatura";
        break;
      case "sign":
        // Check if all signers have signed
        const allSigned = document.signers?.every((s: any) => s.signed_at !== null);
        newStatus = allSigned ? "Assinado" : "Assinatura Parcial";
        break;
      case "close":
        newStatus = "Finalizado";
        break;
      case "deadline":
        newStatus = "Prazo Expirado";
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
      // Update leads that have this document key in their link_contrato
      const { data: leads, error: leadsError } = await supabase
        .from("leads_juridicos")
        .select("id, nome, telefone, link_contrato, status")
        .ilike("link_contrato", `%${documentKey}%`);

      if (leadsError) {
        console.error("Error fetching leads:", leadsError);
      } else if (leads && leads.length > 0) {
        console.log(`Found ${leads.length} leads with document ${documentKey}`);
        
        for (const lead of leads) {
          // Se contrato foi assinado completamente ou finalizado, atualizar lead para "Ganho"
          if (newStatus === "Assinado" || newStatus === "Finalizado") {
            const { error: updateLeadError } = await supabase
              .from("leads_juridicos")
              .update({ 
                status: "Ganho",
                updated_at: new Date().toISOString()
              })
              .eq("id", lead.id);

            if (updateLeadError) {
              console.error("Error updating lead status to Ganho:", updateLeadError);
            } else {
              console.log(`Lead ${lead.id} atualizado para Ganho - contrato assinado`);
            }
          }

          // Create interaction for each lead
          const { error: interactionError } = await supabase
            .from("interacoes")
            .insert({
              cliente_id: lead.id,
              tipo: "Documento",
              resumo: `Contrato: ${newStatus}`,
              detalhes: `Evento Clicksign: ${eventName}. Status atualizado para: ${newStatus}`,
              direcao: "Sistema",
            });

          if (interactionError) {
            console.error("Error creating interaction:", interactionError);
          }

          // Enviar notificação via WhatsApp sobre status do contrato
          if (lead.telefone && (eventName === "add_signer" || eventName === "sign" || eventName === "close")) {
            let whatsappMessage = "";
            const clienteName = lead.nome || "Cliente";
            const contractUrl = lead.link_contrato;

            if (eventName === "add_signer") {
              whatsappMessage = `📄 *Contrato Disponível para Assinatura*\n\nOlá ${clienteName},\n\nSeu contrato está pronto! Clique no link abaixo para assinar digitalmente:\n\n👉 ${contractUrl}\n\nDúvidas? Estamos à disposição.\n\n*Bentes & Ramos Advogados*`;
            } else if (eventName === "sign") {
              whatsappMessage = `✅ *Assinatura Recebida*\n\nOlá ${clienteName},\n\nRecebemos sua assinatura no contrato. ${newStatus === "Assinado" ? "Todas as partes assinaram!" : "Aguardando demais assinantes."}\n\n*Bentes & Ramos Advogados*`;
            } else if (eventName === "close") {
              whatsappMessage = `🎉 *Contrato Finalizado*\n\nOlá ${clienteName},\n\nSeu contrato foi finalizado com sucesso! Você pode acessá-lo pelo link:\n\n👉 ${contractUrl}\n\nObrigado pela confiança!\n\n*Bentes & Ramos Advogados*`;
            }

            if (whatsappMessage) {
              try {
                // Buscar configuração Z-API
                const { data: config } = await supabase
                  .from('integrations_config')
                  .select('config_json, is_active')
                  .eq('provider', 'zapi')
                  .single();

                if (config?.is_active) {
                  const instanceId = config.config_json?.instance_id;
                  const token = config.config_json?.token;

                  if (instanceId && token) {
                    let cleanPhone = lead.telefone.replace(/\D/g, '');
                    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
                      cleanPhone = '55' + cleanPhone;
                    }

                    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ phone: cleanPhone, message: whatsappMessage })
                    });

                    if (response.ok) {
                      console.log(`WhatsApp enviado para ${lead.telefone} - evento: ${eventName}`);
                      
                      // Registrar mensagem enviada
                      await supabase.from('manychat_mensagens').insert({
                        subscriber_id: `zapi_${cleanPhone}`,
                        subscriber_nome: 'Escritório',
                        conteudo: whatsappMessage,
                        canal: 'whatsapp',
                        tipo: 'text',
                        direcao: 'saida',
                        lead_id: lead.id,
                        metadata: { source: 'clicksign-webhook', event: eventName }
                      });
                    }
                  }
                }
              } catch (whatsappError) {
                console.error("Erro ao enviar WhatsApp:", whatsappError);
              }
            }
          }
        }
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
