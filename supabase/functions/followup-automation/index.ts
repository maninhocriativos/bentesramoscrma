import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const manychatApiKey = Deno.env.get('MANYCHAT_API_KEY')!;

// ============================================================
// CONFIGURAÇÃO FOLLOW-UP FAST (apenas Lead Frio)
// ============================================================
const FAST_CONFIG = {
  stage_1: {
    delay_minutos: 10,
    titulo: "Follow-up FAST 1 - 10 min",
    mensagem: `{{nome}}, acabei de ver seu contato! 

⚠️ Sabia que esta semana ganhamos uma causa onde o cliente recebeu *R$ 5.609,24* de volta?

💰 Devolução em DOBRO: R$ 2.609,24
💰 Danos Morais: R$ 3.000,00
✅ Título de capitalização CANCELADO

O banco cobrou dele o que não devia, e a Justiça mandou devolver TUDO!

*Você pode estar na mesma situação.* Me conta o que está acontecendo? 👇`,
    flow_ns: 'followup_fast_1'
  },
  stage_2: {
    delay_minutos: 240, // 4 horas
    titulo: "Follow-up FAST 2 - 4h",
    mensagem: `{{nome}}, você sabia que existe PRAZO para pedir o dinheiro de volta?

⚡ Cobranças indevidas dos últimos 5 anos podem ser recuperadas
⚡ Depois disso, você PERDE o direito

📊 *Resultado REAL de cliente nosso:*
"Declaro INEXIGÍVEL o débito sob rubrica TÍTULO DE CAPITALIZAÇÃO e CONDENO à devolução em DOBRO no valor de R$ 2.609,24"

Já ajudamos pessoas que nem sabiam que tinham direito!

Quer que eu analise seu caso SEM COMPROMISSO? Só responder "SIM" 👇`,
    flow_ns: 'followup_fast_2'
  },
  stage_3: {
    delay_minutos: 900, // 15 horas
    titulo: "Follow-up FAST 3 - 15h (Final FAST)",
    mensagem: `{{nome}}, última mensagem do atendimento inicial... 

Vi que você não respondeu, mas antes de encerrar, olha esse resultado que acabamos de conseguir:

⚖️ *DECISÃO JUDICIAL:*
✅ Débito declarado INEXIGÍVEL
✅ Devolução em DOBRO: R$ 2.609,24
✅ Danos Morais: R$ 3.000,00
✅ Isento de custas processuais

O cliente nem precisou ir na audiência!

Se você tem financiamento, empréstimo ou cobrança bancária, pode ter dinheiro a receber.

*Responda "QUERO ANALISAR"* e verificamos GRÁTIS se você tem direito! 🔍`,
    flow_ns: 'followup_fast_3'
  }
};

// ============================================================
// CONFIGURAÇÃO FOLLOW-UP SLOW (Lead Frio, Em Atendimento, Em Negociação, Aguardando Contrato)
// Só inicia após 24h de silêncio
// ============================================================
const SLOW_CONFIG = {
  stage_1: {
    delay_minutos: 1440, // 24h
    titulo: "Follow-up SLOW 1 - 24h",
    mensagem: `Olá {{nome}}! 👋

Passando para lembrar que estamos à disposição para analisar seu caso.

Muitos clientes como você conseguiram recuperar valores cobrados indevidamente pelos bancos.

Posso ajudar? Responda esta mensagem! 📩`,
    flow_ns: 'content20260105140934_525890',
    requer_template: true
  },
  stage_2: {
    delay_minutos: 2880, // 48h
    titulo: "Follow-up SLOW 2 - 48h",
    mensagem: `{{nome}}, vi que ainda não conseguimos conversar.

⏰ Lembre-se: existe prazo para pedir a devolução de cobranças indevidas!

Ainda está interessado(a) em verificar se tem valores a receber? É gratuito e sem compromisso.

Responda "SIM" para continuarmos! ✅`,
    flow_ns: 'followup_slow_2',
    requer_template: true
  },
  stage_3: {
    delay_minutos: 4320, // 72h
    titulo: "Follow-up SLOW 3 - 72h",
    mensagem: `{{nome}}, esta é nossa última tentativa de contato.

Se mudar de ideia sobre verificar possíveis cobranças indevidas no seu nome, é só responder esta mensagem.

Estamos à disposição! 🤝

Bentes & Ramos Advocacia`,
    flow_ns: 'followup_slow_3',
    requer_template: true
  },
  stage_4: {
    delay_minutos: 7200, // 5 dias (72h + 48h = 120h = 5 dias)
    titulo: "Follow-up SLOW 4 - 5 dias (Final)",
    mensagem: `{{nome}}, sei que o tempo passa rápido e às vezes deixamos algumas coisas de lado...

Mas queria te lembrar que muitos clientes nossos já recuperaram dinheiro de cobranças indevidas dos bancos.

📌 *Exemplo real:*
Cliente recuperou R$ 5.609,24 em ação contra o banco!

Se quiser, posso verificar gratuitamente se você também tem valores a receber.

É só responder "QUERO" 👇

Bentes & Ramos Advocacia`,
    flow_ns: 'content20260113164223_086496',
    requer_template: true
  }
};

