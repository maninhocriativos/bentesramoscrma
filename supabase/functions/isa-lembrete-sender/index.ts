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
        .select('atendimento_humano, telefone, linha_whatsapp')
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

      // Buscar instância Z-API correta
      const isTrafficLine = sub?.linha_whatsapp === 'trafego_isa';
      let instanceId: string | undefined;
      let token: string | undefined;
      let clientToken: string | undefined;

      if (isTrafficLine) {
        const { data: ti } = await supabase
          .from('zapi_instances')
          .select('instance_id, token, client_token')
          .eq('is_active', true)
          .ilike('phone_number', '%85888190%')
          .maybeSingle();
        if (ti) { instanceId = ti.instance_id; token = ti.token; clientToken = ti.client_token; }
      }

      if (!instanceId) {
        const { data: di } = await supabase
          .from('zapi_instances')
          .select('instance_id, token, client_token')
          .eq('is_active', true)
          .eq('is_default', true)
          .maybeSingle();
        if (di) { instanceId = di.instance_id; token = di.token; clientToken = di.client_token; }
      }

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
