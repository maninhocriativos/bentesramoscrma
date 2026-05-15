// xhr polyfill removed — using native fetch
const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";
import { 
  DIAS_PERMITIDOS, 
  HORARIOS_DISPONIVEIS, 
  NOMES_DIAS,
  formatarData,
  formatarDataCurta,
  getProximaSegundaUtc,
  validarAgendamento
} from '../_shared/timezone-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const ACAO_LABELS: Record<string, string> = {
  'criar_tarefa': 'Criar Tarefa',
  'criar_compromisso': 'Agendar Compromisso',
  'atualizar_status_lead': 'Atualizar Status do Lead',
  'enviar_contrato': 'Enviar Contrato',
};

const URGENCIA_CORES: Record<string, string> = {
  'baixa': '#22c55e',
  'media': '#eab308',
  'alta': '#f97316',
  'urgente': '#ef4444',
};

// ============================================================
// ALTERAÇÃO 1: 'transicionar_agente' adicionado em ACOES_AUTOMATICAS
// ============================================================
const ACOES_AUTOMATICAS = [
  'classificar_lead',
  'criar_interacao', 
  'atualizar_resumo_lead',
  'buscar_lead',
  'buscar_historico',
  'atualizar_dados_lead',
  'verificar_agenda',
  'solicitar_agendamento',
  'confirmar_agendamento',
  'agendar_direto',
  'verificar_followup',
  'executar_followup',
  'pausar_followup',
  'retomar_followup',
  'analisar_documentos_conversa',
  'transicionar_estado',
  'classificar_caso',
  'salvar_dados_contrato',
  'marcar_doc_recebido',
  'verificar_docs_pendentes',
  'consultar_processo',
  'transicionar_agente', // ← NOVO: roteamento entre agentes
  'direcionar_atendimento_humano',
  'agendar_lembrete', // ← lembrete contextual agendado
  'enviar_video_inss', // ← vídeo INSS com botões para aposentados/pensionistas
];

const ACOES_CONFIRMACAO = [
  'criar_tarefa',
  'criar_compromisso',
  'atualizar_status_lead',
  'enviar_contrato',
  'enviar_para_advogado',
];

const STATUS_PERMITE_FAST = ['Lead Frio'];
const STATUS_PERMITE_SLOW = ['Lead Frio', 'Em Atendimento', 'Em Negociação', 'Aguardando Contrato'];
const STATUS_BLOQUEADOS = ['Contrato Assinado', 'Ganho', 'Contrato Fechado'];

const LEAD_STATES = {
  NEW: 'NEW',
  TRIAGE: 'TRIAGE',
  CLASSIFIED: 'CLASSIFIED',
  DATA_CAPTURE: 'DATA_CAPTURE',
  CONTRACT_SENT: 'CONTRACT_SENT',
  CONTRACT_SIGNED: 'CONTRACT_SIGNED',
  DOCS_PENDING: 'DOCS_PENDING',
  READY_FOR_LAWYER: 'READY_FOR_LAWYER',
};

const ESTADOS_BLOQUEADOS = ['CONTRACT_SIGNED', 'READY_FOR_LAWYER'];

const RESPONSE_INTELLIGENCE_GUIDE = `
INTELIGENCIA OPERACIONAL PARA Z-API - LEADS DE TRAFEGO:
- Estes agentes respondem somente leads de trafego atendidos pela linha Z-API de trafego. Nao trate contatos do escritorio como automacao.
- Antes de responder, leia MEMORIA OPERACIONAL, CONTEXTO DO LEAD, ESTADO ATUAL, DOCUMENTOS e HISTORICO. A resposta deve partir do que ja aconteceu.
- Nao peca novamente informacao ou documento que ja foi enviado, confirmado no historico ou marcado como recebido.
- Se o cliente enviou contrato, extrato, comprovante, audio, imagem ou PDF, reconheca o recebimento e avance para o proximo dado/documento pendente.
- Escolha um unico objetivo por mensagem: confirmar recebimento, pedir o proximo documento, esclarecer o problema, agendar lembrete/follow-up ou transferir.
- Faca no maximo UMA pergunta objetiva por mensagem. Priorize o dado que destrava a analise.
- Nao invente fatos, agenda, status, valores, documentos recebidos ou probabilidade de exito.
- Nunca prometa resultado, nunca diga que algo e ilegal com certeza e nunca de parecer juridico. Use linguagem segura e condicional.
- Se o cliente pedir humano, demonstrar irritacao, perguntar honorarios especificos, trouxer tema fora de Bancario/Aereo ou houver incerteza relevante, use direcionar_atendimento_humano.
- Tom: humano, profissional e firme. Evite emojis, brincadeiras, excesso de entusiasmo e jargoes juridicos. Use tratamento respeitoso quando o nome permitir.
- Para WhatsApp, responda em 2 a 4 linhas, com autoridade e proximo passo claro.
- Quando sugerir acoes, use apenas as acoes disponiveis e preencha lead_id implicitamente; nao crie campos que nao existem no contrato JSON.
`;

function parseAiJson(content: string): any {
  const raw = (content || '').trim();
  try {
    return JSON.parse(raw);
  } catch (_) {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    if (fenced) return JSON.parse(fenced);
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('Resposta da IA nao esta em JSON valido');
  }
}

type DocumentoResumo = {
  pendentes: string[];
  recebidos: string[];
  pendentesCriticos: string[];
};

function formatarLista(items: string[]): string {
  return items.length > 0 ? items.join(', ') : 'Nenhum';
}

function resumirDocumentos(docsChecklist: any[]): DocumentoResumo {
  const recebidos = (docsChecklist || [])
    .filter((d: any) => d.received)
    .map((d: any) => d.doc_label || d.doc_type)
    .filter(Boolean);

  const pendentes = (docsChecklist || [])
    .filter((d: any) => d.is_required && !d.received)
    .map((d: any) => d.doc_label || d.doc_type)
    .filter(Boolean);

  const pendentesCriticos = pendentes.filter((doc: string) => {
    const normalized = doc.toLowerCase();
    return normalized.includes('contrato') ||
      normalized.includes('extrato') ||
      normalized.includes('comprovante') ||
      normalized.includes('rg') ||
      normalized.includes('cnh') ||
      normalized.includes('documento');
  });

  return { pendentes, recebidos, pendentesCriticos };
}

function inferirDocumentosDaMensagem(mensagem: string, tipoMensagem?: string, mediaUrl?: string): string[] {
  const docs: string[] = [];
  // Imagens: NÃO inferir por keyword — a IA usa visão para identificar o documento
  // PDFs/documentos: provavelmente contrato ou extrato (a IA confirma pelo conteúdo extraído)
  if (tipoMensagem === 'document' || (mediaUrl || '').toLowerCase().includes('.pdf')) {
    docs.push('contrato_ou_extrato');
  }
  return docs;
}
const FAST_CONFIG = {
  stage_1: { delay_minutos: 10, titulo: "Follow-up FAST 1 - 10 min" },
  stage_2: { delay_minutos: 240, titulo: "Follow-up FAST 2 - 4h" },
  stage_3: { delay_minutos: 900, titulo: "Follow-up FAST 3 - 15h" }
};

const SLOW_CONFIG = {
  stage_1: { delay_minutos: 4320, titulo: "Reativação 1 - 3 dias (check-in gentil)" },
  stage_2: { delay_minutos: 10080, titulo: "Reativação 2 - 7 dias (reforço de valor)" },
  stage_3: { delay_minutos: 21600, titulo: "Reativação 3 - 15 dias (última mensagem calorosa)" }
};

// ─── Endereço físico do escritório ────────────────────────────────────────────
const ENDERECO_FISICO = 'Ed. Vieiralves Business Center - Sala 708\nR. Salvador, 120, Adrianópolis, Manaus - AM 😊';

// ─── Nomes e intros dos agentes especialistas ──────────────────────────────────
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  'isa_triagem':  'Isa',
  'isa_bancario': 'Melissa',
  'isa_aereo':    'Jerusa',
  'humano':       'Atendente',
};

// Mensagem curta de Isa anunciando a transferência (sem se reapresentar)
const AGENT_HANDOFFS: Record<string, string> = {
  'isa_bancario': 'Entendi. Vou direcionar seu atendimento para a Melissa, nossa especialista em demandas bancarias. Ela dara continuidade a analise a partir do que voce ja enviou.',
  'isa_aereo':    'Entendi. Vou direcionar seu atendimento para a Jerusa, nossa especialista em demandas aereas. Ela dara continuidade a partir das informacoes ja enviadas.',
};

const AGENT_INTROS: Record<string, string> = {
  'isa_bancario': 'Olá! 😊 Sou a *Melissa*, especialista em Direito Bancário do escritório Bentes & Ramos!\n\nVi que você está com um problema com banco ou instituição financeira. Esses casos geralmente têm ótimo resultado e podemos te ajudar!\n\nPara analisar seu caso, preciso de alguns documentos básicos:\n\n📎 *1. RG ou CNH*\n📎 *2. CPF*\n📎 *3. Contrato ou extrato do banco/financeira*\n📎 *4. Comprovante do problema* (cobrança indevida, negativação, etc.)\n\nPode ir me enviando um por um? Começa pelo que tiver mais fácil! 😊',
  'isa_aereo':    'Olá! 😊 Sou a *Jerusa*, especialista em Direito Aéreo do escritório Bentes & Ramos!\n\nVi que você passou por uma situação ruim com uma companhia aérea — infelizmente é muito comum e você TEM direitos!\n\nPara defender seus direitos, preciso de alguns documentos:\n\n📎 *1. RG ou CNH*\n📎 *2. CPF*\n📎 *3. Cartão de embarque ou localizador do voo*\n📎 *4. Comprovante do problema* (print do app, e-mail da companhia, recibo de despesas extras)\n\nPode começar enviando o que tiver à mão? 😊',
};

