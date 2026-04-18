const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";
import { getZapiConfig, sendText, sendImage, normalizePhone } from '../_shared/zapi-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// ============================================
// CONFIGURAÇÃO DOS 11 ESTÁGIOS
// ============================================
const STAGES_CONFIG = {
  '3min':  { delay_minutes: 3,     label: 'Triagem Rápida',   next: '15min' },
  '15min': { delay_minutes: 15,    label: 'Reforço Triagem',  next: '10min' },
  '10min': { delay_minutes: 10,    label: 'Quebra de Padrão', next: '3h'   },
  '3h':    { delay_minutes: 180,   label: 'Aversão à Perda',  next: '8h'   },
  '8h':    { delay_minutes: 480,   label: 'Escassez',         next: '24h'  },
  '24h':   { delay_minutes: 1440,  label: 'Ultimato Lógico',  next: '34h'  },
  '34h':   { delay_minutes: 2040,  label: 'Prova Social',     next: '42h'  },
  '42h':   { delay_minutes: 2520,  label: 'Último Lembrete',  next: '72h'  },
  '72h':   { delay_minutes: 4320,  label: 'Última Chance',    next: '6d'   },
  '6d':    { delay_minutes: 8640,  label: 'Reflexão',         next: '7d'   },
  '7d':    { delay_minutes: 10080, label: 'Arquivamento',     next: null   },
};

const PROVA_SOCIAL_IMAGE_URL = 'https://bentesramoscrma.lovable.app/images/prova-social-bradesco.jpg';
const DELAY_BETWEEN_MESSAGES = 7 * 60 * 1000; // 7 minutos entre mensagens

// ============================================
// AGENT LABELS
// ============================================
const AGENT_NAMES: Record<string, string> = {
  isa_triagem:  'Isa',
  isa_bancario: 'Melissa',
  isa_aereo:    'Jerusa',
};

// ============================================
// BUSCAR PROMPT DO AGENTE ATIVO DO LEAD
// ============================================
async function getAgentPrompt(supabase: any, leadId: string): Promise<{ content: string; agentName: string; agentKey: string } | null> {
  const { data: lead } = await supabase
    .from('leads_juridicos')
    .select('isa_agent')
    .eq('id', leadId)
    .single();

  const agentKey = lead?.isa_agent || 'isa_triagem';
  const agentName = AGENT_NAMES[agentKey] || 'Isa';

  const { data: prompt } = await supabase
    .from('ai_prompts')
    .select('content')
    .eq('name', agentKey)
    .maybeSingle();

  if (!prompt?.content) {
    // Fallback para prompt geral
    const { data: fallback } = await supabase
      .from('ai_prompts')
      .select('content')
      .eq('name', 'isa_system_prompt')
      .maybeSingle();
    if (!fallback?.content) return null;
    return { content: fallback.content, agentName, agentKey };
  }

  return { content: prompt.content, agentName, agentKey };
}