// Status que permitem follow-up
const STATUS_PERMITE_FAST = ['Lead Frio'];
const STATUS_PERMITE_SLOW = ['Lead Frio', 'Em Atendimento', 'Em Negociação', 'Aguardando Contrato'];
const STATUS_BLOQUEADOS = ['Contrato Assinado', 'Ganho'];

// Enviar mensagem direta via ManyChat (dentro de 24h)
async function enviarMensagemManyChat(subscriberId: string, mensagem: string, canal: string = 'whatsapp') {
  try {
    console.log(`[FOLLOWUP] Enviando mensagem direta: subscriber=${subscriberId}, canal=${canal}`);
    
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
      return await tentarSendMessage(subscriberId, mensagem);
    }

    const result = await response.json();
    console.log('[FOLLOWUP] sendContent response:', JSON.stringify(result));
    
    if (result.status === 'success') {
      return { success: true, result };
    }
    
    console.log('[FOLLOWUP] sendContent falhou, tentando sendMessage...');
    return await tentarSendMessage(subscriberId, mensagem);

  } catch (error: any) {
    console.error('[FOLLOWUP] Erro no envio:', error);
    return await tentarSendMessage(subscriberId, mensagem);
  }
}

// Fallback via sendMessage
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
    
    return { success: result.status === 'success', result, error: result.error };

  } catch (error: any) {
    console.error('[FOLLOWUP] Erro no sendFlow:', error);
    return { success: false, error: error.message, fallback: true };
  }
}