// Missão específica de cada agente (adicionada ao prompt para guiar comportamento)
const AGENT_MISSIONS: Record<string, string> = {
  'isa_triagem': `
🎯 SUA MISSÃO — ISA (TRIAGEM):
- SEMPRE se apresente na PRIMEIRA mensagem: "Olá! 😊 Sou a *Isa*, assistente virtual do escritório *Bentes & Ramos Advocacia*. Como posso te ajudar?"
- Seu papel é IDENTIFICAR o problema jurídico e ENCAMINHAR para o especialista correto.
- NUNCA tente coletar documentos — isso é responsabilidade de Melissa (bancário) ou Jerusa (aéreo).
- NUNCA tente fechar contratos — você apenas filtra e direciona.

REGRAS CRÍTICAS DE ROTEAMENTO:
- Se area_juridica="bancario" → transicionar_agente para "isa_bancario" IMEDIATAMENTE
- Se area_juridica="aereo" → transicionar_agente para "isa_aereo" IMEDIATAMENTE
- Se area_juridica="indefinido" → NUNCA chame direcionar_atendimento_humano! Faça UMA pergunta: "Pode me contar mais sobre o que aconteceu?"
- Só use direcionar_atendimento_humano se o cliente mencionar explicitamente área jurídica fora do escopo (trabalhista, criminal, família, imobiliário)
- NUNCA use direcionar_atendimento_humano para saudações como "Olá", "Oi", "Bom dia"

SE O ASSUNTO NÃO FOR JURÍDICO (ex: limpeza, serviços, produtos, outros):
- Responda educadamente: "Olá! 😊 Somos um escritório de advocacia especializado em Direito Bancário e Aéreo. Para outros serviços, infelizmente não podemos ajudar. Se tiver alguma questão jurídica relacionada a banco ou voo, estarei aqui! 🙏"
- NÃO use nenhuma ação/ferramenta nesses casos — apenas responda e encerre
`,
  'isa_bancario': `
🎯 SUA MISSÃO — MELISSA (DIREITO BANCÁRIO):
- Você é especialista em Direito Bancário. Seu papel é FECHAR O CASO e COLETAR OS DOCUMENTOS.
- Seja persuasiva, empática e focada em resultado: o cliente precisa sentir que vai ganhar.

📎 DOCUMENTOS OBRIGATÓRIOS — solicite SEMPRE UM DE CADA VEZ, na ordem:
  1. RG ou CNH (documento de identidade)
  2. CPF
  3. Contrato ou extrato com o banco/financeira envolvida
  4. Comprovante do problema (cobrança indevida, negativação, cláusula abusiva, etc.)

⚠️ REGRA ABSOLUTA — IDENTIFICAÇÃO DE DOCUMENTOS (NUNCA ALUCINÉ):
- Ao receber uma IMAGEM: olhe visualmente o que é. RG → marcar_doc_recebido doc_type="rg_frente" ou "rg_verso". CNH → "cnh_frente". CPF → "cpf". Outro documento de identidade → "rg".
- Ao receber um PDF ou arquivo: provavelmente é contrato ou extrato → marcar_doc_recebido doc_type="contrato_ou_extrato".
- NUNCA diga que recebeu um documento que NÃO está em DOCUMENTOS RECEBIDOS e NÃO foi enviado NESTA mensagem.
- NUNCA suponha que recebeu mais de um documento de uma vez, salvo se o cliente enviou múltiplos arquivos.
- Após confirmar o documento recebido: peça o PRÓXIMO pendente (apenas um).

🔄 FLUXO CORRETO (um documento por vez):
1. Entender o caso + confirmar que pode ajudar
2. Pedir RG ou CNH (um só, primeiro)
3. Receber RG/CNH → marcar → pedir CPF
4. Receber CPF → marcar → pedir contrato/extrato do banco
5. Receber contrato → marcar → pedir comprovante do problema
6. Ao receber todos: transicionar_estado to_state="DOCS_PENDING"
- NUNCA encerre a conversa sem tentar fechar o contrato.

📋 CLIENTES SEM CONTRATO — NÃO aposentados/pensionistas/servidores:
Quando o cliente comum (que NÃO é aposentado/pensionista/servidor público) diz que NÃO tem ou não encontra o contrato/extrato:
- Use direcionar_atendimento_humano com motivo: "Cliente não tem o contrato — encaminhar para Amanda orientar como obter junto ao banco"
- Responda: "Sem problema! 😊 Vou te conectar com a *Amanda*, nossa atendente, que vai te orientar sobre como solicitar o documento direto no banco. Um momento!"

📋 CLIENTES APOSENTADOS/PENSIONISTAS SEM CONTRATO OU EXTRATO:
Quando o cliente for aposentado/pensionista/servidor e NÃO tiver o contrato ou extrato:
1. Pergunte qual é o problema específico para enviar o vídeo certo:
   - "não tenho acesso ao Meu INSS" / "não sei a senha" → enviar_video_inss com video_numero=2
   - "não sei onde achar o extrato" / "não acho o empréstimo lá" → enviar_video_inss com video_numero=1
   - "perdi acesso ao GOV.br" / "não consigo entrar no gov" → enviar_video_inss com video_numero=3
   - problema não especificado → enviar_video_inss com video_numero=1 (mais comum)
2. Use SEMPRE a ação enviar_video_inss — NUNCA escreva os links manualmente no texto.
3. Envie UM vídeo por vez com a ação. NÃO chame enviar_video_inss mais de uma vez por resposta.
4. Após enviar o vídeo, diga no texto: "É bem simples! Quando conseguir o extrato, me manda aqui 😊"

RESPOSTA AOS BOTÕES DO VÍDEO (no histórico aparece como [BOTÃO CLICADO: ID]):
- [BOTÃO CLICADO: video_ajudou_inss_1] ou video_ajudou_inss_2 ou video_ajudou_inss_3 → O vídeo ajudou! Elogie ("Ótimo! 🎉") e peça o próximo documento da lista.
- [BOTÃO CLICADO: falar_amanda] → Cliente quer atendimento humano. Use direcionar_atendimento_humano com motivo "Cliente solicitou falar com Amanda via botão" e responda: "Claro! 😊 Vou te conectar com a *Amanda* agora. Um momento!"

📅 FOLLOW-UP AUTOMÁTICO (clientes de tráfego):
- Sempre que pedir um documento, chame TAMBÉM agendar_lembrete na MESMA resposta:
  - delay_minutos: 1440 (24h)
  - mensagem: "Oi! 😊 Passando para saber se já conseguiu nos enviar [nome do doc pedido]. Estamos aguardando para dar andamento no seu caso!"
- Se for a segunda vez pedindo o mesmo doc (cliente sumiu): delay_minutos: 2880 (48h) e mensagem mais enfática: "Olá! Só um lembrete rápido 😊 Precisamos do [doc] para seguir com a análise do seu caso. Consegue enviar hoje?"
- NÃO agende lembrete se o cliente acabou de enviar algo ou está respondendo ativamente.
`,
  'isa_aereo': `
🎯 SUA MISSÃO — JERUSA (DIREITO AÉREO):
- Você é especialista em Direito Aéreo. Seu papel é FECHAR O CASO e COLETAR OS DOCUMENTOS.
- Seja empática e combativa: companhias aéreas violam direitos constantemente e o cliente MERECE ser indenizado.
- Documentos obrigatórios (coletar 1 por vez):
  1. RG ou CNH
  2. CPF
  3. Cartão de embarque ou localizador/e-ticket do voo
  4. Comprovante do problema (print do cancelamento, e-mail da cia aérea, recibo de despesas extras)
- Fluxo: entender o ocorrido → confirmar direitos do cliente → pedir doc 1 → receber → pedir doc 2 → etc. → encaminhar para análise
- Ao receber cada documento: use marcar_doc_recebido
- Quando todos os docs chegarem: use transicionar_estado com to_state "DOCS_PENDING"
- NUNCA encerre a conversa sem tentar fechar o contrato.

📅 FOLLOW-UP AUTOMÁTICO (clientes de tráfego):
- Sempre que pedir um documento, chame TAMBÉM agendar_lembrete na MESMA resposta:
  - delay_minutos: 1440 (24h)
  - mensagem: "Oi! 😊 Passando para saber se já conseguiu nos enviar [nome do doc pedido]. Estamos aguardando para dar andamento no seu caso de indenização!"
- Se for a segunda vez pedindo o mesmo doc (cliente sumiu): delay_minutos: 2880 (48h) e mensagem mais enfática.
- NÃO agende lembrete se o cliente acabou de enviar algo ou está respondendo ativamente.
`,
};

interface LeadContext {
  lead: any;
  mensagens: any[];
  interacoes: any[];
  tarefas: any[];
  compromissos: any[];
  processos: any[];
  honorarios: any[];
  parcelas: any[];
  followup?: any;
  classification?: any;
  contractData?: any;
  docsChecklist?: any[];
  stateHistory?: any[];
  lembretesPendentes?: any[];
}

async function buscarContextoLead(supabase: any, leadId: string): Promise<LeadContext | null> {
  const [
    { data: lead },
    { data: mensagens },
    { data: interacoes },
    { data: tarefas },
    { data: compromissos },
    { data: processos },
    { data: honorarios },
    { data: followup },
    { data: zapiFollowup },
    { data: classification },
    { data: contractData },
    { data: docsChecklist },
    { data: stateHistory },
    { data: lembretesPendentes },
  ] = await Promise.all([
    supabase.from('leads_juridicos').select('*').eq('id', leadId).single(),
    supabase.from('manychat_mensagens').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(60),
    supabase.from('interacoes').select('*').eq('cliente_id', leadId).order('data_interacao', { ascending: false }).limit(10),
    supabase.from('tarefas').select('*').eq('cliente_id', leadId).order('created_at', { ascending: false }).limit(10),
    supabase.from('compromissos').select('*').eq('lead_id', leadId).order('data_inicio', { ascending: false }).limit(5),
    supabase.from('processos').select('*').eq('cliente_id', leadId),
    supabase.from('honorarios').select('*, parcelas(*)').eq('cliente_id', leadId),
    supabase.from('lead_followups').select('*').eq('lead_id', leadId).maybeSingle(),
    supabase.from('zapi_followups').select('*').eq('lead_id', leadId).maybeSingle(),
    supabase.from('lead_classifications').select('*').eq('lead_id', leadId).maybeSingle(),
    supabase.from('lead_contract_data').select('*').eq('lead_id', leadId).maybeSingle(),
    supabase.from('lead_docs_checklist').select('*').eq('lead_id', leadId),
    supabase.from('lead_state_history').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(5),
    supabase.from('system_events').select('*').eq('lead_id', leadId).eq('tipo', 'lembrete').eq('acao', 'lembrete_pendente').eq('processado', false).order('created_at', { ascending: false }).limit(3),
  ]);

  if (!lead) return null;

  const parcelas = honorarios?.flatMap((h: any) => h.parcelas || []) || [];
  
  const mergedFollowup = zapiFollowup ? {
    ...followup,
    ...zapiFollowup,
    total_followups_enviados: zapiFollowup.total_followups_enviados || 0,
    ultimo_tipo_enviado: zapiFollowup.ultimo_tipo_enviado || null,
    respondido: zapiFollowup.respondido || followup?.respondido || false,
  } : followup;

  return { 
    lead, 
    mensagens: mensagens || [], 
    interacoes: interacoes || [], 
    tarefas: tarefas || [], 
    compromissos: compromissos || [], 
    processos: processos || [], 
    honorarios: honorarios || [], 
    parcelas,
    followup: mergedFollowup || null,
    classification: classification || null,
    contractData: contractData || null,
    docsChecklist: docsChecklist || [],
    stateHistory: stateHistory || [],
    lembretesPendentes: lembretesPendentes || [],
  };
}

async function verificarFollowupStatus(supabase: any, leadId: string, followup: any) {
  const agora = new Date();
  
  if (!followup) {
    return { status: 'sem_followup', pode_enviar: false, motivo: 'Lead não tem follow-up configurado' };
  }

  const { data: lead } = await supabase
    .from('leads_juridicos')
    .select('status')
    .eq('id', leadId)
    .single();

  if (STATUS_BLOQUEADOS.includes(lead?.status)) {
    return { status: 'bloqueado', pode_enviar: false, motivo: `Lead com status ${lead?.status} - automações bloqueadas` };
  }

  if (followup.subscriber_id) {
    const { data: subscriber } = await supabase
      .from('manychat_subscribers')
      .select('atendimento_humano')
      .eq('subscriber_id', followup.subscriber_id)
      .maybeSingle();

    if (subscriber?.atendimento_humano) {
      return { status: 'atendimento_humano', pode_enviar: false, motivo: 'Atendimento humano ativo' };
    }
  }

  if (followup.respondido) {
    return { status: 'respondido', pode_enviar: false, motivo: 'Lead já respondeu' };
  }

  const trintaMinAtras = new Date(agora.getTime() - 30 * 60 * 1000).toISOString();
  const { data: msgRecentes } = await supabase
    .from('manychat_mensagens')
    .select('id')
    .eq('lead_id', leadId)
    .eq('direcao', 'entrada')
    .gte('created_at', trintaMinAtras)
    .limit(1);

  if (msgRecentes && msgRecentes.length > 0) {
    return { status: 'conversa_ativa', pode_enviar: false, motivo: 'Lead tem mensagens recentes (últimos 30 min)' };
  }

  const stageFast = followup.followup_stage_fast || 0;
  const stageSlow = followup.followup_stage_slow || 0;
  const primeiroContato = new Date(followup.primeiro_contato_em);
  const minutosDesdeContato = (agora.getTime() - primeiroContato.getTime()) / (1000 * 60);

  let proximo = { tipo: null as string | null, stage: 0, config: null as any };

  if (STATUS_PERMITE_FAST.includes(lead?.status) && stageFast < 3) {
    const nextStage = stageFast + 1;
    const config = FAST_CONFIG[`stage_${nextStage}` as keyof typeof FAST_CONFIG];
    if (minutosDesdeContato >= config.delay_minutos) {
      proximo = { tipo: 'FAST', stage: nextStage, config };
    }
  }

  if (!proximo.tipo && STATUS_PERMITE_SLOW.includes(lead?.status) && stageSlow < 3) {
    const fastCompleto = stageFast >= 3 || !STATUS_PERMITE_FAST.includes(lead?.status);
    if (fastCompleto) {
      const nextStage = stageSlow + 1;
      const config = SLOW_CONFIG[`stage_${nextStage}` as keyof typeof SLOW_CONFIG];
      if (minutosDesdeContato >= config.delay_minutos) {
        proximo = { tipo: 'SLOW', stage: nextStage, config };
      }
    }
  }

  if (proximo.tipo) {
    return {
      status: 'pronto_para_enviar',
      pode_enviar: true,
      tipo: proximo.tipo,
      stage: proximo.stage,
      titulo: proximo.config?.titulo,
      motivo: `Follow-up ${proximo.tipo} stage ${proximo.stage} pronto para envio`
    };
  }

  return {
    status: 'aguardando',
    pode_enviar: false,
    stage_fast: stageFast,
    stage_slow: stageSlow,
    next_followup_at: followup.next_followup_at,
    motivo: 'Aguardando tempo para próximo follow-up'
  };
}

// ============================================================
// ALTERAÇÃO 2: Funções de roteamento de agentes
// ============================================================

async function getIsaAgent(supabase: any, leadId: string): Promise<string> {
  const { data } = await supabase
    .from('leads_juridicos')
    .select('isa_agent')
    .eq('id', leadId)
    .single();
  return data?.isa_agent || 'isa_triagem';
}

async function setIsaAgent(supabase: any, leadId: string, agent: string): Promise<void> {
  await supabase
    .from('leads_juridicos')
    .update({ isa_agent: agent })
    .eq('id', leadId);
  await supabase.from('system_events').insert({
    tipo: 'roteamento',
    fonte: 'isa_auto',
    acao: 'agente_alterado',
    lead_id: leadId,
    dados: { novo_agente: agent },
    processado: true,
  });
  console.log(`[Isa Routing] Lead ${leadId} → agente: ${agent}`);
}

async function getPromptForAgent(supabaseClient: any, leadId: string): Promise<{ content: string; strict_mode: boolean } | null> {
  const agent = await getIsaAgent(supabaseClient, leadId);
  const promptName: Record<string, string> = {
    'isa_triagem':  'isa_triagem',
    'isa_bancario': 'isa_bancario',
    'isa_aereo':    'isa_aereo',
  };
  const { data } = await supabaseClient
    .from('ai_prompts')
    .select('content, strict_mode')
    .eq('name', promptName[agent] || 'isa_triagem')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) {
    const { data: fallback } = await supabaseClient
      .from('ai_prompts')
      .select('content, strict_mode')
      .eq('name', 'isa_system_prompt')
      .maybeSingle();
    return fallback;
  }
  console.log(`[Isa Routing] Usando prompt: ${promptName[agent] || 'isa_triagem'} para lead ${leadId}`);
  return data;
}

