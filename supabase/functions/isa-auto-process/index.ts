import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const MANYCHAT_API_KEY = Deno.env.get('MANYCHAT_API_KEY');

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
        const { lead_id, novo_status, motivo } = dados;
        const { data, error } = await supabase
          .from('leads_juridicos')
          .update({ 
            status: novo_status,
            resumo_ia: motivo 
          })
          .eq('id', lead_id)
          .select()
          .single();
        
        if (error) throw error;
        
        // Registrar evento
        await supabase.from('system_events').insert({
          tipo: 'lead',
          fonte: 'isa_auto',
          acao: 'lead_classificado',
          entidade_id: lead_id,
          lead_id: lead_id,
          dados: { status_anterior: dados.status_anterior, novo_status, motivo },
          processado: true,
        });
        
        return { success: true, message: `Lead classificado como "${novo_status}"`, data };
      }

      case 'criar_interacao': {
        const { cliente_id, tipo, resumo, detalhes, direcao } = dados;
        const { data, error } = await supabase
          .from('interacoes')
          .insert({
            cliente_id,
            tipo: tipo || 'WhatsApp',
            resumo,
            detalhes,
            direcao: direcao || 'Entrada',
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
