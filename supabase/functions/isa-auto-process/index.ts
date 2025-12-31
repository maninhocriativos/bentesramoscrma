import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


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
];

// Ações que precisam de confirmação (híbrido)
const ACOES_CONFIRMACAO = [
  'criar_tarefa',
  'criar_compromisso',
  'atualizar_status_lead',
  'enviar_contrato',
];

interface LeadContext {
  lead: any;
  mensagens: any[];
  interacoes: any[];
  tarefas: any[];
  compromissos: any[];
  processos: any[];
  honorarios: any[];
  parcelas: any[];
}

// Buscar contexto completo do lead
async function buscarContextoLead(supabase: any, leadId: string): Promise<LeadContext | null> {
  const [
    { data: lead },
    { data: mensagens },
    { data: interacoes },
    { data: tarefas },
    { data: compromissos },
    { data: processos },
    { data: honorarios },
  ] = await Promise.all([
    supabase.from('leads_juridicos').select('*').eq('id', leadId).single(),
    supabase.from('manychat_mensagens').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(20),
    supabase.from('interacoes').select('*').eq('cliente_id', leadId).order('data_interacao', { ascending: false }).limit(10),
    supabase.from('tarefas').select('*').eq('cliente_id', leadId).order('created_at', { ascending: false }).limit(10),
    supabase.from('compromissos').select('*').eq('lead_id', leadId).order('data_inicio', { ascending: false }).limit(5),
    supabase.from('processos').select('*').eq('cliente_id', leadId),
    supabase.from('honorarios').select('*, parcelas(*)').eq('cliente_id', leadId),
  ]);

  if (!lead) return null;

  const parcelas = honorarios?.flatMap((h: any) => h.parcelas || []) || [];

  return { lead, mensagens: mensagens || [], interacoes: interacoes || [], tarefas: tarefas || [], compromissos: compromissos || [], processos: processos || [], honorarios: honorarios || [], parcelas };
}

