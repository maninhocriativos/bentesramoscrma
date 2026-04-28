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
const MANYCHAT_API_KEY = Deno.env.get('MANYCHAT_API_KEY');
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
const STATUS_BLOQUEADOS = ['Contrato Assinado', 'Ganho'];

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
  'isa_aereo':    'Jerussa',
  'humano':       'Atendente',
};

const AGENT_INTROS: Record<string, string> = {
  'isa_bancario': 'Olá! Sou a *Melissa*, especialista em Direito Bancário aqui no escritório Bentes & Ramos 😊\n\nVi que você tem uma questão relacionada a serviços financeiros. Para que eu possa te ajudar da melhor forma, pode me dizer qual banco ou instituição está envolvida e o tipo de produto (empréstimo, financiamento, cartão, consignado)?',
  'isa_aereo':    'Olá! Sou a *Jerussa*, especialista em Direito Aéreo do escritório Bentes & Ramos 😊\n\nVi que você passou por alguma situação com uma companhia aérea. Pode me contar mais detalhes? Qual companhia e o que aconteceu (cancelamento, atraso, bagagem extraviada, overbooking)?',
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
  ] = await Promise.all([
    supabase.from('leads_juridicos').select('*').eq('id', leadId).single(),
    supabase.from('manychat_mensagens').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(20),
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
  analise: { intencao: string; sentimento: string; urgencia: string },
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
        if (!subscriberId || !MANYCHAT_API_KEY) return { success: false, message: 'Subscriber ID ou ManyChat API não disponível' };
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
        if (!doc_type) return { success: false, message: 'Tipo do documento (doc_type) é obrigatório' };
        const { data, error } = await supabase.from('lead_docs_checklist').update({ received: true, received_at: new Date().toISOString(), file_id: file_id || null, notes: notes || null, updated_at: new Date().toISOString() }).eq('lead_id', lead_id).eq('doc_type', doc_type).select().single();
        if (error) throw error;
        const { data: pending } = await supabase.from('lead_docs_checklist').select('id').eq('lead_id', lead_id).eq('is_required', true).eq('received', false);
        const allReceived = !pending || pending.length === 0;
        await supabase.from('system_events').insert({ tipo: 'documento', fonte: 'isa_auto', acao: 'doc_recebido', lead_id, dados: { doc_type, all_docs_received: allReceived }, processado: true });
        return { success: true, message: allReceived ? `Documento "${doc_type}" recebido. ✅ TODOS os documentos recebidos!` : `Documento "${doc_type}" recebido. Ainda há pendentes.`, data: { ...data, all_docs_received: allReceived } };
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
  return lowerContent.match(/\.(ogg|mp3|wav|m4a|aac|opus)(\?|$)/) !== null || lowerContent.includes('voice') || lowerContent.includes('audio');
}

async function getLeadState(supabase: any, leadId: string): Promise<string | null> {
  const { data: lead } = await supabase.from('leads_juridicos').select('lead_state, status, is_lost, tipo_origem, fonte_trafego, canal_origem, created_at, linha_whatsapp, isa_ativa, empresa_tag').eq('id', leadId).single();
  if (!lead) return null;
  if (lead.is_lost) return 'LOST';
  if (['Contrato Assinado', 'Ganho'].includes(lead.status)) return 'BLOCKED';
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
async function processarComIA(contexto: LeadContext, mensagem: string, subscriberId: string): Promise<{
  resposta: string;
  acoes: Array<{ acao: string; dados: any; motivo: string; automatica: boolean }>;
  analise: { intencao: string; sentimento: string; urgencia: string };
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
    ...contexto.mensagens.slice(0, 20).map(m => ({ tipo: 'chat', origem: m.direcao === 'inbound' ? 'cliente' : 'bot/equipe', conteudo: m.conteudo, data: m.created_at })),
    ...contexto.interacoes.slice(0, 10).map(i => ({ tipo: 'interacao', origem: i.direcao === 'entrada' ? 'cliente' : 'equipe', conteudo: `[${i.tipo}] ${i.resumo}${i.detalhes ? ': ' + i.detalhes : ''}`, data: i.data_interacao })),
  ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  const historicoFormatado = historicoCompleto.slice(-25).map(h => `[${h.origem.toUpperCase()}] ${h.conteudo}`).join('\n');

  const leadState = contexto.lead.lead_state || 'NEW';
  const classification = contexto.classification;
  const contractData = contexto.contractData;
  const docsChecklist = contexto.docsChecklist || [];
  const docsPending = docsChecklist.filter((d: any) => d.is_required && !d.received);
  const docsReceived = docsChecklist.filter((d: any) => d.received);

  // Buscar agente atual para info no prompt
  const agentAtual = await getIsaAgent(supabaseClient, contexto.lead.id);

  const basePrompt = promptConfig?.content || 'Você é Isa, assistente do escritório Bentes & Ramos.';

  const systemPrompt = `${basePrompt}

${strictMode ? '🔒 MODO RÍGIDO ATIVADO: Opere pela máquina de estados.\n' : ''}

AGENTE ATUAL: ${agentAtual}

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

📊 CONTEXTO DO LEAD:
Nome: ${contexto.lead.nome || 'Não informado'}
Status: ${contexto.lead.status || 'Lead Frio'}
Estado: ${leadState}
Telefone: ${contexto.lead.telefone || 'Não informado'}
Tipo Ação: ${contexto.lead.tipo_acao || 'Não classificado'}

🔄 ESTADO ATUAL: ${leadState}
${leadState === 'NEW' ? '→ Identifique o problema e roteie para o especialista correto usando transicionar_agente.' : ''}
${leadState === 'TRIAGE' ? '→ Classifique o caso e transfira para especialista.' : ''}
${leadState === 'CLASSIFIED' ? `→ Classificação: ${classification?.case_type || 'Não definida'}. Colete dados para contrato.` : ''}
${leadState === 'DATA_CAPTURE' ? `→ Dados salvos: ${contractData ? Object.keys(contractData).filter(k => contractData[k] && !['id', 'lead_id', 'created_at', 'updated_at'].includes(k)).join(', ') || 'Nenhum' : 'Nenhum'}. Continue coletando.` : ''}
${leadState === 'DOCS_PENDING' ? `→ Docs pendentes: ${docsPending.length > 0 ? docsPending.map((d: any) => d.doc_label).join(', ') : 'Nenhum!'}` : ''}
${leadState === 'READY_FOR_LAWYER' ? '→ BLOQUEADO. Aguardar equipe jurídica.' : ''}

📜 HISTÓRICO:
${historicoFormatado || '(Sem histórico)'}

⚙️ AÇÕES DISPONÍVEIS:
- transicionar_agente: { lead_id, isa_agent: "isa_bancario"|"isa_aereo"|"humano" } — ROTEAMENTO SILENCIOSO
- transicionar_estado: { lead_id, to_state }
- classificar_caso: { lead_id, case_type, sub_type?, recommended_docs? }
- salvar_dados_contrato: { lead_id, cpf?, rg?, endereco?, cidade?, uf?, cep? }
- marcar_doc_recebido: { lead_id, doc_type }
- verificar_docs_pendentes: { lead_id }
- classificar_lead: { lead_id, novo_status }
- atualizar_dados_lead: { lead_id, nome?, telefone?, email? }
- criar_interacao: { cliente_id, tipo, resumo }
- verificar_agenda, agendar_direto: para agendamentos
- pausar_followup / retomar_followup: { lead_id }
- direcionar_atendimento_humano: { lead_id, motivo, tipo }

ROTEAMENTO (apenas quando agente=isa_triagem):
- Bancário → transicionar_agente com isa_agent: "isa_bancario"
- Aéreo → transicionar_agente com isa_agent: "isa_aereo"
- Outra área → direcionar_atendimento_humano com [TRANSFERIR_HUMANO]
- Transferência SILENCIOSA — não avisar o cliente

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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `NOVA MENSAGEM DO CLIENTE:\n"${mensagem}"` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!response.ok) { const error = await response.text(); console.error('❌ Erro na API OpenAI:', error); throw new Error('Erro ao processar com IA'); }

  const data = await response.json();
  const resultado = JSON.parse(data.choices[0].message.content);

  const acoesProcessadas = (resultado.acoes || []).map((a: any) => ({
    acao: a.acao,
    dados: { ...a.dados, lead_id: contexto.lead.id, cliente_id: contexto.lead.id, status_anterior: contexto.lead.status },
    motivo: a.motivo || '',
    automatica: ACOES_AUTOMATICAS.includes(a.acao),
  }));

  return { resposta: resultado.resposta || '', acoes: acoesProcessadas, analise: resultado.analise };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const { lead_id, subscriber_id, mensagem, canal, tipo_mensagem } = await req.json();
    
    console.log('🤖 Isa Auto-Process iniciado');
    console.log('📝 Lead ID:', lead_id);
    console.log('📱 Subscriber ID:', subscriber_id);
    console.log('💬 Mensagem:', mensagem?.substring(0, 100));
    console.log('📎 Tipo:', tipo_mensagem);

    if (!lead_id || !mensagem) {
      return new Response(JSON.stringify({ success: false, error: 'lead_id e mensagem são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // LOCK de processamento
    const lockExpiry = 30;
    const { data: recentProcessing } = await supabase.from('system_events').select('id, created_at').eq('lead_id', lead_id).eq('acao', 'isa_processing_lock').eq('processado', false).gte('created_at', new Date(Date.now() - lockExpiry * 1000).toISOString()).maybeSingle();
    if (recentProcessing) {
      console.log('⏳ Processamento em andamento, ignorando duplicata');
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'processamento_concorrente' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const { data: lockData } = await supabase.from('system_events').insert({ tipo: 'lock', fonte: 'isa_auto', acao: 'isa_processing_lock', lead_id, dados: { mensagem_hash: mensagem.substring(0, 50), subscriber_id }, processado: false }).select().single();
    const lockId = lockData?.id;

    // Rate limit
    const { data: recentIsaMessages } = await supabase.from('manychat_mensagens').select('id, conteudo, created_at').eq('lead_id', lead_id).eq('direcao', 'saida').eq('metadata->>source', 'isa').gte('created_at', new Date(Date.now() - 60 * 1000).toISOString()).order('created_at', { ascending: false }).limit(3);
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
    const mensagemLower = mensagem.toLowerCase().trim();
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
    let mensagemProcessada = mensagem;
    let audioTranscrito = false;
    if (tipo_mensagem === 'audio' || isAudioUrl(mensagem)) {
      const transcricao = await transcreverAudio(mensagem);
      if (transcricao) {
        mensagemProcessada = transcricao;
        audioTranscrito = true;
        await supabase.from('interacoes').insert({ cliente_id: lead_id, tipo: 'WhatsApp', resumo: `Áudio transcrito: "${transcricao.substring(0, 200)}"`, detalhes: transcricao, direcao: 'Entrada' });
      } else {
        mensagemProcessada = '[Áudio recebido - transcrição não disponível]';
      }
    }

    // Buscar contexto do lead
    const contexto = await buscarContextoLead(supabase, lead_id);
    if (!contexto) {
      return new Response(JSON.stringify({ success: false, error: 'Lead não encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Capturar agente ativo ANTES do processamento (para subscriber_nome correto)
    const agentKeyBefore = await getIsaAgent(supabase, lead_id);
    const agentDisplayName = AGENT_DISPLAY_NAMES[agentKeyBefore] || 'Isa';

    console.log('📊 Contexto carregado para:', contexto.lead.nome, '| Agente:', agentDisplayName);

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
    const resultado = await processarComIA(contexto, mensagemProcessada, subscriber_id);
    console.log('🧠 Análise da IA:', resultado.analise);
    console.log('📋 Ações sugeridas:', resultado.acoes.length);

    // Executar ações
    const acoesExecutadas = [];
    const acoesNauto = [];

    for (const acao of resultado.acoes) {
      if (acao.automatica) {
        console.log(`⚡ Executando ação automática: ${acao.acao}`);
        const resultadoAcao = await executarAcao(supabase, acao.acao, acao.dados, subscriber_id);
        acoesExecutadas.push({ ...acao, resultado: resultadoAcao });
        if (acao.acao === 'confirmar_agendamento') {
          await supabase.from('system_events').update({ processado: true }).eq('lead_id', lead_id).eq('acao', 'aguardando_confirmacao_lead').eq('processado', false);
        }
      } else {
        await supabase.from('system_events').insert({ tipo: 'acao_pendente', fonte: 'isa_auto', acao: 'acao_sugerida', entidade_id: lead_id, lead_id, dados: { acao_sugerida: acao.acao, dados_acao: acao.dados, motivo: acao.motivo, mensagem_original: mensagem, audio_transcrito: audioTranscrito, analise: resultado.analise }, processado: false });
        acoesNauto.push(acao);
      }
    }

    if (acoesNauto.length > 0) {
      await enviarNotificacaoEquipe(supabase, contexto.lead, acoesNauto, resultado.analise, audioTranscrito ? `[🎤 Áudio]: ${mensagemProcessada}` : mensagem);
    }

    // Verificar se houve transferência para especialista nesta rodada
    const transferAction = resultado.acoes.find(a =>
      a.acao === 'transicionar_agente' &&
      (a.dados.isa_agent === 'isa_bancario' || a.dados.isa_agent === 'isa_aereo') &&
      acoesExecutadas.some(ae => ae.acao === 'transicionar_agente' && ae.resultado?.success)
    );

    // Enviar resposta do agente atual
    let respostaEnviada = false;
    let respostaMsgId: string | null = null;
    if (resultado.resposta && subscriber_id) {
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

    // Após transferência → enviar intro do especialista com pequeno delay
    if (transferAction && subscriber_id) {
      const newAgent = transferAction.dados.isa_agent as string;
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
            metadata: { auto_gerada: true, source: 'isa', agent: newAgent },
          });
          console.log(`[Isa Routing] ✅ Intro de ${AGENT_DISPLAY_NAMES[newAgent]} enviada ao lead ${lead_id}`);
        }
      }
    }

    // Registrar processamento
    await supabase.from('system_events').insert({ tipo: 'processamento', fonte: 'isa_auto', acao: 'mensagem_processada', entidade_id: lead_id, lead_id, dados: { mensagem_original: mensagem.substring(0, 200), audio_transcrito: audioTranscrito, analise: resultado.analise, acoes_executadas: acoesExecutadas.length, acoes_pendentes: acoesNauto.length, resposta_enviada: respostaEnviada }, processado: true });

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
