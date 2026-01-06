import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const manychatApiKey = Deno.env.get('MANYCHAT_API_KEY')!;

interface FollowupConfig {
  titulo: string;
  mensagem: string;
  delay_minutos: number;
  flow_ns: string;
  requer_template?: boolean;
}

// Configuração de follow-ups
const FOLLOWUP_CONFIG: Record<string, FollowupConfig> = {
  followup_1: {
    titulo: "Ainda estou aqui para ajudar! 🤝",
    mensagem: `Oi {{nome}}! Vi que você entrou em contato conosco há pouco.

Sei que às vezes a vida corrida nos faz pausar, mas estou aqui para te ajudar com sua questão jurídica.

Responda "SIM" se quiser conversar agora ou "AGENDAR" para marcar um horário! 📅`,
    delay_minutos: 10,
    flow_ns: 'followup_10min'
  },
  followup_2: {
    titulo: "Sua situação merece atenção 📋",
    mensagem: `{{nome}}, percebi que ainda não conversamos.

Muitos clientes que atendemos estavam na mesma situação - sem saber por onde começar.

Nossa equipe já ajudou centenas de pessoas a resolver questões como:
✅ Revisão de contratos
✅ Ações trabalhistas  
✅ Direitos do consumidor

Que tal conversarmos sem compromisso? Só responder aqui! 💬`,
    delay_minutos: 60,
    flow_ns: 'followup_1hora'
  },
  followup_3: {
    titulo: "Última mensagem sobre seu caso 📌",
    mensagem: `Olá {{nome}}, essa é minha última tentativa de contato.

Entendo que você pode estar ocupado(a), mas não queria deixar de oferecer nossa ajuda.

🎯 Primeira consulta GRATUITA
📱 Atendimento rápido pelo WhatsApp
🔒 Sigilo total garantido

Se mudar de ideia, é só responder aqui que retomamos de onde paramos!`,
    delay_minutos: 1440,
    flow_ns: 'followup_24h_template',
    requer_template: true
  }
};

// Enviar via Flow do ManyChat
async function enviarViaFlow(subscriberId: string, flowNs: string, dados: Record<string, any>) {
  try {
    console.log(`[FOLLOWUP] Enviando via sendFlow: subscriber=${subscriberId}, flow=${flowNs}`);
    
    const response = await fetch('https://api.manychat.com/fb/sending/sendFlow', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${manychatApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: parseInt(subscriberId),
        flow_ns: flowNs,
        external_data: dados
      }),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      const text = await response.text();
      console.error('[FOLLOWUP] Resposta não-JSON do sendFlow:', text.substring(0, 200));
      return { success: false, error: 'Resposta não-JSON', fallback: true };
    }

    const result = await response.json();
    console.log('[FOLLOWUP] sendFlow response:', JSON.stringify(result));
    
    if (result.status === 'success') {
      return { success: true, result };
    }
    
    // Se o flow não existe, marcar para fallback
    if (result.error?.includes('not found') || result.error?.includes('Flow')) {
      return { success: false, error: result.error, fallback: true };
    }
    
    return { success: false, error: result.error || 'Erro desconhecido' };

  } catch (error: any) {
    console.error('[FOLLOWUP] Erro no sendFlow:', error);
    return { success: false, error: error.message, fallback: true };
  }
}

// Fallback: enviar mensagem direta (só funciona dentro da janela 24h)
async function enviarMensagemDireta(subscriberId: string, mensagem: string, canal: string = 'whatsapp') {
  try {
    console.log(`[FOLLOWUP] Tentando envio direto: subscriber=${subscriberId}`);
    
    const contentType = canal === 'whatsapp' ? 'whatsapp' : 'instagram';
    
    const response = await fetch('https://api.manychat.com/fb/sending/sendContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${manychatApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: parseInt(subscriberId),
        data: {
          version: "v2",
          content: {
            type: contentType,
            messages: [{ type: "text", text: mensagem }]
          }
        }
      }),
    });

    const respContentType = response.headers.get('content-type');
    if (!respContentType?.includes('application/json')) {
      const text = await response.text();
      console.error('[FOLLOWUP] Resposta não-JSON do sendContent:', text.substring(0, 200));
      return { success: false, error: 'API retornou HTML' };
    }

    const result = await response.json();
    console.log('[FOLLOWUP] sendContent response:', JSON.stringify(result));
    
    return { success: result.status === 'success', result };

  } catch (error: any) {
    console.error('[FOLLOWUP] Erro no sendContent:', error);
    return { success: false, error: error.message };
  }
}

