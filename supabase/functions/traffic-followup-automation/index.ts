const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  sendText, sendImage, sendDocument, sendAudio, sendVideo,
  sendButtonList, normalizePhone,
} from '../_shared/zapi-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// ============================================
// 3 ESTÁGIOS + NUTRIÇÃO
// ============================================
const STAGES_CONFIG: Record<string, { delay_minutes: number; label: string; next: string | null }> = {
  '15min': { delay_minutes: 15,   label: '1º Follow-up',  next: '24h'  },
  '24h':   { delay_minutes: 1440, label: '2º Follow-up',  next: '44h'  },
  '44h':   { delay_minutes: 2640, label: '3º Follow-up',  next: null   },
};

const AGENT_NAMES: Record<string, string> = {
  isa_triagem:  'Isa',
  isa_bancario: 'Melissa',
  isa_aereo:    'Jerusa',
};

function getNextStage(current: string | null): string {
  if (!current) return '15min';
  return STAGES_CONFIG[current]?.next || '';
}

function calculateNextMessageTime(stage: string): Date {
  const delay = STAGES_CONFIG[stage]?.delay_minutes || 15;
  return new Date(Date.now() + delay * 60 * 1000);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ============================================
// MENSAGEM LGPD OPT-IN (nutrição)
// ============================================
const OPTIN_MESSAGE = `Olá! 👋

Tentamos entrar em contato algumas vezes mas não conseguimos falar.

Para continuarmos te informando sobre seus *direitos jurídicos* e *novidades importantes* do escritório Bentes & Ramos, precisamos da sua autorização — conforme a *Lei Geral de Proteção de Dados (LGPD – Lei 13.709/2018)*.

📋 *Termos:* Seus dados serão usados exclusivamente para envio de conteúdo informativo. Você pode cancelar a qualquer momento respondendo *PARAR*.

Você autoriza receber nossas comunicações?`;

const OPTIN_BUTTONS = [
  { id: 'sim_nutricao', label: '✅ Sim, autorizo' },
  { id: 'nao_nutricao', label: '❌ Não, obrigado' },
];

// ============================================
// TEMPLATES FIXOS (fallback)
// ============================================
function getMessageTemplate(stage: string, nome: string): string {
  const n = nome || 'Cliente';
  switch (stage) {
    case '15min': return `${n}, vi que ainda não tivemos a chance de conversar.\n\nSe você está com alguma dúvida sobre seus direitos com o banco — empréstimo, desconto indevido, juros abusivos — estou aqui para te ajudar.\n\nÉ só me responder com "OI" que continuo seu atendimento agora mesmo. 😊`;
    case '24h':   return `Oi, ${n}! Tudo bem?\n\nJá se passou um dia e ainda não conseguimos falar. Saiba que muitos clientes descobrem valores a receber que nem sabiam que tinham — às vezes R$ 2.000, R$ 5.000 ou mais.\n\nA análise é *gratuita* e leva poucos minutos. Aproveite enquanto sua agenda está aberta com a gente. 📋`;
    case '44h':   return `${n}, essa é minha última tentativa de contato.\n\nSei que a rotina é corrida, mas não quero que você perca a chance de saber se tem dinheiro a receber do banco.\n\nSe um dia quiser retomar — é só nos chamar. Estarei por aqui. 👋`;
    default:      return '';
  }
}

// ============================================
// BUSCAR PROMPT DO AGENTE
// ============================================
async function getAgentPrompt(supabase: any, leadId: string) {
  const { data: lead } = await supabase
    .from('leads_juridicos').select('isa_agent').eq('id', leadId).single();
  const agentKey = lead?.isa_agent || 'isa_triagem';
  const agentName = AGENT_NAMES[agentKey] || 'Isa';
  const { data: prompt } = await supabase
    .from('ai_prompts').select('content').eq('name', agentKey).maybeSingle();
  if (!prompt?.content) {
    const { data: fallback } = await supabase
      .from('ai_prompts').select('content').eq('name', 'isa_system_prompt').maybeSingle();
    if (!fallback?.content) return null;
    return { content: fallback.content, agentName, agentKey };
  }
  return { content: prompt.content, agentName, agentKey };
}

// ============================================
// GERAR MENSAGEM VIA IA
// ============================================
async function gerarMensagemIA(supabase: any, lead: any, stage: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const agentData = await getAgentPrompt(supabase, lead.id);
    if (!agentData) return null;
    const { data: historico } = await supabase
      .from('manychat_mensagens').select('conteudo, direcao').eq('lead_id', lead.id)
      .order('created_at', { ascending: false }).limit(8);
    const ctx = (historico || []).reverse()
      .map((m: any) => `[${m.direcao === 'entrada' ? 'CLIENTE' : agentData.agentName.toUpperCase()}] ${m.conteudo}`)
      .join('\n');
    const tons: Record<string, string> = {
      '15min': 'Reforço gentil — cliente ainda não respondeu. Sem pressão.',
      '24h':   'Aversão à perda suave — mostre o valor, sem urgência exagerada.',
      '44h':   'Encerramento humano — tom de despedida respeitoso, deixa porta aberta.',
    };
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: agentData.content },
          { role: 'user', content: `[INSTRUÇÃO INTERNA] Follow-up estágio ${stage}.\nTom: ${tons[stage]}\nLead: ${lead.nome}\nHistórico:\n${ctx || '(primeiro contato)'}\nGere UMA mensagem de follow-up. Máx 5 linhas. Natural, não genérico. NÃO mencione "follow-up automático".` },
        ],
        max_tokens: 350, temperature: 0.75,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

