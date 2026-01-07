import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

// Fluxo de retomada após 24h para leads frios (template aprovado da Meta)
const RETOMADA_FLOW_NS = '20260105140934_525890';

// Configuração de follow-ups com mensagens de alto impacto
const FOLLOWUP_CONFIG: Record<string, FollowupConfig> = {
  followup_1: {
    titulo: "Vitória recente para mostrar! 💰",
    mensagem: `{{nome}}, acabei de ver seu contato! 

⚠️ Sabia que esta semana ganhamos uma causa onde o cliente recebeu *R$ 5.609,24* de volta?

💰 Devolução em DOBRO: R$ 2.609,24
💰 Danos Morais: R$ 3.000,00
✅ Título de capitalização CANCELADO

O banco cobrou dele o que não devia, e a Justiça mandou devolver TUDO!

*Você pode estar na mesma situação.* Me conta o que está acontecendo? 👇`,
    delay_minutos: 10,
    flow_ns: 'followup_10min'
  },
  followup_2: {
    titulo: "Alerta: Prazo para pedir devolução 📋",
    mensagem: `{{nome}}, você sabia que existe PRAZO para pedir o dinheiro de volta?

⚡ Cobranças indevidas dos últimos 5 anos podem ser recuperadas
⚡ Depois disso, você PERDE o direito

📊 *Resultado REAL de cliente nosso:*
"Declaro INEXIGÍVEL o débito sob rubrica TÍTULO DE CAPITALIZAÇÃO e CONDENO à devolução em DOBRO no valor de R$ 2.609,24"

Já ajudamos pessoas que nem sabiam que tinham direito!

Quer que eu analise seu caso SEM COMPROMISSO? Só responder "SIM" 👇`,
    delay_minutos: 60,
    flow_ns: 'followup_1hora'
  },
  // Follow-up 3: usa o fluxo de retomada após 24h (template aprovado)
  followup_3: {
    titulo: "Retomada após 24h - Template aprovado 📌",
    mensagem: ``, // Mensagem está no template do ManyChat
    delay_minutos: 1440, // 24 horas
    flow_ns: RETOMADA_FLOW_NS,
    requer_template: true
  }
};

// Enviar mensagem direta via ManyChat (funciona dentro de 24h)
async function enviarMensagemManyChat(subscriberId: string, mensagem: string, canal: string = 'whatsapp') {
  try {
    console.log(`[FOLLOWUP] Enviando mensagem direta: subscriber=${subscriberId}, canal=${canal}`);
    
    // Tentar via sendContent primeiro
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
            type: canal === 'instagram' ? 'instagram' : 'whatsapp',
            messages: [{ type: "text", text: mensagem }]
          }
        }
      }),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      const text = await response.text();
      console.error('[FOLLOWUP] Resposta não-JSON:', text.substring(0, 300));
      
      // Tentar fallback com sendMessage
      return await tentarSendMessage(subscriberId, mensagem);
    }

    const result = await response.json();
    console.log('[FOLLOWUP] sendContent response:', JSON.stringify(result));
    
    if (result.status === 'success') {
      return { success: true, result };
    }
    
    // Se falhou, tentar sendMessage como fallback
    console.log('[FOLLOWUP] sendContent falhou, tentando sendMessage...');
    return await tentarSendMessage(subscriberId, mensagem);

  } catch (error: any) {
    console.error('[FOLLOWUP] Erro no envio:', error);
    return await tentarSendMessage(subscriberId, mensagem);
  }
}

// Fallback via sendMessage (endpoint mais simples)
async function tentarSendMessage(subscriberId: string, mensagem: string) {
  try {
    const response = await fetch('https://api.manychat.com/fb/subscriber/sendMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${manychatApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: parseInt(subscriberId),
        message_tag: 'CONFIRMED_EVENT_UPDATE',
        data: {
          version: "v2",
          content: {
            messages: [{ type: "text", text: mensagem }]
          }
        }
      }),
    });

    const result = await response.json();
    console.log('[FOLLOWUP] sendMessage response:', JSON.stringify(result));
    return { success: result.status === 'success', result };
  } catch (error: any) {
    console.error('[FOLLOWUP] sendMessage falhou:', error);
    return { success: false, error: error.message };
  }
}

// Enviar via Flow (para templates aprovados após 24h)
async function enviarViaFlow(subscriberId: string, flowNs: string, dados: Record<string, any>) {
  try {
    console.log(`[FOLLOWUP] Enviando via Flow: subscriber=${subscriberId}, flow=${flowNs}`);
    
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
    
    return { success: false, error: result.error || 'Erro desconhecido', fallback: true };

  } catch (error: any) {
    console.error('[FOLLOWUP] Erro no sendFlow:', error);
    return { success: false, error: error.message, fallback: true };
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
  
  // Se está fora da janela 24h e requer template
  if (config.requer_template && minutosDesdeContato > 1440) {
    console.log(`[FOLLOWUP] Follow-up ${templateKey} fora da janela 24h (${minutosDesdeContato.toFixed(0)} min)`);
    
    // Tentar via Flow primeiro (para templates aprovados)
    const resultado = await enviarViaFlow(subscriberId, config.flow_ns, { 
      nome: nome || 'cliente',
      mensagem: mensagemPersonalizada 
    });
    
    if (resultado.success) {
      return resultado;
    }
    
    // Se flow não existe, tentar envio direto mesmo assim (pode funcionar se janela ainda aberta no ManyChat)
    console.log('[FOLLOWUP] Flow falhou, tentando envio direto...');
    return await enviarMensagemManyChat(subscriberId, mensagemPersonalizada, canal);
  }
  
  // Dentro da janela 24h - enviar mensagem direta
  console.log(`[FOLLOWUP] Dentro da janela 24h, enviando direto (${minutosDesdeContato.toFixed(0)} min)`);
  return await enviarMensagemManyChat(subscriberId, mensagemPersonalizada, canal);
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