// Função principal de envio
async function enviarFollowup(
  subscriberId: string, 
  templateKey: string, 
  nome: string, 
  canal: string,
  minutosDesdeContato: number
) {
  const config = FOLLOWUP_CONFIG[templateKey as keyof typeof FOLLOWUP_CONFIG];
  if (!config) {
    return { success: false, error: 'Template não encontrado' };
  }
  
  const mensagemPersonalizada = config.mensagem.replace(/\{\{nome\}\}/g, nome || 'cliente');
  
  // Se requer template (fora de 24h), só podemos usar sendFlow com template aprovado
  if (config.requer_template && minutosDesdeContato > 1440) {
    console.log(`[FOLLOWUP] Follow-up ${templateKey} requer template aprovado (${minutosDesdeContato.toFixed(0)} min > 24h)`);
    
    const resultado = await enviarViaFlow(subscriberId, config.flow_ns, { 
      nome: nome || 'cliente',
      mensagem: mensagemPersonalizada 
    });
    
    if (!resultado.success && resultado.fallback) {
      console.warn(`[FOLLOWUP] ⚠️ Flow '${config.flow_ns}' não encontrado. Crie no ManyChat com Message Template aprovado!`);
      return { 
        success: false, 
        error: `Flow '${config.flow_ns}' não configurado no ManyChat`,
        precisa_criar_flow: true
      };
    }
    
    return resultado;
  }
  
  // Dentro da janela 24h - tentar flow primeiro, depois fallback
  const resultadoFlow = await enviarViaFlow(subscriberId, config.flow_ns, { 
    nome: nome || 'cliente',
    mensagem: mensagemPersonalizada 
  });
  
  if (resultadoFlow.success) {
    return resultadoFlow;
  }
  
  // Fallback: mensagem direta
  if (resultadoFlow.fallback && minutosDesdeContato <= 1440) {
    console.log('[FOLLOWUP] Usando fallback de mensagem direta (dentro de 24h)');
    return await enviarMensagemDireta(subscriberId, mensagemPersonalizada, canal);
  }
  
  return resultadoFlow;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const agora = new Date();
  
  console.log('[FOLLOWUP] Iniciando processamento de follow-ups:', agora.toISOString());

  try {
    // Buscar follow-ups pendentes de leads frios
    const { data: followups, error: fetchError } = await supabase
      .from('lead_followups')
      .select(`
        *,
        leads_juridicos!inner(id, nome, telefone, status)
      `)
      .in('status', ['aguardando', 'em_andamento', 'pendente'])
      .eq('respondido', false);

    if (fetchError) {
      console.error('[FOLLOWUP] Erro ao buscar followups:', fetchError);
      throw fetchError;
    }

    console.log(`[FOLLOWUP] Encontrados ${followups?.length || 0} follow-ups ativos`);

    let enviados = 0;
    let erros = 0;
    let pendentesTemplate = 0;

    for (const followup of followups || []) {
      const lead = followup.leads_juridicos;
      const primeiroContato = new Date(followup.primeiro_contato_em);
      const minutosDesdeContato = (agora.getTime() - primeiroContato.getTime()) / (1000 * 60);
      
      console.log(`[FOLLOWUP] Lead: ${lead.nome}, minutos: ${minutosDesdeContato.toFixed(0)}, status: ${lead.status}`);

      // Verificar se lead respondeu
      if (lead.status !== 'Lead Frio') {
        await supabase
          .from('lead_followups')
          .update({ 
            status: 'respondido', 
            respondido: true, 
            respondido_em: agora.toISOString() 
          })
          .eq('id', followup.id);
        console.log(`[FOLLOWUP] Lead ${lead.nome} respondeu (status: ${lead.status})`);
        continue;
      }

      // Determinar qual follow-up enviar
      let templateKey: string | null = null;
      let updateField: string | null = null;

      if (!followup.followup_1_enviado && minutosDesdeContato >= FOLLOWUP_CONFIG.followup_1.delay_minutos) {
        templateKey = 'followup_1';
        updateField = 'followup_1';
      } else if (followup.followup_1_enviado && !followup.followup_2_enviado && minutosDesdeContato >= FOLLOWUP_CONFIG.followup_2.delay_minutos) {
        templateKey = 'followup_2';
        updateField = 'followup_2';
      } else if (followup.followup_2_enviado && !followup.followup_3_enviado && minutosDesdeContato >= FOLLOWUP_CONFIG.followup_3.delay_minutos) {
        templateKey = 'followup_3';
        updateField = 'followup_3';
      }

      if (templateKey && followup.subscriber_id) {
        console.log(`[FOLLOWUP] Enviando ${templateKey} para ${lead.nome} (subscriber: ${followup.subscriber_id})`);

        const resultado = await enviarFollowup(
          followup.subscriber_id,
          templateKey,
          lead.nome,
          followup.canal || 'whatsapp',
          minutosDesdeContato
        );

        if (resultado.success) {
          const updateData: any = {
            [`${updateField}_enviado`]: true,
            [`${updateField}_enviado_em`]: agora.toISOString(),
            status: 'em_andamento'
          };
          
          if (templateKey === 'followup_3') {
            updateData.status = 'concluido';
          }

          await supabase
            .from('lead_followups')
            .update(updateData)
            .eq('id', followup.id);

          // Registrar interação
          await supabase.from('interacoes').insert({
            cliente_id: lead.id,
            tipo: 'WhatsApp',
            direcao: 'Saída',
            resumo: `Follow-up automático ${templateKey.replace('_', ' ')} enviado pela Isa`,
            detalhes: FOLLOWUP_CONFIG[templateKey as keyof typeof FOLLOWUP_CONFIG].mensagem.replace(/\{\{nome\}\}/g, lead.nome || 'cliente'),
          });

          await supabase.from('system_events').insert({
            tipo: 'followup',
            fonte: 'isa-automation',
            acao: `${templateKey}_enviado`,
            lead_id: lead.id,
            entidade_tipo: 'lead_followup',
            entidade_id: followup.id,
            dados: { template: templateKey, subscriber_id: followup.subscriber_id },
            processado: true
          });

          enviados++;
          console.log(`[FOLLOWUP] ✅ ${templateKey} enviado para ${lead.nome}`);
        } else {
          if ((resultado as any).precisa_criar_flow) {
            pendentesTemplate++;
            console.warn(`[FOLLOWUP] ⚠️ ${templateKey} pendente: precisa criar flow no ManyChat`);
          } else {
            erros++;
            console.error(`[FOLLOWUP] ❌ Erro ao enviar ${templateKey}: ${resultado.error}`);
          }
        }
      }
    }

    console.log(`[FOLLOWUP] Concluído. Enviados: ${enviados}, Erros: ${erros}, Pendentes template: ${pendentesTemplate}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processados: followups?.length || 0,
        enviados,
        erros,
        pendentes_template: pendentesTemplate,
        timestamp: agora.toISOString(),
        instrucoes: pendentesTemplate > 0 
          ? 'Crie flows no ManyChat (followup_10min, followup_1hora, followup_24h_template) com Message Templates aprovados para envio fora da janela 24h.'
          : null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('[FOLLOWUP] Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});