const serve = Deno.serve;
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const agora = new Date().toISOString();

    // Buscar lembretes pendentes cujo horário já chegou
    const { data: lembretes, error: fetchErr } = await supabase
      .from('system_events')
      .select('*')
      .eq('acao', 'lembrete_pendente')
      .eq('processado', false)
      .lte('dados->>scheduled_for', agora)
      .limit(20);

    if (fetchErr) throw fetchErr;

    let enviados = 0;
    let pulados = 0;

    for (const lembrete of lembretes || []) {
      const { subscriber_id, lead_id, mensagem } = lembrete.dados || {};

      if (!subscriber_id || !mensagem) {
        await supabase.from('system_events').update({ processado: true }).eq('id', lembrete.id);
        pulados++;
        continue;
      }

      // Verificar atendimento humano ou lead bloqueado
      const { data: sub } = await supabase
        .from('manychat_subscribers')
        .select('atendimento_humano, telefone, linha_whatsapp, lead_id')
        .eq('subscriber_id', subscriber_id)
        .maybeSingle();

      if (sub?.atendimento_humano) {
        console.log(`[Lembrete] ⏭️ Pulando — atendimento humano ativo: ${subscriber_id}`);
        await supabase.from('system_events')
          .update({ processado: true, dados: { ...lembrete.dados, cancelado_por: 'atendimento_humano' } })
          .eq('id', lembrete.id);
        pulados++;
        continue;
      }

      // Cancelar lembrete se o lead respondeu nas últimas 12h (não precisa mais do reengajamento)
      if (lead_id) {
        const dozeHorasAtras = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const { data: msgRecente } = await supabase
          .from('manychat_mensagens')
          .select('id')
          .eq('lead_id', lead_id)
          .eq('direcao', 'inbound')
          .gte('created_at', dozeHorasAtras)
          .limit(1)
          .maybeSingle();
        if (msgRecente) {
          console.log(`[Lembrete] ⏭️ Pulando — cliente respondeu nas últimas 12h: ${lead_id}`);
          await supabase.from('system_events')
            .update({ processado: true, dados: { ...lembrete.dados, cancelado_por: 'cliente_respondeu_recente' } })
            .eq('id', lembrete.id);
          pulados++;
          continue;
        }
      }

      // REGRA ABSOLUTA: tipo_origem = 'trafego' → 5592985888190 | demais → 5592991604348
      const PHONE_TRAFEGO    = '5592985888190'; // (92) 98588-8190 — "Bentes Ramos Trafego"
      const PHONE_ESCRITORIO = '5592991604348'; // (92) 99160-4348 — "Bentes Ramos"

      // Verificar se é lead de tráfego: linha_whatsapp OU tipo_origem do lead
      let isTrafego = sub?.linha_whatsapp === 'trafego_isa' || sub?.linha_whatsapp === 'trafego';
      if (!isTrafego && sub?.lead_id) {
        const { data: lead } = await supabase
          .from('leads_juridicos')
          .select('tipo_origem')
          .eq('id', sub.lead_id)
          .maybeSingle();
        if (lead?.tipo_origem === 'trafego' || lead?.tipo_origem === 'trafego_isa') isTrafego = true;
      }

      const targetPhone = isTrafego ? PHONE_TRAFEGO : PHONE_ESCRITORIO;

      let instanceId: string | undefined;
      let token: string | undefined;
      let clientToken: string | undefined;

      // 1º: match pelo número de telefone exato (mais confiável)
      const { data: instances } = await supabase
        .from('zapi_instances')
        .select('instance_id, token, client_token, phone_number, is_default')
        .eq('is_active', true);

      const byPhone = (instances || []).find((i: any) =>
        i.phone_number?.replace(/\D/g, '') === targetPhone
      );
      const byFlag = isTrafego
        ? (instances || []).find((i: any) => !i.is_default)
        : (instances || []).find((i: any) => i.is_default);
      const inst = byPhone || byFlag || (instances || [])[0];

      if (inst) { instanceId = inst.instance_id; token = inst.token; clientToken = inst.client_token; }

      console.log(`[Lembrete] 📱 Roteamento: isTrafego=${isTrafego} → ${inst?.phone_number || 'sem instância'} (via ${byPhone ? 'phone' : 'flag'})`);

      if (!instanceId || !token || !sub?.telefone) {
        console.error(`[Lembrete] ❌ Sem instância ou telefone para ${subscriber_id}`);
        continue;
      }

      // Enviar mensagem via Z-API
      let cleanPhone = sub.telefone.replace(/\D/g, '');
      if (cleanPhone.length <= 11) cleanPhone = '55' + cleanPhone;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (clientToken) headers['Client-Token'] = clientToken;

      const zapiResponse = await fetch(
        `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
        { method: 'POST', headers, body: JSON.stringify({ phone: cleanPhone, message: mensagem }) },
      );

      if (zapiResponse.ok) {
        const result = await zapiResponse.json();

        // Salvar no histórico de mensagens
        await supabase.from('manychat_mensagens').insert({
          subscriber_id,
          subscriber_nome: 'Especialista',
          canal: 'whatsapp',
          conteudo: mensagem,
          tipo: 'text',
          direcao: 'saida',
          lead_id,
          metadata: {
            auto_gerada: true,
            source: 'isa_lembrete',
            message_id: result.messageId || result.id,
          },
        });

        await supabase.from('system_events')
          .update({ processado: true, dados: { ...lembrete.dados, enviado_em: new Date().toISOString() } })
          .eq('id', lembrete.id);

        enviados++;
        console.log(`[Lembrete] ✅ Enviado para ${subscriber_id}`);
      } else {
        console.error(`[Lembrete] ❌ Z-API erro ${zapiResponse.status} para ${subscriber_id}`);
      }
    }

    console.log(`[Lembrete] Concluído — enviados: ${enviados}, pulados: ${pulados}`);
    return new Response(
      JSON.stringify({ success: true, enviados, pulados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[Lembrete] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