// ============================================
// PROCESSAR FOLLOW-UPS PENDENTES
// ============================================
async function processFollowups(supabase: any, zapiConfig: any): Promise<any[]> {
  const now = new Date();
  const results: any[] = [];

  // Horário permitido: 8h–20h (Manaus UTC-4)
  const horaManaus = new Date(now.getTime() - 4 * 60 * 60 * 1000).getUTCHours();
  if (horaManaus < 8 || horaManaus >= 20) {
    console.log(`[Followup] ⏰ Fora do horário (${horaManaus}h). Aguardando 8h-20h.`);
    return results;
  }

  const { data: pendentes, error } = await supabase
    .from('traffic_followups')
    .select('*, lead:leads_juridicos(id, nome, telefone, status, tipo_origem, isa_agent)')
    .eq('automation_active', true)
    .not('status', 'in', '("responded","archived","nutricao")')
    .lte('next_message_at', now.toISOString())
    .order('next_message_at', { ascending: true })
    .limit(20);

  if (error) { console.error('[Followup] Query error:', error); return results; }
  console.log(`[Followup] ${pendentes?.length || 0} follow-ups pendentes`);

  for (const fu of pendentes || []) {
    try {
      const lead = fu.lead;
      if (!lead || lead.tipo_origem !== 'trafego') {
        await supabase.from('traffic_followups')
          .update({ automation_active: false, pause_reason: 'Lead inválido ou não tráfego' }).eq('id', fu.id);
        continue;
      }

      if (['Ganho', 'Perdido', 'Contrato Assinado'].includes(lead.status)) {
        await supabase.from('traffic_followups')
          .update({ automation_active: false, status: 'archived', pause_reason: `Status: ${lead.status}` }).eq('id', fu.id);
        continue;
      }

      // Lead respondeu recentemente?
      const trintaMin = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { data: recentInbound } = await supabase
        .from('manychat_mensagens').select('id').eq('lead_id', lead.id).eq('direcao', 'entrada')
        .gte('created_at', trintaMin).limit(1);
      if (recentInbound?.length) {
        await supabase.from('traffic_followups')
          .update({ status: 'responded', automation_active: false, last_inbound_at: now.toISOString() }).eq('id', fu.id);
        results.push({ lead_id: lead.id, action: 'marked_responded' });
        continue;
      }

      // ISA enviou algo recentemente? (evita duplicatas)
      const { data: recentOut } = await supabase
        .from('manychat_mensagens').select('id').eq('lead_id', lead.id).eq('direcao', 'saida')
        .gte('created_at', new Date(now.getTime() - 10 * 60 * 1000).toISOString()).limit(1);
      if (recentOut?.length) { continue; }

      const nextStage = getNextStage(fu.current_stage);

      // Sem próximo estágio → mover para nutrição
      if (!nextStage) {
        await moverParaNutricao(supabase, fu, lead, zapiConfig);
        results.push({ lead_id: lead.id, action: 'moved_to_nutricao' });
        continue;
      }

      const stageLabel = STAGES_CONFIG[nextStage]?.label || nextStage;
      const agentData = await getAgentPrompt(supabase, lead.id);
      let mensagem = await gerarMensagemIA(supabase, lead, nextStage);
      if (!mensagem) mensagem = getMessageTemplate(nextStage, lead.nome);
      if (!mensagem) continue;

      const sendResult = await sendText(zapiConfig, fu.telefone, mensagem);
      if (sendResult.success) {
        const subscriberNome = agentData ? `${agentData.agentName} (Follow-up)` : 'Isa (Follow-up)';
        await supabase.from('manychat_mensagens').insert({
          subscriber_id: fu.subscriber_id, subscriber_nome: subscriberNome,
          lead_id: lead.id, conteudo: mensagem, direcao: 'saida', tipo: 'text', canal: 'whatsapp',
          metadata: { source: 'traffic_followup', stage: nextStage, stage_label: stageLabel, agent: agentData?.agentKey || 'isa_triagem', ia_generated: !!OPENAI_API_KEY },
        });

        const subsequente = STAGES_CONFIG[nextStage]?.next;
        const stagesSent = { ...(fu.stages_sent || {}), [nextStage]: { at: now.toISOString() } };
        const proximaAt = subsequente ? calculateNextMessageTime(subsequente) : null;

        await supabase.from('traffic_followups').update({
          current_stage: nextStage,
          stages_sent: stagesSent,
          last_message_at: now.toISOString(),
          total_messages_sent: (fu.total_messages_sent || 0) + 1,
          status: 'in_progress',
          next_message_at: proximaAt?.toISOString() || null,
          automation_active: !!subsequente,
        }).eq('id', fu.id);

        results.push({ lead_id: lead.id, nome: lead.nome, stage: nextStage, success: true });
        console.log(`[Followup] ✅ ${nextStage} enviado para ${lead.nome}`);
        await sleep(7000);
      } else {
        console.error(`[Followup] ❌ Falha: ${lead.nome}`, sendResult.error);
      }
    } catch (err: any) {
      console.error('[Followup] Erro:', err.message);
    }
  }
  return results;
}