// Executar ação no sistema
async function executarAcao(supabase: any, acao: string, dados: any): Promise<{ success: boolean; message: string; data?: any }> {
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

      default:
        return { success: false, message: `Ação "${acao}" não reconhecida` };
    }
  } catch (error) {
    console.error(`❌ Erro na ação ${acao}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return { success: false, message: `Erro ao executar ${acao}: ${errorMessage}` };
  }
}

// Enviar resposta via ManyChat
async function enviarRespostaManyChat(subscriberId: string, mensagem: string): Promise<boolean> {
  if (!MANYCHAT_API_KEY) {
    console.log('⚠️ MANYCHAT_API_KEY não configurada, resposta não enviada');
    return false;
  }

  try {
    const response = await fetch('https://api.manychat.com/fb/sending/sendContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
      },
      body: JSON.stringify({
        subscriber_id: parseInt(subscriberId),
        data: {
          version: 'v2',
          content: {
            messages: [{ type: 'text', text: mensagem }]
          }
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Erro ao enviar para ManyChat:', error);
      return false;
    }

    console.log('✅ Resposta enviada via ManyChat');
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar para ManyChat:', error);
    return false;
  }
}

// Processar mensagem com IA
async function processarComIA(contexto: LeadContext, mensagem: string, subscriberId: string): Promise<{
  resposta: string;
  acoes: Array<{ acao: string; dados: any; motivo: string; automatica: boolean }>;
  analise: { intencao: string; sentimento: string; urgencia: string };
}> {
  const systemPrompt = `Você é Isa, a assistente inteligente do escritório de advocacia Bentes & Ramos.
Seu papel é analisar mensagens de clientes e tomar ações inteligentes no sistema.

CONTEXTO DO LEAD:
${JSON.stringify({
  nome: contexto.lead.nome,
  status: contexto.lead.status,
  telefone: contexto.lead.telefone,
  email: contexto.lead.email,
  origem: contexto.lead.origem,
  tipo_acao: contexto.lead.tipo_acao,
  valor_causa: contexto.lead.valor_causa,
  resumo: contexto.lead.resumo_ia,
}, null, 2)}

HISTÓRICO DE MENSAGENS (últimas 10):
${contexto.mensagens.slice(0, 10).map(m => `[${m.direcao}] ${m.subscriber_nome || 'Cliente'}: ${m.conteudo}`).join('\n')}

INTERAÇÕES ANTERIORES:
${contexto.interacoes.slice(0, 5).map(i => `[${i.tipo}] ${i.resumo}`).join('\n') || 'Nenhuma interação registrada'}

TAREFAS PENDENTES:
${contexto.tarefas.filter(t => t.status !== 'Concluída').slice(0, 5).map(t => `- ${t.titulo} (${t.prioridade})`).join('\n') || 'Nenhuma tarefa pendente'}

COMPROMISSOS:
${contexto.compromissos.slice(0, 3).map(c => `- ${c.titulo} em ${new Date(c.data_inicio).toLocaleDateString('pt-BR')}`).join('\n') || 'Nenhum compromisso'}

PROCESSOS:
${contexto.processos.map(p => `- ${p.titulo_acao || 'Sem título'} (${p.status})`).join('\n') || 'Nenhum processo'}

FINANCEIRO:
${contexto.honorarios.length > 0 ? 
  `Honorários: R$ ${contexto.honorarios.reduce((sum, h) => sum + h.valor_total, 0).toLocaleString('pt-BR')}
Parcelas pendentes: ${contexto.parcelas.filter(p => p.status !== 'Pago').length}` 
  : 'Nenhum honorário cadastrado'}

---

INSTRUÇÕES:
1. Analise a mensagem do cliente considerando todo o contexto
2. Identifique a intenção, sentimento e urgência
3. Determine quais ações devem ser tomadas
4. Gere uma resposta empática e profissional

AÇÕES DISPONÍVEIS:
- classificar_lead: Atualizar status do lead (Lead Frio, Lead Morno, Lead Quente, Em Negociação, Cliente)
- criar_interacao: Registrar esta interação no histórico
- atualizar_resumo_lead: Atualizar o resumo/notas sobre o lead
- criar_tarefa: Criar tarefa de follow-up ou ação necessária
- criar_compromisso: Agendar reunião ou compromisso

Responda em JSON com a seguinte estrutura:
{
  "analise": {
    "intencao": "string descrevendo a intenção do cliente",
    "sentimento": "positivo|neutro|negativo",
    "urgencia": "baixa|media|alta|urgente"
  },
  "resposta": "Mensagem para responder ao cliente (deixe vazio se não for para responder)",
  "acoes": [
    {
      "acao": "nome_da_acao",
      "dados": { /* dados necessários para a ação */ },
      "motivo": "por que esta ação é necessária"
    }
  ]
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { lead_id, subscriber_id, mensagem, canal } = await req.json();
    
    console.log('🤖 Isa Auto-Process iniciado');
    console.log('📝 Lead ID:', lead_id);
    console.log('📱 Subscriber ID:', subscriber_id);
    console.log('💬 Mensagem:', mensagem?.substring(0, 100));

    if (!lead_id || !mensagem) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'lead_id e mensagem são obrigatórios' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // Processar com IA
    const resultado = await processarComIA(contexto, mensagem, subscriber_id);
    
    console.log('🧠 Análise da IA:', resultado.analise);
    console.log('📋 Ações sugeridas:', resultado.acoes.length);

    // Executar ações automáticas
    const acoesExecutadas = [];
    const acoesNauto = [];

    for (const acao of resultado.acoes) {
      if (acao.automatica) {
        console.log(`⚡ Executando ação automática: ${acao.acao}`);
        const resultadoAcao = await executarAcao(supabase, acao.acao, acao.dados);
        acoesExecutadas.push({
          ...acao,
          resultado: resultadoAcao,
        });
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
        mensagem
      );
    }

    // Enviar resposta via ManyChat se houver
    let respostaEnviada = false;
    if (resultado.resposta && subscriber_id) {
      respostaEnviada = await enviarRespostaManyChat(subscriber_id, resultado.resposta);
      
      // Salvar resposta no banco
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
        mensagem: mensagem.substring(0, 200),
        analise: resultado.analise,
        acoes_executadas: acoesExecutadas.length,
        acoes_pendentes: acoesNauto.length,
        resposta_enviada: respostaEnviada,
      },
      processado: true,
    });

    console.log('✅ Processamento concluído');
    console.log(`   - Ações executadas: ${acoesExecutadas.length}`);
    console.log(`   - Ações pendentes: ${acoesNauto.length}`);
    console.log(`   - Resposta enviada: ${respostaEnviada}`);

    return new Response(JSON.stringify({
      success: true,
      lead: { id: contexto.lead.id, nome: contexto.lead.nome },
      analise: resultado.analise,
      resposta: resultado.resposta,
      resposta_enviada: respostaEnviada,
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
