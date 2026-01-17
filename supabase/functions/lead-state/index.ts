import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const url = new URL(req.url);
  const path = url.pathname.replace('/lead-state', '');

  try {
    // GET /lead-state/:id - Obter contexto completo do lead
    if (req.method === 'GET' && path.match(/^\/[a-f0-9-]+$/i)) {
      const leadId = path.replace('/', '');
      
      // Buscar lead com todas as informações relacionadas
      const { data: lead, error: leadError } = await supabase
        .from('leads_juridicos')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError) {
        return new Response(JSON.stringify({ error: 'Lead not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Buscar dados adicionais em paralelo
      const [
        { data: classification },
        { data: contractData },
        { data: docsChecklist },
        { data: stateHistory },
        { data: recentInteractions }
      ] = await Promise.all([
        supabase.from('lead_classifications').select('*').eq('lead_id', leadId).maybeSingle(),
        supabase.from('lead_contract_data').select('*').eq('lead_id', leadId).maybeSingle(),
        supabase.from('lead_docs_checklist').select('*').eq('lead_id', leadId),
        supabase.from('lead_state_history').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(10),
        supabase.from('interacoes').select('*').eq('cliente_id', leadId).order('data_interacao', { ascending: false }).limit(20)
      ]);

      // Calcular docs pendentes
      const docsPending = (docsChecklist || []).filter(d => d.is_required && !d.received);
      const docsReceived = (docsChecklist || []).filter(d => d.received);

      return new Response(JSON.stringify({
        success: true,
        data: {
          lead,
          lead_state: lead.lead_state || 'NEW',
          classification,
          contract_data: contractData,
          docs_checklist: docsChecklist || [],
          docs_pending: docsPending,
          docs_received: docsReceived,
          state_history: stateHistory || [],
          recent_interactions: recentInteractions || [],
          flags: {
            is_lost: lead.is_lost,
            has_contract_data: !!contractData?.cpf,
            has_classification: !!classification,
            all_docs_received: docsPending.length === 0 && (docsChecklist || []).length > 0
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /lead-state/:id/transition - Mudar estado do lead
    if (req.method === 'POST' && path.match(/^\/[a-f0-9-]+\/transition$/i)) {
      const leadId = path.split('/')[1];
      const { to_state, reason, changed_by = 'system' } = await req.json();

      if (!to_state) {
        return new Response(JSON.stringify({ error: 'to_state is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Usar a função do banco para validar e executar a transição
      const { data: result, error } = await supabase.rpc('update_lead_state', {
        p_lead_id: leadId,
        p_to_state: to_state,
        p_changed_by: changed_by,
        p_reason: reason
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /lead-state/:id/classify - Classificar caso
    if (req.method === 'POST' && path.match(/^\/[a-f0-9-]+\/classify$/i)) {
      const leadId = path.split('/')[1];
      const { case_type, sub_type, summary, recommended_docs, confidence_score } = await req.json();

      if (!case_type) {
        return new Response(JSON.stringify({ error: 'case_type is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Upsert classificação
      const { data: classification, error } = await supabase
        .from('lead_classifications')
        .upsert({
          lead_id: leadId,
          case_type,
          sub_type,
          summary,
          recommended_docs,
          confidence_score,
          classified_by: 'isa',
          updated_at: new Date().toISOString()
        }, { onConflict: 'lead_id' })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Criar checklist de documentos se fornecido
      if (recommended_docs && recommended_docs.length > 0) {
        const checklistItems = recommended_docs.map((doc: string, index: number) => ({
          lead_id: leadId,
          doc_type: doc.toLowerCase().replace(/\s+/g, '_'),
          doc_label: doc,
          is_required: true,
          received: false
        }));

        await supabase
          .from('lead_docs_checklist')
          .upsert(checklistItems, { onConflict: 'lead_id,doc_type' });
      }

      return new Response(JSON.stringify({ success: true, classification }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /lead-state/:id/contract-data - Salvar dados para contrato
    if (req.method === 'POST' && path.match(/^\/[a-f0-9-]+\/contract-data$/i)) {
      const leadId = path.split('/')[1];
      const contractData = await req.json();

      const { data, error } = await supabase
        .from('lead_contract_data')
        .upsert({
          lead_id: leadId,
          ...contractData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'lead_id' })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /lead-state/:id/doc-received - Marcar documento como recebido
    if (req.method === 'POST' && path.match(/^\/[a-f0-9-]+\/doc-received$/i)) {
      const leadId = path.split('/')[1];
      const { doc_type, file_id, notes } = await req.json();

      if (!doc_type) {
        return new Response(JSON.stringify({ error: 'doc_type is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase
        .from('lead_docs_checklist')
        .update({
          received: true,
          received_at: new Date().toISOString(),
          file_id,
          notes,
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', leadId)
        .eq('doc_type', doc_type)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verificar se todos os docs obrigatórios foram recebidos
      const { data: pending } = await supabase
        .from('lead_docs_checklist')
        .select('id')
        .eq('lead_id', leadId)
        .eq('is_required', true)
        .eq('received', false);

      const allReceived = !pending || pending.length === 0;

      return new Response(JSON.stringify({ 
        success: true, 
        data,
        all_docs_received: allReceived
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Lead State] Error:', errorMessage);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