async function enviarNotificacaoEquipe(
  supabase: any,
  lead: any,
  acoesPendentes: Array<{ acao: string; dados: any; motivo: string }>,
  analise: { intencao: string; sentimento: string; urgencia: string; area_juridica?: string; deve_direcionar_humano?: boolean; motivo_handoff?: string },
  mensagemOriginal: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log('⚠️ RESEND_API_KEY não configurada, email não enviado');
    return false;
  }

  try {
    const { data: usuarios } = await supabase
      .from('perfis')
      .select('email, nome, cargo')
      .eq('aprovado', true)
      .in('cargo', ['Administrador', 'Gerente']);

    if (!usuarios || usuarios.length === 0) return false;

    const destinatarios = usuarios.map((u: any) => u.email).filter(Boolean);
    if (destinatarios.length === 0) return false;

    const urgenciaCor = URGENCIA_CORES[analise.urgencia] || '#6b7280';
    const acoesHtml = acoesPendentes.map(a => `
      <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 8px 0; border-radius: 0 8px 8px 0;">
        <strong style="color: #1e40af;">${ACAO_LABELS[a.acao] || a.acao}</strong>
        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">${a.motivo}</p>
      </div>
    `).join('');

    const html = `<!DOCTYPE html><html><body style="font-family: sans-serif; background: #f1f5f9;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#1e3a5f,#2d5a87);padding:24px;border-radius:12px 12px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">🤖 Isa - Ação Requer Aprovação</h1>
        </div>
        <div style="background:white;padding:24px;border-radius:0 0 12px 12px;">
          <h3>${lead.nome || 'Sem nome'}</h3>
          <p>${lead.telefone || ''} | Status: ${lead.status || 'Não definido'}</p>
          <p><strong>Mensagem:</strong> "${mensagemOriginal}"</p>
          <p><strong>Urgência:</strong> <span style="background:${urgenciaCor};color:white;padding:2px 8px;border-radius:12px;">${analise.urgencia}</span></p>
          ${acoesHtml}
          <div style="text-align:center;margin-top:24px;">
            <a href="https://lovable.dev/projects/qgenaltkjtlvwfgykpxq" style="background:#3b82f6;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;">Revisar no Sistema</a>
          </div>
        </div>
      </div>
    </body></html>`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'Isa - Bentes & Ramos <onboarding@resend.dev>',
        to: destinatarios,
        subject: `🔔 Ação pendente: ${lead.nome || 'Lead'} - ${ACAO_LABELS[acoesPendentes[0]?.acao] || 'Nova ação'}`,
        html,
      }),
    });

    if (!response.ok) { console.error('❌ Erro ao enviar email:', await response.text()); return false; }
    console.log(`✅ Email enviado para ${destinatarios.length} destinatário(s)`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar notificação:', error);
    return false;
  }
}

