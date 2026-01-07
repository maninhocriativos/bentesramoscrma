import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * FLUXO DE RETOMADA - Leads Frios Sem Resposta
 * 
 * Este é um fluxo SEPARADO do follow-up inicial.
 * Só é acionado para leads que:
 * - Estão como "Lead Frio"
 * - Já passaram pelo follow-up inicial (3 mensagens)
 * - Não responderam
 * 
 * Envia o template aprovado da Meta nos seguintes intervalos:
 * - Retomada 1: após 24h do último follow-up
 * - Retomada 2: após 48h do último follow-up
 * - Retomada 3: após 6 dias do último follow-up
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const manychatApiKey = Deno.env.get('MANYCHAT_API_KEY')!;

// Fluxo de retomada aprovado pela Meta
const RETOMADA_FLOW_NS = 'content20260105140934_525890';

// Intervalos de envio (em minutos desde o último follow-up)
const RETOMADA_CONFIG = {
  retomada_1: { delay_minutos: 1440, titulo: "Retomada 24h" },   // 24 horas
  retomada_2: { delay_minutos: 2880, titulo: "Retomada 48h" },   // 48 horas
  retomada_3: { delay_minutos: 8640, titulo: "Retomada 6 dias" } // 6 dias
};

// Enviar via Flow (template aprovado pela Meta)
async function enviarRetomada(subscriberId: string, nome: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[RETOMADA] Enviando via Flow: subscriber=${subscriberId}, flow=${RETOMADA_FLOW_NS}`);
    
    const response = await fetch('https://api.manychat.com/fb/sending/sendFlow', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${manychatApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: parseInt(subscriberId),
        flow_ns: RETOMADA_FLOW_NS,
        external_data: { nome: nome || 'Cliente' }
      }),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      const text = await response.text();
      console.error('[RETOMADA] Resposta não-JSON:', text.substring(0, 200));
      return { success: false, error: 'Resposta não-JSON' };
    }

    const result = await response.json();
    console.log('[RETOMADA] sendFlow response:', JSON.stringify(result));
    
    if (result.status === 'success') {
      return { success: true };
    }
    
    return { success: false, error: result.message || 'Erro desconhecido' };

  } catch (error: any) {
    console.error('[RETOMADA] Erro:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const agora = new Date();
  
  // Modo de teste manual
  let body: any = {};
  try {
    body = await req.json();
  } catch { /* sem body */ }

  // Teste manual
  if (body.test && body.subscriber_id) {
    console.log(`[RETOMADA-TEST] Testando para subscriber: ${body.subscriber_id}`);
    const resultado = await enviarRetomada(body.subscriber_id, body.nome || 'Cliente');
    return new Response(
      JSON.stringify({ 
        success: resultado.success, 
        flow_ns: RETOMADA_FLOW_NS,
        subscriber_id: body.subscriber_id,
        resultado 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  console.log('[RETOMADA] Iniciando processamento:', agora.toISOString());

  try {
    // Buscar leads frios que já concluíram o follow-up inicial mas não responderam
    const { data: followups, error: fetchError } = await supabase
      .from('lead_followups')
      .select(`
        *,
        leads_juridicos!inner(id, nome, telefone, status)
      `)
      .eq('status', 'concluido')
      .eq('respondido', false)
      .eq('followup_3_enviado', true);

    if (fetchError) {
      console.error('[RETOMADA] Erro ao buscar:', fetchError);
      throw fetchError;
    }

    console.log(`[RETOMADA] Encontrados ${followups?.length || 0} leads para retomada`);

    let enviados = 0;
    let erros = 0;

    for (const followup of followups || []) {
      const lead = followup.leads_juridicos;
      
      // Só processar leads frios
      if (lead.status !== 'Lead Frio') {
        console.log(`[RETOMADA] Lead ${lead.nome} não é mais Lead Frio (${lead.status}), pulando`);
        continue;
      }

      if (!followup.subscriber_id) {
        console.log(`[RETOMADA] Lead ${lead.nome} sem subscriber_id, pulando`);
        continue;
      }

      // Calcular tempo desde o último follow-up (followup_3)
      const ultimoFollowup = new Date(followup.followup_3_enviado_em);
      const minutosDesdeUltimoFollowup = (agora.getTime() - ultimoFollowup.getTime()) / (1000 * 60);
      
      console.log(`[RETOMADA] Lead: ${lead.nome}, minutos desde followup_3: ${minutosDesdeUltimoFollowup.toFixed(0)}`);

      // Determinar qual retomada enviar
      // Usando campos existentes: retomada usa os mesmos campos mas com lógica diferente
      // Para não criar novos campos, vamos usar um campo de metadata
      
      let retomadaKey: string | null = null;
      
      // Retomada 1: após 24h do followup_3
      if (minutosDesdeUltimoFollowup >= RETOMADA_CONFIG.retomada_1.delay_minutos && 
          minutosDesdeUltimoFollowup < RETOMADA_CONFIG.retomada_2.delay_minutos) {
        // Verificar se já enviou retomada 1 (olhando system_events)
        const { data: jaEnviou } = await supabase
          .from('system_events')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('acao', 'retomada_1_enviado')
          .limit(1);
        
        if (!jaEnviou || jaEnviou.length === 0) {
          retomadaKey = 'retomada_1';
        }
      }
      // Retomada 2: após 48h do followup_3
      else if (minutosDesdeUltimoFollowup >= RETOMADA_CONFIG.retomada_2.delay_minutos && 
               minutosDesdeUltimoFollowup < RETOMADA_CONFIG.retomada_3.delay_minutos) {
        const { data: jaEnviou } = await supabase
          .from('system_events')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('acao', 'retomada_2_enviado')
          .limit(1);
        
        if (!jaEnviou || jaEnviou.length === 0) {
          retomadaKey = 'retomada_2';
        }
      }
      // Retomada 3: após 6 dias do followup_3
      else if (minutosDesdeUltimoFollowup >= RETOMADA_CONFIG.retomada_3.delay_minutos) {
        const { data: jaEnviou } = await supabase
          .from('system_events')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('acao', 'retomada_3_enviado')
          .limit(1);
        
        if (!jaEnviou || jaEnviou.length === 0) {
          retomadaKey = 'retomada_3';
        }
      }

      if (retomadaKey) {
        console.log(`[RETOMADA] Enviando ${retomadaKey} para ${lead.nome}`);

        const resultado = await enviarRetomada(followup.subscriber_id, lead.nome);

        if (resultado.success) {
          // Registrar no system_events
          await supabase.from('system_events').insert({
            tipo: 'retomada',
            fonte: 'isa-automation',
            acao: `${retomadaKey}_enviado`,
            lead_id: lead.id,
            entidade_tipo: 'lead_followup',
            entidade_id: followup.id,
            dados: { 
              retomada: retomadaKey, 
              subscriber_id: followup.subscriber_id,
              flow_ns: RETOMADA_FLOW_NS,
              minutos_desde_followup: minutosDesdeUltimoFollowup
            },
            processado: true
          });

          // Registrar interação
          await supabase.from('interacoes').insert({
            cliente_id: lead.id,
            tipo: 'WhatsApp',
            direcao: 'Saída',
            resumo: `Retomada automática (${RETOMADA_CONFIG[retomadaKey as keyof typeof RETOMADA_CONFIG].titulo}) enviada pela Isa`,
            detalhes: `Template de retomada enviado via ManyChat Flow: ${RETOMADA_FLOW_NS}`,
          });

          enviados++;
          console.log(`[RETOMADA] ✅ ${retomadaKey} enviado para ${lead.nome}`);
        } else {
          erros++;
          console.error(`[RETOMADA] ❌ Erro ao enviar ${retomadaKey}: ${resultado.error}`);
        }
      }
    }

    console.log(`[RETOMADA] Concluído. Enviados: ${enviados}, Erros: ${erros}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processados: followups?.length || 0,
        enviados,
        erros,
        timestamp: agora.toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('[RETOMADA] Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
