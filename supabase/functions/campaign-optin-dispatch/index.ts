import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizePhone, gerarSubscriberId, getAllZapiInstances, sendText } from '../_shared/zapi-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ============================================
// MENSAGENS DA CAMPANHA
// ============================================

const MENSAGEM_OPTIN = (nome: string) => {
  const primeiro = nome?.split(' ')[0] || '';
  return `Olá${primeiro ? `, ${primeiro}` : ''}! Aqui é a *Isa*, da equipe *Bentes & Ramos Advocacia*. 👋

Estamos realizando um trabalho de orientação sobre *direitos do consumidor* em contratos bancários.

Muitas pessoas pagam juros abusivos sem saber que têm direito à revisão e até restituição de valores.

Posso te enviar uma informação importante sobre isso? Responda *SIM* se tiver interesse! 😊`;
};

const MENSAGEM_CAMPANHA = (nome: string) => {
  const primeiro = nome?.split(' ')[0] || '';
  return `Olá, *${primeiro || 'cliente'}*! 👋

Você sabia que muitos contratos de crédito têm *juros acima do permitido por lei?*

Bancos cobram taxas abusivas e a maioria das pessoas *paga sem saber que tem direito à revisão.*

✅ Revisamos seu contrato *gratuitamente*

✅ Se houver cobrança indevida, você pode receber *dinheiro de volta*

✅ Sem burocracia, 100% pelo WhatsApp

⚠️ Vagas limitadas para análise esta semana.

Responde *SIM* agora e eu te explico como funciona em 2 minutos.`;
};