async function executarAcao(supabase: any, acao: string, dados: any, subscriberId?: string): Promise<{ success: boolean; message: string; data?: any }> {
  console.log(`🔧 Executando ação: ${acao}`, dados);
  
  try {
    switch (acao) {
      case 'classificar_lead': {
        const novoStatus = dados.novo_status || dados.status;
        const motivo = dados.motivo || dados.resumo || 'Classificação automática pela Isa';
        const lead_id = dados.lead_id;
        if (!novoStatus) return { success: false, message: 'Status não informado' };
        const { data, error } = await supabase.from('leads_juridicos').update({ status: novoStatus, resumo_ia: motivo }).eq('id', lead_id).select();
        if (error) throw error;
        if (!data || data.length === 0) return { success: false, message: 'Lead não encontrado' };
        await supabase.from('system_events').insert({ tipo: 'lead', fonte: 'isa_auto', acao: 'lead_classificado', entidade_id: lead_id, lead_id, dados: { status_anterior: dados.status_anterior, novo_status: novoStatus, motivo }, processado: true });
        return { success: true, message: `Lead classificado como "${novoStatus}"`, data: data[0] };
      }

      case 'atualizar_dados_lead': {
        const { lead_id, nome, telefone, email } = dados;
        const updateData: any = {};
        if (nome) updateData.nome = nome;
        if (telefone) updateData.telefone = telefone;
        if (email) updateData.email = email;
        if (Object.keys(updateData).length === 0) return { success: false, message: 'Nenhum dado para atualizar' };
        const { data, error } = await supabase.from('leads_juridicos').update(updateData).eq('id', lead_id).select().single();
        if (error) throw error;
        await supabase.from('system_events').insert({ tipo: 'lead', fonte: 'isa_auto', acao: 'dados_lead_atualizados', entidade_id: lead_id, lead_id, dados: { campos_atualizados: Object.keys(updateData), valores: updateData }, processado: true });
        return { success: true, message: `Dados atualizados: ${Object.keys(updateData).join(', ')}`, data };
      }

      case 'criar_interacao': {
        const cliente_id = dados.cliente_id || dados.lead_id;
        const resumo = dados.resumo || dados.mensagem || dados.descricao || 'Interação registrada pela Isa';
        const detalhes = dados.detalhes || dados.mensagem || null;
        const tipo = dados.tipo || 'WhatsApp';
        const direcao = dados.direcao || 'Entrada';
        const { data, error } = await supabase.from('interacoes').insert({ cliente_id, tipo, resumo: resumo.substring(0, 500), detalhes, direcao, data_interacao: new Date().toISOString() }).select().single();
        if (error) throw error;
        return { success: true, message: 'Interação registrada', data };
      }

      case 'atualizar_resumo_lead': {
        const { lead_id, resumo } = dados;
        const { data, error } = await supabase.from('leads_juridicos').update({ resumo_ia: resumo }).eq('id', lead_id).select().single();
        if (error) throw error;
        return { success: true, message: 'Resumo do lead atualizado', data };
      }

      case 'criar_tarefa': {
        const { titulo, descricao, data_limite, prioridade, cliente_id, responsavel_id } = dados;
        const { data, error } = await supabase.from('tarefas').insert({ titulo, descricao, data_limite, prioridade: prioridade || 'Media', status: 'Pendente', cliente_id, responsavel_id }).select().single();
        if (error) throw error;
        await supabase.from('system_events').insert({ tipo: 'tarefa', fonte: 'isa_auto', acao: 'tarefa_criada', entidade_id: data.id, lead_id: cliente_id, dados: { titulo, prioridade }, processado: true });
        return { success: true, message: `Tarefa "${titulo}" criada`, data };
      }

      case 'criar_compromisso': {
        const { titulo, tipo, data_inicio, data_fim, descricao, lead_id, responsavel_id } = dados;
        if (lead_id) {
          const agora = new Date().toISOString();
          const { data: compromissosExistentes } = await supabase.from('compromissos').select('id, titulo, data_inicio').eq('lead_id', lead_id).gte('data_inicio', agora).order('data_inicio', { ascending: true }).limit(1);
          if (compromissosExistentes && compromissosExistentes.length > 0) {
            const existente = compromissosExistentes[0];
            return { success: false, message: `Lead já possui compromisso agendado: "${existente.titulo}" para ${existente.data_inicio}`, data: { compromisso_existente: existente } };
          }
        }
        const { data, error } = await supabase.from('compromissos').insert({ titulo, tipo: tipo || 'Reunião', data_inicio, data_fim, descricao, lead_id, responsavel_id }).select().single();
        if (error) throw error;
        await supabase.from('system_events').insert({ tipo: 'compromisso', fonte: 'isa_auto', acao: 'compromisso_criado', entidade_id: data.id, lead_id, dados: { titulo, tipo, data_inicio }, processado: true });
        return { success: true, message: `Compromisso "${titulo}" agendado`, data };
      }

      case 'confirmar_agendamento': {
        const { lead_id, data_hora, hora_escolhida, titulo, tipo, modalidade } = dados;
        let dataInicio: Date;
        if (hora_escolhida && typeof hora_escolhida === 'string') {
          const dataBase = data_hora ? new Date(data_hora) : new Date();
          const dataManaus = `${dataBase.toISOString().split('T')[0]}T${hora_escolhida}:00-04:00`;
          dataInicio = new Date(dataManaus);
        } else if (data_hora) {
          const dataStr = String(data_hora);
          if (!dataStr.includes('Z') && !dataStr.includes('+') && !dataStr.match(/-\d{2}:\d{2}$/)) {
            dataInicio = new Date(dataStr + '-04:00');
          } else {
            dataInicio = new Date(dataStr);
          }
        } else {
          return { success: false, message: 'Data/hora não informada para agendamento' };
        }
        const dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000);
        const tipoCompromisso = modalidade === 'online' ? 'Reunião Online' : modalidade === 'presencial' ? 'Reunião Presencial' : tipo || 'Reunião';
        const descricaoCompromisso = `Agendamento confirmado pelo cliente via chat.\n${modalidade === 'online' ? '📹 Atendimento ONLINE' : modalidade === 'presencial' ? '🏢 Atendimento PRESENCIAL' : ''}`.trim();
        const { data, error } = await supabase.from('compromissos').insert({ titulo: titulo || 'Consulta agendada', tipo: tipoCompromisso, data_inicio: dataInicio.toISOString(), data_fim: dataFim.toISOString(), descricao: descricaoCompromisso, lead_id }).select().single();
        if (error) throw error;
        await supabase.from('leads_juridicos').update({ status: 'Em Negociação' }).eq('id', lead_id);
        await supabase.from('system_events').insert({ tipo: 'compromisso', fonte: 'isa_auto', acao: 'agendamento_confirmado_lead', entidade_id: data.id, lead_id, dados: { titulo, tipo: tipoCompromisso, modalidade, data_inicio: dataInicio.toISOString() }, processado: true });
        const horaManaus = dataInicio.toLocaleTimeString('pt-BR', { timeZone: 'America/Manaus', hour: '2-digit', minute: '2-digit' });
        const dataManaus = dataInicio.toLocaleDateString('pt-BR', { timeZone: 'America/Manaus' });
        return { success: true, message: `${tipoCompromisso} agendada para ${dataManaus} às ${horaManaus}`, data };
      }

      case 'verificar_agenda': {
        const { lead_id, data_especifica, horario_especifico } = dados;
        try {
          const calcomResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/calcom-integration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
            body: JSON.stringify({ action: data_especifica ? 'verificar_disponibilidade' : 'buscar_horarios', datetime: data_especifica && horario_especifico ? `${data_especifica}T${horario_especifico}:00` : undefined }),
          });
          const calcomData = await calcomResponse.json();
          if (!calcomData.success) {
            const opcoes = await gerarOpcoesHorario(supabase, lead_id);
            return { success: true, message: `${opcoes.length} horários disponíveis encontrados`, data: { horarios_disponiveis: opcoes } };
          }
          if (data_especifica) {
            if (!calcomData.disponivel) return { success: false, message: 'Horário indisponível no Cal.com', data: { disponivel: false } };
            return { success: true, message: `Horário disponível!`, data: { disponivel: true, data: data_especifica, horario: horario_especifico } };
          }
          const horarios = calcomData.horarios || [];
          return { success: true, message: `${horarios.length} horários disponíveis`, data: { horarios_disponiveis: horarios } };
        } catch (error) {
          const opcoes = await gerarOpcoesHorario(supabase, lead_id);
          return { success: true, message: `${opcoes.length} horários disponíveis (fallback)`, data: { horarios_disponiveis: opcoes } };
        }
      }

      case 'solicitar_agendamento': {
        if (!subscriberId) return { success: false, message: 'Subscriber ID não disponível' };
        const { lead_id, mensagem_personalizada } = dados;
        const agora = new Date().toISOString();
        const { data: compromissosExistentes } = await supabase.from('compromissos').select('id, titulo, data_inicio, confirmacao_status').eq('lead_id', lead_id).gte('data_inicio', agora).order('data_inicio', { ascending: true }).limit(1);
        if (compromissosExistentes && compromissosExistentes.length > 0) {
          const existente = compromissosExistentes[0];
          return { success: false, message: `Lead já possui compromisso agendado: "${existente.titulo}"`, data: { compromisso_existente: existente } };
        }
        const opcoes = await gerarOpcoesHorario(supabase, lead_id);
        if (opcoes.length === 0) return { success: false, message: 'Não há horários disponíveis no momento.' };
        const mensagem = mensagem_personalizada || `Ótimo! Vamos agendar sua consulta. 📅\n\nEscolha um horário:\n\n${opcoes.map((o: { label: string }, i: number) => `${i + 1}️⃣ ${o.label}`).join('\n')}\n\nOu acesse: https://cal.com/bentes-ramos-advocacia-1ucmau/agendamentos-crm`;
        await supabase.from('system_events').insert({ tipo: 'agendamento', fonte: 'isa_auto', acao: 'aguardando_confirmacao_lead', entidade_id: lead_id, lead_id, dados: { opcoes_oferecidas: opcoes, subscriber_id: subscriberId }, processado: false });
        await supabase.from('manychat_mensagens').insert({ subscriber_id: subscriberId, subscriber_nome: 'Isa (Assistente)', canal: 'whatsapp', conteudo: mensagem, tipo: 'text', direcao: 'saida', lead_id, metadata: { tipo: 'solicitacao_agendamento', opcoes } });
        return { success: true, message: 'Solicitação de agendamento enviada ao lead', data: { opcoes } };
      }

      case 'agendar_direto': {
        const { lead_id, data_hora, titulo, modalidade } = dados;
        if (!data_hora) return { success: false, message: 'Data e hora são obrigatórios para agendar' };
        const { data: lead } = await supabase.from('leads_juridicos').select('nome, email, telefone').eq('id', lead_id).single();
        if (!lead) return { success: false, message: 'Lead não encontrado' };
        let dataAgendamento: string = data_hora;
        const dataStr = String(data_hora);
        if (!dataStr.includes('Z') && !dataStr.includes('+') && !dataStr.match(/-\d{2}:\d{2}$/)) {
          dataAgendamento = new Date(dataStr + '-04:00').toISOString();
        }
        const email = lead.email || `${(lead.telefone || '').replace(/\D/g, '')}@placeholder.com`;
        try {
          const calcomResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/calcom-integration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
            body: JSON.stringify({ action: 'agendar', datetime: dataAgendamento, nome: lead.nome || 'Cliente', email, telefone: lead.telefone, leadId: lead_id, subscriberId, notas: modalidade === 'online' ? 'Atendimento ONLINE' : 'Atendimento PRESENCIAL' }),
          });
          const calcomData = await calcomResponse.json();
          if (!calcomData.success) {
            const dataFim = new Date(new Date(dataAgendamento).getTime() + 60 * 60 * 1000);
            const tipoCompromisso = modalidade === 'online' ? 'Reunião Online' : modalidade === 'presencial' ? 'Reunião Presencial' : 'Consulta';
            const { data: compromisso, error } = await supabase.from('compromissos').insert({ titulo: titulo || 'Consulta Jurídica', tipo: tipoCompromisso, data_inicio: dataAgendamento, data_fim: dataFim.toISOString(), descricao: `Agendamento feito pela Isa (local).`, lead_id, confirmacao_status: 'pendente', origem: 'isa' }).select().single();
            if (error) throw error;
            await supabase.from('leads_juridicos').update({ status: 'Em Negociação' }).eq('id', lead_id);
            const dataObj = new Date(dataAgendamento);
            const horaManaus = dataObj.toLocaleTimeString('pt-BR', { timeZone: 'America/Manaus', hour: '2-digit', minute: '2-digit' });
            const dataManaus = dataObj.toLocaleDateString('pt-BR', { timeZone: 'America/Manaus', weekday: 'long', day: '2-digit', month: '2-digit' });
            return { success: true, message: `✅ Agendado: ${tipoCompromisso} para ${dataManaus} às ${horaManaus}`, data: { compromisso_id: compromisso.id } };
          }
          return { success: true, message: calcomData.mensagem, data: { booking: calcomData.booking, compromisso_id: calcomData.compromisso_id } };
        } catch (error) {
          return { success: false, message: 'Erro ao criar agendamento.', data: null };
        }
      }

      case 'verificar_followup': {
        const { lead_id } = dados;
        const { data: followup } = await supabase.from('lead_followups').select('*').eq('lead_id', lead_id).maybeSingle();
        const status = await verificarFollowupStatus(supabase, lead_id, followup);
        return { success: true, message: status.motivo, data: status };
      }

      case 'executar_followup': {
        const { lead_id, tipo_forcado } = dados;
        const { data: followup } = await supabase.from('lead_followups').select('*, leads_juridicos!inner(id, nome, telefone, status)').eq('lead_id', lead_id).maybeSingle();
        if (!followup || !followup.subscriber_id) return { success: false, message: 'Follow-up não encontrado ou sem subscriber' };
        const lead = followup.leads_juridicos;
        const status = await verificarFollowupStatus(supabase, lead_id, followup);
        if (!status.pode_enviar && !tipo_forcado) return { success: false, message: status.motivo };
        const mensagem = `Olá ${lead.nome || 'cliente'}! 👋\n\nPassando para saber se posso ajudar com sua questão.\n\nEstamos à disposição para analisar seu caso!\n\n📅 Agende: https://cal.com/bentes-ramos-advocacia-1ucmau/agendamentos-crm`;
        const enviado = await enviarRespostaManyChat(followup.subscriber_id, mensagem);
        if (enviado) {
          const agora = new Date().toISOString();
          await supabase.from('lead_followups').update({ last_outbound_at: agora, last_isa_outbound_at: agora, waiting_reply: true }).eq('id', followup.id);
          await supabase.from('interacoes').insert({ cliente_id: lead_id, tipo: 'WhatsApp', direcao: 'Saída', resumo: 'Follow-up enviado pela Isa', detalhes: mensagem });
          return { success: true, message: `Follow-up enviado para ${lead.nome}` };
        }
        return { success: false, message: 'Falha ao enviar follow-up' };
      }

      case 'pausar_followup': {
        const { lead_id, motivo } = dados;
        await supabase.from('lead_followups').update({ status: 'pausado', followup_lock_reason: motivo || 'Pausado pela Isa' }).eq('lead_id', lead_id);
        const { data: followup } = await supabase.from('lead_followups').select('subscriber_id').eq('lead_id', lead_id).maybeSingle();
        if (followup?.subscriber_id) await supabase.from('manychat_subscribers').update({ atendimento_humano: true, atendimento_humano_desde: new Date().toISOString() }).eq('subscriber_id', followup.subscriber_id);
        await supabase.from('system_events').insert({ tipo: 'followup', fonte: 'isa_inteligente', acao: 'followup_pausado', lead_id, dados: { motivo }, processado: true });
        return { success: true, message: 'Follow-up pausado com sucesso' };
      }

      case 'retomar_followup': {
        const { lead_id } = dados;
        await supabase.from('lead_followups').update({ status: 'em_andamento', followup_lock_reason: null }).eq('lead_id', lead_id);
        const { data: followup } = await supabase.from('lead_followups').select('subscriber_id').eq('lead_id', lead_id).maybeSingle();
        if (followup?.subscriber_id) await supabase.from('manychat_subscribers').update({ atendimento_humano: false, atendimento_humano_desde: null }).eq('subscriber_id', followup.subscriber_id);
        await supabase.from('system_events').insert({ tipo: 'followup', fonte: 'isa_inteligente', acao: 'followup_retomado', lead_id, processado: true });
        return { success: true, message: 'Follow-up retomado com sucesso' };
      }

      case 'transicionar_estado': {
        const { lead_id, to_state, reason } = dados;
        if (!to_state) return { success: false, message: 'Estado destino (to_state) não informado' };
        const { data: result, error } = await supabase.rpc('update_lead_state', { p_lead_id: lead_id, p_to_state: to_state, p_changed_by: 'isa', p_reason: reason || 'Transição automática pela Isa' });
        if (error) { console.error('❌ Erro na transição de estado:', error); return { success: false, message: `Transição inválida: ${error.message}` }; }
        return { success: true, message: `Lead movido para estado "${to_state}"`, data: result };
      }

      case 'classificar_caso': {
        const { lead_id, case_type, sub_type, summary, recommended_docs, confidence_score } = dados;
        if (!case_type) return { success: false, message: 'Tipo do caso (case_type) é obrigatório' };
        const { data: classification, error } = await supabase.from('lead_classifications').upsert({ lead_id, case_type, sub_type: sub_type || null, summary: summary || null, recommended_docs: recommended_docs || [], confidence_score: confidence_score || null, classified_by: 'isa', updated_at: new Date().toISOString() }, { onConflict: 'lead_id' }).select().single();
        if (error) throw error;
        if (recommended_docs && recommended_docs.length > 0) {
          for (const doc of recommended_docs) {
            await supabase.from('lead_docs_checklist').upsert({ lead_id, doc_type: doc.toLowerCase().replace(/\s+/g, '_'), doc_label: doc, is_required: true, received: false }, { onConflict: 'lead_id,doc_type' });
          }
        }
        await supabase.from('leads_juridicos').update({ tipo_acao: case_type }).eq('id', lead_id);
        await supabase.from('system_events').insert({ tipo: 'lead', fonte: 'isa_auto', acao: 'caso_classificado', lead_id, dados: { case_type, sub_type, summary }, processado: true });
        return { success: true, message: `Caso classificado como "${case_type}"${sub_type ? ` (${sub_type})` : ''}`, data: classification };
      }

      case 'salvar_dados_contrato': {
        const { lead_id, cpf, rg, data_nascimento, endereco, cidade, uf, cep, estado_civil, profissao, nacionalidade, nome_mae, dados_extras } = dados;
        const contractData: any = { lead_id, updated_at: new Date().toISOString() };
        if (cpf) contractData.cpf = cpf;
        if (rg) contractData.rg = rg;
        if (data_nascimento) contractData.data_nascimento = data_nascimento;
        if (endereco) contractData.endereco = endereco;
        if (cidade) contractData.cidade = cidade;
        if (uf) contractData.uf = uf;
        if (cep) contractData.cep = cep;
        if (estado_civil) contractData.estado_civil = estado_civil;
        if (profissao) contractData.profissao = profissao;
        if (nacionalidade) contractData.nacionalidade = nacionalidade;
        if (nome_mae) contractData.nome_mae = nome_mae;
        if (dados_extras) contractData.dados_extras = dados_extras;
        const { data, error } = await supabase.from('lead_contract_data').upsert(contractData, { onConflict: 'lead_id' }).select().single();
        if (error) throw error;
        await supabase.from('system_events').insert({ tipo: 'lead', fonte: 'isa_auto', acao: 'dados_contrato_salvos', lead_id, dados: { campos: Object.keys(contractData).filter(k => k !== 'lead_id' && k !== 'updated_at') }, processado: true });
        return { success: true, message: `Dados do contrato salvos`, data };
      }

      case 'marcar_doc_recebido': {
        const { lead_id, doc_type, file_id, notes } = dados;
        if (!doc_type) return { success: false, message: 'Tipo do documento (doc_type) e obrigatorio' };
        const normalizedDocType = String(doc_type).toLowerCase().trim().replace(/\s+/g, '_');
        const labels: Record<string, string> = {
          contrato: 'Contrato',
          extrato: 'Extrato',
          contrato_ou_extrato: 'Contrato ou extrato',
          comprovante_do_problema: 'Comprovante do problema',
          rg_frente: 'RG - frente',
          rg_verso: 'RG - verso',
          cnh_frente: 'CNH - frente',
          cnh_verso: 'CNH - verso',
          rg: 'RG recebido (verificar frente e verso)',
          cnh: 'CNH recebida (verificar frente e verso)',
          comprovante_residencia: 'Comprovante de residencia',
        };
        const { data, error } = await supabase.from('lead_docs_checklist').upsert({
          lead_id,
          doc_type: normalizedDocType,
          doc_label: labels[normalizedDocType] || normalizedDocType,
          is_required: true,
          received: true,
          received_at: new Date().toISOString(),
          file_id: file_id || null,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'lead_id,doc_type' }).select().single();
        if (error) throw error;
        const { data: pending } = await supabase.from('lead_docs_checklist').select('id').eq('lead_id', lead_id).eq('is_required', true).eq('received', false);
        const allReceived = !pending || pending.length === 0;
        await supabase.from('system_events').insert({ tipo: 'documento', fonte: 'isa_auto', acao: 'doc_recebido', lead_id, dados: { doc_type: normalizedDocType, all_docs_received: allReceived, notes }, processado: true });
        return { success: true, message: allReceived ? `Documento "${normalizedDocType}" recebido. Todos os documentos obrigatorios foram recebidos.` : `Documento "${normalizedDocType}" recebido. Ainda ha pendencias.`, data: { ...data, all_docs_received: allReceived } };
      }
      case 'verificar_docs_pendentes': {
        const { lead_id } = dados;
        const { data: checklist, error } = await supabase.from('lead_docs_checklist').select('*').eq('lead_id', lead_id);
        if (error) throw error;
        const pendentes = (checklist || []).filter((d: any) => d.is_required && !d.received);
        const recebidos = (checklist || []).filter((d: any) => d.received);
        return { success: true, message: pendentes.length === 0 ? 'Todos os documentos obrigatórios foram recebidos!' : `${pendentes.length} documento(s) pendente(s): ${pendentes.map((d: any) => d.doc_label).join(', ')}`, data: { pendentes: pendentes.map((d: any) => ({ type: d.doc_type, label: d.doc_label })), recebidos: recebidos.map((d: any) => ({ type: d.doc_type, label: d.doc_label })), total: checklist?.length || 0, all_received: pendentes.length === 0 } };
      }

      case 'consultar_processo': {
        const { lead_id, numero_processo } = dados;
        if (!numero_processo) {
          const { data: processos } = await supabase.from('processos').select('numero_processo, titulo_acao, status').eq('cliente_id', lead_id).not('numero_processo', 'is', null).limit(5);
          if (!processos || processos.length === 0) return { success: false, message: 'Não encontrei nenhum processo vinculado a você.', data: null };
          if (processos.length === 1) return await executarAcao(supabase, 'consultar_processo', { lead_id, numero_processo: processos[0].numero_processo }, subscriberId);
          const lista = processos.map((p: any, i: number) => `${i + 1}. ${p.numero_processo} - ${p.titulo_acao || 'Sem título'} (${p.status || 'Em Andamento'})`).join('\n');
          return { success: true, message: `Encontrei ${processos.length} processos:\n${lista}`, data: { processos } };
        }
        try {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/processo-status-monitor`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'consultar_para_lead', lead_id, numero_processo }),
          });
          const result = await response.json();
          return result.success ? { success: true, message: result.mensagem, data: result.dados } : { success: false, message: result.mensagem || 'Não foi possível consultar o processo.', data: null };
        } catch (err) {
          return { success: false, message: 'Ocorreu um erro ao consultar o processo.', data: null };
        }
      }

      // ============================================================
      // ALTERAÇÃO 4: case 'transicionar_agente' NOVO
      // ============================================================
      case 'transicionar_agente': {
        const { lead_id, isa_agent, motivo } = dados;
        if (!isa_agent) return { success: false, message: 'isa_agent não informado' };
        const agentesValidos = ['isa_triagem', 'isa_bancario', 'isa_aereo', 'humano'];
        if (!agentesValidos.includes(isa_agent)) return { success: false, message: `Agente inválido: ${isa_agent}` };

        // Transferência para humano → acionar handoff completo (não apenas mudar campo)
        if (isa_agent === 'humano') {
          return await executarAcao(supabase, 'direcionar_atendimento_humano', {
            lead_id,
            motivo: motivo || 'Transferência solicitada pela IA',
            tipo: 'transicao_agente',
          }, subscriberId);
        }

        const supabaseLocal = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        await setIsaAgent(supabaseLocal, lead_id, isa_agent);
        console.log(`[Isa Routing] ✅ Lead ${lead_id} → ${AGENT_DISPLAY_NAMES[isa_agent] || isa_agent}`);
        return { success: true, message: `Lead roteado para ${AGENT_DISPLAY_NAMES[isa_agent] || isa_agent}`, data: { isa_agent, motivo } };
      }

      case 'agendar_lembrete': {
        const { lead_id, mensagem: msgLembrete, delay_minutos, assunto } = dados;
        if (!msgLembrete) return { success: false, message: 'mensagem e obrigatoria para agendar_lembrete' };
        const reminderSubject = String(assunto || msgLembrete).toLowerCase().substring(0, 120);
        const { data: existingReminder } = await supabase
          .from('system_events')
          .select('id, dados')
          .eq('lead_id', lead_id)
          .eq('tipo', 'lembrete')
          .eq('acao', 'lembrete_pendente')
          .eq('processado', false)
          .limit(1)
          .maybeSingle();
        if (existingReminder) {
          return { success: true, message: 'Ja existe lembrete pendente para este lead; nao foi criado outro.', data: existingReminder };
        }
        const delayMin = Math.max(5, Math.min(Number(delay_minutos) || 120, 1440));
        const scheduledFor = new Date(Date.now() + delayMin * 60 * 1000).toISOString();
        const { error: lembreteErr } = await supabase.from('system_events').insert({
          tipo: 'lembrete',
          fonte: 'isa_auto',
          acao: 'lembrete_pendente',
          lead_id,
          dados: {
            subscriber_id: subscriberId,
            lead_id,
            mensagem: msgLembrete,
            assunto: reminderSubject,
            scheduled_for: scheduledFor,
            agendado_em: new Date().toISOString(),
          },
          processado: false,
        });
        if (lembreteErr) throw lembreteErr;
        const horaManaus = new Date(scheduledFor).toLocaleTimeString('pt-BR', { timeZone: 'America/Manaus', hour: '2-digit', minute: '2-digit' });
        console.log(`[Lembrete] Agendado para ${horaManaus} - lead ${lead_id}`);
        return { success: true, message: `Lembrete agendado para ${horaManaus}`, data: { scheduled_for: scheduledFor } };
      }

      case 'enviar_video_inss': {
        const { lead_id, video_numero } = dados;
        if (!subscriberId) return { success: false, message: 'Subscriber ID não disponível para enviar vídeo' };
        const supabaseLocal = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        const VIDEOS_INSS = [
          { num: 1, titulo: '📹 Como acessar o extrato de empréstimo no Meu INSS', url: 'https://drive.google.com/file/d/16TzO0QybAi32O3xFU8LphBrrQR7JtvQm/view?usp=sharing' },
          { num: 2, titulo: '📹 Como criar código de acesso no Meu INSS', url: 'https://drive.google.com/file/d/1Sy28fDE--TOm_7h2n9qjsGSFqt9Y1Nbv/view?usp=sharing' },
          { num: 3, titulo: '📹 Como recuperar seu acesso ao GOV.br', url: 'https://drive.google.com/file/d/1NiGr6qCVqmF4NjxNw-fdHzvBb3ycUnOv/view?usp=sharing' },
        ];
        const num = Math.max(1, Math.min(3, Number(video_numero) || 1));
        const video = VIDEOS_INSS[num - 1];
        const videoMsg = `${video.titulo}:\n${video.url}`;
        const textSend = await enviarRespostaZapi(supabaseLocal, subscriberId, videoMsg);
        if (textSend.success) {
          await supabaseLocal.from('manychat_mensagens').insert({
            subscriber_id: subscriberId,
            subscriber_nome: 'Melissa',
            canal: 'whatsapp',
            conteudo: videoMsg,
            tipo: 'text',
            direcao: 'saida',
            lead_id,
            metadata: { auto_gerada: true, source: 'isa', agent: 'isa_bancario', tipo: 'video_inss', video_numero: num },
          });
        }
        await new Promise<void>(r => setTimeout(r, 1200));
        const buttonSend = await enviarBotoesZapi(supabaseLocal, subscriberId, 'Este vídeo te ajudou? 😊', [
          { id: `video_ajudou_inss_${num}`, title: '✅ Sim, me ajudou!' },
          { id: 'falar_amanda', title: '💬 Falar com Amanda' },
        ]);
        if (buttonSend.success) {
          await supabaseLocal.from('manychat_mensagens').insert({
            subscriber_id: subscriberId,
            subscriber_nome: 'Melissa',
            canal: 'whatsapp',
            conteudo: 'Este vídeo te ajudou? 😊 [Botões: ✅ Sim, me ajudou! | 💬 Falar com Amanda]',
            tipo: 'buttons',
            direcao: 'saida',
            lead_id,
            metadata: { auto_gerada: true, source: 'isa', agent: 'isa_bancario', tipo: 'buttons_video_inss', video_numero: num },
          });
        }
        console.log(`[Melissa] 📹 Vídeo INSS ${num} enviado${buttonSend.success ? ' com botões' : ' (somente texto)'}`);
        return { success: true, message: `Vídeo INSS ${num} enviado ao cliente`, data: { video_numero: num, buttons_sent: buttonSend.success } };
      }

      case 'direcionar_atendimento_humano': {
        const lead_id = dados.lead_id;
        const motivo = dados.motivo || 'Lead qualificado para atendimento humano';
        const tipo_handoff = dados.tipo || 'qualificado';
        if (subscriberId) {
          await supabase.from('manychat_subscribers').update({ atendimento_humano: true, atendimento_humano_desde: new Date().toISOString() }).eq('subscriber_id', subscriberId);
        }
        await supabase.from('leads_juridicos').update({ status: 'Em Atendimento', isa_ativa: false, resumo_ia: `[HANDOFF] ${motivo}` }).eq('id', lead_id);
        await supabase.from('system_events').insert({ tipo: 'handoff', fonte: 'isa', acao: 'direcionar_atendimento_humano', lead_id, dados: { tipo_handoff, motivo, subscriber_id: subscriberId, timestamp: new Date().toISOString() }, processado: false });
        if (RESEND_API_KEY) {
          try {
            const { data: lead } = await supabase.from('leads_juridicos').select('nome, telefone, email, tipo_acao').eq('id', lead_id).single();
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
              body: JSON.stringify({ from: 'Isa - Bentes & Ramos <onboarding@resend.dev>', to: ['bentes@bentesramos.com.br'], subject: `🔔 Handoff: ${lead?.nome || 'Lead'}`, html: `<h2>Lead direcionado para humano</h2><p><strong>Lead:</strong> ${lead?.nome}</p><p><strong>Motivo:</strong> ${motivo}</p>` }),
            });
          } catch (err) { console.error('Erro ao enviar email de handoff:', err); }
        }
        return { success: true, message: `Lead direcionado para atendimento humano: ${motivo}`, data: { tipo_handoff, motivo } };
      }

      default:
        return { success: false, message: `Ação "${acao}" não reconhecida` };
    }
  } catch (error) {
    console.error(`❌ Erro na ação ${acao}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return { success: false, message: `Erro ao executar ${acao}: ${errorMessage}` };
  }
}

