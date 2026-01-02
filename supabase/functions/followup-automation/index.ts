import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const manychatApiKey = Deno.env.get('MANYCHAT_API_KEY')!;

// Templates de mensagem seguindo guidelines Meta - Cards com botões
const FOLLOWUP_TEMPLATES = {
  // Follow-up 1: 10 minutos - Mensagem de interesse
  followup_1: {
    titulo: "Ainda estou aqui para ajudar! 🤝",
    mensagem: `Oi {{nome}}! Vi que você entrou em contato conosco há pouco. 

Sei que às vezes a vida corrida nos faz pausar, mas estou aqui para te ajudar com sua questão jurídica.

*Posso te ajudar com algo agora?*`,
    botoes: [
      { type: "reply", title: "Sim, tenho dúvidas" },
      { type: "reply", title: "Quero agendar consulta" }
    ],
    delay_minutos: 10
  },
  
  // Follow-up 2: 1 hora - Valor e urgência
  followup_2: {
    titulo: "Sua situação merece atenção 📋",
    mensagem: `{{nome}}, percebi que ainda não conversamos.

Muitos clientes que atendemos estavam na mesma situação - *sem saber por onde começar*.

Nossa equipe já ajudou centenas de pessoas a resolver questões como:
✅ Revisão de contratos
✅ Ações trabalhistas  
✅ Direitos do consumidor
✅ E muito mais

*Que tal conversarmos sem compromisso?*`,
    botoes: [
      { type: "reply", title: "Quero saber mais" },
      { type: "reply", title: "Qual o valor?" }
    ],
    delay_minutos: 60
  },
  
  // Follow-up 3: 24 horas - Última tentativa com oferta
  followup_3: {
    titulo: "Última mensagem sobre seu caso 📌",
    mensagem: `Olá {{nome}}, essa é minha última tentativa de contato.

Entendo que você pode estar ocupado(a), mas não queria deixar de oferecer nossa ajuda.

🎯 *Primeira consulta GRATUITA*
📱 Atendimento rápido pelo WhatsApp
🔒 Sigilo total garantido

Se mudar de ideia, é só responder aqui que retomamos de onde paramos!`,
    botoes: [
      { type: "reply", title: "Quero a consulta grátis" },
      { type: "reply", title: "Me ligue depois" }
    ],
    delay_minutos: 1440 // 24 horas
  }
};

// Enviar mensagem via ManyChat API
async function enviarMensagemManyChat(subscriberId: string, mensagem: string, botoes: any[]) {
  try {
    // Formatar botões para ManyChat
    const quickReplies = botoes.map(b => ({
      type: "node",
      caption: b.title,
      target_node_id: null // Deixar null para usar resposta livre
    }));

    const response = await fetch('https://api.manychat.com/fb/sending/sendContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${manychatApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        data: {
          version: "v2",
          content: {
            messages: [
              {
                type: "text",
                text: mensagem,
                buttons: botoes.map(b => ({
                  type: "reply",
                  caption: b.title
                }))
              }
            ],
            quick_replies: quickReplies
          }
        }
      }),
    });

    const result = await response.json();
    console.log('[FOLLOWUP] ManyChat response:', JSON.stringify(result));
    return { success: response.ok, result };
  } catch (error: any) {
    console.error('[FOLLOWUP] Erro ao enviar ManyChat:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const agora = new Date();
  
  console.log('[FOLLOWUP] Iniciando processamento de follow-ups:', agora.toISOString());

  try {
    // Buscar follow-ups pendentes
    const { data: followups, error: fetchError } = await supabase
      .from('lead_followups')
      .select(`
        *,
        leads_juridicos!inner(id, nome, telefone, status)
      `)
      .in('status', ['aguardando', 'em_andamento'])
      .eq('respondido', false);

    if (fetchError) {
      console.error('[FOLLOWUP] Erro ao buscar followups:', fetchError);
      throw fetchError;
    }

    console.log(`[FOLLOWUP] Encontrados ${followups?.length || 0} follow-ups ativos`);

    let enviados = 0;
    let erros = 0;

    for (const followup of followups || []) {
      const lead = followup.leads_juridicos;
      const primeiroContato = new Date(followup.primeiro_contato_em);
      const minutosDesdeContato = (agora.getTime() - primeiroContato.getTime()) / (1000 * 60);
      
      console.log(`[FOLLOWUP] Lead: ${lead.nome}, minutos desde contato: ${minutosDesdeContato.toFixed(0)}`);

      // Verificar se lead respondeu (status mudou de Lead Frio)
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

      // Follow-up 1: 10 minutos
      if (!followup.followup_1_enviado && minutosDesdeContato >= FOLLOWUP_TEMPLATES.followup_1.delay_minutos) {
        templateKey = 'followup_1';
        updateField = 'followup_1';
      }
      // Follow-up 2: 1 hora
      else if (followup.followup_1_enviado && !followup.followup_2_enviado && minutosDesdeContato >= FOLLOWUP_TEMPLATES.followup_2.delay_minutos) {
        templateKey = 'followup_2';
        updateField = 'followup_2';
      }
      // Follow-up 3: 24 horas
      else if (followup.followup_2_enviado && !followup.followup_3_enviado && minutosDesdeContato >= FOLLOWUP_TEMPLATES.followup_3.delay_minutos) {
        templateKey = 'followup_3';
        updateField = 'followup_3';
      }

      if (templateKey && followup.subscriber_id) {
        const template = FOLLOWUP_TEMPLATES[templateKey as keyof typeof FOLLOWUP_TEMPLATES];
        const mensagemPersonalizada = template.mensagem.replace(/\{\{nome\}\}/g, lead.nome || 'cliente');
        
        console.log(`[FOLLOWUP] Enviando ${templateKey} para ${lead.nome}`);

        const resultado = await enviarMensagemManyChat(
          followup.subscriber_id,
          mensagemPersonalizada,
          template.botoes
        );

        if (resultado.success) {
          // Atualizar registro
          const updateData: any = {
            [`${updateField}_enviado`]: true,
            [`${updateField}_enviado_em`]: agora.toISOString(),
            status: 'em_andamento'
          };
          
          // Se foi o último follow-up, marcar como concluído
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
            resumo: `Follow-up automático ${templateKey.replace('_', ' ')} enviado`,
            detalhes: mensagemPersonalizada,
          });

          // Registrar evento
          await supabase.from('system_events').insert({
            tipo: 'followup',
            fonte: 'automation',
            acao: `${templateKey}_enviado`,
            lead_id: lead.id,
            entidade_tipo: 'lead_followup',
            entidade_id: followup.id,
            dados: { template: templateKey, subscriber_id: followup.subscriber_id },
            processado: true
          });

          enviados++;
          console.log(`[FOLLOWUP] ✅ ${templateKey} enviado com sucesso para ${lead.nome}`);
        } else {
          erros++;
          console.error(`[FOLLOWUP] ❌ Erro ao enviar ${templateKey} para ${lead.nome}:`, resultado.error);
        }
      }
    }

    console.log(`[FOLLOWUP] Processamento concluído. Enviados: ${enviados}, Erros: ${erros}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processados: followups?.length || 0,
        enviados,
        erros,
        timestamp: agora.toISOString()
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