// ============================================
// IMPORTAR LISTA E DISPARAR EM LOTES
// ============================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'import' } = body;

    // ============================================
    // ACTION: import — Importa lista e inicia disparos de opt-in
    // ============================================
    if (action === 'import') {
      const { recipients, campaign_name = 'juros_abusivos_2026' } = body;

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return new Response(JSON.stringify({ error: 'Lista de recipients vazia' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Normalizar e preparar recipients
      const BATCH_SIZE = 10;
      const prepared = recipients.map((r: any, idx: number) => {
        const telefoneNorm = normalizePhone(r.telefone || r.phone || '');
        return {
          campaign_name,
          nome: r.nome || r.name || null,
          telefone: r.telefone || r.phone || '',
          telefone_normalizado: telefoneNorm,
          subscriber_id: telefoneNorm ? gerarSubscriberId(telefoneNorm) : null,
          stage: 'pending',
          batch_number: Math.floor(idx / BATCH_SIZE) + 1,
        };
      }).filter((r: any) => r.telefone_normalizado);

      // Inserir todos no banco
      const { data: inserted, error: insertError } = await supabase
        .from('campaign_recipients')
        .insert(prepared)
        .select('id, nome, telefone_normalizado, batch_number');

      if (insertError) throw new Error(`Erro ao inserir: ${insertError.message}`);

      const totalBatches = Math.ceil(prepared.length / BATCH_SIZE);

      console.log(`[Campaign] ✅ ${prepared.length} recipients importados em ${totalBatches} lotes`);

      // Disparar primeiro lote imediatamente
      const firstBatchResult = await dispatchBatch(supabase, campaign_name, 1);

      // Agendar próximos lotes via system_events (30 min cada)
      for (let batch = 2; batch <= totalBatches; batch++) {
        const scheduledAt = new Date(Date.now() + (batch - 1) * 30 * 60 * 1000);
        await supabase.from('system_events').insert({
          tipo: 'campaign_batch_scheduled',
          fonte: 'campaign-optin-dispatch',
          dados: {
            campaign_name,
            batch_number: batch,
            scheduled_at: scheduledAt.toISOString(),
          },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        total_recipients: prepared.length,
        total_batches: totalBatches,
        first_batch_result: firstBatchResult,
        next_batch_in: '30 minutos',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================
    // ACTION: dispatch_batch — Dispara um lote específico de opt-in
    // ============================================
    if (action === 'dispatch_batch') {
      const { campaign_name = 'juros_abusivos_2026', batch_number } = body;
      if (!batch_number) {
        return new Response(JSON.stringify({ error: 'batch_number obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await dispatchBatch(supabase, campaign_name, batch_number);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================
    // ACTION: send_campaign — Envia mensagem de campanha para quem aceitou (SIM)
    // ============================================
    if (action === 'send_campaign') {
      const { recipient_id, telefone, nome } = body;
      const result = await sendCampaignMessage(supabase, recipient_id, telefone, nome);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================
    // ACTION: process_scheduled — Cron: processa lotes agendados
    // ============================================
    if (action === 'process_scheduled') {
      const { campaign_name = 'juros_abusivos_2026' } = body;

      // Buscar eventos de lote pendentes que já passaram do horário
      const { data: pendingEvents } = await supabase
        .from('system_events')
        .select('id, dados')
        .eq('tipo', 'campaign_batch_scheduled')
        .eq('dados->>campaign_name', campaign_name)
        .lte('dados->>scheduled_at', new Date().toISOString())
        .order('created_at', { ascending: true })
        .limit(1);

      if (!pendingEvents || pendingEvents.length === 0) {
        return new Response(JSON.stringify({ message: 'Nenhum lote pendente' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const event = pendingEvents[0];
      const batchNumber = event.dados?.batch_number;

      // Disparar o lote
      const result = await dispatchBatch(supabase, campaign_name, batchNumber);

      // Remover o evento processado
      await supabase.from('system_events').delete().eq('id', event.id);

      return new Response(JSON.stringify({ batch_number: batchNumber, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================
    // ACTION: status — Retorna status da campanha
    // ============================================
    if (action === 'status') {
      const { campaign_name = 'juros_abusivos_2026' } = body;

      const { data: stats } = await supabase
        .from('campaign_recipients')
        .select('stage')
        .eq('campaign_name', campaign_name);

      const counts = (stats || []).reduce((acc: any, r: any) => {
        acc[r.stage] = (acc[r.stage] || 0) + 1;
        return acc;
      }, {});

      return new Response(JSON.stringify({ campaign_name, counts, total: stats?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Action inválida' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Campaign] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ============================================
// HELPERS
// ============================================

async function dispatchBatch(supabase: any, campaignName: string, batchNumber: number) {
  // Buscar recipients do lote que ainda estão pendentes
  const { data: recipients, error } = await supabase
    .from('campaign_recipients')
    .select('*')
    .eq('campaign_name', campaignName)
    .eq('batch_number', batchNumber)
    .eq('stage', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Erro ao buscar lote: ${error.message}`);
  if (!recipients || recipients.length === 0) {
    return { batch_number: batchNumber, enviados: 0, message: 'Lote vazio ou já processado' };
  }

  // Buscar instância de tráfego (Bentes Ramos-2)
  const instances = await getAllZapiInstances(supabase);
  const trafficInstance = instances.find(i => !i.is_default) || instances[0];

  if (!trafficInstance) {
    throw new Error('Nenhuma instância Z-API ativa');
  }

  let enviados = 0;
  let erros = 0;
  const results: any[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    try {
      const telefone = recipient.telefone_normalizado;
      if (!telefone) continue;

      console.log(`[Campaign] [Lote ${batchNumber}] [${i + 1}/${recipients.length}] Enviando opt-in para ${recipient.nome} (${telefone})`);

      const mensagem = MENSAGEM_OPTIN(recipient.nome || '');
      const sendResult = await sendText(trafficInstance, telefone, mensagem);

      if (sendResult.success) {
        enviados++;

        // Atualizar stage
        await supabase
          .from('campaign_recipients')
          .update({ stage: 'optin_sent', optin_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', recipient.id);

        // Salvar mensagem no chat
        const subscriberId = recipient.subscriber_id || gerarSubscriberId(telefone);
        await supabase.from('manychat_mensagens').insert({
          subscriber_id: subscriberId,
          subscriber_nome: 'Isa',
          lead_id: recipient.lead_id,
          conteudo: mensagem,
          direcao: 'saida',
          tipo: 'text',
          canal: 'whatsapp',
          metadata: {
            source: 'campaign_optin',
            campaign_name: campaignName,
            batch_number: batchNumber,
            message_id: sendResult.messageId,
            instance_name: trafficInstance.name,
          },
        });

        // Criar/atualizar subscriber para aparecer no chat
        await supabase.from('manychat_subscribers').upsert({
          subscriber_id: subscriberId,
          nome: recipient.nome || telefone,
          telefone: telefone,
          canal: 'whatsapp',
          lead_id: recipient.lead_id,
          ultima_interacao: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          instance_name: trafficInstance.phone_number,
          linha_whatsapp: 'trafego_isa',
        }, { onConflict: 'subscriber_id', ignoreDuplicates: false });

        results.push({ nome: recipient.nome, telefone, success: true });
        console.log(`[Campaign] ✅ Opt-in enviado: ${recipient.nome}`);
      } else {
        erros++;
        await supabase
          .from('campaign_recipients')
          .update({ stage: 'error', error_message: sendResult.error, updated_at: new Date().toISOString() })
          .eq('id', recipient.id);
        results.push({ nome: recipient.nome, telefone, success: false, error: sendResult.error });
      }

      // Intervalo de 10 segundos entre envios
      if (i < recipients.length - 1) {
        await new Promise(r => setTimeout(r, 10000));
      }
    } catch (err: any) {
      erros++;
      results.push({ nome: recipient.nome, success: false, error: err.message });
    }
  }

  console.log(`[Campaign] Lote ${batchNumber} concluído - Enviados: ${enviados}, Erros: ${erros}`);
  return { batch_number: batchNumber, total: recipients.length, enviados, erros, results };
}

async function sendCampaignMessage(supabase: any, recipientId: string, telefone: string, nome: string) {
  // Buscar instância de tráfego
  const instances = await getAllZapiInstances(supabase);
  const trafficInstance = instances.find(i => !i.is_default) || instances[0];

  if (!trafficInstance) {
    return { success: false, error: 'Sem instância Z-API' };
  }

  const cleanPhone = normalizePhone(telefone);
  const mensagem = MENSAGEM_CAMPANHA(nome || '');
  const sendResult = await sendText(trafficInstance, cleanPhone, mensagem);

  if (sendResult.success) {
    // Atualizar stage
    await supabase
      .from('campaign_recipients')
      .update({ stage: 'campaign_sent', campaign_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', recipientId);

    // Salvar no chat
    const subscriberId = gerarSubscriberId(cleanPhone);
    await supabase.from('manychat_mensagens').insert({
      subscriber_id: subscriberId,
      subscriber_nome: 'Isa',
      lead_id: null,
      conteudo: mensagem,
      direcao: 'saida',
      tipo: 'text',
      canal: 'whatsapp',
      metadata: {
        source: 'campaign_main_message',
        campaign_name: 'juros_abusivos_2026',
        message_id: sendResult.messageId,
        instance_name: trafficInstance.name,
      },
    });

    console.log(`[Campaign] ✅ Mensagem campanha enviada: ${nome} (${cleanPhone})`);
    return { success: true, messageId: sendResult.messageId };
  }

  return { success: false, error: sendResult.error };
}