// ============================================
// MOVER PARA NUTRIÇÃO
// ============================================
async function moverParaNutricao(supabase: any, fu: any, lead: any, zapiConfig: any) {
  console.log(`[Followup] 🌱 Movendo ${lead.nome} para nutrição`);

  // Verificar se já está na lista de nutrição
  const { data: existing } = await supabase
    .from('followup_nutricao').select('id').eq('subscriber_id', fu.subscriber_id).maybeSingle();
  if (existing) {
    await supabase.from('traffic_followups')
      .update({ status: 'nutricao', automation_active: false }).eq('id', fu.id);
    return;
  }

  // Criar registro na nutrição
  await supabase.from('followup_nutricao').insert({
    subscriber_id: fu.subscriber_id,
    lead_id: lead.id,
    telefone: fu.telefone,
    status: 'pendente',
    optin_enviado_em: new Date().toISOString(),
  });

  // Arquivar follow-up
  await supabase.from('traffic_followups')
    .update({ status: 'nutricao', automation_active: false }).eq('id', fu.id);

  // Enviar mensagem opt-in com botões
  const sendResult = await sendButtonList(zapiConfig, fu.telefone, OPTIN_MESSAGE, OPTIN_BUTTONS);
  if (sendResult.success) {
    await supabase.from('manychat_mensagens').insert({
      subscriber_id: fu.subscriber_id, subscriber_nome: 'Sistema (Nutrição)',
      lead_id: lead.id, conteudo: OPTIN_MESSAGE, direcao: 'saida', tipo: 'text', canal: 'whatsapp',
      metadata: { source: 'nutricao_optin', message_id: sendResult.messageId },
    });
    console.log(`[Followup] ✅ Opt-in enviado para ${lead.nome}`);
  }
}

