import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

// Mapeamento de ações para labels em português
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

// Enviar email de notificação para equipe
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
    // Buscar emails dos usuários aprovados (admin e gerentes)
    const { data: usuarios } = await supabase
      .from('perfis')
      .select('email, nome, cargo')
      .eq('aprovado', true)
      .in('cargo', ['Administrador', 'Gerente']);

    if (!usuarios || usuarios.length === 0) {
      console.log('⚠️ Nenhum usuário para notificar');
      return false;
    }

    const destinatarios = usuarios.map((u: any) => u.email).filter(Boolean);
    
    if (destinatarios.length === 0) {
      console.log('⚠️ Nenhum email válido encontrado');
      return false;
    }

    const urgenciaCor = URGENCIA_CORES[analise.urgencia] || '#6b7280';
    const acoesHtml = acoesPendentes.map(a => `
      <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 8px 0; border-radius: 0 8px 8px 0;">
        <strong style="color: #1e40af;">${ACAO_LABELS[a.acao] || a.acao}</strong>
        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">${a.motivo}</p>
      </div>
    `).join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f1f5f9;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">🤖 Isa - Ação Requer Aprovação</h1>
        </div>
        
        <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 8px 0; color: #0369a1;">Lead: ${lead.nome || 'Sem nome'}</h3>
            <p style="margin: 0; color: #64748b; font-size: 14px;">
              ${lead.telefone || ''} ${lead.email ? `• ${lead.email}` : ''}<br>
              Status: <strong>${lead.status || 'Não definido'}</strong>
            </p>
          </div>

          <div style="margin-bottom: 20px;">
            <h4 style="color: #334155; margin: 0 0 8px 0;">💬 Mensagem recebida:</h4>
            <div style="background: #fefce8; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #eab308;">
              <p style="margin: 0; color: #713f12; font-style: italic;">"${mensagemOriginal}"</p>
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <h4 style="color: #334155; margin: 0 0 8px 0;">🧠 Análise da Isa:</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 12px; background: #f8fafc; border-radius: 6px;">
                  <strong>Intenção:</strong> ${analise.intencao}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 12px;">
                  <strong>Sentimento:</strong> ${analise.sentimento === 'positivo' ? '😊 Positivo' : analise.sentimento === 'negativo' ? '😟 Negativo' : '😐 Neutro'}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; background: #f8fafc; border-radius: 6px;">
                  <strong>Urgência:</strong> 
                  <span style="background: ${urgenciaCor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; text-transform: uppercase;">
                    ${analise.urgencia}
                  </span>
                </td>
              </tr>
            </table>
          </div>

          <div style="margin-bottom: 20px;">
            <h4 style="color: #334155; margin: 0 0 12px 0;">📋 Ações sugeridas para aprovação:</h4>
            ${acoesHtml}
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <a href="https://lovable.dev/projects/qgenaltkjtlvwfgykpxq" 
               style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
              Revisar no Sistema
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
            Este email foi enviado automaticamente pela Isa, assistente do Bentes & Ramos Advocacia.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    // Enviar via API Resend diretamente
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Isa - Bentes & Ramos <onboarding@resend.dev>',
        to: destinatarios,
        subject: `🔔 Ação pendente: ${lead.nome || 'Lead'} - ${ACAO_LABELS[acoesPendentes[0]?.acao] || 'Nova ação'}`,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Erro ao enviar email:', error);
      return false;
    }

    console.log(`✅ Email de notificação enviado para ${destinatarios.length} destinatário(s)`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar notificação por email:', error);
    return false;
  }
}

// Ações que a Isa pode executar automaticamente (sem confirmação)
const ACOES_AUTOMATICAS = [
  'classificar_lead',
  'criar_interacao', 
  'atualizar_resumo_lead',
  'buscar_lead',
  'buscar_historico',
  'atualizar_dados_lead', // Atualizar nome/telefone do lead
  'verificar_agenda', // Consultar agenda e horários disponíveis
  'solicitar_agendamento', // Enviar opções de horário para lead confirmar
  'confirmar_agendamento', // Confirmar agendamento após resposta do lead
  'agendar_direto', // Agendar compromisso diretamente no sistema
  'verificar_followup', // Verificar e executar follow-ups pendentes
  'executar_followup', // Disparar follow-up manualmente
  'pausar_followup', // Pausar automação
  'retomar_followup', // Retomar automação
  'analisar_documentos_conversa', // Analisar conversas para detectar documentos pendentes
  // STATE MACHINE ACTIONS
  'transicionar_estado', // Mover lead para próximo estado
  'classificar_caso', // Classificar tipo do caso
  'salvar_dados_contrato', // Salvar dados para contrato
  'marcar_doc_recebido', // Marcar documento como recebido
  'verificar_docs_pendentes', // Verificar documentos pendentes
  // CONSULTA DE PROCESSOS
  'consultar_processo', // Consultar status do processo do lead
];

// Ações que precisam de confirmação do USUÁRIO INTERNO (híbrido)
const ACOES_CONFIRMACAO = [
  'criar_tarefa',
  'criar_compromisso', // Quando criado manualmente pela equipe
  'atualizar_status_lead',
  'enviar_contrato',
  'enviar_para_advogado', // Handoff para advogado
];

// Status que permitem follow-up
const STATUS_PERMITE_FAST = ['Lead Frio'];
const STATUS_PERMITE_SLOW = ['Lead Frio', 'Em Atendimento', 'Em Negociação', 'Aguardando Contrato'];
const STATUS_BLOQUEADOS = ['Contrato Assinado', 'Ganho'];

// Estados da State Machine
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

// Estados que permitem automação
const ESTADOS_BLOQUEADOS = ['CONTRACT_SIGNED', 'READY_FOR_LAWYER'];

// Configuração FAST (apenas Lead Frio)
const FAST_CONFIG = {
  stage_1: { delay_minutos: 10, titulo: "Follow-up FAST 1 - 10 min" },
  stage_2: { delay_minutos: 240, titulo: "Follow-up FAST 2 - 4h" },
  stage_3: { delay_minutos: 900, titulo: "Follow-up FAST 3 - 15h" }
};

// Configuração SLOW (Lead Frio, Em Atendimento, Em Negociação, Aguardando Contrato)
const SLOW_CONFIG = {
  stage_1: { delay_minutos: 1440, titulo: "Follow-up SLOW 1 - 24h" },
  stage_2: { delay_minutos: 2880, titulo: "Follow-up SLOW 2 - 48h" },
  stage_3: { delay_minutos: 4320, titulo: "Follow-up SLOW 3 - 72h" }
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
  // State Machine data
  classification?: any;
  contractData?: any;
  docsChecklist?: any[];
  stateHistory?: any[];
}

// Buscar contexto completo do lead INCLUINDO state machine data
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
    supabase.from('lead_classifications').select('*').eq('lead_id', leadId).maybeSingle(),
    supabase.from('lead_contract_data').select('*').eq('lead_id', leadId).maybeSingle(),
    supabase.from('lead_docs_checklist').select('*').eq('lead_id', leadId),
    supabase.from('lead_state_history').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(5),
  ]);

  if (!lead) return null;

  const parcelas = honorarios?.flatMap((h: any) => h.parcelas || []) || [];

  return { 
    lead, 
    mensagens: mensagens || [], 
    interacoes: interacoes || [], 
    tarefas: tarefas || [], 
    compromissos: compromissos || [], 
    processos: processos || [], 
    honorarios: honorarios || [], 
    parcelas,
    followup: followup || null,
    classification: classification || null,
    contractData: contractData || null,
    docsChecklist: docsChecklist || [],
    stateHistory: stateHistory || [],
  };
}