async function gerarOpcoesHorario(supabase: any, leadId?: string): Promise<Array<{ label: string; short: string; datetime: string; disponivel: boolean }>> {
  const opcoes: Array<{ label: string; short: string; datetime: string; disponivel: boolean }> = [];
  const proximaSegunda = getProximaSegundaUtc();
  const fimPeriodo = new Date(proximaSegunda.getTime() + 21 * 24 * 60 * 60 * 1000);
  const { data: compromissosExistentes } = await supabase.from('compromissos').select('data_inicio, data_fim').gte('data_inicio', proximaSegunda.toISOString()).lte('data_inicio', fimPeriodo.toISOString());
  const horariosOcupados = new Set<string>();
  if (compromissosExistentes) {
    for (const c of compromissosExistentes) {
      const dataInicio = new Date(c.data_inicio);
      const dataStr = dataInicio.toISOString().split('T')[0];
      const horaManaus = dataInicio.toLocaleTimeString('pt-BR', { timeZone: 'America/Manaus', hour: '2-digit', minute: '2-digit' });
      horariosOcupados.add(`${dataStr} ${horaManaus}`);
    }
  }
  let diaAtual = new Date(proximaSegunda);
  let diasProcessados = 0;
  const maxDias = 9;
  while (diasProcessados < maxDias && opcoes.length < 6) {
    const diaSemana = diaAtual.getDay();
    if (DIAS_PERMITIDOS.includes(diaSemana)) {
      diasProcessados++;
      const dataStrISO = diaAtual.toISOString().split('T')[0];
      const nomeDia = NOMES_DIAS[diaSemana];
      for (const horario of HORARIOS_DISPONIVEIS) {
        const chave = `${dataStrISO} ${horario}`;
        if (!horariosOcupados.has(chave) && opcoes.length < 6) {
          const dataHoraUtc = new Date(`${dataStrISO}T${horario}:00-04:00`);
          opcoes.push({ label: `${nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1)}, ${formatarData(diaAtual)} às ${horario}`, short: `${diaAtual.getDate()}/${diaAtual.getMonth() + 1} ${horario}`, datetime: dataHoraUtc.toISOString(), disponivel: true });
        }
      }
    }
    diaAtual = new Date(diaAtual.getTime() + 24 * 60 * 60 * 1000);
  }
  return opcoes;
}

async function enviarRespostaZapi(supabaseClient: any, subscriberId: string, mensagem: string): Promise<{ success: boolean; messageId?: string }> {
  try {
    const { data: subscriber } = await supabaseClient.from('manychat_subscribers').select('telefone, linha_whatsapp, lead_id').eq('subscriber_id', subscriberId).maybeSingle();
    if (!subscriber?.telefone) return { success: false };
    const isTrafficLine = subscriber.linha_whatsapp === 'trafego_isa';
    let useTrafficInstance = isTrafficLine;
    if (!useTrafficInstance && subscriber.lead_id) {
      const { data: lead } = await supabaseClient.from('leads_juridicos').select('linha_whatsapp, tipo_origem, fonte_trafego').eq('id', subscriber.lead_id).maybeSingle();
      useTrafficInstance = lead?.linha_whatsapp === 'trafego_isa' || lead?.tipo_origem === 'trafego' || lead?.fonte_trafego?.includes('facebook');
    }
    let instanceId: string | undefined;
    let token: string | undefined;
    let clientToken: string | undefined;
    let instanceName = 'default';
    if (useTrafficInstance) {
      const { data: trafficInstance } = await supabaseClient.from('zapi_instances').select('instance_id, token, client_token, name').eq('is_active', true).ilike('phone_number', '%85888190%').maybeSingle();
      if (trafficInstance) { instanceId = trafficInstance.instance_id; token = trafficInstance.token; clientToken = trafficInstance.client_token; instanceName = trafficInstance.name || 'traffic'; }
    }
    if (!instanceId) {
      const { data: zapiInstance } = await supabaseClient.from('zapi_instances').select('instance_id, token, client_token, name').eq('is_active', true).eq('is_default', true).maybeSingle();
      if (zapiInstance) { instanceId = zapiInstance.instance_id; token = zapiInstance.token; clientToken = zapiInstance.client_token; instanceName = zapiInstance.name || 'default'; }
      else {
        const { data: legacyConfig } = await supabaseClient.from('integrations_config').select('config_json, is_active').eq('provider', 'zapi').single();
        if (!legacyConfig?.is_active) return { success: false };
        instanceId = legacyConfig.config_json?.instance_id;
        token = legacyConfig.config_json?.token;
        clientToken = legacyConfig.config_json?.client_token;
      }
    }
    if (!instanceId || !token) return { success: false };
    let cleanPhone = subscriber.telefone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = '55' + cleanPhone;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (clientToken) headers['Client-Token'] = clientToken;
    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, { method: 'POST', headers, body: JSON.stringify({ phone: cleanPhone, message: mensagem }) });
    const result = await response.json();
    if (!response.ok || result.error) return { success: false };
    return { success: true, messageId: result.messageId || result.id };
  } catch (error) {
    console.error('❌ Erro ao enviar via Z-API:', error);
    return { success: false };
  }
}