// ============================================
// PROCESSAR CAMPANHAS DE NUTRIÇÃO
// ============================================
async function processNutricao(supabase: any, zapiConfig: any): Promise<any[]> {
  const now = new Date();
  const results: any[] = [];

  // Horário permitido
  const horaManaus = new Date(now.getTime() - 4 * 60 * 60 * 1000).getUTCHours();
  if (horaManaus < 8 || horaManaus >= 20) return results;

  const { data: leads } = await supabase
    .from('followup_nutricao')
    .select('*, lead:leads_juridicos(id, nome, telefone)')
    .eq('status', 'aceito')
    .lte('proxima_campanha_em', now.toISOString())
    .limit(20);

  for (const nutricao of leads || []) {
    try {
      // Buscar próxima campanha na ordem
      let campanhaQuery = supabase
        .from('followup_campanhas').select('*').eq('ativo', true);

      if (nutricao.ultima_campanha_id) {
        const { data: ultima } = await supabase
          .from('followup_campanhas').select('ordem').eq('id', nutricao.ultima_campanha_id).maybeSingle();
        if (ultima) campanhaQuery = campanhaQuery.gt('ordem', ultima.ordem);
      }

      const { data: campanha } = await campanhaQuery.order('ordem', { ascending: true }).limit(1).maybeSingle();

      if (!campanha) {
        // Sem mais campanhas → parar por enquanto
        await supabase.from('followup_nutricao')
          .update({ proxima_campanha_em: null }).eq('id', nutricao.id);
        continue;
      }

      const telefone = nutricao.telefone || nutricao.lead?.telefone;
      if (!telefone) continue;

      let sendResult;
      const tipo = campanha.tipo_midia || 'text';

      if (tipo === 'image' && campanha.media_url) {
        sendResult = await sendImage(zapiConfig, telefone, campanha.media_url, campanha.legenda || campanha.mensagem || '');
      } else if (tipo === 'audio' && campanha.media_url) {
        sendResult = await sendAudio(zapiConfig, telefone, campanha.media_url);
      } else if (tipo === 'video' && campanha.media_url) {
        sendResult = await sendVideo(zapiConfig, telefone, campanha.media_url, campanha.legenda || '');
      } else if (tipo === 'document' && campanha.media_url) {
        sendResult = await sendDocument(zapiConfig, telefone, campanha.media_url, campanha.media_nome || 'documento.pdf');
      } else {
        sendResult = await sendText(zapiConfig, telefone, campanha.mensagem || '');
      }

      if (sendResult?.success) {
        const intervaloDias = campanha.intervalo_dias || 7;
        const proximaCampanha = new Date(now.getTime() + intervaloDias * 24 * 60 * 60 * 1000);

        await supabase.from('followup_nutricao').update({
          ultima_campanha_id: campanha.id,
          ultima_campanha_em: now.toISOString(),
          proxima_campanha_em: proximaCampanha.toISOString(),
          updated_at: now.toISOString(),
        }).eq('id', nutricao.id);

        if (nutricao.lead_id) {
          const conteudo = campanha.mensagem || `[${tipo}] ${campanha.titulo}`;
          await supabase.from('manychat_mensagens').insert({
            subscriber_id: nutricao.subscriber_id, subscriber_nome: 'Bentes & Ramos (Nutrição)',
            lead_id: nutricao.lead_id, conteudo, direcao: 'saida', tipo, canal: 'whatsapp',
            metadata: { source: 'nutricao_campanha', campanha_id: campanha.id, campanha_titulo: campanha.titulo },
          });
        }

        results.push({ nutricao_id: nutricao.id, campanha: campanha.titulo, success: true });
        console.log(`[Nutrição] ✅ "${campanha.titulo}" enviado para ${nutricao.lead?.nome || telefone}`);
        await sleep(5000);
      }
    } catch (err: any) {
      console.error('[Nutrição] Erro:', err.message);
    }
  }
  return results;
}

// ============================================
// INSCREVER LEAD
// ============================================
async function enrollLead(supabase: any, leadId: string, telefone: string, subscriberId?: string) {
  const { data: lead } = await supabase
    .from('leads_juridicos').select('id, nome, tipo_origem, status').eq('id', leadId).single();
  if (!lead) return { success: false, error: 'Lead not found' };
  if (lead.tipo_origem !== 'trafego') return { success: false, error: 'Não é lead de tráfego' };

  const { data: existing } = await supabase
    .from('traffic_followups').select('id').eq('lead_id', leadId).maybeSingle();
  if (existing) return { success: false, message: 'Já inscrito', existing };

  const normalizedPhone = normalizePhone(telefone);
  const { data, error } = await supabase.from('traffic_followups').insert({
    lead_id: leadId,
    subscriber_id: subscriberId || `zapi_${normalizedPhone}`,
    telefone: normalizedPhone,
    status: 'new',
    automation_active: true,
    current_stage: null,
    next_message_at: calculateNextMessageTime('15min').toISOString(),
  }).select().single();

  if (error) return { success: false, error: error.message };
  return { success: true, followup: data };
}