// Verificar status do follow-up
async function verificarFollowupStatus(supabase: any, leadId: string, followup: any) {
  const agora = new Date();
  
  if (!followup) {
    return { 
      status: 'sem_followup', 
      pode_enviar: false, 
      motivo: 'Lead não tem follow-up configurado' 
    };
  }

  // Status bloqueados
  const { data: lead } = await supabase
    .from('leads_juridicos')
    .select('status')
    .eq('id', leadId)
    .single();

  if (STATUS_BLOQUEADOS.includes(lead?.status)) {
    return { 
      status: 'bloqueado', 
      pode_enviar: false, 
      motivo: `Lead com status ${lead?.status} - automações bloqueadas` 
    };
  }

  // Verificar atendimento humano
  if (followup.subscriber_id) {
    const { data: subscriber } = await supabase
      .from('manychat_subscribers')
      .select('atendimento_humano')
      .eq('subscriber_id', followup.subscriber_id)
      .maybeSingle();

    if (subscriber?.atendimento_humano) {
      return { 
        status: 'atendimento_humano', 
        pode_enviar: false, 
        motivo: 'Atendimento humano ativo' 
      };
    }
  }

  // Verificar respondido
  if (followup.respondido) {
    return { 
      status: 'respondido', 
      pode_enviar: false, 
      motivo: 'Lead já respondeu' 
    };
  }

  // Verificar conversa ativa (últimos 30 min)
  const trintaMinAtras = new Date(agora.getTime() - 30 * 60 * 1000).toISOString();
  const { data: msgRecentes } = await supabase
    .from('manychat_mensagens')
    .select('id')
    .eq('lead_id', leadId)
    .eq('direcao', 'entrada')
    .gte('created_at', trintaMinAtras)
    .limit(1);

  if (msgRecentes && msgRecentes.length > 0) {
    return { 
      status: 'conversa_ativa', 
      pode_enviar: false, 
      motivo: 'Lead tem mensagens recentes (últimos 30 min)' 
    };
  }

  // Calcular próximo follow-up
  const stageFast = followup.followup_stage_fast || 0;
  const stageSlow = followup.followup_stage_slow || 0;
  const primeiroContato = new Date(followup.primeiro_contato_em);
  const minutosDesdeContato = (agora.getTime() - primeiroContato.getTime()) / (1000 * 60);

  let proximo = { tipo: null as string | null, stage: 0, config: null as any };

  // Verificar FAST
  if (STATUS_PERMITE_FAST.includes(lead?.status) && stageFast < 3) {
    const nextStage = stageFast + 1;
    const config = FAST_CONFIG[`stage_${nextStage}` as keyof typeof FAST_CONFIG];
    if (minutosDesdeContato >= config.delay_minutos) {
      proximo = { tipo: 'FAST', stage: nextStage, config };
    }
  }

  // Verificar SLOW se FAST terminou
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

// Executar ação no sistema
async function executarAcao(supabase: any, acao: string, dados: any, subscriberId?: string): Promise<{ success: boolean; message: string; data?: any }> {
  console.log(`🔧 Executando ação: ${acao}`, dados);
  
  try {
    switch (acao) {
      case 'classificar_lead': {
        // A IA pode passar 'status' ou 'novo_status'
        const novoStatus = dados.novo_status || dados.status;
        const motivo = dados.motivo || dados.resumo || 'Classificação automática pela Isa';
        const lead_id = dados.lead_id;
        
        if (!novoStatus) {
          return { success: false, message: 'Status não informado' };
        }
        
        const { data, error } = await supabase
          .from('leads_juridicos')
          .update({ 
            status: novoStatus,
            resumo_ia: motivo 
          })
          .eq('id', lead_id)
          .select();
        
        if (error) throw error;
        if (!data || data.length === 0) {
          return { success: false, message: 'Lead não encontrado' };
        }
        
        // Registrar evento
        await supabase.from('system_events').insert({
          tipo: 'lead',
          fonte: 'isa_auto',
          acao: 'lead_classificado',
          entidade_id: lead_id,
          lead_id: lead_id,
          dados: { status_anterior: dados.status_anterior, novo_status: novoStatus, motivo },
          processado: true,
        });
        
        return { success: true, message: `Lead classificado como "${novoStatus}"`, data: data[0] };
      }

      case 'atualizar_dados_lead': {
        // Atualizar nome e/ou telefone do lead
        const { lead_id, nome, telefone, email } = dados;
        const updateData: any = {};
        
        if (nome) updateData.nome = nome;
        if (telefone) updateData.telefone = telefone;
        if (email) updateData.email = email;
        
        if (Object.keys(updateData).length === 0) {
          return { success: false, message: 'Nenhum dado para atualizar' };
        }
        
        const { data, error } = await supabase
          .from('leads_juridicos')
          .update(updateData)
          .eq('id', lead_id)
          .select()
          .single();
        
        if (error) throw error;
        
        // Registrar evento
        await supabase.from('system_events').insert({
          tipo: 'lead',
          fonte: 'isa_auto',
          acao: 'dados_lead_atualizados',
          entidade_id: lead_id,
          lead_id: lead_id,
          dados: { campos_atualizados: Object.keys(updateData), valores: updateData },
          processado: true,
        });
        
        console.log(`✅ Dados do lead atualizados: ${JSON.stringify(updateData)}`);
        return { success: true, message: `Dados atualizados: ${Object.keys(updateData).join(', ')}`, data };
      }

      case 'solicitar_agendamento': {
        // Enviar mensagem pedindo para o lead confirmar/escolher horário
        if (!subscriberId || !MANYCHAT_API_KEY) {
          return { success: false, message: 'Subscriber ID ou ManyChat API não disponível' };
        }
        
        const { lead_id, tipo_reuniao, mensagem_personalizada } = dados;
        
        // VERIFICAR SE JÁ EXISTE COMPROMISSO FUTURO PARA ESTE LEAD
        const agora = new Date().toISOString();
        const { data: compromissosExistentes } = await supabase
          .from('compromissos')
          .select('id, titulo, data_inicio, confirmacao_status')
          .eq('lead_id', lead_id)
          .gte('data_inicio', agora)
          .order('data_inicio', { ascending: true })
          .limit(1);

        if (compromissosExistentes && compromissosExistentes.length > 0) {
          const existente = compromissosExistentes[0];
          console.log(`⚠️ Lead ${lead_id} já possui compromisso agendado: ${existente.titulo} em ${existente.data_inicio}`);
          
          // Se já existe, não solicitar novo agendamento
          return { 
            success: false, 
            message: `Lead já possui compromisso agendado: "${existente.titulo}" para ${existente.data_inicio}`,
            data: { compromisso_existente: existente }
          };
        }
        
        // Gerar opções de horários consultando agenda real
        const opcoes = await gerarOpcoesHorario(supabase, lead_id);
        
        if (opcoes.length === 0) {
          return { 
            success: false, 
            message: 'Não há horários disponíveis no momento. Tente novamente mais tarde.',
            data: null
          };
        }
        
        const mensagem = mensagem_personalizada || `Ótimo! Vamos agendar sua consulta. 📅

Por favor, escolha um dos horários disponíveis:

${opcoes.map((o: { label: string }, i: number) => `${i + 1}️⃣ ${o.label}`).join('\n')}

Ou acesse nosso link de agendamento: https://cal.com/bentes-ramos-advocacia-1ucmau/agendamentos-crm`;

        // Enviar via ManyChat com botões
        const response = await fetch('https://api.manychat.com/fb/sending/sendContent', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscriber_id: parseInt(subscriberId),
            data: {
              version: 'v2',
              content: {
                messages: [{ type: 'text', text: mensagem }],
                quick_replies: opcoes.slice(0, 3).map((o: { short: string }) => ({
                  type: 'text',
                  title: o.short
                }))
              }
            }
          }),
        });

        const result = await response.json();
        console.log('📅 Solicitação de agendamento enviada:', result);

        // Salvar no banco que estamos aguardando confirmação
        await supabase.from('system_events').insert({
          tipo: 'agendamento',
          fonte: 'isa_auto',
          acao: 'aguardando_confirmacao_lead',
          entidade_id: lead_id,
          lead_id: lead_id,
          dados: { 
            opcoes_oferecidas: opcoes,
            tipo_reuniao: tipo_reuniao || 'Consulta',
            subscriber_id: subscriberId,
          },
          processado: false, // Aguardando resposta do lead
        });

        // Registrar a mensagem enviada
        await supabase.from('manychat_mensagens').insert({
          subscriber_id: subscriberId,
          subscriber_nome: 'Isa (Assistente)',
          canal: 'whatsapp',
          conteudo: mensagem,
          tipo: 'text',
          direcao: 'saida',
          lead_id: lead_id,
          metadata: { 
            tipo: 'solicitacao_agendamento',
            opcoes: opcoes 
          },
        });

        return { success: true, message: 'Solicitação de agendamento enviada ao lead', data: { opcoes } };
      }

      case 'criar_interacao': {
        const cliente_id = dados.cliente_id || dados.lead_id;
        // A IA pode passar 'resumo', 'mensagem' ou 'descricao'
        const resumo = dados.resumo || dados.mensagem || dados.descricao || 'Interação registrada pela Isa';
        const detalhes = dados.detalhes || dados.mensagem || null;
        const tipo = dados.tipo || 'WhatsApp';
        const direcao = dados.direcao || 'Entrada';
        
        const { data, error } = await supabase
          .from('interacoes')
          .insert({
            cliente_id,
            tipo,
            resumo: resumo.substring(0, 500), // Limitar tamanho
            detalhes,
            direcao,
            data_interacao: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, message: 'Interação registrada', data };
      }

      case 'atualizar_resumo_lead': {
        const { lead_id, resumo } = dados;
        const { data, error } = await supabase
          .from('leads_juridicos')
          .update({ resumo_ia: resumo })
          .eq('id', lead_id)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, message: 'Resumo do lead atualizado', data };
      }

      case 'criar_tarefa': {
        const { titulo, descricao, data_limite, prioridade, cliente_id, responsavel_id } = dados;
        const { data, error } = await supabase
          .from('tarefas')
          .insert({
            titulo,
            descricao,
            data_limite,
            prioridade: prioridade || 'Media',
            status: 'Pendente',
            cliente_id,
            responsavel_id,
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Registrar evento
        await supabase.from('system_events').insert({
          tipo: 'tarefa',
          fonte: 'isa_auto',
          acao: 'tarefa_criada',
          entidade_id: data.id,
          lead_id: cliente_id,
          dados: { titulo, prioridade },
          processado: true,
        });
        
        return { success: true, message: `Tarefa "${titulo}" criada`, data };
      }

      case 'criar_compromisso': {
        const { titulo, tipo, data_inicio, data_fim, descricao, lead_id, responsavel_id } = dados;
        
        // VERIFICAR SE JÁ EXISTE COMPROMISSO FUTURO PARA ESTE LEAD
        if (lead_id) {
          const agora = new Date().toISOString();
          const { data: compromissosExistentes } = await supabase
            .from('compromissos')
            .select('id, titulo, data_inicio')
            .eq('lead_id', lead_id)
            .gte('data_inicio', agora)
            .order('data_inicio', { ascending: true })
            .limit(1);

          if (compromissosExistentes && compromissosExistentes.length > 0) {
            const existente = compromissosExistentes[0];
            console.log(`⚠️ Lead ${lead_id} já possui compromisso: ${existente.titulo} em ${existente.data_inicio}`);
            return { 
              success: false, 
              message: `Lead já possui compromisso agendado: "${existente.titulo}" para ${existente.data_inicio}`,
              data: { compromisso_existente: existente }
            };
          }
        }
        
        const { data, error } = await supabase
          .from('compromissos')
          .insert({
            titulo,
            tipo: tipo || 'Reunião',
            data_inicio,
            data_fim,
            descricao,
            lead_id,
            responsavel_id,
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Registrar evento
        await supabase.from('system_events').insert({
          tipo: 'compromisso',
          fonte: 'isa_auto',
          acao: 'compromisso_criado',
          entidade_id: data.id,
          lead_id: lead_id,
          dados: { titulo, tipo, data_inicio },
          processado: true,
        });
        
        return { success: true, message: `Compromisso "${titulo}" agendado`, data };
      }

      // Nova ação: confirmar agendamento após resposta do lead
      case 'confirmar_agendamento': {
        const { lead_id, data_hora, hora_escolhida, titulo, tipo, modalidade } = dados;
        
        // A IA deve enviar a hora no formato "YYYY-MM-DDTHH:mm" já em horário de Manaus
        // Precisamos converter para UTC
        let dataInicio: Date;
        
        if (hora_escolhida && typeof hora_escolhida === 'string') {
          // Se recebemos hora_escolhida separadamente (ex: "09:00" com data)
          const dataBase = data_hora ? new Date(data_hora) : new Date();
          const [hora, minuto] = hora_escolhida.split(':').map(Number);
          // Criar data em Manaus e converter para UTC
          const dataManaus = `${dataBase.toISOString().split('T')[0]}T${hora_escolhida}:00-04:00`;
          dataInicio = new Date(dataManaus);
        } else if (data_hora) {
          // Se data_hora já contém a data completa
          // Assumir que a IA está enviando em formato ISO ou horário de Manaus
          const dataStr = String(data_hora);
          
          // Se não tem timezone, assumir que é horário de Manaus
          if (!dataStr.includes('Z') && !dataStr.includes('+') && !dataStr.match(/-\d{2}:\d{2}$/)) {
            dataInicio = new Date(dataStr + '-04:00');
          } else {
            dataInicio = new Date(dataStr);
          }
        } else {
          return { success: false, message: 'Data/hora não informada para agendamento' };
        }
        
        const dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000); // +1 hora
        
        // Determinar tipo de compromisso baseado na modalidade
        const tipoCompromisso = modalidade === 'online' ? 'Reunião Online' : 
                                modalidade === 'presencial' ? 'Reunião Presencial' : 
                                tipo || 'Reunião';
        
        // Gerar descrição com a modalidade
        const descricaoCompromisso = `Agendamento confirmado pelo cliente via chat.\n${
          modalidade === 'online' ? '📹 Atendimento ONLINE (videoconferência)' :
          modalidade === 'presencial' ? '🏢 Atendimento PRESENCIAL no escritório' :
          ''
        }`.trim();
        
        const { data, error } = await supabase
          .from('compromissos')
          .insert({
            titulo: titulo || 'Consulta agendada',
            tipo: tipoCompromisso,
            data_inicio: dataInicio.toISOString(),
            data_fim: dataFim.toISOString(),
            descricao: descricaoCompromisso,
            lead_id,
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Atualizar status do lead
        await supabase
          .from('leads_juridicos')
          .update({ status: 'Em Negociação' })
          .eq('id', lead_id);
        
        // Registrar evento
        await supabase.from('system_events').insert({
          tipo: 'compromisso',
          fonte: 'isa_auto',
          acao: 'agendamento_confirmado_lead',
          entidade_id: data.id,
          lead_id: lead_id,
          dados: { titulo, tipo: tipoCompromisso, modalidade, data_inicio: dataInicio.toISOString() },
          processado: true,
        });
        
        // Formatar hora para Manaus
        const horaManaus = dataInicio.toLocaleTimeString('pt-BR', { 
          timeZone: 'America/Manaus',
          hour: '2-digit', 
          minute: '2-digit' 
        });
        const dataManaus = dataInicio.toLocaleDateString('pt-BR', { 
          timeZone: 'America/Manaus' 
        });
        
        return { success: true, message: `${tipoCompromisso} agendada para ${dataManaus} às ${horaManaus}`, data };
      }

      case 'consultar_processo': {
        const { numero_processo, tribunal } = dados;
        
        if (!numero_processo) {
          return { success: false, message: 'Número do processo não informado' };
        }
        
        console.log('🔍 Consultando processo:', numero_processo);
        
        try {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/consulta-processos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({ numeroProcesso: numero_processo, tribunal }),
          });
          
          const resultado = await response.json();
          
          if (!resultado.encontrado) {
            return { success: false, message: resultado.mensagem || 'Processo não encontrado' };
          }
          
          const p = resultado.processo;
          const ultimoMovimento = p.movimentos?.[0];
          
          // Formatar resposta amigável
          const resumo = `📋 PROCESSO: ${p.numeroProcesso}\n` +
            `📊 Classe: ${p.classe}\n` +
            `🏛️ Tribunal: ${p.tribunal}\n` +
            `📅 Ajuizado em: ${new Date(p.dataAjuizamento).toLocaleDateString('pt-BR')}\n` +
            (ultimoMovimento ? `\n⚖️ Última movimentação (${new Date(ultimoMovimento.dataHora).toLocaleDateString('pt-BR')}):\n${ultimoMovimento.nome}${ultimoMovimento.complemento ? ` - ${ultimoMovimento.complemento}` : ''}` : '');
          
          return { success: true, message: resumo, data: resultado.processo };
        } catch (error) {
          console.error('❌ Erro ao consultar processo:', error);
          return { success: false, message: 'Não foi possível consultar o processo no momento' };
        }
      }

      // ============================================================
      // AÇÕES DE AGENDA E AGENDAMENTO
      // ============================================================
      
      case 'verificar_agenda': {
        const { lead_id, data_especifica, horario_especifico } = dados;
        
        try {
          // Chamar API do Cal.com para buscar horários disponíveis
          const calcomResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/calcom-integration`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              action: data_especifica ? 'verificar_disponibilidade' : 'buscar_horarios',
              datetime: data_especifica && horario_especifico ? `${data_especifica}T${horario_especifico}:00` : undefined,
            }),
          });

          const calcomData = await calcomResponse.json();
          console.log('📅 Resposta Cal.com (verificar_agenda):', JSON.stringify(calcomData, null, 2));

          if (!calcomData.success) {
            // Fallback para geração local
            const opcoes = await gerarOpcoesHorario(supabase, lead_id);
            return {
              success: true,
              message: `${opcoes.length} horários disponíveis encontrados (local)`,
              data: { 
                horarios_disponiveis: opcoes.map((o: { label: string; datetime: string }) => ({ 
                  label: o.label, 
                  datetime: o.datetime 
                })),
                regras: {
                  dias: 'Segunda, Quarta e Sexta',
                  horarios: HORARIOS_DISPONIVEIS.join(', '),
                  observacao: 'Agendamentos apenas para próxima semana'
                }
              }
            };
          }

          if (data_especifica) {
            // Verificação de disponibilidade específica
            if (!calcomData.disponivel) {
              return {
                success: false,
                message: 'Horário indisponível no Cal.com',
                data: { 
                  disponivel: false,
                  alternativas: (calcomData.horarios_alternativos || []).map((a: { label: string }) => a.label)
                }
              };
            }
            
            return {
              success: true,
              message: `Horário ${horario_especifico || '09:00'} em ${data_especifica} está DISPONÍVEL!`,
              data: { disponivel: true, data: data_especifica, horario: horario_especifico }
            };
          }

          // Lista de horários disponíveis
          const horarios = calcomData.horarios || [];
          return {
            success: true,
            message: calcomData.mensagem || `${horarios.length} horários disponíveis encontrados`,
            data: { 
              horarios_disponiveis: horarios,
              regras: {
                dias: 'Segunda, Quarta e Sexta',
                horarios: HORARIOS_DISPONIVEIS.join(', '),
                observacao: 'Agendamentos apenas para próxima semana'
              }
            }
          };
        } catch (error) {
          console.error('❌ Erro ao verificar agenda Cal.com:', error);
          // Fallback para geração local
          const opcoes = await gerarOpcoesHorario(supabase, lead_id);
          return {
            success: true,
            message: `${opcoes.length} horários disponíveis (fallback)`,
            data: { horarios_disponiveis: opcoes }
          };
        }
      }
      
      case 'agendar_direto': {
        const { lead_id, data_hora, titulo, modalidade } = dados;
        
        if (!data_hora) {
          return { success: false, message: 'Data e hora são obrigatórios para agendar' };
        }
        
        // Buscar dados do lead para agendar no Cal.com
        const { data: lead } = await supabase
          .from('leads_juridicos')
          .select('nome, email, telefone')
          .eq('id', lead_id)
          .single();

        if (!lead) {
          return { success: false, message: 'Lead não encontrado' };
        }

        // Converter data para formato correto
        let dataAgendamento: string = data_hora;
        const dataStr = String(data_hora);
        
        if (!dataStr.includes('Z') && !dataStr.includes('+') && !dataStr.match(/-\d{2}:\d{2}$/)) {
          // Assumir Manaus (UTC-4) e converter para ISO
          const tempDate = new Date(dataStr + '-04:00');
          dataAgendamento = tempDate.toISOString();
        }

        // Verificar se lead tem email (obrigatório para Cal.com)
        const email = lead.email || `${(lead.telefone || '').replace(/\D/g, '')}@placeholder.com`;
        
        try {
          // Chamar API do Cal.com para criar agendamento
          const calcomResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/calcom-integration`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              action: 'agendar',
              datetime: dataAgendamento,
              nome: lead.nome || 'Cliente',
              email: email,
              telefone: lead.telefone,
              leadId: lead_id,
              subscriberId: subscriberId,
              notas: modalidade === 'online' ? 'Atendimento ONLINE' : 'Atendimento PRESENCIAL',
            }),
          });

          const calcomData = await calcomResponse.json();
          console.log('📅 Resposta Cal.com (agendar_direto):', JSON.stringify(calcomData, null, 2));

          if (!calcomData.success) {
            // Se falhou no Cal.com, tentar criar localmente
            console.log('⚠️ Falha no Cal.com, criando agendamento local...');
            
            const dataFim = new Date(new Date(dataAgendamento).getTime() + 60 * 60 * 1000);
            const tipoCompromisso = modalidade === 'online' ? 'Reunião Online' : 
                                    modalidade === 'presencial' ? 'Reunião Presencial' : 'Consulta';
            
            const { data: compromisso, error } = await supabase
              .from('compromissos')
              .insert({
                titulo: titulo || 'Consulta Jurídica',
                tipo: tipoCompromisso,
                data_inicio: dataAgendamento,
                data_fim: dataFim.toISOString(),
                descricao: `Agendamento feito pela Isa (local).\n${modalidade === 'online' ? '📹 ONLINE' : '🏢 PRESENCIAL'}`,
                lead_id,
                confirmacao_status: 'pendente',
                origem: 'isa',
              })
              .select()
              .single();
            
            if (error) throw error;
            
            await supabase
              .from('leads_juridicos')
              .update({ status: 'Em Negociação' })
              .eq('id', lead_id);
            
            const dataObj = new Date(dataAgendamento);
            const horaManaus = dataObj.toLocaleTimeString('pt-BR', { 
              timeZone: 'America/Manaus',
              hour: '2-digit', 
              minute: '2-digit' 
            });
            const dataManaus = dataObj.toLocaleDateString('pt-BR', { 
              timeZone: 'America/Manaus',
              weekday: 'long',
              day: '2-digit',
              month: '2-digit'
            });
            
            return { 
              success: true, 
              message: `✅ Agendado (local): ${tipoCompromisso} para ${dataManaus} às ${horaManaus}`,
              data: { 
                compromisso_id: compromisso.id,
                data_formatada: `${dataManaus} às ${horaManaus}`,
                tipo: tipoCompromisso
              }
            };
          }

          // Sucesso no Cal.com
          return { 
            success: true, 
            message: calcomData.mensagem,
            data: { 
              booking: calcomData.booking,
              compromisso_id: calcomData.compromisso_id,
              data_formatada: calcomData.booking?.dataFormatada,
            }
          };
        } catch (error) {
          console.error('❌ Erro ao agendar no Cal.com:', error);
          return { 
            success: false, 
            message: 'Erro ao criar agendamento. Tente novamente.',
            data: null
          };
        }
      }

      // ============================================================
      // AÇÕES DE FOLLOW-UP INTELIGENTE
      // ============================================================
      
      case 'verificar_followup': {
        const { lead_id } = dados;
        
        // Buscar follow-up do lead
        const { data: followup } = await supabase
          .from('lead_followups')
          .select('*')
          .eq('lead_id', lead_id)
          .maybeSingle();
        
        const status = await verificarFollowupStatus(supabase, lead_id, followup);
        
        console.log(`📊 Status follow-up lead ${lead_id}:`, status);
        
        return { 
          success: true, 
          message: status.motivo,
          data: status
        };
      }

      case 'executar_followup': {
        const { lead_id, tipo_forcado } = dados;
        
        // Buscar dados do follow-up
        const { data: followup } = await supabase
          .from('lead_followups')
          .select('*, leads_juridicos!inner(id, nome, telefone, status)')
          .eq('lead_id', lead_id)
          .maybeSingle();
        
        if (!followup) {
          return { success: false, message: 'Follow-up não encontrado para este lead' };
        }

        if (!followup.subscriber_id) {
          return { success: false, message: 'Lead sem subscriber vinculado' };
        }

        const lead = followup.leads_juridicos;
        
        // Verificar se pode enviar
        const status = await verificarFollowupStatus(supabase, lead_id, followup);
        
        if (!status.pode_enviar && !tipo_forcado) {
          return { success: false, message: status.motivo };
        }

        // Determinar mensagem
        const stageFast = followup.followup_stage_fast || 0;
        const stageSlow = followup.followup_stage_slow || 0;
        
        // Mensagem simples de acompanhamento
        const mensagem = `Olá ${lead.nome || 'cliente'}! 👋\n\nPassando para saber se posso ajudar com sua questão.\n\nEstamos à disposição para analisar seu caso!\n\n📅 Agende sua consulta: https://cal.com/bentes-ramos-advocacia-1ucmau/agendamentos-crm`;
        
        // Enviar via ManyChat
        const enviado = await enviarRespostaManyChat(followup.subscriber_id, mensagem);
        
        if (enviado) {
          const agora = new Date().toISOString();
          
          // Atualizar follow-up
          await supabase
            .from('lead_followups')
            .update({
              last_outbound_at: agora,
              last_isa_outbound_at: agora,
              waiting_reply: true
            })
            .eq('id', followup.id);
          
          // Registrar interação
          await supabase.from('interacoes').insert({
            cliente_id: lead_id,
            tipo: 'WhatsApp',
            direcao: 'Saída',
            resumo: 'Follow-up enviado pela Isa (inteligente)',
            detalhes: mensagem
          });
          
          // Registrar evento
          await supabase.from('system_events').insert({
            tipo: 'followup',
            fonte: 'isa_inteligente',
            acao: 'followup_enviado_manual',
            lead_id: lead_id,
            dados: { stage_fast: stageFast, stage_slow: stageSlow },
            processado: true
          });
          
          return { success: true, message: `Follow-up enviado para ${lead.nome}` };
        }
        
        return { success: false, message: 'Falha ao enviar follow-up' };
      }

      case 'pausar_followup': {
        const { lead_id, motivo } = dados;
        
        const { error } = await supabase
          .from('lead_followups')
          .update({
            status: 'pausado',
            followup_lock_reason: motivo || 'Pausado pela Isa'
          })
          .eq('lead_id', lead_id);
        
        if (error) throw error;
        
        // Ativar atendimento humano se tiver subscriber
        const { data: followup } = await supabase
          .from('lead_followups')
          .select('subscriber_id')
          .eq('lead_id', lead_id)
          .maybeSingle();
        
        if (followup?.subscriber_id) {
          await supabase
            .from('manychat_subscribers')
            .update({ atendimento_humano: true, atendimento_humano_desde: new Date().toISOString() })
            .eq('subscriber_id', followup.subscriber_id);
        }
        
        await supabase.from('system_events').insert({
          tipo: 'followup',
          fonte: 'isa_inteligente',
          acao: 'followup_pausado',
          lead_id: lead_id,
          dados: { motivo },
          processado: true
        });
        
        return { success: true, message: 'Follow-up pausado com sucesso' };
      }

      case 'retomar_followup': {
        const { lead_id } = dados;
        
        const { error } = await supabase
          .from('lead_followups')
          .update({
            status: 'em_andamento',
            followup_lock_reason: null
          })
          .eq('lead_id', lead_id);
        
        if (error) throw error;
        
        // Desativar atendimento humano
        const { data: followup } = await supabase
          .from('lead_followups')
          .select('subscriber_id')
          .eq('lead_id', lead_id)
          .maybeSingle();
        
        if (followup?.subscriber_id) {
          await supabase
            .from('manychat_subscribers')
            .update({ atendimento_humano: false, atendimento_humano_desde: null })
            .eq('subscriber_id', followup.subscriber_id);
        }
        
        await supabase.from('system_events').insert({
          tipo: 'followup',
          fonte: 'isa_inteligente',
          acao: 'followup_retomado',
          lead_id: lead_id,
          processado: true
        });
        
        return { success: true, message: 'Follow-up retomado com sucesso' };
      }

      // ============================================================
      // STATE MACHINE ACTIONS
      // ============================================================

      case 'transicionar_estado': {
        const { lead_id, to_state, reason } = dados;
        
        if (!to_state) {
          return { success: false, message: 'Estado destino (to_state) não informado' };
        }

        // Usar a função do banco para validar e executar a transição
        const { data: result, error } = await supabase.rpc('update_lead_state', {
          p_lead_id: lead_id,
          p_to_state: to_state,
          p_changed_by: 'isa',
          p_reason: reason || 'Transição automática pela Isa'
        });

        if (error) {
          console.error('❌ Erro na transição de estado:', error);
          return { success: false, message: `Transição inválida: ${error.message}` };
        }

        console.log(`✅ Lead ${lead_id} transitou para ${to_state}`);
        return { 
          success: true, 
          message: `Lead movido para estado "${to_state}"`,
          data: result
        };
      }

      case 'classificar_caso': {
        const { lead_id, case_type, sub_type, summary, recommended_docs, confidence_score } = dados;
        
        if (!case_type) {
          return { success: false, message: 'Tipo do caso (case_type) é obrigatório' };
        }

        // Upsert classificação
        const { data: classification, error } = await supabase
          .from('lead_classifications')
          .upsert({
            lead_id,
            case_type,
            sub_type: sub_type || null,
            summary: summary || null,
            recommended_docs: recommended_docs || [],
            confidence_score: confidence_score || null,
            classified_by: 'isa',
            updated_at: new Date().toISOString()
          }, { onConflict: 'lead_id' })
          .select()
          .single();

        if (error) throw error;

        // Criar checklist de documentos se fornecido
        if (recommended_docs && recommended_docs.length > 0) {
          const checklistItems = recommended_docs.map((doc: string) => ({
            lead_id,
            doc_type: doc.toLowerCase().replace(/\s+/g, '_'),
            doc_label: doc,
            is_required: true,
            received: false
          }));

          // Upsert para não duplicar
          for (const item of checklistItems) {
            await supabase
              .from('lead_docs_checklist')
              .upsert(item, { onConflict: 'lead_id,doc_type' });
          }
        }

        // Atualizar tipo_acao do lead
        await supabase
          .from('leads_juridicos')
          .update({ tipo_acao: case_type })
          .eq('id', lead_id);

        // Registrar evento
        await supabase.from('system_events').insert({
          tipo: 'lead',
          fonte: 'isa_auto',
          acao: 'caso_classificado',
          lead_id,
          dados: { case_type, sub_type, summary },
          processado: true
        });

        console.log(`✅ Caso classificado: ${case_type}`);
        return { 
          success: true, 
          message: `Caso classificado como "${case_type}"${sub_type ? ` (${sub_type})` : ''}`,
          data: classification
        };
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

        const { data, error } = await supabase
          .from('lead_contract_data')
          .upsert(contractData, { onConflict: 'lead_id' })
          .select()
          .single();

        if (error) throw error;

        // Registrar evento
        await supabase.from('system_events').insert({
          tipo: 'lead',
          fonte: 'isa_auto',
          acao: 'dados_contrato_salvos',
          lead_id,
          dados: { campos: Object.keys(contractData).filter(k => k !== 'lead_id' && k !== 'updated_at') },
          processado: true
        });

        console.log(`✅ Dados do contrato salvos para lead ${lead_id}`);
        return { 
          success: true, 
          message: `Dados do contrato salvos: ${Object.keys(contractData).filter(k => k !== 'lead_id' && k !== 'updated_at').join(', ')}`,
          data
        };
      }

      case 'marcar_doc_recebido': {
        const { lead_id, doc_type, file_id, notes } = dados;
        
        if (!doc_type) {
          return { success: false, message: 'Tipo do documento (doc_type) é obrigatório' };
        }

        const { data, error } = await supabase
          .from('lead_docs_checklist')
          .update({
            received: true,
            received_at: new Date().toISOString(),
            file_id: file_id || null,
            notes: notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('lead_id', lead_id)
          .eq('doc_type', doc_type)
          .select()
          .single();

        if (error) throw error;

        // Verificar se todos os docs obrigatórios foram recebidos
        const { data: pending } = await supabase
          .from('lead_docs_checklist')
          .select('id')
          .eq('lead_id', lead_id)
          .eq('is_required', true)
          .eq('received', false);

        const allReceived = !pending || pending.length === 0;

        // Registrar evento
        await supabase.from('system_events').insert({
          tipo: 'documento',
          fonte: 'isa_auto',
          acao: 'doc_recebido',
          lead_id,
          dados: { doc_type, all_docs_received: allReceived },
          processado: true
        });

        console.log(`✅ Documento "${doc_type}" marcado como recebido`);
        return { 
          success: true, 
          message: allReceived 
            ? `Documento "${doc_type}" recebido. ✅ TODOS os documentos obrigatórios foram recebidos!`
            : `Documento "${doc_type}" recebido. Ainda há documentos pendentes.`,
          data: { ...data, all_docs_received: allReceived }
        };
      }

      case 'verificar_docs_pendentes': {
        const { lead_id } = dados;

        const { data: checklist, error } = await supabase
          .from('lead_docs_checklist')
          .select('*')
          .eq('lead_id', lead_id);

        if (error) throw error;

        const pendentes = (checklist || []).filter((d: any) => d.is_required && !d.received);
        const recebidos = (checklist || []).filter((d: any) => d.received);

        return { 
          success: true, 
          message: pendentes.length === 0 
            ? 'Todos os documentos obrigatórios foram recebidos!'
            : `${pendentes.length} documento(s) pendente(s): ${pendentes.map((d: any) => d.doc_label).join(', ')}`,
          data: { 
            pendentes: pendentes.map((d: any) => ({ type: d.doc_type, label: d.doc_label })),
            recebidos: recebidos.map((d: any) => ({ type: d.doc_type, label: d.doc_label })),
            total: checklist?.length || 0,
            all_received: pendentes.length === 0
          }
        };
      }

      case 'consultar_processo': {
        // Consultar status do processo via DataJud e retornar para o lead
        const { lead_id, numero_processo } = dados;
        
        if (!numero_processo) {
          // Buscar processos vinculados ao lead
          const { data: processos } = await supabase
            .from('processos')
            .select('numero_processo, titulo_acao, status')
            .eq('cliente_id', lead_id)
            .not('numero_processo', 'is', null)
            .limit(5);
          
          if (!processos || processos.length === 0) {
            return { 
              success: false, 
              message: 'Não encontrei nenhum processo vinculado a você. Pode me informar o número do processo?',
              data: null
            };
          }
          
          // Se tiver apenas um processo, consultar direto
          if (processos.length === 1) {
            const numeroUnico = processos[0].numero_processo;
            // Fazer chamada recursiva com o número
            return await executarAcao(supabase, 'consultar_processo', { 
              lead_id, 
              numero_processo: numeroUnico 
            }, subscriberId);
          }
          
          // Se tiver múltiplos, listar
          const lista = processos.map((p: any, i: number) => 
            `${i + 1}. ${p.numero_processo} - ${p.titulo_acao || 'Sem título'} (${p.status || 'Em Andamento'})`
          ).join('\n');
          
          return { 
            success: true, 
            message: `Encontrei ${processos.length} processos vinculados:\n${lista}\n\nQual deles você gostaria de consultar?`,
            data: { processos }
          };
        }
        
        // Consultar processo específico via edge function
        try {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/processo-status-monitor`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'consultar_para_lead',
              lead_id,
              numero_processo
            }),
          });
          
          const result = await response.json();
          
          if (result.success) {
            return { 
              success: true, 
              message: result.mensagem,
              data: result.dados
            };
          } else {
            return { 
              success: false, 
              message: result.mensagem || 'Não foi possível consultar o processo.',
              data: null
            };
          }
        } catch (err) {
          console.error('❌ Erro ao consultar processo:', err);
          return { 
            success: false, 
            message: 'Ocorreu um erro ao consultar o processo. Tente novamente em instantes.',
            data: null
          };
        }
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

// Gerar opções de horários para agendamento consultando a agenda real
async function gerarOpcoesHorario(supabase: any, leadId?: string): Promise<Array<{ label: string; short: string; datetime: string; disponivel: boolean }>> {
  const opcoes: Array<{ label: string; short: string; datetime: string; disponivel: boolean }> = [];
  
  // Calcular período: próxima semana + 2 semanas
  const proximaSegunda = getProximaSegundaUtc();
  const fimPeriodo = new Date(proximaSegunda.getTime() + 21 * 24 * 60 * 60 * 1000); // 3 semanas
  
  // Buscar compromissos existentes no período
  const { data: compromissosExistentes } = await supabase
    .from('compromissos')
    .select('data_inicio, data_fim')
    .gte('data_inicio', proximaSegunda.toISOString())
    .lte('data_inicio', fimPeriodo.toISOString());
  
  // Criar set de horários ocupados (formato: "YYYY-MM-DD HH:mm")
  const horariosOcupados = new Set<string>();
  if (compromissosExistentes) {
    for (const c of compromissosExistentes) {
      const dataInicio = new Date(c.data_inicio);
      // Formatar em horário de Manaus
      const dataStr = dataInicio.toISOString().split('T')[0];
      const horaManaus = dataInicio.toLocaleTimeString('pt-BR', { 
        timeZone: 'America/Manaus',
        hour: '2-digit', 
        minute: '2-digit' 
      });
      horariosOcupados.add(`${dataStr} ${horaManaus}`);
    }
  }
  
  console.log('📅 Horários ocupados:', Array.from(horariosOcupados));
  
  // Iterar pelos dias permitidos da próxima semana
  let diaAtual = new Date(proximaSegunda);
  let diasProcessados = 0;
  const maxDias = 9; // Processar até 9 dias (3 semanas de Seg/Qua/Sex)
  
  while (diasProcessados < maxDias && opcoes.length < 6) {
    const diaSemana = diaAtual.getDay();
    
    // Verificar se é dia permitido (Seg=1, Qua=3, Sex=5)
    if (DIAS_PERMITIDOS.includes(diaSemana)) {
      diasProcessados++;
      
      const dataStrISO = diaAtual.toISOString().split('T')[0];
      const nomeDia = NOMES_DIAS[diaSemana];
      const dataFormatada = formatarDataCurta(diaAtual);
      
      // Verificar cada horário disponível
      for (const horario of HORARIOS_DISPONIVEIS) {
        const chave = `${dataStrISO} ${horario}`;
        const ocupado = horariosOcupados.has(chave);
        
        if (!ocupado && opcoes.length < 6) {
          // Criar datetime em UTC (Manaus = UTC-4)
          const dataHoraManaus = `${dataStrISO}T${horario}:00-04:00`;
          const dataHoraUtc = new Date(dataHoraManaus);
          
          opcoes.push({
            label: `${nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1)}, ${formatarData(diaAtual)} às ${horario}`,
            short: `${diaAtual.getDate()}/${diaAtual.getMonth() + 1} ${horario}`,
            datetime: dataHoraUtc.toISOString(),
            disponivel: true
          });
        }
      }
    }
    
    // Avançar para o próximo dia
    diaAtual = new Date(diaAtual.getTime() + 24 * 60 * 60 * 1000);
  }
  
  console.log(`📅 Geradas ${opcoes.length} opções de horário disponíveis`);
  return opcoes;
}

// Verificar disponibilidade de um horário específico
async function verificarDisponibilidadeHorario(supabase: any, dataHora: Date): Promise<{ disponivel: boolean; motivo?: string }> {
  // Validar regras de agendamento
  const horaManaus = dataHora.toLocaleTimeString('pt-BR', { 
    timeZone: 'America/Manaus',
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  const validacao = validarAgendamento(dataHora, horaManaus);
  if (!validacao.valido) {
    return { disponivel: false, motivo: validacao.motivo };
  }
  
  // Verificar conflitos na agenda
  const inicioSlot = dataHora.toISOString();
  const fimSlot = new Date(dataHora.getTime() + 60 * 60 * 1000).toISOString(); // +1 hora
  
  const { data: conflitos } = await supabase
    .from('compromissos')
    .select('id, titulo')
    .or(`and(data_inicio.lt.${fimSlot},data_fim.gt.${inicioSlot})`)
    .limit(1);
  
  if (conflitos && conflitos.length > 0) {
    return { disponivel: false, motivo: 'Horário já ocupado por outro compromisso' };
  }
  
  return { disponivel: true };
}

// Enviar resposta via Z-API (retorna messageId para evitar duplicação)
async function enviarRespostaZapi(supabaseClient: any, subscriberId: string, mensagem: string): Promise<{ success: boolean; messageId?: string }> {
  try {
    // Buscar telefone do subscriber
    const { data: subscriber } = await supabaseClient
      .from('manychat_subscribers')
      .select('telefone')
      .eq('subscriber_id', subscriberId)
      .maybeSingle();

    if (!subscriber?.telefone) {
      console.log('⚠️ Subscriber sem telefone:', subscriberId);
      return { success: false };
    }

    // Buscar configuração do Z-API
    const { data: zapiConfig } = await supabaseClient
      .from('integrations_config')
      .select('config_json, is_active')
      .eq('provider', 'zapi')
      .single();

    if (!zapiConfig?.is_active) {
      console.log('⚠️ Z-API não está ativo');
      return { success: false };
    }

    const instanceId = zapiConfig.config_json?.instance_id;
    const token = zapiConfig.config_json?.token;
    const clientToken = zapiConfig.config_json?.client_token;

    if (!instanceId || !token) {
      console.log('⚠️ Z-API não configurado (falta instance_id ou token)');
      return { success: false };
    }

    // Normalizar telefone
    let cleanPhone = subscriber.telefone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = '55' + cleanPhone;
    }

    // Headers com Client-Token se disponível
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (clientToken) {
      headers['Client-Token'] = clientToken;
    }

    console.log(`[Isa Z-API] Enviando para ${cleanPhone}, clientToken: ${clientToken ? 'presente' : 'ausente'}`);

    // Enviar via Z-API
    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: cleanPhone,
        message: mensagem
      })
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      console.error('❌ Erro ao enviar via Z-API:', result);
      return { success: false };
    }

    console.log('✅ Resposta enviada via Z-API para:', cleanPhone, 'messageId:', result.messageId);
    return { success: true, messageId: result.messageId || result.id };
  } catch (error) {
    console.error('❌ Erro ao enviar via Z-API:', error);
    return { success: false };
  }
}

// Alias para compatibilidade
async function enviarRespostaManyChat(subscriberId: string, mensagem: string): Promise<boolean> {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const result = await enviarRespostaZapi(supabaseClient, subscriberId, mensagem);
  return result.success;
}

// Processar mensagem com IA
async function processarComIA(contexto: LeadContext, mensagem: string, subscriberId: string): Promise<{
  resposta: string;
  acoes: Array<{ acao: string; dados: any; motivo: string; automatica: boolean }>;
  analise: { intencao: string; sentimento: string; urgencia: string };
}> {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Buscar prompt customizado do banco
  const { data: promptConfig } = await supabaseClient
    .from('ai_prompts')
    .select('content, strict_mode, greeting_message')
    .eq('name', 'isa_system_prompt')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const strictMode = promptConfig?.strict_mode ?? true;

  // Verificar se há agendamento pendente de confirmação
  const { data: agendamentoPendente } = await supabaseClient
    .from('system_events')
    .select('*')
    .eq('lead_id', contexto.lead.id)
    .eq('acao', 'aguardando_confirmacao_lead')
    .eq('processado', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const temAgendamentoPendente = !!agendamentoPendente;
  const opcoesAgendamento = agendamentoPendente?.dados?.opcoes_oferecidas || [];

  // Verificar status do follow-up
  let followupInfo = '';
  if (contexto.followup) {
    const statusFollowup = await verificarFollowupStatus(supabaseClient, contexto.lead.id, contexto.followup);
    const stageFast = contexto.followup.followup_stage_fast || 0;
    const stageSlow = contexto.followup.followup_stage_slow || 0;
    
    followupInfo = `
📊 STATUS DO FOLLOW-UP:
- Estágio FAST: ${stageFast}/3 ${stageFast >= 3 ? '(completo)' : ''}
- Estágio SLOW: ${stageSlow}/3 ${stageSlow >= 3 ? '(completo)' : ''}
- Respondeu: ${contexto.followup.respondido ? 'SIM ✅' : 'NÃO'}
- Status: ${statusFollowup.status}
`;
  }

  // Formatar histórico completo (bot + humano)
  const historicoCompleto = [
    ...contexto.mensagens.slice(0, 20).map(m => ({
      tipo: 'chat',
      origem: m.direcao === 'inbound' ? 'cliente' : 'bot/equipe',
      conteudo: m.conteudo,
      data: m.created_at,
    })),
    ...contexto.interacoes.slice(0, 10).map(i => ({
      tipo: 'interacao',
      origem: i.direcao === 'entrada' ? 'cliente' : 'equipe',
      conteudo: `[${i.tipo}] ${i.resumo}${i.detalhes ? ': ' + i.detalhes : ''}`,
      data: i.data_interacao,
    })),
  ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  const historicoFormatado = historicoCompleto.slice(-25).map(h => 
    `[${h.origem.toUpperCase()}] ${h.conteudo}`
  ).join('\n');

  // ============================================================
  // STATE MACHINE CONTEXT
  // ============================================================
  const leadState = contexto.lead.lead_state || 'NEW';
  const classification = contexto.classification;
  const contractData = contexto.contractData;
  const docsChecklist = contexto.docsChecklist || [];
  const docsPending = docsChecklist.filter(d => d.is_required && !d.received);
  const docsReceived = docsChecklist.filter(d => d.received);

  const stateInfo = `
🔄 ESTADO ATUAL DO LEAD: ${leadState}

📊 MÁQUINA DE ESTADOS (Lead Lifecycle):
- NEW → TRIAGE → CLASSIFIED → DATA_CAPTURE → CONTRACT_SENT → CONTRACT_SIGNED → DOCS_PENDING → READY_FOR_LAWYER

📍 ETAPAS E AÇÕES ESPERADAS:
${leadState === 'NEW' ? `
⭐ ESTADO ATUAL: NEW (Lead acabou de entrar)
→ AÇÃO: Fazer perguntas de triagem para entender o caso
→ Após entender o problema, use "transicionar_estado" para "TRIAGE"
` : ''}
${leadState === 'TRIAGE' ? `
⭐ ESTADO ATUAL: TRIAGE (Triagem em andamento)
→ AÇÃO: Identificar o tipo de caso (bancário/aéreo) e qualificar
→ Use "classificar_caso" com o tipo identificado
→ Após classificar, use "transicionar_estado" para "CLASSIFIED"
` : ''}
${leadState === 'CLASSIFIED' ? `
⭐ ESTADO ATUAL: CLASSIFIED (Caso já identificado)
→ Classificação: ${classification?.case_type || 'Não definida'} ${classification?.sub_type ? `(${classification.sub_type})` : ''}
→ AÇÃO: Coletar dados para contrato (CPF, RG, endereço, etc.)
→ Pergunte os dados faltantes de forma natural
→ Use "salvar_dados_contrato" conforme receber os dados
→ Quando tiver os dados mínimos, use "transicionar_estado" para "DATA_CAPTURE"
` : ''}
${leadState === 'DATA_CAPTURE' ? `
⭐ ESTADO ATUAL: DATA_CAPTURE (Coletando dados)
→ Dados já salvos: ${contractData ? Object.keys(contractData).filter(k => contractData[k] && !['id', 'lead_id', 'created_at', 'updated_at'].includes(k)).join(', ') || 'Nenhum' : 'Nenhum'}
→ AÇÃO: Continuar coletando dados essenciais (CPF, endereço completo)
→ Quando completo, informar que o contrato será enviado
→ Use "transicionar_estado" para "CONTRACT_SENT" após enviar
` : ''}
${leadState === 'CONTRACT_SENT' ? `
⭐ ESTADO ATUAL: CONTRACT_SENT (Contrato enviado)
→ AÇÃO: Acompanhar assinatura do contrato
→ Se cliente confirmar assinatura, use "transicionar_estado" para "CONTRACT_SIGNED"
` : ''}
${leadState === 'CONTRACT_SIGNED' ? `
⭐ ESTADO ATUAL: CONTRACT_SIGNED (Contrato assinado!)
→ AÇÃO: Solicitar documentos necessários
→ Documentos requeridos: ${classification?.recommended_docs?.join(', ') || 'Definir conforme caso'}
→ Use "transicionar_estado" para "DOCS_PENDING"
` : ''}
${leadState === 'DOCS_PENDING' ? `
⭐ ESTADO ATUAL: DOCS_PENDING (Aguardando documentos)
→ Documentos pendentes: ${docsPending.length > 0 ? docsPending.map(d => d.doc_label).join(', ') : 'Nenhum pendente!'}
→ Documentos recebidos: ${docsReceived.length > 0 ? docsReceived.map(d => d.doc_label).join(', ') : 'Nenhum ainda'}
→ AÇÃO: Cobrar documentos faltantes
→ Use "marcar_doc_recebido" quando cliente enviar um documento
→ Quando todos recebidos, use "transicionar_estado" para "READY_FOR_LAWYER"
` : ''}
${leadState === 'READY_FOR_LAWYER' ? `
⭐ ESTADO ATUAL: READY_FOR_LAWYER (Pronto para advogado!)
→ AÇÃO: Confirmar recebimento e informar que a equipe jurídica irá analisar
→ ⚠️ BLOQUEADO: Não executar mais automações. Aguardar equipe.
` : ''}
`;

  // Prompt base com state machine
  const basePrompt = promptConfig?.content || `Você é Isa, a assistente inteligente do escritório de advocacia Bentes & Ramos.

🎯 OBJETIVO: Conduzir leads pelo fluxo de conversão usando a MÁQUINA DE ESTADOS.

⚠️ GUARDRAILS (OBRIGATÓRIO):
- NUNCA afirme que algo é ilegal ou que o cliente VAI ganhar
- Use linguagem condicional: "há indícios", "em tese", "depende de análise"
- Toda classificação é TRIAGEM PRELIMINAR, não parecer jurídico
- Ao final de classificações, informe: "Esta é uma análise preliminar e depende de validação pela equipe jurídica."

⛔ ÁREAS QUE NÃO ATENDEMOS:
- Direito Trabalhista, Previdenciário, Família, Criminal, Imobiliário
- Se o cliente mencionar essas áreas, decline educadamente e redirecione

✅ ÁREAS QUE ATENDEMOS:
- Direito Bancário (juros abusivos, seguro prestamista, revisional, busca e apreensão)
- Questões Aéreas (overbooking, cancelamento, atraso, extravio de bagagem)`;

  const systemPrompt = `${basePrompt}

${strictMode ? `
🔒 MODO RÍGIDO ATIVADO: Você DEVE operar exclusivamente pela máquina de estados.
- Cada resposta deve considerar o estado atual e guiar para o próximo
- Use as ações de transição obrigatoriamente
` : ''}

${stateInfo}

📅 REGRAS DE AGENDAMENTO:
- Dias: Segunda, Quarta e Sexta
- Horários: ${HORARIOS_DISPONIVEIS.join(', ')}
- Link Cal.com: https://cal.com/bentes-ramos-advocacia-1ucmau/agendamentos-crm

${temAgendamentoPendente ? `
⚠️ AGENDAMENTO PENDENTE: ${JSON.stringify(opcoesAgendamento.map((o: { label: string }) => o.label))}
` : ''}

${followupInfo}

📊 CONTEXTO DO LEAD:
Nome: ${contexto.lead.nome || 'Não informado'}
Status Legado: ${contexto.lead.status || 'Lead Frio'}
Estado: ${leadState}
Telefone: ${contexto.lead.telefone || 'Não informado'}
Email: ${contexto.lead.email || 'Não informado'}
Origem: ${contexto.lead.origem || 'Não informada'}
Tipo Ação: ${contexto.lead.tipo_acao || 'Não classificado'}

📜 HISTÓRICO DA CONVERSA:
${historicoFormatado || '(Sem histórico)'}

⚙️ AÇÕES DISPONÍVEIS:

🔄 STATE MACHINE:
- transicionar_estado: Mover lead para próximo estado (dados: { lead_id, to_state, reason? })
- classificar_caso: Classificar tipo do caso (dados: { lead_id, case_type, sub_type?, summary?, recommended_docs?: string[], confidence_score? })
- salvar_dados_contrato: Salvar dados para contrato (dados: { lead_id, cpf?, rg?, endereco?, cidade?, uf?, cep?, estado_civil?, profissao? })
- marcar_doc_recebido: Marcar documento como recebido (dados: { lead_id, doc_type })
- verificar_docs_pendentes: Listar documentos pendentes (dados: { lead_id })

📅 AGENDA:
- verificar_agenda: Consultar horários disponíveis
- agendar_direto: Criar compromisso

📋 LEAD:
- classificar_lead: Atualizar status legado do lead
- atualizar_dados_lead: Atualizar nome, telefone ou email
- criar_interacao: Registrar interação

🔄 FOLLOW-UP:
- pausar_followup / retomar_followup: Controlar automação

Responda em JSON:
{
  "analise": {
    "intencao": "descrição breve",
    "sentimento": "positivo|neutro|negativo",
    "urgencia": "baixa|media|alta|urgente",
    "area_juridica": "bancario|aereo|trabalhista|outro|indefinido",
    "proximo_estado_sugerido": "${leadState}" ou próximo estado lógico
  },
  "resposta": "Mensagem para o cliente (máximo 3-4 linhas)",
  "acoes": [{ "acao": "nome", "dados": {}, "motivo": "razão" }]
}`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
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

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Erro na API OpenAI:', error);
    throw new Error('Erro ao processar com IA');
  }

  const data = await response.json();
  const resultado = JSON.parse(data.choices[0].message.content);

  // Marcar ações como automáticas ou não
  const acoesProcessadas = (resultado.acoes || []).map((a: any) => ({
    acao: a.acao,
    dados: {
      ...a.dados,
      lead_id: contexto.lead.id,
      cliente_id: contexto.lead.id,
      status_anterior: contexto.lead.status,
    },
    motivo: a.motivo || '',
    automatica: ACOES_AUTOMATICAS.includes(a.acao),
  }));

  return {
    resposta: resultado.resposta || '',
    acoes: acoesProcessadas,
    analise: resultado.analise,
  };
}

// Transcrever áudio usando Whisper
async function transcreverAudio(audioUrl: string): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.log('⚠️ OPENAI_API_KEY não configurada para transcrição');
    return null;
  }

  try {
    console.log('🎤 Baixando áudio para transcrição:', audioUrl.substring(0, 80));
    
    // Baixar o áudio
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error('❌ Erro ao baixar áudio:', audioResponse.status);
      return null;
    }
    
    const audioBlob = await audioResponse.blob();
    console.log('🎤 Áudio baixado:', audioBlob.size, 'bytes');
    
    // Criar FormData para enviar ao Whisper
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    
    // Enviar para Whisper
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });
    
    if (!whisperResponse.ok) {
      const error = await whisperResponse.text();
      console.error('❌ Erro no Whisper:', error);
      return null;
    }
    
    const result = await whisperResponse.json();
    console.log('✅ Transcrição concluída:', result.text?.substring(0, 100));
    return result.text || null;
  } catch (error) {
    console.error('❌ Erro ao transcrever áudio:', error);
    return null;
  }
}

// Detectar se é URL de áudio
function isAudioUrl(content: string): boolean {
  if (!content) return false;
  const lowerContent = content.toLowerCase();
  return lowerContent.match(/\.(ogg|mp3|wav|m4a|aac|opus)(\?|$)/) !== null ||
         lowerContent.includes('voice') ||
         lowerContent.includes('audio');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { lead_id, subscriber_id, mensagem, canal, tipo_mensagem } = await req.json();
    
    console.log('🤖 Isa Auto-Process iniciado');
    console.log('📝 Lead ID:', lead_id);
    console.log('📱 Subscriber ID:', subscriber_id);
    console.log('💬 Mensagem:', mensagem?.substring(0, 100));
    console.log('📎 Tipo:', tipo_mensagem);

    if (!lead_id || !mensagem) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'lead_id e mensagem são obrigatórios' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 🔒 IGNORAR MENSAGENS DO BOT - Evitar loop de processamento
    const mensagemLower = mensagem.toLowerCase().trim();
    if (mensagemLower.startsWith('bot diz:') || 
        mensagemLower.startsWith('isa diz:') ||
        mensagemLower.startsWith('[bot]') ||
        mensagemLower.startsWith('[isa]')) {
      console.log('🔇 Mensagem do bot detectada, ignorando processamento');
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        reason: 'mensagem_do_bot' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 🛑 VERIFICAR ATENDIMENTO HUMANO - Isa para de processar
    if (subscriber_id) {
      const { data: subscriberCheck } = await supabase
        .from('manychat_subscribers')
        .select('atendimento_humano')
        .eq('subscriber_id', subscriber_id)
        .maybeSingle();
      
      if (subscriberCheck?.atendimento_humano) {
        console.log('⏸️ Atendimento humano ativo, Isa não processa');
        return new Response(JSON.stringify({ 
          success: true, 
          skipped: true,
          reason: 'atendimento_humano_ativo' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Se for áudio, transcrever primeiro
    let mensagemProcessada = mensagem;
    let audioTranscrito = false;
    
    if (tipo_mensagem === 'audio' || isAudioUrl(mensagem)) {
      console.log('🎤 Detectado áudio, iniciando transcrição...');
      const transcricao = await transcreverAudio(mensagem);
      
      if (transcricao) {
        mensagemProcessada = transcricao;
        audioTranscrito = true;
        console.log('✅ Áudio transcrito com sucesso');
        
        // Salvar transcrição como interação
        await supabase.from('interacoes').insert({
          cliente_id: lead_id,
          tipo: 'WhatsApp',
          resumo: `Áudio transcrito: "${transcricao.substring(0, 200)}${transcricao.length > 200 ? '...' : ''}"`,
          detalhes: `Transcrição completa: ${transcricao}`,
          direcao: 'Entrada',
        });
      } else {
        mensagemProcessada = '[Áudio recebido - transcrição não disponível]';
        console.log('⚠️ Não foi possível transcrever o áudio');
      }
    }

    // Buscar contexto completo do lead
    const contexto = await buscarContextoLead(supabase, lead_id);
    
    if (!contexto) {
      console.log('⚠️ Lead não encontrado:', lead_id);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Lead não encontrado' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📊 Contexto carregado para:', contexto.lead.nome);

    // ============================================================
    // 🔄 INTELIGÊNCIA DE FOLLOW-UP: Marcar como respondido
    // ============================================================
    const agora = new Date().toISOString();
    
    if (contexto.followup) {
      // Lead respondeu! Marcar follow-up como respondido
      if (!contexto.followup.respondido) {
        console.log('✅ Lead respondeu! Marcando follow-up como respondido');
        
        await supabase
          .from('lead_followups')
          .update({
            respondido: true,
            respondido_em: agora,
            waiting_reply: false,
            last_inbound_at: agora,
            status: 'respondido'
          })
          .eq('id', contexto.followup.id);
        
        // Registrar evento de resposta
        await supabase.from('system_events').insert({
          tipo: 'followup',
          fonte: 'isa_inteligente',
          acao: 'lead_respondeu',
          lead_id: lead_id,
          dados: {
            followup_id: contexto.followup.id,
            stage_fast: contexto.followup.followup_stage_fast,
            stage_slow: contexto.followup.followup_stage_slow
          },
          processado: true
        });
        
        // Se era Lead Frio, atualizar para Em Atendimento
        if (contexto.lead.status === 'Lead Frio') {
          console.log('📈 Lead Frio respondeu - atualizando para Em Atendimento');
          
          await supabase
            .from('leads_juridicos')
            .update({ status: 'Em Atendimento' })
            .eq('id', lead_id);
          
          // Atualizar contexto local
          contexto.lead.status = 'Em Atendimento';
        }
      } else {
        // Atualizar apenas o timestamp de última mensagem recebida
        await supabase
          .from('lead_followups')
          .update({
            last_inbound_at: agora,
            waiting_reply: false
          })
          .eq('id', contexto.followup.id);
      }
    }

    // Processar com IA (usando mensagem transcrita se for áudio)
    const resultado = await processarComIA(contexto, mensagemProcessada, subscriber_id);
    
    console.log('🧠 Análise da IA:', resultado.analise);
    console.log('📋 Ações sugeridas:', resultado.acoes.length);

    // Executar ações automáticas
    const acoesExecutadas = [];
    const acoesNauto = [];

    for (const acao of resultado.acoes) {
      if (acao.automatica) {
        console.log(`⚡ Executando ação automática: ${acao.acao}`);
        const resultadoAcao = await executarAcao(supabase, acao.acao, acao.dados, subscriber_id);
        acoesExecutadas.push({
          ...acao,
          resultado: resultadoAcao,
        });
        
        // Se confirmou agendamento, marcar evento pendente como processado
        if (acao.acao === 'confirmar_agendamento') {
          await supabase
            .from('system_events')
            .update({ processado: true })
            .eq('lead_id', lead_id)
            .eq('acao', 'aguardando_confirmacao_lead')
            .eq('processado', false);
        }
      } else {
        // Ações que precisam de confirmação - salvar para notificar equipe
        console.log(`⏳ Ação requer confirmação: ${acao.acao}`);
        
        // Criar notificação pendente
        await supabase.from('system_events').insert({
          tipo: 'acao_pendente',
          fonte: 'isa_auto',
          acao: 'acao_sugerida',
          entidade_id: lead_id,
          lead_id: lead_id,
          dados: {
            acao_sugerida: acao.acao,
            dados_acao: acao.dados,
            motivo: acao.motivo,
            mensagem_original: mensagem,
            mensagem_processada: mensagemProcessada,
            audio_transcrito: audioTranscrito,
            analise: resultado.analise,
          },
          processado: false,
        });
        
        acoesNauto.push(acao);
      }
    }

    // Enviar email de notificação se houver ações pendentes
    if (acoesNauto.length > 0) {
      console.log('📧 Enviando notificação por email para equipe...');
      await enviarNotificacaoEquipe(
        supabase,
        contexto.lead,
        acoesNauto,
        resultado.analise,
        audioTranscrito ? `[🎤 Áudio transcrito]: ${mensagemProcessada}` : mensagem
      );
    }

    // Enviar resposta via Z-API se houver
    let respostaEnviada = false;
    let respostaMsgId: string | null = null;
    if (resultado.resposta && subscriber_id) {
      const sendResult = await enviarRespostaZapi(supabase, subscriber_id, resultado.resposta);
      respostaEnviada = sendResult.success;
      respostaMsgId = sendResult.messageId || null;
      
      // Salvar resposta no banco (única vez, aqui)
      if (respostaEnviada) {
        await supabase.from('manychat_mensagens').insert({
          subscriber_id: subscriber_id,
          subscriber_nome: 'Isa (Assistente)',
          canal: canal || 'whatsapp',
          conteudo: resultado.resposta,
          tipo: 'text',
          direcao: 'saida',
          lead_id: lead_id,
          metadata: { 
            auto_gerada: true, 
            source: 'isa',
            message_id: respostaMsgId,
            analise: resultado.analise 
          },
        });
      }
    }

    // Registrar processamento
    await supabase.from('system_events').insert({
      tipo: 'processamento',
      fonte: 'isa_auto',
      acao: 'mensagem_processada',
      entidade_id: lead_id,
      lead_id: lead_id,
      dados: {
        mensagem_original: mensagem.substring(0, 200),
        mensagem_processada: mensagemProcessada.substring(0, 200),
        audio_transcrito: audioTranscrito,
        analise: resultado.analise,
        acoes_executadas: acoesExecutadas.length,
        acoes_pendentes: acoesNauto.length,
        resposta_enviada: respostaEnviada,
      },
      processado: true,
    });

    console.log('✅ Processamento concluído');
    console.log(`   - Áudio transcrito: ${audioTranscrito}`);
    console.log(`   - Ações executadas: ${acoesExecutadas.length}`);
    console.log(`   - Ações pendentes: ${acoesNauto.length}`);
    console.log(`   - Resposta enviada: ${respostaEnviada}`);

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
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    
    await supabase.from('system_events').insert({
      tipo: 'erro',
      fonte: 'isa_auto',
      acao: 'processamento_erro',
      erro: error instanceof Error ? error.message : 'Erro desconhecido',
      processado: false,
    });

    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