// Calcular próximo follow-up
function calcularProximoFollowup(
  stageFast: number, 
  stageSlow: number, 
  statusLead: string,
  primeiroContatoEm: Date
): { nextAt: Date | null; nextType: 'FAST' | 'SLOW' | null; nextStage: number } {
  const agora = new Date();
  
  // Se ainda pode receber FAST (Lead Frio e stage < 3)
  if (STATUS_PERMITE_FAST.includes(statusLead) && stageFast < 3) {
    const nextStage = stageFast + 1;
    const config = FAST_CONFIG[`stage_${nextStage}` as keyof typeof FAST_CONFIG];
    if (config) {
      const nextAt = new Date(primeiroContatoEm.getTime() + config.delay_minutos * 60 * 1000);
      return { nextAt, nextType: 'FAST', nextStage };
    }
  }
  
  // Se pode receber SLOW e stage < 4 (agora temos 4 estágios)
  if (STATUS_PERMITE_SLOW.includes(statusLead) && stageSlow < 4) {
    const nextStage = stageSlow + 1;
    const config = SLOW_CONFIG[`stage_${nextStage}` as keyof typeof SLOW_CONFIG];
    if (config) {
      const nextAt = new Date(primeiroContatoEm.getTime() + config.delay_minutos * 60 * 1000);
      return { nextAt, nextType: 'SLOW', nextStage };
    }
  }
  
  // Sem mais follow-ups
  return { nextAt: null, nextType: null, nextStage: 0 };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const agora = new Date();

  console.log('[FOLLOWUP] Iniciando processamento FAST/SLOW:', agora.toISOString());

  try {
    // Buscar follow-ups pendentes
    const { data: followups, error: fetchError } = await supabase
      .from('lead_followups')
      .select(`
        *,
        leads_juridicos!inner(id, nome, telefone, status)
      `)
      .in('status', ['aguardando', 'em_andamento', 'pendente'])
      .eq('respondido', false)
      .or('next_followup_at.is.null,next_followup_at.lte.' + agora.toISOString());

    if (fetchError) {
      console.error('[FOLLOWUP] Erro ao buscar followups:', fetchError);
      throw fetchError;
    }

    console.log(`[FOLLOWUP] Encontrados ${followups?.length || 0} follow-ups para processar`);

    let enviados = 0;
    let erros = 0;
    let pulados = 0;
    let agendados = 0;

    for (const followup of followups || []) {
      const lead = followup.leads_juridicos;
      const primeiroContato = new Date(followup.primeiro_contato_em);
      const minutosDesdeContato = (agora.getTime() - primeiroContato.getTime()) / (1000 * 60);
      const stageFast = followup.followup_stage_fast || 0;
      const stageSlow = followup.followup_stage_slow || 0;
      
      console.log(`[FOLLOWUP] Lead: ${lead.nome}, status: ${lead.status}, FAST: ${stageFast}/3, SLOW: ${stageSlow}/3, minutos: ${minutosDesdeContato.toFixed(0)}`);

      // 🛑 REGRA 1: Status bloqueados - NUNCA enviar
      if (STATUS_BLOQUEADOS.includes(lead.status)) {
        await supabase
          .from('lead_followups')
          .update({ 
            status: 'concluido',
            followup_lock_reason: `Status bloqueado: ${lead.status}`,
            next_followup_at: null,
            next_followup_type: null
          })
          .eq('id', followup.id);
        console.log(`[FOLLOWUP] 🛑 Lead ${lead.nome} BLOQUEADO (${lead.status})`);
        pulados++;
        continue;
      }

      // 🛑 REGRA 2: Verificar atendimento humano
      if (followup.subscriber_id) {
        const { data: subscriber } = await supabase
          .from('manychat_subscribers')
          .select('atendimento_humano')
          .eq('subscriber_id', followup.subscriber_id)
          .maybeSingle();

        if (subscriber?.atendimento_humano) {
          console.log(`[FOLLOWUP] 🛑 Atendimento humano ativo para ${lead.nome}`);
          pulados++;
          continue;
        }
      }

      // 🛑 REGRA 3: Verificar mensagens recentes (conversa ativa - 30 min)
      const trintaMinAtras = new Date(agora.getTime() - 30 * 60 * 1000).toISOString();
      const { data: msgRecentes } = await supabase
        .from('manychat_mensagens')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('direcao', 'entrada')
        .gte('created_at', trintaMinAtras)
        .limit(1);

      if (msgRecentes && msgRecentes.length > 0) {
        console.log(`[FOLLOWUP] ⏸️ Lead ${lead.nome} tem conversa ativa`);
        pulados++;
        continue;
      }

      // 🛑 REGRA 4: Verificar interações recentes
      const { data: interacoesRecentes } = await supabase
        .from('interacoes')
        .select('id')
        .eq('cliente_id', lead.id)
        .gte('data_interacao', trintaMinAtras)
        .limit(1);

      if (interacoesRecentes && interacoesRecentes.length > 0) {
        console.log(`[FOLLOWUP] ⏸️ Lead ${lead.nome} tem interação recente`);
        pulados++;
        continue;
      }

      // Determinar tipo e estágio do follow-up
      let tipoEnvio: 'FAST' | 'SLOW' | null = null;
      let stageEnvio = 0;
      let config: any = null;

      // FAST: apenas para Lead Frio
      if (STATUS_PERMITE_FAST.includes(lead.status) && stageFast < 3) {
        const nextStage = stageFast + 1;
        const fastConfig = FAST_CONFIG[`stage_${nextStage}` as keyof typeof FAST_CONFIG];
        
        if (minutosDesdeContato >= fastConfig.delay_minutos) {
          tipoEnvio = 'FAST';
          stageEnvio = nextStage;
          config = fastConfig;
        }
      }
      
      // SLOW: se FAST terminou ou não é Lead Frio (agora com 4 estágios)
      if (!tipoEnvio && STATUS_PERMITE_SLOW.includes(lead.status) && stageSlow < 4) {
        // SLOW só começa após 24h OU após FAST completo
        const fastCompleto = stageFast >= 3 || !STATUS_PERMITE_FAST.includes(lead.status);
        
        if (fastCompleto) {
          const nextStage = stageSlow + 1;
          const slowConfig = SLOW_CONFIG[`stage_${nextStage}` as keyof typeof SLOW_CONFIG];
          
          if (slowConfig && minutosDesdeContato >= slowConfig.delay_minutos) {
            tipoEnvio = 'SLOW';
            stageEnvio = nextStage;
            config = slowConfig;
          }
        }
      }

      // Se não há follow-up para enviar agora, calcular próximo
      if (!tipoEnvio || !config) {
        const proximo = calcularProximoFollowup(stageFast, stageSlow, lead.status, primeiroContato);
        
        if (proximo.nextAt) {
          await supabase
            .from('lead_followups')
            .update({
              next_followup_at: proximo.nextAt.toISOString(),
              next_followup_type: proximo.nextType
            })
            .eq('id', followup.id);
          agendados++;
        } else {
          // Sem mais follow-ups
          await supabase
            .from('lead_followups')
            .update({
              status: 'concluido',
              next_followup_at: null,
              next_followup_type: null
            })
            .eq('id', followup.id);
        }
        continue;
      }

      // Enviar follow-up
      if (!followup.subscriber_id) {
        console.log(`[FOLLOWUP] ⚠️ Lead ${lead.nome} sem subscriber_id`);
        pulados++;
        continue;
      }

      console.log(`[FOLLOWUP] Enviando ${tipoEnvio} stage ${stageEnvio} para ${lead.nome}`);

      const mensagem = config.mensagem.replace(/\{\{nome\}\}/g, lead.nome || 'cliente');
      let resultado: any;

      // SLOW sempre usa template (>24h)
      if (tipoEnvio === 'SLOW' || config.requer_template) {
        resultado = await enviarViaFlow(followup.subscriber_id, config.flow_ns, {
          nome: lead.nome || 'cliente',
          mensagem
        });
        
        // Fallback para mensagem direta se flow falhar
        if (!resultado.success) {
          console.log('[FOLLOWUP] Flow falhou, tentando envio direto...');
          resultado = await enviarMensagemManyChat(followup.subscriber_id, mensagem, followup.canal || 'whatsapp');
        }
      } else {
        resultado = await enviarMensagemManyChat(followup.subscriber_id, mensagem, followup.canal || 'whatsapp');
      }

      if (resultado.success) {
        // Atualizar campos
        const updateData: any = {
          status: 'em_andamento',
          last_outbound_at: agora.toISOString(),
          last_isa_outbound_at: agora.toISOString(),
          waiting_reply: true
        };

        if (tipoEnvio === 'FAST') {
          updateData.followup_stage_fast = stageEnvio;
          // Mapear para campos legados
          if (stageEnvio === 1) {
            updateData.followup_1_enviado = true;
            updateData.followup_1_enviado_em = agora.toISOString();
          } else if (stageEnvio === 2) {
            updateData.followup_2_enviado = true;
            updateData.followup_2_enviado_em = agora.toISOString();
          } else if (stageEnvio === 3) {
            updateData.followup_3_enviado = true;
            updateData.followup_3_enviado_em = agora.toISOString();
          }
        } else {
          updateData.followup_stage_slow = stageEnvio;
          // Mapear para campos legados de retomada
          if (stageEnvio === 1) {
            updateData.retomada_1_enviado = true;
            updateData.retomada_1_enviado_em = agora.toISOString();
          } else if (stageEnvio === 2) {
            updateData.retomada_2_enviado = true;
            updateData.retomada_2_enviado_em = agora.toISOString();
          } else if (stageEnvio === 3) {
            updateData.retomada_3_enviado = true;
            updateData.retomada_3_enviado_em = agora.toISOString();
          }
          // Stage 4 é rastreado apenas pelo followup_stage_slow (sem campo legado)
        }

        // Calcular próximo follow-up
        const proximo = calcularProximoFollowup(
          tipoEnvio === 'FAST' ? stageEnvio : stageFast,
          tipoEnvio === 'SLOW' ? stageEnvio : stageSlow,
          lead.status,
          primeiroContato
        );

        if (proximo.nextAt) {
          updateData.next_followup_at = proximo.nextAt.toISOString();
          updateData.next_followup_type = proximo.nextType;
        } else {
          updateData.status = 'concluido';
          updateData.next_followup_at = null;
          updateData.next_followup_type = null;
        }

        await supabase.from('lead_followups').update(updateData).eq('id', followup.id);

        // Registrar interação
        await supabase.from('interacoes').insert({
          cliente_id: lead.id,
          tipo: 'WhatsApp',
          direcao: 'Saída',
          resumo: `${tipoEnvio} ${stageEnvio}/3 enviado automaticamente`,
          detalhes: mensagem,
        });

        // Registrar evento
        await supabase.from('system_events').insert({
          tipo: 'followup',
          fonte: 'followup-automation',
          acao: `${tipoEnvio.toLowerCase()}_${stageEnvio}_enviado`,
          lead_id: lead.id,
          entidade_tipo: 'lead_followup',
          entidade_id: followup.id,
          dados: { tipo: tipoEnvio, stage: stageEnvio, subscriber_id: followup.subscriber_id },
          processado: true
        });

        enviados++;
        console.log(`[FOLLOWUP] ✅ ${tipoEnvio} ${stageEnvio}/3 enviado para ${lead.nome}`);
      } else {
        erros++;
        console.error(`[FOLLOWUP] ❌ Erro ao enviar: ${resultado.error}`);
      }
    }

    console.log(`[FOLLOWUP] Concluído. Enviados: ${enviados}, Erros: ${erros}, Pulados: ${pulados}, Agendados: ${agendados}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processados: followups?.length || 0,
        enviados,
        erros,
        pulados,
        agendados,
        timestamp: agora.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[FOLLOWUP] Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