// ============================================
// BACKFILL: LEEDS ANTIGOS
// ============================================
async function backfillLeads(supabase: any) {
  const { data: leads, error } = await supabase
    .from('leads_juridicos').select('id, nome, telefone, tipo_origem, created_at, status')
    .eq('tipo_origem', 'trafego').not('telefone', 'is', null)
    .not('status', 'in', '("Ganho","Perdido","Contrato Assinado")');

  if (error) return { success: false, error: error.message };
  const enrolled: any[] = [], skipped: any[] = [];

  for (const lead of leads || []) {
    const { data: existing } = await supabase
      .from('traffic_followups').select('id').eq('lead_id', lead.id).maybeSingle();
    if (existing) { skipped.push({ id: lead.id, reason: 'already_enrolled' }); continue; }

    const minutesSince = (Date.now() - new Date(lead.created_at).getTime()) / 60000;
    let currentStage: string | null = null;
    let nextStage: string | null = '15min';
    let status = 'new';

    if (minutesSince >= 2640) {
      // Mais de 44h → ir direto para nutrição
      const normalizedPhone = normalizePhone(lead.telefone);
      const sid = `zapi_${normalizedPhone}`;
      const { data: nutExisting } = await supabase
        .from('followup_nutricao').select('id').eq('subscriber_id', sid).maybeSingle();
      if (!nutExisting) {
        await supabase.from('followup_nutricao').insert({
          subscriber_id: sid, lead_id: lead.id, telefone: normalizedPhone,
          status: 'pendente', optin_enviado_em: new Date().toISOString(),
        });
      }
      await supabase.from('traffic_followups').insert({
        lead_id: lead.id, subscriber_id: sid, telefone: normalizedPhone,
        status: 'nutricao', automation_active: false, current_stage: '44h',
        stages_sent: { '15min': { simulated: true }, '24h': { simulated: true }, '44h': { simulated: true } },
      });
      enrolled.push({ id: lead.id, stage: 'nutricao' });
      continue;
    } else if (minutesSince >= 1440) { currentStage = '24h'; nextStage = '44h'; status = 'in_progress'; }
    else if (minutesSince >= 15)     { currentStage = '15min'; nextStage = '24h'; status = 'in_progress'; }

    const normalizedPhone = normalizePhone(lead.telefone);
    const proximaAt = nextStage ? calculateNextMessageTime(nextStage) : null;

    await supabase.from('traffic_followups').insert({
      lead_id: lead.id, subscriber_id: `zapi_${normalizedPhone}`, telefone: normalizedPhone,
      status, automation_active: !!nextStage, current_stage: currentStage,
      next_message_at: proximaAt?.toISOString() || null,
      stages_sent: currentStage ? { [currentStage]: { simulated: true } } : {},
    });
    enrolled.push({ id: lead.id, stage: currentStage || 'novo' });
  }

  return { success: true, enrolled: enrolled.length, skipped: skipped.length };
}

// ============================================
// MAIN SERVE
// ============================================
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'process';
    console.log('[Followup] Action:', action);

    // Instância de tráfego
    const { data: instances } = await supabase
      .from('zapi_instances').select('*').eq('is_active', true).order('is_default', { ascending: true });
    const trafegoInstance = instances?.find((i: any) => !i.is_default) || instances?.[0];
    if (!trafegoInstance) {
      return new Response(JSON.stringify({ error: 'Z-API não configurada' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const zapiConfig = {
      instance_id: trafegoInstance.instance_id, token: trafegoInstance.token,
      client_token: trafegoInstance.client_token, name: trafegoInstance.name,
    };

    switch (action) {
      case 'enroll': {
        const { lead_id, telefone, subscriber_id } = body;
        const result = await enrollLead(supabase, lead_id, telefone, subscriber_id);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      case 'backfill': {
        const result = await backfillLeads(supabase);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      default: {
        const followupResults = await processFollowups(supabase, zapiConfig);
        const nutricaoResults = await processNutricao(supabase, zapiConfig);
        return new Response(
          JSON.stringify({ success: true, followups: followupResults.length, nutricao: nutricaoResults.length }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }
  } catch (err: any) {
    console.error('[Followup] Erro:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
