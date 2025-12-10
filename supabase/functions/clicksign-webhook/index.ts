import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
        .select("id, link_contrato")
        .ilike("link_contrato", `%${documentKey}%`);

      if (leadsError) {
        console.error("Error fetching leads:", leadsError);
      } else if (leads && leads.length > 0) {
        console.log(`Found ${leads.length} leads with document ${documentKey}`);
        
        // Create interaction for each lead
        for (const lead of leads) {
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