// ============================================
// GERAR MENSAGEM DE FOLLOW-UP VIA IA
// ============================================
async function gerarMensagemFollowup(
  supabase: any,
  lead: any,
  followup: any,
  stage: string,
  stageLabel: string
): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;

  try {
    const agentData = await getAgentPrompt(supabase, lead.id);
    if (!agentData) return null;

    // Buscar últimas mensagens para contexto
    const { data: historico } = await supabase
      .from('manychat_mensagens')
      .select('conteudo, direcao, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const historicoFormatado = (historico || [])
      .reverse()
      .map((m: any) => `[${m.direcao === 'entrada' ? 'CLIENTE' : agentData.agentName.toUpperCase()}] ${m.conteudo}`)
      .join('\n');

    // Definir tom por estágio
    const tomPorEstagio: Record<string, string> = {
      '3min':  'Triagem inicial — apresente as opções do menu de forma amigável',
      '15min': 'Reforço gentil — cliente ainda não respondeu ao menu',
      '10min': 'Direto e provocador — lembre que cada dia é dinheiro perdido para o banco',
      '3h':    'Aversão à perda — o banco lucra com a inércia do cliente',
      '8h':    'Escassez — agenda quase fechada para hoje',
      '24h':   'Ultimato lógico — vai arquivar o caso?',
      '34h':   'Prova social — outro cliente acabou de ganhar R$8.000',
      '42h':   'Penúltima tentativa — tom humano e direto',
      '72h':   'Última chance — tom de encerramento',
      '6d':    'Reengajamento suave — tom gentil, sem pressão',
      '7d':    'Encerramento — tom respeitoso de despedida',
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: agentData.content },
          {
            role: 'user',
            content: `[INSTRUÇÃO INTERNA — NÃO MOSTRAR AO CLIENTE]
Você é ${agentData.agentName}, do escritório Bentes & Ramos.
Esta é uma mensagem de FOLLOW-UP automático — estágio: ${stageLabel}.

Tom para este estágio: ${tomPorEstagio[stage] || 'Profissional e direto'}

Lead: ${lead.nome || 'Cliente'}
Status atual: ${lead.status || 'Lead Frio'}

Histórico recente da conversa:
${historicoFormatado || '(Sem histórico — primeiro contato)'}

Gere UMA mensagem de follow-up no estilo ${agentData.agentName} para este estágio.
Máximo 5 linhas. Seja natural, não genérico.
NÃO mencione que é um follow-up automático.
NÃO use placeholders como [Nome].
Use o nome "${lead.nome || 'Cliente'}" diretamente.`,
          }
        ],
        max_tokens: 400,
        temperature: 0.75,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;

  } catch (err) {
    console.error('[Traffic Followup] Erro ao gerar mensagem IA:', err);
    return null;
  }
}