async function enviarImagemZapi(supabaseClient: any, subscriberId: string, imageUrl: string, caption: string): Promise<{ success: boolean }> {
  try {
    const { data: subscriber } = await supabaseClient.from('manychat_subscribers').select('telefone, linha_whatsapp, lead_id').eq('subscriber_id', subscriberId).maybeSingle();
    if (!subscriber?.telefone) return { success: false };
    const isTrafficLine = subscriber.linha_whatsapp === 'trafego_isa';
    let useTrafficInstance = isTrafficLine;
    if (!useTrafficInstance && subscriber.lead_id) {
      const { data: lead } = await supabaseClient.from('leads_juridicos').select('linha_whatsapp, tipo_origem, fonte_trafego').eq('id', subscriber.lead_id).maybeSingle();
      useTrafficInstance = lead?.linha_whatsapp === 'trafego_isa' || lead?.tipo_origem === 'trafego' || lead?.fonte_trafego?.includes('facebook');
    }
    let instanceId: string | undefined;
    let token: string | undefined;
    let clientToken: string | undefined;
    if (useTrafficInstance) {
      const { data: ti } = await supabaseClient.from('zapi_instances').select('instance_id, token, client_token').eq('is_active', true).ilike('phone_number', '%85888190%').maybeSingle();
      if (ti) { instanceId = ti.instance_id; token = ti.token; clientToken = ti.client_token; }
    }
    if (!instanceId) {
      const { data: di } = await supabaseClient.from('zapi_instances').select('instance_id, token, client_token').eq('is_active', true).eq('is_default', true).maybeSingle();
      if (di) { instanceId = di.instance_id; token = di.token; clientToken = di.client_token; }
    }
    if (!instanceId || !token) return { success: false };
    let cleanPhone = subscriber.telefone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = '55' + cleanPhone;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (clientToken) headers['Client-Token'] = clientToken;
    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-image`, {
      method: 'POST', headers,
      body: JSON.stringify({ phone: cleanPhone, image: imageUrl, caption }),
    });
    const result = await response.json();
    return { success: response.ok && !result.error };
  } catch (err) {
    console.error('❌ Erro ao enviar imagem Z-API:', err);
    return { success: false };
  }
}

async function enviarBotoesZapi(
  supabaseClient: any,
  subscriberId: string,
  mensagem: string,
  botoes: Array<{ id: string; title: string }>
): Promise<{ success: boolean }> {
  try {
    const { data: subscriber } = await supabaseClient.from('manychat_subscribers').select('telefone, linha_whatsapp, lead_id').eq('subscriber_id', subscriberId).maybeSingle();
    if (!subscriber?.telefone) return { success: false };
    const isTrafficLine = subscriber.linha_whatsapp === 'trafego_isa';
    let useTrafficInstance = isTrafficLine;
    if (!useTrafficInstance && subscriber.lead_id) {
      const { data: lead } = await supabaseClient.from('leads_juridicos').select('linha_whatsapp, tipo_origem, fonte_trafego').eq('id', subscriber.lead_id).maybeSingle();
      useTrafficInstance = lead?.linha_whatsapp === 'trafego_isa' || lead?.tipo_origem === 'trafego' || lead?.fonte_trafego?.includes('facebook');
    }
    let instanceId: string | undefined;
    let token: string | undefined;
    let clientToken: string | undefined;
    if (useTrafficInstance) {
      const { data: ti } = await supabaseClient.from('zapi_instances').select('instance_id, token, client_token').eq('is_active', true).ilike('phone_number', '%85888190%').maybeSingle();
      if (ti) { instanceId = ti.instance_id; token = ti.token; clientToken = ti.client_token; }
    }
    if (!instanceId) {
      const { data: di } = await supabaseClient.from('zapi_instances').select('instance_id, token, client_token').eq('is_active', true).eq('is_default', true).maybeSingle();
      if (di) { instanceId = di.instance_id; token = di.token; clientToken = di.client_token; }
    }
    if (!instanceId || !token) return { success: false };
    let cleanPhone = subscriber.telefone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = '55' + cleanPhone;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (clientToken) headers['Client-Token'] = clientToken;
    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-button-actions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: cleanPhone,
        message: mensagem,
        buttonActions: botoes.map(b => ({ id: b.id, type: 'REPLY', reply: { title: b.title } })),
      }),
    });
    const result = await response.json();
    if (!response.ok || result.error) { console.error('❌ Z-API botões erro:', result); return { success: false }; }
    return { success: true };
  } catch (err) {
    console.error('❌ Erro ao enviar botões Z-API:', err);
    return { success: false };
  }
}

async function enviarRespostaManyChat(subscriberId: string, mensagem: string): Promise<boolean> {
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const result = await enviarRespostaZapi(supabaseClient, subscriberId, mensagem);
  return result.success;
}

async function transcreverAudio(audioUrl: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) return null;
    const audioBlob = await audioResponse.blob();
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }, body: formData });
    if (!whisperResponse.ok) return null;
    const result = await whisperResponse.json();
    return result.text || null;
  } catch (error) {
    console.error('❌ Erro ao transcrever áudio:', error);
    return null;
  }
}

function isAudioUrl(content: string): boolean {
  if (!content) return false;
  const lowerContent = content.toLowerCase();
  return lowerContent.match(/\.(ogg|mp3|wav|m4a|aac|opus)(\?|$)/) !== null || lowerContent.includes('voice') || lowerContent.includes('audio') || lowerContent.includes('ptt');
}

function isAudioMessage(tipoMensagem?: string, mensagem?: string, mediaUrl?: string): boolean {
  const tipo = (tipoMensagem || '').toLowerCase();
  const content = String(mensagem || '') + ' ' + String(mediaUrl || '');
  return ['audio', 'ptt', 'voice', 'voice_message', 'audiomessage', 'audio_message'].includes(tipo) || isAudioUrl(content);
}

function isImageUrl(content: string): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  return lower.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/) !== null || lower.includes('image') || lower.includes('photo');
}

function isPdfUrl(content: string): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  return lower.includes('.pdf') || lower.includes('application/pdf');
}

async function analisarPdfComIA(pdfUrl: string): Promise<string | null> {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) { console.log('⚠️ ANTHROPIC_API_KEY não configurada'); return null; }
  try {
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) { console.error('❌ Não foi possível baixar o PDF:', pdfResponse.status); return null; }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const bytes = new Uint8Array(pdfBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: 'Analise este documento e extraia as informações principais relevantes para um escritório de advocacia. Identifique: tipo de documento, nome do titular, CPF/RG se presente, datas relevantes, valores, banco/instituição se mencionado, cláusulas importantes. Seja conciso e objetivo. Responda em português.' },
          ],
        }],
      }),
    });

    if (!response.ok) { console.error('❌ Erro Anthropic PDF:', await response.text()); return null; }
    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch (error) {
    console.error('❌ Erro ao processar PDF:', error);
    return null;
  }
}

async function getLeadState(supabase: any, leadId: string): Promise<string | null> {
  const { data: lead } = await supabase.from('leads_juridicos').select('lead_state, status, is_lost, tipo_origem, fonte_trafego, canal_origem, created_at, linha_whatsapp, isa_ativa, empresa_tag').eq('id', leadId).single();
  if (!lead) return null;
  if (lead.is_lost) return 'LOST';
  if (['Contrato Assinado', 'Ganho', 'Contrato Fechado'].includes(lead.status)) return 'BLOCKED';
  if (lead.isa_ativa === false || lead.linha_whatsapp === 'bentes_ramos_antigo') return 'BENTES_RAMOS';
  if (lead.linha_whatsapp === 'trafego_isa') return lead.lead_state || 'NEW';
  const tipoOrigem = lead.tipo_origem || 'indefinido';
  if (tipoOrigem === 'whatsapp_direto') return 'BENTES_RAMOS';
  if (tipoOrigem === 'trafego') return lead.lead_state || 'NEW';
  const isFromTraffic = Boolean(lead.fonte_trafego || lead.canal_origem === 'trafego_pago' || lead.canal_origem === 'instagram' || lead.canal_origem === 'facebook' || lead.canal_origem === 'google');
  if (isFromTraffic) return lead.lead_state || 'NEW';
  const createdAt = new Date(lead.created_at);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  if (createdAt <= thirtyDaysAgo) return 'BENTES_RAMOS';
  return lead.lead_state || 'NEW';
}

// ============================================================
// ALTERAÇÃO 3: processarComIA usa getPromptForAgent
// ============================================================
async function processarComIA(contexto: LeadContext, mensagem: string, subscriberId: string, imageUrl?: string): Promise<{
  resposta: string;
  acoes: Array<{ acao: string; dados: any; motivo: string; automatica: boolean }>;
  analise: { intencao: string; sentimento: string; urgencia: string; area_juridica?: string; deve_direcionar_humano?: boolean; motivo_handoff?: string };
}> {
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  // ALTERAÇÃO 3: Substituído bloco de busca por getPromptForAgent
  const promptConfig = await getPromptForAgent(supabaseClient, contexto.lead.id);

  const strictMode = promptConfig?.strict_mode ?? true;

  const { data: agendamentoPendente } = await supabaseClient.from('system_events').select('*').eq('lead_id', contexto.lead.id).eq('acao', 'aguardando_confirmacao_lead').eq('processado', false).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const temAgendamentoPendente = !!agendamentoPendente;
  const opcoesAgendamento = agendamentoPendente?.dados?.opcoes_oferecidas || [];

  let followupInfo = '';
  if (contexto.followup) {
    const statusFollowup = await verificarFollowupStatus(supabaseClient, contexto.lead.id, contexto.followup);
    const stageFast = contexto.followup.followup_stage_fast || 0;
    const stageSlow = contexto.followup.followup_stage_slow || 0;
    followupInfo = `\n📊 STATUS DO FOLLOW-UP:\n- Estágio FAST: ${stageFast}/3\n- Estágio SLOW: ${stageSlow}/3\n- Respondeu: ${contexto.followup.respondido ? 'SIM ✅' : 'NÃO'}\n- Status: ${statusFollowup.status}\n`;
  }

  const historicoCompleto = [
    ...contexto.mensagens.slice(0, 50).map(m => ({ tipo: 'chat', origem: m.direcao === 'inbound' ? 'cliente' : 'bot/equipe', conteudo: m.conteudo, data: m.created_at })),
    ...contexto.interacoes.slice(0, 10).map(i => ({ tipo: 'interacao', origem: i.direcao === 'entrada' ? 'cliente' : 'equipe', conteudo: `[${i.tipo}] ${i.resumo}${i.detalhes ? ': ' + i.detalhes : ''}`, data: i.data_interacao })),
  ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  const historicoFormatado = historicoCompleto.slice(-40).map(h => `[${h.origem.toUpperCase()}] ${h.conteudo}`).join('\n');

  const leadState = contexto.lead.lead_state || 'NEW';
  const classification = contexto.classification;
  const contractData = contexto.contractData;
  const docsChecklist = contexto.docsChecklist || [];
  const docsResumo = resumirDocumentos(docsChecklist);
  const docsPending = docsChecklist.filter((d: any) => d.is_required && !d.received);
  const docsReceived = docsChecklist.filter((d: any) => d.received);
  const ultimasMensagensCliente = contexto.mensagens
    .filter((m: any) => m.direcao === 'entrada' || m.direcao === 'inbound')
    .slice(0, 5)
    .map((m: any) => (m.conteudo || '').substring(0, 220));
  const ultimaMensagemCliente = ultimasMensagensCliente[0] || '(sem mensagem anterior do cliente)';
  const ultimaMensagemAgente = contexto.mensagens
    .filter((m: any) => m.direcao === 'saida')
    .slice(0, 1)
    .map((m: any) => (m.conteudo || '').substring(0, 260))[0] || '(sem resposta anterior do agente)';
  const lembretesPendentes = (contexto.lembretesPendentes || [])
    .map((e: any) => `${e.dados?.scheduled_for || 'sem horario'}: ${e.dados?.mensagem || 'lembrete pendente'}`)
    .slice(0, 3);
  const camposContratoSalvos = contractData
    ? Object.keys(contractData).filter(k => contractData[k] && !['id', 'lead_id', 'created_at', 'updated_at'].includes(k))
    : [];

  // Buscar agente atual para info no prompt
  const agentAtual = await getIsaAgent(supabaseClient, contexto.lead.id);

  // Últimas mensagens enviadas por ESTE agente (para evitar repetição)
  const ultimasBotMsgs = contexto.mensagens
    .filter((m: any) => m.direcao === 'saida' && m.metadata?.agent === agentAtual)
    .slice(0, 5)
    .map((m: any) => (m.conteudo || '').substring(0, 250));

  const basePrompt = promptConfig?.content || 'Você é Isa, assistente do escritório Bentes & Ramos.';

  const systemPrompt = `${basePrompt}

${strictMode ? '🔒 MODO RÍGIDO ATIVADO: Opere pela máquina de estados.\n' : ''}

${RESPONSE_INTELLIGENCE_GUIDE}

AGENTE ATUAL: ${agentAtual}
${AGENT_MISSIONS[agentAtual] || ''}

🏢 ENDEREÇO FÍSICO DO ESCRITÓRIO:
${ENDERECO_FISICO}
- Quando o cliente perguntar se tem endereço físico, responda com o endereço acima.
- Em seguida pergunte se ele já possui o contrato assinado conosco.
- Se possuir contrato, ofereça horários de Terça ou Quinta.

📅 REGRAS DE AGENDAMENTO:
- Dias: Terça-feira e Quinta-feira APENAS
- Horários manhã: 09:00, 10:00, 11:00 | Horários tarde: 14:00, 15:00, 16:00
- Use verificar_agenda para checar disponibilidade antes de oferecer horários
- Link: https://cal.com/bentes-ramos-advocacia-1ucmau/agendamentos-crm

${temAgendamentoPendente ? `⚠️ AGENDAMENTO PENDENTE: ${JSON.stringify(opcoesAgendamento.map((o: { label: string }) => o.label))}\n` : ''}

${followupInfo}

MEMORIA OPERACIONAL OBRIGATORIA:
- Ultima mensagem do cliente: ${ultimaMensagemCliente}
- Ultima mensagem do agente: ${ultimaMensagemAgente}
- Documentos ja recebidos: ${formatarLista(docsResumo.recebidos)}
- Documentos pendentes: ${formatarLista(docsResumo.pendentes)}
- Pendencias criticas: ${formatarLista(docsResumo.pendentesCriticos)}
- Dados de contrato ja salvos: ${formatarLista(camposContratoSalvos)}
- Lembretes/follow-ups ja agendados: ${formatarLista(lembretesPendentes)}

REGRA DE MEMORIA:
- Se a ultima mensagem do agente ja pediu um documento/dado, nao repita a mesma pergunta. Avance, confirme ou agende follow-up.
- Se o cliente respondeu com documento, audio, imagem, PDF ou confirmacao, reconheca isso antes de pedir qualquer outra coisa.
- Se houver lembrete pendente para o mesmo assunto, nao crie outro.

CONTEXTO DO LEAD:
Nome: ${contexto.lead.nome || 'Nao informado'}
Status: ${contexto.lead.status || 'Lead Frio'}
Estado: ${leadState}
Telefone: ${contexto.lead.telefone || 'Nao informado'}
Tipo Acao: ${contexto.lead.tipo_acao || 'Nao classificado'}
🔄 ESTADO ATUAL: ${leadState}
${leadState === 'NEW' ? '→ Identifique o problema e roteie para o especialista correto usando transicionar_agente.' : ''}
${leadState === 'TRIAGE' ? '→ Classifique o caso e transfira para especialista.' : ''}
${leadState === 'CLASSIFIED' ? `→ Classificação: ${classification?.case_type || 'Não definida'}. Colete dados para contrato.` : ''}
${leadState === 'DATA_CAPTURE' ? `→ Dados salvos: ${contractData ? Object.keys(contractData).filter(k => contractData[k] && !['id', 'lead_id', 'created_at', 'updated_at'].includes(k)).join(', ') || 'Nenhum' : 'Nenhum'}. Continue coletando.` : ''}
${leadState === 'DOCS_PENDING' ? `→ Docs pendentes: ${docsPending.length > 0 ? docsPending.map((d: any) => d.doc_label).join(', ') : 'Nenhum!'}` : ''}
${leadState === 'READY_FOR_LAWYER' ? '→ BLOQUEADO. Aguardar equipe jurídica.' : ''}

📜 HISTÓRICO:
${historicoFormatado || '(Sem histórico)'}

${ultimasBotMsgs.length > 0 ? `⚠️ SUAS ÚLTIMAS MENSAGENS ENVIADAS (NUNCA REPITA TEXTUALMENTE — varie sempre):
${ultimasBotMsgs.map((m: string, i: number) => `${i + 1}. "${m}"`).join('\n')}
` : ''}
⚙️ AÇÕES DISPONÍVEIS:
- transicionar_agente: { lead_id, isa_agent: "isa_bancario"|"isa_aereo"|"humano" } — ROTEAMENTO SILENCIOSO
- transicionar_estado: { lead_id, to_state }
- classificar_caso: { lead_id, case_type, sub_type?, summary?, recommended_docs? }
- salvar_dados_contrato: { lead_id, cpf?, rg?, data_nascimento?, endereco?, cidade?, uf?, cep?, estado_civil?, profissao?, nacionalidade?, nome_mae?, dados_extras? }
- marcar_doc_recebido: { lead_id, doc_type, notes? } - doc_type sugeridos: contrato, extrato, contrato_ou_extrato, comprovante_do_problema, rg_frente, rg_verso, cnh_frente, cnh_verso, comprovante_residencia
- verificar_docs_pendentes: { lead_id }
- classificar_lead: { lead_id, novo_status }
- atualizar_dados_lead: { lead_id, nome?, telefone?, email? }
- criar_interacao: { cliente_id, tipo, resumo }
- verificar_agenda, agendar_direto: para agendamentos
- pausar_followup / retomar_followup: { lead_id }
- direcionar_atendimento_humano: { lead_id, motivo, tipo }
- agendar_lembrete: { lead_id, mensagem, delay_minutos } — Agenda mensagem para enviar ao cliente após X minutos (mín 5, máx 1440)
- enviar_video_inss: { lead_id, video_numero: 1|2|3 } — Envia tutorial INSS com botões (1=acessar extrato, 2=criar código acesso, 3=recuperar GOV.br)

ROTEAMENTO (apenas quando agente=isa_triagem):
- Bancário → transicionar_agente com isa_agent: "isa_bancario"
- Aéreo → transicionar_agente com isa_agent: "isa_aereo"
- Outra área → direcionar_atendimento_humano com [TRANSFERIR_HUMANO]
- Transferência SILENCIOSA — não avisar o cliente

MELISSA - OBJETIVO EM BANCARIO:
- Analisar a conversa e documentos antes de pedir qualquer coisa.
- Se contrato/extrato ja foi recebido, confirme e solicite apenas o proximo item faltante.
- Para analise bancaria, priorize: contrato ou extrato, comprovante do problema/desconto, documento com foto frente e verso (RG ou CNH) e dados minimos para contrato.
- RG ou CNH sempre precisa de frente e verso. Se so houver um lado, peca somente o lado faltante.
- Se o lead pedir para analisar contrato, nao pergunte novamente banco/produto se o documento ou historico ja indicarem isso.

FOLLOW-UP CONTEXTUAL — REGRAS (somente leads de tráfego):
- Ao pedir qualquer documento: chame agendar_lembrete NA MESMA resposta (delay_minutos=1440, mensagem contextual ao doc)
- Cliente disse que fará mais tarde / quando chegar em casa: delay proporcional (ex: 120 min)
- Cliente informou horário específico: calcule os minutos exatos
- Não agende lembrete se o cliente acabou de enviar algo ou está respondendo na mesma conversa
- Não agende mais de 1 lembrete ativo por conversa para o mesmo assunto

FOLLOW-UP CONTEXTUAL (use agendar_lembrete quando):
- Se voce pedir documento/dado essencial e o lead nao responder imediatamente, agende um lembrete coerente para cobrar esse mesmo item.
- Cliente disser que fara algo mais tarde / quando chegar em casa / amanha: agende com delay adequado (ex: 120 min) e mensagem profissional, sem emoji.
- Cliente informar horario especifico: calcule os minutos e use esse delay exato.
- Nunca agende mais de um lembrete para o mesmo assunto se ja houver lembrete pendente em MEMORIA OPERACIONAL.
- Quando o lead enviar o documento cobrado, nao cobre de novo; confirme recebimento e avance.
Responda em JSON:
{
  "analise": {
    "intencao": "descrição breve",
    "sentimento": "positivo|neutro|negativo",
    "urgencia": "baixa|media|alta|urgente",
    "area_juridica": "bancario|aereo|trabalhista|outro|indefinido",
    "deve_direcionar_humano": false,
    "motivo_handoff": ""
  },
  "resposta": "Mensagem para o cliente (máximo 4 linhas)",
  "acoes": [{ "acao": "nome", "dados": {}, "motivo": "razão" }]
}`;

  const ANTHROPIC_KEY_MAIN = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_KEY_MAIN) throw new Error('ANTHROPIC_API_KEY não configurada');

  const userContent: any = imageUrl
    ? [
        { type: 'image', source: { type: 'url', url: imageUrl } },
        { type: 'text', text: `NOVA MENSAGEM DO CLIENTE (enviou uma imagem):\n"${mensagem}"` },
      ]
    : `NOVA MENSAGEM DO CLIENTE:\n"${mensagem}"`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY_MAIN,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) { const error = await response.text(); console.error('❌ Erro na API Anthropic:', error); throw new Error('Erro ao processar com IA'); }

  const data = await response.json();
  const resultado = parseAiJson(data.content[0].text);

  const acoesProcessadas = (resultado.acoes || []).map((a: any) => ({
    acao: a.acao,
    dados: { ...a.dados, lead_id: contexto.lead.id, cliente_id: contexto.lead.id, status_anterior: contexto.lead.status },
    motivo: a.motivo || '',
    automatica: ACOES_AUTOMATICAS.includes(a.acao),
  }));

  return { resposta: resultado.resposta || '', acoes: acoesProcessadas, analise: resultado.analise };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const { lead_id, subscriber_id, mensagem, canal, tipo_mensagem, media_url } = await req.json();

    console.log('🤖 Isa Auto-Process iniciado');
    console.log('📝 Lead ID:', lead_id);
    console.log('📱 Subscriber ID:', subscriber_id);
    console.log('💬 Mensagem:', mensagem?.substring(0, 100));
    console.log('📎 Tipo:', tipo_mensagem);
    console.log('🔗 Media URL:', media_url ? 'presente' : 'ausente');

    if (!lead_id || (!mensagem && !media_url)) {
      return new Response(JSON.stringify({ success: false, error: 'lead_id e mensagem ou media_url sao obrigatorios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar se a Isa está habilitada via app_settings
    const { data: isaSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'isa_auto_enabled')
      .maybeSingle();
    if (isaSetting && isaSetting.value === 'false') {
      console.log('⏸️ Isa desabilitada via app_settings — ignorando mensagem');
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'agent_disabled' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // LOCK de processamento
    const lockExpiry = 30;
    const { data: recentProcessing } = await supabase.from('system_events').select('id, created_at').eq('lead_id', lead_id).eq('acao', 'isa_processing_lock').eq('processado', false).gte('created_at', new Date(Date.now() - lockExpiry * 1000).toISOString()).maybeSingle();
    if (recentProcessing) {
      console.log('⏳ Processamento em andamento, ignorando duplicata');
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'processamento_concorrente' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const { data: lockData } = await supabase.from('system_events').insert({ tipo: 'lock', fonte: 'isa_auto', acao: 'isa_processing_lock', lead_id, dados: { mensagem_hash: String(mensagem || media_url || '').substring(0, 50), subscriber_id }, processado: false }).select().single();
    const lockId = lockData?.id;

    // Rate limit — conta apenas respostas reais do agente atual (exclui intros) nos últimos 30s
    const currentAgentForRateLimit = await getIsaAgent(supabase, lead_id);
    const { data: recentIsaMessages } = await supabase.from('manychat_mensagens').select('id, conteudo, created_at').eq('lead_id', lead_id).eq('direcao', 'saida').eq('metadata->>source', 'isa').eq('metadata->>agent', currentAgentForRateLimit).neq('metadata->>is_intro', 'true').gte('created_at', new Date(Date.now() - 30 * 1000).toISOString()).order('created_at', { ascending: false }).limit(3);
    if (recentIsaMessages && recentIsaMessages.length >= 2) {
      console.log('🛑 Rate limit - muitas respostas recentes');
      if (lockId) await supabase.from('system_events').update({ processado: true }).eq('id', lockId);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'rate_limit_respostas' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar estado do lead
    const currentState = await getLeadState(supabase, lead_id);
    if (currentState === null) {
      return new Response(JSON.stringify({ success: false, error: 'Lead não encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (['BLOCKED', 'LOST', 'LEGACY_CLIENT', 'BENTES_RAMOS'].includes(currentState)) {
      console.log(`🚫 Lead ${currentState}, abortando`);
      return new Response(JSON.stringify({ success: false, skipped: true, reason: currentState }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Ignorar mensagens do bot
    const mensagemLower = String(mensagem || media_url || '').toLowerCase().trim();
    if (mensagemLower.startsWith('bot diz:') || mensagemLower.startsWith('isa diz:') || mensagemLower.startsWith('[bot]') || mensagemLower.startsWith('[isa]')) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'mensagem_do_bot' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar atendimento humano
    if (subscriber_id) {
      const { data: subscriberCheck } = await supabase.from('manychat_subscribers').select('atendimento_humano').eq('subscriber_id', subscriber_id).maybeSingle();
      if (subscriberCheck?.atendimento_humano) {
        console.log('⏸️ Atendimento humano ativo');
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'atendimento_humano_ativo' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Transcrever áudio se necessário
    let mensagemProcessada = mensagem || media_url || '[Midia recebida]';
    let audioTranscrito = false;
    let imageUrlParaIA: string | undefined;

    if (isAudioMessage(tipo_mensagem, mensagemProcessada, media_url)) {
      const urlAudio = media_url || mensagemProcessada;
      const transcricao = await transcreverAudio(urlAudio);
      if (transcricao) {
        mensagemProcessada = transcricao;
        audioTranscrito = true;
        await supabase.from('interacoes').insert({ cliente_id: lead_id, tipo: 'WhatsApp', resumo: `Áudio transcrito: "${transcricao.substring(0, 200)}"`, detalhes: transcricao, direcao: 'Entrada' });
      } else {
        mensagemProcessada = '[Áudio recebido - transcrição não disponível]';
      }
    } else if (tipo_mensagem === 'image' || (media_url && isImageUrl(media_url))) {
      // Imagem: passa a URL para o GPT-4o-mini vision processar diretamente
      imageUrlParaIA = media_url || mensagem;
      mensagemProcessada = mensagem && mensagem !== imageUrlParaIA ? mensagem : '[Imagem enviada]';
      console.log('🖼️ Imagem detectada — enviando para análise visual');
    } else if (tipo_mensagem === 'document' || (media_url && isPdfUrl(media_url))) {
      // PDF/Documento: extrai conteúdo com Anthropic e passa como texto
      const docUrl = media_url || mensagem;
      console.log('📄 Documento recebido — analisando com IA...');
      const analise = await analisarPdfComIA(docUrl);
      if (analise) {
        mensagemProcessada = `[Documento/PDF recebido]\n\nConteúdo extraído:\n${analise}`;
        await supabase.from('interacoes').insert({ cliente_id: lead_id, tipo: 'WhatsApp', resumo: 'Documento PDF analisado pela IA', detalhes: analise.substring(0, 500), direcao: 'Entrada' });
        console.log('✅ PDF analisado com sucesso');
      } else {
        mensagemProcessada = `[Documento recebido — não foi possível extrair o conteúdo automaticamente]`;
      }
    }

    // Buscar contexto do lead
    let contexto = await buscarContextoLead(supabase, lead_id);
    if (!contexto) {
      return new Response(JSON.stringify({ success: false, error: 'Lead nao encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const docsInferidos = inferirDocumentosDaMensagem(mensagemProcessada, tipo_mensagem, media_url);
    if (docsInferidos.length > 0) {
      for (const docType of docsInferidos) {
        await executarAcao(supabase, 'marcar_doc_recebido', {
          lead_id,
          doc_type: docType,
          notes: `Documento inferido automaticamente pela Melissa a partir de ${tipo_mensagem || 'mensagem'}`,
        }, subscriber_id);
      }
      const contextoAtualizado = await buscarContextoLead(supabase, lead_id);
      if (contextoAtualizado) contexto = contextoAtualizado;
    }
    // Capturar agente ativo ANTES do processamento (para subscriber_nome correto)
    const agentKeyBefore = await getIsaAgent(supabase, lead_id);
    const agentDisplayName = AGENT_DISPLAY_NAMES[agentKeyBefore] || 'Isa';

    console.log('📊 Contexto carregado para:', contexto.lead.nome, '| Agente:', agentDisplayName);

    // Se especialista está respondendo pela primeira vez, enviar intro antes da resposta IA
    if ((agentKeyBefore === 'isa_bancario' || agentKeyBefore === 'isa_aereo') && subscriber_id) {
      const { data: prevSpecialistMsg } = await supabase
        .from('manychat_mensagens')
        .select('id')
        .eq('lead_id', lead_id)
        .eq('direcao', 'saida')
        .eq('metadata->>agent', agentKeyBefore)
        .limit(1)
        .maybeSingle();

      if (!prevSpecialistMsg) {
        const introMsg = AGENT_INTROS[agentKeyBefore];
        if (introMsg) {
          console.log(`[Isa Routing] 📣 Primeiro contato de ${AGENT_DISPLAY_NAMES[agentKeyBefore]} — enviando intro`);
          const introSend = await enviarRespostaZapi(supabase, subscriber_id, introMsg);
          if (introSend.success) {
            await supabase.from('manychat_mensagens').insert({
              subscriber_id,
              subscriber_nome: AGENT_DISPLAY_NAMES[agentKeyBefore] || 'Especialista',
              canal: canal || 'whatsapp',
              conteudo: introMsg,
              tipo: 'text',
              direcao: 'saida',
              lead_id,
              metadata: { auto_gerada: true, source: 'isa', agent: agentKeyBefore, is_intro: true },
            });
          }
        }
      }
    }

    // Marcar follow-up como respondido
    const agora = new Date().toISOString();
    if (contexto.followup) {
      if (!contexto.followup.respondido) {
        await supabase.from('lead_followups').update({ respondido: true, respondido_em: agora, waiting_reply: false, last_inbound_at: agora, status: 'respondido' }).eq('id', contexto.followup.id);
        await supabase.from('system_events').insert({ tipo: 'followup', fonte: 'isa_inteligente', acao: 'lead_respondeu', lead_id, dados: { followup_id: contexto.followup.id }, processado: true });
        if (contexto.lead.status === 'Lead Frio') {
          await supabase.from('leads_juridicos').update({ status: 'Em Atendimento' }).eq('id', lead_id);
          contexto.lead.status = 'Em Atendimento';
        }
      } else {
        await supabase.from('lead_followups').update({ last_inbound_at: agora, waiting_reply: false }).eq('id', contexto.followup.id);
      }
    }

    // Processar com IA
    const resultado = await processarComIA(contexto, mensagemProcessada, subscriber_id, imageUrlParaIA);
    console.log('🧠 Análise da IA:', resultado.analise);
    console.log('📋 Ações sugeridas:', resultado.acoes.length);

    // Executar ações
    const acoesExecutadas = [];
    const acoesNauto = [];

    // Captura o agente de destino diretamente no loop para evitar falha de detecção pós-loop
    let transferredToAgent: string | null = null;

    for (const acao of resultado.acoes) {
      if (acao.automatica) {
        console.log(`⚡ Executando ação automática: ${acao.acao}`);
        const resultadoAcao = await executarAcao(supabase, acao.acao, acao.dados, subscriber_id);
        acoesExecutadas.push({ ...acao, resultado: resultadoAcao });

        // Detectar transferência para especialista no momento exato em que ocorre
        if (
          acao.acao === 'transicionar_agente' &&
          resultadoAcao.success &&
          (acao.dados.isa_agent === 'isa_bancario' || acao.dados.isa_agent === 'isa_aereo')
        ) {
          transferredToAgent = acao.dados.isa_agent;
          console.log(`[Isa Routing] 🔀 Transferência detectada → ${transferredToAgent}`);
        }

        if (acao.acao === 'confirmar_agendamento') {
          await supabase.from('system_events').update({ processado: true }).eq('lead_id', lead_id).eq('acao', 'aguardando_confirmacao_lead').eq('processado', false);
        }
      } else {
        await supabase.from('system_events').insert({ tipo: 'acao_pendente', fonte: 'isa_auto', acao: 'acao_sugerida', entidade_id: lead_id, lead_id, dados: { acao_sugerida: acao.acao, dados_acao: acao.dados, motivo: acao.motivo, mensagem_original: mensagemProcessada, audio_transcrito: audioTranscrito, analise: resultado.analise }, processado: false });
        acoesNauto.push(acao);
      }
    }

    if (acoesNauto.length > 0) {
      await enviarNotificacaoEquipe(supabase, contexto.lead, acoesNauto, resultado.analise, audioTranscrito ? `[🎤 Áudio]: ${mensagemProcessada}` : mensagem);
    }

    // ── Fallback de roteamento ─────────────────────────────────────────────────
    // Se a IA identificou a área jurídica mas NÃO incluiu transicionar_agente
    // nas ações (ou as ações falharam), forçamos a transferência agora.
    if (!transferredToAgent && agentKeyBefore === 'isa_triagem') {
      const area = resultado.analise?.area_juridica;
      const agentTarget = area === 'bancario' ? 'isa_bancario'
                        : area === 'aereo'    ? 'isa_aereo'
                        : null;
      if (agentTarget) {
        console.log(`[Isa Routing] ⚠️ Fallback: AI não chamou transicionar_agente, forçando → ${agentTarget}`);
        const forcedResult = await executarAcao(supabase, 'transicionar_agente', { lead_id, isa_agent: agentTarget }, subscriber_id);
        if (forcedResult.success) {
          transferredToAgent = agentTarget;
        }
      }
    }

    // ── Verificação final via DB (garante consistência) ────────────────────────
    if (!transferredToAgent) {
      const agentKeyAfter = await getIsaAgent(supabase, lead_id);
      if (agentKeyBefore === 'isa_triagem' &&
          (agentKeyAfter === 'isa_bancario' || agentKeyAfter === 'isa_aereo')) {
        transferredToAgent = agentKeyAfter;
        console.log(`[Isa Routing] ✅ Transferência confirmada via DB → ${transferredToAgent}`);
      }
    }

    // Enviar resposta da Isa — suprimida se houve transferência para especialista
    let respostaEnviada = false;
    let respostaMsgId: string | null = null;
    if (resultado.resposta && subscriber_id && !transferredToAgent) {
      const sendResult = await enviarRespostaZapi(supabase, subscriber_id, resultado.resposta);
      respostaEnviada = sendResult.success;
      respostaMsgId = sendResult.messageId || null;
      if (respostaEnviada && respostaMsgId) {
        const { error: insertErr } = await supabase.from('manychat_mensagens').insert({
          subscriber_id,
          subscriber_nome: agentDisplayName,
          canal: canal || 'whatsapp',
          conteudo: resultado.resposta,
          tipo: 'text',
          direcao: 'saida',
          lead_id,
          metadata: { auto_gerada: true, source: 'isa', agent: agentKeyBefore, message_id: respostaMsgId, analise: resultado.analise },
        });
        if (insertErr && !insertErr.message?.includes('duplicate') && !insertErr.code?.includes('23505')) {
          console.error('[Isa] Erro ao salvar resposta:', insertErr);
        }
      }
    }

    // Após transferência → 0) prova social, 1) Isa anuncia, 2) especialista se apresenta
    if (transferredToAgent && subscriber_id) {
      const newAgent = transferredToAgent;

      // Prova social: imagem Bradesco + texto de casos de sucesso antes da transferência
      const PROVA_SOCIAL_IMG = 'https://bentesramoscrma.lovable.app/images/prova-social-bradesco.jpg';
      const provaSocialTexto = 'Enquanto direciono seu atendimento, compartilho um exemplo de caso bancario ja analisado pelo escritorio. Seguimos com criterio, documentacao adequada e proximos passos objetivos.';
      const imgSend = await enviarImagemZapi(supabase, subscriber_id, PROVA_SOCIAL_IMG, provaSocialTexto);
      if (imgSend.success) {
        await supabase.from('manychat_mensagens').insert({
          subscriber_id,
          subscriber_nome: agentDisplayName,
          canal: canal || 'whatsapp',
          conteudo: provaSocialTexto,
          tipo: 'image',
          direcao: 'saida',
          lead_id,
          metadata: { auto_gerada: true, source: 'isa', agent: agentKeyBefore, prova_social: true, image_url: PROVA_SOCIAL_IMG },
        });
        console.log('[Isa Routing] 📸 Prova social enviada antes do handoff');
      }
      await new Promise<void>(r => setTimeout(r, 1500));

      // Mensagem curta de Isa (sem se reapresentar)
      const handoffMsg = AGENT_HANDOFFS[newAgent];
      if (handoffMsg) {
        const handoffSend = await enviarRespostaZapi(supabase, subscriber_id, handoffMsg);
        if (handoffSend.success) {
          await supabase.from('manychat_mensagens').insert({
            subscriber_id,
            subscriber_nome: agentDisplayName,
            canal: canal || 'whatsapp',
            conteudo: handoffMsg,
            tipo: 'text',
            direcao: 'saida',
            lead_id,
            metadata: { auto_gerada: true, source: 'isa', agent: agentKeyBefore },
          });
        }
      }

      // Intro da especialista após 2s
      const introMsg = AGENT_INTROS[newAgent];
      if (introMsg) {
        await new Promise<void>(r => setTimeout(r, 2000));
        const introSend = await enviarRespostaZapi(supabase, subscriber_id, introMsg);
        if (introSend.success) {
          await supabase.from('manychat_mensagens').insert({
            subscriber_id,
            subscriber_nome: AGENT_DISPLAY_NAMES[newAgent] || 'Especialista',
            canal: canal || 'whatsapp',
            conteudo: introMsg,
            tipo: 'text',
            direcao: 'saida',
            lead_id,
            metadata: { auto_gerada: true, source: 'isa', agent: newAgent, is_intro: true },
          });
          console.log(`[Isa Routing] ✅ Intro de ${AGENT_DISPLAY_NAMES[newAgent]} enviada ao lead ${lead_id}`);
        }
      }
    }

    // Registrar processamento
    await supabase.from('system_events').insert({ tipo: 'processamento', fonte: 'isa_auto', acao: 'mensagem_processada', entidade_id: lead_id, lead_id, dados: { mensagem_original: String(mensagem || media_url || '').substring(0, 200), mensagem_processada: mensagemProcessada.substring(0, 500), audio_transcrito: audioTranscrito, analise: resultado.analise, acoes_executadas: acoesExecutadas.length, acoes_pendentes: acoesNauto.length, resposta_enviada: respostaEnviada }, processado: true });

    // Liberar lock
    if (lockId) await supabase.from('system_events').update({ processado: true }).eq('id', lockId);

    console.log('✅ Processamento concluído');
    return new Response(JSON.stringify({
      success: true,
      lead: { id: contexto.lead.id, nome: contexto.lead.nome },
      analise: resultado.analise,
      resposta: resultado.resposta,
      resposta_enviada: respostaEnviada,
      audio_transcrito: audioTranscrito,
      transcricao: audioTranscrito ? mensagemProcessada : null,
      acoes_executadas: acoesExecutadas,
      acoes_pendentes: acoesNauto,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    await supabase.from('system_events').update({ processado: true }).eq('acao', 'isa_processing_lock').eq('processado', false).lt('created_at', new Date(Date.now() - 120 * 1000).toISOString());
    await supabase.from('system_events').insert({ tipo: 'erro', fonte: 'isa_auto', acao: 'processamento_erro', erro: error instanceof Error ? error.message : 'Erro desconhecido', processado: false });
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