// ============================================
// TEMPLATE FIXO (fallback quando IA falha)
// ============================================
function getMessageTemplate(stage: string, leadNome: string): { text: string; image?: string } {
  const nome = leadNome || 'Cliente';

  switch (stage) {
    case '3min':
      return {
        text: `Olá, aqui é a Isa do Bentes & Ramos Advogados. Recebi seu contato e para direcionar seu atendimento para o especialista correto agora mesmo, me diga:

Qual dessas situações mais se aproxima do seu caso?

1️⃣ Empréstimo consignado ou pessoal 
2️⃣ Descontos indevidos no benefício ou salário 
3️⃣ Seguro prestamista ou proteção financeira no empréstimo 
4️⃣ Cartão de crédito consignado (RMC/RCC) 
5️⃣ Juros abusivos 
6️⃣ Tarifa bancária indevida 
7️⃣ Outro problema bancário

(Digite apenas o número)`
      };
    case '15min':
      return { text: `${nome}, vi que você ainda não escolheu a opção. Sem problemas!\n\nSe estiver na dúvida, digite *7* que eu te ajudo a identificar seu caso.\n\n⏰ Não deixe para depois - em casos bancários, cada dia que passa é dinheiro que você pode estar perdendo para o banco.` };
    case '10min':
      return { text: `Oi, ${nome}. Vi que você clicou no nosso anúncio sobre os juros abusivos, mas não concluiu.\n\nDeixa eu ser direta: o banco aposta que você vai ter preguiça de correr atrás dos seus direitos. É assim que eles lucram bilhões.\n\nEstou com a calculadora aberta aqui. Me manda o contrato agora ou diz 'OI' para eu te falar quanto você pode recuperar.` };
    case '3h':
      return { text: `Ainda por aqui? Só para te lembrar: esse dinheiro que o banco te cobrou indevidamente não rende na sua conta, rende na deles.\n\nA análise é gratuita e rápida. Você realmente prefere deixar esse valor para o banco do que colocar no seu bolso? Estou aguardando.` };
    case '8h':
      return { text: `${nome}, estou fechando a agenda de análises de hoje.\n\nMuita gente descobre que tem R$ 2.000, R$ 5.000 para receber e nem sabia. Você vai dormir hoje com essa dúvida?\n\nMe manda o 'ok' aqui que eu priorizo seu atendimento amanhã cedo.` };
    case '24h':
      return { text: `Já se passaram 24h. Se fosse o banco te cobrando, eles já teriam te ligado 10 vezes, certo?\n\nVamos dar andamento ou vou arquivar seu caso como 'cliente que aceita pagar juros abusivos'?` };
    case '34h':
      return { text: `Acabei de analisar o caso de outro cliente aqui. Olha o que o juiz decidiu:\n\n🏦 *Banco condenado a pagar R$ 8.000,00 por cobrança indevida.*\n\nIsso poderia ser você. Mas só se você me responder.\n\nMe manda seu contrato ou diz 'QUERO' que eu analiso seu caso agora.`, image: PROVA_SOCIAL_IMAGE_URL };
    case '42h':
      return { text: `${nome}, essa é a minha penúltima tentativa de te ajudar.\n\nVocê clicou no anúncio porque queria saber se tem dinheiro a receber. Eu estou aqui, de graça, te oferecendo exatamente isso.\n\nÉ só me responder. Não deixe o banco ganhar de novo.` };
    case '72h':
      return { text: `Última chance, ${nome}.\n\nDepois dessa mensagem, vou arquivar seu contato e focar em quem realmente quer resolver o problema com o banco.\n\nSe você ainda tem interesse, responde agora.` };
    case '6d':
      return { text: `Oi ${nome}! Passou um tempinho...\n\nSei que a rotina é corrida, mas pensei em você hoje. Aquele assunto dos juros abusivos ainda está aí.\n\nSe surgiu alguma dúvida ou se quiser retomar, é só me chamar. Tô por aqui! 😉` };
    case '7d':
      return { text: `${nome}, estou encerrando seu atendimento por falta de retorno.\n\nSe um dia quiser revisitar o assunto, é só me chamar novamente.\n\nCuide-se! 👋` };
    default:
      return { text: '' };
  }
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================
function getNextStage(currentStage: string | null): string {
  if (!currentStage) return '3min';
  const config = STAGES_CONFIG[currentStage as keyof typeof STAGES_CONFIG];
  return config?.next || '';
}

function getDelayForStage(stage: string): number {
  return STAGES_CONFIG[stage as keyof typeof STAGES_CONFIG]?.delay_minutes || 0;
}

function calculateNextMessageTime(stage: string): Date {
  const delayMinutes = getDelayForStage(stage);
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// MAIN SERVE
// ============================================
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'process';

    console.log('[Traffic Followup] Action:', action);

    // REGRA ESTRITA: usar instância de tráfego
    const { data: allInstances } = await supabase
      .from('zapi_instances')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: true });

    const trafegoInstance = allInstances?.find((i: any) => !i.is_default) || allInstances?.[0];
    if (!trafegoInstance) {
      return new Response(JSON.stringify({ error: 'Z-API not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const zapiConfig = {
      instance_id: trafegoInstance.instance_id,
      token: trafegoInstance.token,
      client_token: trafegoInstance.client_token,
      name: trafegoInstance.name,
      phone_number: trafegoInstance.phone_number,
    };

    console.log(`[Traffic Followup] 📱 Instância: ${zapiConfig.name}`);

    switch (action) {
      case 'enroll': {
        const { lead_id, telefone, subscriber_id } = body;
        if (!lead_id || !telefone) {
          return new Response(JSON.stringify({ error: 'Missing lead_id or telefone' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const result = await enrollLead(supabase, lead_id, telefone, subscriber_id);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'mark_responded': {
        const { lead_id } = body;
        const result = await markAsResponded(supabase, lead_id);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'backfill': {
        const result = await backfillTrafficLeads(supabase);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'process':
      default: {
        const results = await processFollowups(supabase, zapiConfig);
        return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
  } catch (error: any) {
    console.error('[Traffic Followup] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ============================================
// INSCREVER LEAD NO FOLLOW-UP
// ============================================
async function enrollLead(supabase: any, leadId: string, telefone: string, subscriberId?: string): Promise<any> {
  const { data: lead } = await supabase
    .from('leads_juridicos')
    .select('id, nome, tipo_origem, status')
    .eq('id', leadId)
    .single();

  if (!lead) return { success: false, error: 'Lead not found' };
  if (lead.tipo_origem !== 'trafego') return { success: false, error: 'Lead não é de tráfego' };

  const { data: existing } = await supabase
    .from('traffic_followups')
    .select('id, status')
    .eq('lead_id', leadId)
    .maybeSingle();

  if (existing) return { success: false, message: 'Lead already enrolled', existing };

  const normalizedPhone = normalizePhone(telefone);
  const firstStage = '10min';
  const nextMessageAt = calculateNextMessageTime(firstStage);

  const { data, error } = await supabase
    .from('traffic_followups')
    .insert({
      lead_id: leadId,
      subscriber_id: subscriberId || `zapi_${normalizedPhone}`,
      telefone: normalizedPhone,
      status: 'new',
      automation_active: true,
      current_stage: null,
      next_message_at: nextMessageAt.toISOString(),
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, followup: data };
}

// ============================================
// MARCAR COMO RESPONDIDO
// ============================================
async function markAsResponded(supabase: any, leadId: string): Promise<any> {
  const { error } = await supabase
    .from('traffic_followups')
    .update({
      status: 'responded',
      automation_active: false,
      last_inbound_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('lead_id', leadId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ============================================
// BACKFILL
// ============================================
async function backfillTrafficLeads(supabase: any): Promise<any> {
  const { data: trafficLeads, error } = await supabase
    .from('leads_juridicos')
    .select('id, nome, telefone, tipo_origem, created_at, status')
    .eq('tipo_origem', 'trafego')
    .not('telefone', 'is', null)
    .not('status', 'in', '("Ganho","Perdido","Contrato Assinado")');

  if (error) return { success: false, error: error.message };

  const enrolled: any[] = [];
  const skipped: any[] = [];

  for (const lead of trafficLeads || []) {
    const { data: existing } = await supabase
      .from('traffic_followups')
      .select('id')
      .eq('lead_id', lead.id)
      .maybeSingle();

    if (existing) { skipped.push({ id: lead.id, nome: lead.nome, reason: 'already_enrolled' }); continue; }

    const createdAt = new Date(lead.created_at);
    const now = new Date();
    const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    let currentStage: string | null = null;
    let nextStage = '3min';

    if (minutesSinceCreation >= 10080) { currentStage = '7d'; nextStage = ''; }
    else if (minutesSinceCreation >= 8640) { currentStage = '6d'; nextStage = '7d'; }
    else if (minutesSinceCreation >= 4320) { currentStage = '72h'; nextStage = '6d'; }
    else if (minutesSinceCreation >= 2520) { currentStage = '42h'; nextStage = '72h'; }
    else if (minutesSinceCreation >= 2040) { currentStage = '34h'; nextStage = '42h'; }
    else if (minutesSinceCreation >= 1440) { currentStage = '24h'; nextStage = '34h'; }
    else if (minutesSinceCreation >= 480)  { currentStage = '8h';  nextStage = '24h'; }
    else if (minutesSinceCreation >= 180)  { currentStage = '3h';  nextStage = '8h'; }
    else if (minutesSinceCreation >= 25)   { currentStage = '10min'; nextStage = '3h'; }
    else if (minutesSinceCreation >= 18)   { currentStage = '15min'; nextStage = '10min'; }
    else if (minutesSinceCreation >= 3)    { currentStage = '3min';  nextStage = '15min'; }

    const status = currentStage === '7d' ? 'archived' : 'in_progress';
    const automationActive = status !== 'archived' && nextStage !== '';
    const nextMessageAt = automationActive && nextStage ? calculateNextMessageTime(nextStage) : null;

    const { data, error: insertError } = await supabase
      .from('traffic_followups')
      .insert({
        lead_id: lead.id,
        subscriber_id: `zapi_${normalizePhone(lead.telefone)}`,
        telefone: normalizePhone(lead.telefone),
        status,
        automation_active: automationActive,
        current_stage: currentStage,
        next_message_at: nextMessageAt?.toISOString(),
        stages_sent: currentStage ? { [currentStage]: { simulated: true, at: now.toISOString() } } : {},
      })
      .select()
      .single();

    if (insertError) { skipped.push({ id: lead.id, nome: lead.nome, reason: insertError.message }); }
    else { enrolled.push({ id: lead.id, nome: lead.nome, currentStage, nextStage }); }
  }

  return { success: true, enrolled: enrolled.length, skipped: skipped.length, details: { enrolled, skipped } };
}

// ============================================
// PROCESSAR FOLLOW-UPS PENDENTES
// ============================================
async function processFollowups(supabase: any, zapiConfig: any): Promise<any[]> {
  const now = new Date();
  const results: any[] = [];

  // ── Verificação de horário permitido ─────────────────────────────────────────
  // Disparos apenas entre 8h e 20h (horário de Manaus, UTC-4)
  const horaManaus = new Date(now.getTime() - 4 * 60 * 60 * 1000).getUTCHours();
  if (horaManaus < 8 || horaManaus >= 20) {
    console.log(`[Traffic Followup] ⏰ Fora do horário permitido (${horaManaus}h Manaus). Aguardando 8h-20h.`);
    return results;
  }

  // ── Disparos começam a partir de amanhã ──────────────────────────────────────
  const amanha = new Date(now);
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(0, 0, 0, 0);
  // Remova este bloco após a data de início (18/04/2026)
  const dataInicio = new Date('2026-04-18T08:00:00-04:00');
  if (now < dataInicio) {
    console.log(`[Traffic Followup] ⏳ Disparos iniciam em ${dataInicio.toISOString()}. Aguardando...`);
    return results;
  }

  const { data: pendingFollowups, error } = await supabase
    .from('traffic_followups')
    .select(`*, lead:leads_juridicos(id, nome, telefone, status, tipo_origem, isa_agent)`)
    .eq('automation_active', true)
    .not('status', 'in', '("responded","archived")')
    .lte('next_message_at', now.toISOString())
    .order('next_message_at', { ascending: true })
    .limit(20);

  if (error) { console.error('[Traffic Followup] Query error:', error); return results; }

  console.log(`[Traffic Followup] ${pendingFollowups?.length || 0} follow-ups pendentes`);

  for (const followup of pendingFollowups || []) {
    try {
      const lead = followup.lead;
      if (!lead) {
        await supabase.from('traffic_followups').update({ automation_active: false, pause_reason: 'Lead not found' }).eq('id', followup.id);
        continue;
      }

      if (lead.tipo_origem !== 'trafego') {
        await supabase.from('traffic_followups').update({ automation_active: false, pause_reason: 'Lead não é tráfego' }).eq('id', followup.id);
        continue;
      }

      const blockedStatuses = ['Ganho', 'Perdido', 'Contrato Assinado'];
      if (blockedStatuses.includes(lead.status)) {
        await supabase.from('traffic_followups').update({ automation_active: false, status: 'archived', pause_reason: `Status: ${lead.status}` }).eq('id', followup.id);
        continue;
      }

      // Verificar resposta recente
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { data: recentMsgs } = await supabase
        .from('manychat_mensagens')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('direcao', 'entrada')
        .gte('created_at', thirtyMinAgo)
        .limit(1);

      if (recentMsgs && recentMsgs.length > 0) {
        await markAsResponded(supabase, lead.id);
        results.push({ lead_id: lead.id, nome: lead.nome, action: 'marked_responded' });
        continue;
      }

      // Verificar se ISA já respondeu recentemente (evitar duplo disparo)
      const { data: recentIsa } = await supabase
        .from('manychat_mensagens')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('direcao', 'saida')
        .gte('created_at', new Date(now.getTime() - 10 * 60 * 1000).toISOString())
        .limit(1);

      if (recentIsa && recentIsa.length > 0) {
        console.log(`[Traffic Followup] ⏭️ ISA respondeu recentemente para ${lead.nome}, pulando`);
        continue;
      }

      const nextStage = getNextStage(followup.current_stage);
      if (!nextStage) {
        await supabase.from('traffic_followups').update({ status: 'archived', automation_active: false }).eq('id', followup.id);
        continue;
      }

      const stageLabel = STAGES_CONFIG[nextStage as keyof typeof STAGES_CONFIG]?.label || nextStage;

      // ── TENTATIVA IA PRIMEIRO ──────────────────────────────────────────────
      let mensagemFinal: string | null = null;
      const agentData = await getAgentPrompt(supabase, lead.id);

      if (agentData && OPENAI_API_KEY) {
        console.log(`[Traffic Followup] 🤖 Gerando mensagem IA (${agentData.agentName}) para ${lead.nome} — ${nextStage}`);
        mensagemFinal = await gerarMensagemFollowup(supabase, lead, followup, nextStage, stageLabel);
      }

      // ── FALLBACK: template fixo ────────────────────────────────────────────
      const template = getMessageTemplate(nextStage, lead.nome);
      if (!mensagemFinal) {
        console.log(`[Traffic Followup] 📝 Usando template fixo para ${nextStage}`);
        mensagemFinal = template.text;
      }

      if (!mensagemFinal) {
        console.error(`[Traffic Followup] Sem mensagem para estágio ${nextStage}`);
        continue;
      }

      console.log(`[Traffic Followup] Enviando ${nextStage} para ${lead.nome}`);

      // Enviar imagem se estágio 34h
      if (template.image) {
        const imageResult = await sendImage(zapiConfig, followup.telefone, template.image, '');
        console.log(`[Traffic Followup] Imagem enviada:`, imageResult.success);
        await sleep(2000);
      }

      // Enviar mensagem
      const sendResult = await sendText(zapiConfig, followup.telefone, mensagemFinal);

      if (sendResult.success) {
        const subscriberNome = agentData ? `${agentData.agentName} (Follow-up)` : 'Isa (Follow-up)';

        await supabase.from('manychat_mensagens').insert({
          subscriber_id: followup.subscriber_id,
          subscriber_nome: subscriberNome,
          lead_id: lead.id,
          conteudo: mensagemFinal,
          direcao: 'saida',
          tipo: 'text',
          canal: 'whatsapp',
          metadata: {
            source: 'traffic_followup',
            stage: nextStage,
            stage_label: stageLabel,
            agent: agentData?.agentKey || 'isa_triagem',
            agent_name: agentData?.agentName || 'Isa',
            ia_generated: !!mensagemFinal && mensagemFinal !== template.text,
            message_id: sendResult.messageId,
          },
        });

        const stagesSent = { ...(followup.stages_sent || {}), [nextStage]: { at: now.toISOString(), agent: agentData?.agentKey } };
        const subsequentStage = getNextStage(nextStage);
        const nextMessageAt = subsequentStage ? calculateNextMessageTime(subsequentStage) : null;

        await supabase.from('traffic_followups').update({
          current_stage: nextStage,
          stages_sent: stagesSent,
          last_message_at: now.toISOString(),
          total_messages_sent: (followup.total_messages_sent || 0) + 1,
          status: 'in_progress',
          next_message_at: nextMessageAt?.toISOString(),
          automation_active: !!subsequentStage,
        }).eq('id', followup.id);

        await supabase.from('interacoes').insert({
          cliente_id: lead.id,
          tipo: 'WhatsApp',
          direcao: 'Saída',
          resumo: `Follow-up ${stageLabel} — ${agentData?.agentName || 'Isa'}`,
          detalhes: mensagemFinal.substring(0, 300),
        });

        results.push({ lead_id: lead.id, nome: lead.nome, stage: nextStage, agent: agentData?.agentName, ia_generated: true, success: true });
        console.log(`[Traffic Followup] ✅ ${nextStage} enviado para ${lead.nome} por ${agentData?.agentName || 'Isa'}`);

        await sleep(DELAY_BETWEEN_MESSAGES);
      } else {
        console.error(`[Traffic Followup] ❌ Falha ao enviar para ${lead.nome}:`, sendResult.error);
        results.push({ lead_id: lead.id, nome: lead.nome, stage: nextStage, success: false, error: sendResult.error });
      }

    } catch (err: any) {
      console.error(`[Traffic Followup] Erro:`, err);
    }
  }

  return results;
}
