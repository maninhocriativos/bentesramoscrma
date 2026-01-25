import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { 
  getZapiConfig, 
  sendText,
  gerarSubscriberId 
} from '../_shared/zapi-helper.ts';

/**
 * FLUXO DE RETOMADA - Leads Frios Sem Resposta (Z-API)
 * 
 * Este é um fluxo SEPARADO do follow-up inicial.
 * Só é acionado para leads que:
 * - Estão como "Lead Frio"
 * - Já passaram pelo follow-up inicial (3 mensagens)
 * - Não responderam
 * 
 * Envia mensagens personalizadas nos seguintes intervalos:
 * - Retomada 1: após 24h do último follow-up
 * - Retomada 2: após 48h do último follow-up
 * - Retomada 3: após 6 dias do último follow-up
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Intervalos de envio (em minutos desde o último follow-up)
const RETOMADA_CONFIG = {
  retomada_1: { 
    delay_minutos: 1440, 
    titulo: "Retomada 24h",
    mensagem: `{{nome}}, ainda estamos à disposição para ajudar com seu caso!

📌 Muitos clientes como você descobriram que tinham direito a devoluções de cobranças indevidas.

Quer que eu verifique gratuitamente se você também tem? É só responder "SIM" 👇

Bentes & Ramos Advocacia`
  },
  retomada_2: { 
    delay_minutos: 2880, 
    titulo: "Retomada 48h",
    mensagem: `{{nome}}, passando para uma última verificação...

⏰ Lembra que existe prazo para recuperar valores de cobranças indevidas?

Se ainda tiver interesse, responda esta mensagem e analisamos seu caso gratuitamente.

Bentes & Ramos Advocacia`
  },
  retomada_3: { 
    delay_minutos: 8640, 
    titulo: "Retomada 6 dias",
    mensagem: `{{nome}}, sei que a correria do dia a dia é grande...

Mas queria deixar registrado: estamos aqui caso precise de ajuda com cobranças bancárias.

📌 Já ajudamos clientes a recuperar mais de R$ 5.000!

Qualquer dúvida, é só responder. Boa semana! 🤝

Bentes & Ramos Advocacia`
  }
};

// Mensagem para campanha manual de reengajamento
const CAMPANHA_MENSAGEM = `{{nome}}, tudo bem? 👋

Vi que conversamos há um tempo sobre cobranças bancárias indevidas.

Novidade: agora estamos conseguindo resultados ainda melhores para nossos clientes! 💰

Se ainda tiver interesse em verificar seu caso (é grátis), me responde aqui que te explico rapidinho.

Bentes & Ramos Advocacia 🤝`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const agora = new Date();
  
  // Modo de teste manual
  let body: any = {};
  try {
    body = await req.json();
  } catch { /* sem body */ }

  // Verificar Z-API
  const zapiConfig = await getZapiConfig(supabase);
  if (!zapiConfig) {
    return new Response(
      JSON.stringify({ success: false, error: 'Z-API não configurado ou inativo' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  // Teste manual para um número específico
  if (body.test && body.phone) {
    console.log(`[RETOMADA-TEST] Testando para telefone: ${body.phone}`);
    const resultado = await sendText(zapiConfig, body.phone, 
      RETOMADA_CONFIG.retomada_1.mensagem.replace('{{nome}}', body.nome || 'Cliente')
    );
    return new Response(
      JSON.stringify({ 
        success: resultado.success, 
        phone: body.phone,
        resultado,
        provider: 'zapi'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // MODO CAMPANHA: Enviar para todos os leads frios que já completaram o ciclo
  if (body.campanha) {
    console.log('[RETOMADA-CAMPANHA] Iniciando campanha de reengajamento...');
    
    const { data: leadsFrios, error: campError } = await supabase
      .from('lead_followups')
      .select(`
        lead_id,
        leads_juridicos!inner(id, nome, telefone, status)
      `)
      .eq('status', 'concluido')
      .eq('respondido', false)
      .eq('followup_3_enviado', true);

    if (campError) {
      console.error('[RETOMADA-CAMPANHA] Erro:', campError);
      throw campError;
    }

    let enviados = 0;
    let erros = 0;
    const limite = body.limite || 50; // Limite padrão de 50 por campanha

    for (const followup of leadsFrios || []) {
      if (enviados >= limite) break;
      
      const lead = followup.leads_juridicos as any;
      if (!lead || lead.status !== 'Lead Frio' || !lead.telefone) continue;

      // Verificar se já enviou campanha hoje
      const hoje = new Date().toISOString().split('T')[0];
      const { data: jaEnviou } = await supabase
        .from('system_events')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('acao', 'campanha_reengajamento')
        .gte('created_at', hoje)
        .limit(1);

      if (jaEnviou && jaEnviou.length > 0) {
        console.log(`[CAMPANHA] Lead ${lead.nome} já recebeu campanha hoje, pulando`);
        continue;
      }

      const mensagem = CAMPANHA_MENSAGEM.replace('{{nome}}', lead.nome || 'Cliente');
      console.log(`[CAMPANHA] Enviando para ${lead.nome} (${lead.telefone})`);
      
      const resultado = await sendText(zapiConfig, lead.telefone, mensagem);

      if (resultado.success) {
        // Registrar no system_events
        await supabase.from('system_events').insert({
          tipo: 'campanha',
          fonte: 'zapi-automation',
          acao: 'campanha_reengajamento',
          lead_id: lead.id,
          entidade_tipo: 'lead',
          entidade_id: lead.id,
          dados: { 
            campanha: body.campanha_nome || 'reengajamento_manual',
            phone: lead.telefone,
            provider: 'zapi'
          },
          processado: true
        });

        // Registrar mensagem
        await supabase.from('manychat_mensagens').insert({
          subscriber_id: gerarSubscriberId(lead.telefone),
          subscriber_nome: lead.nome || 'Cliente',
          lead_id: lead.id,
          conteudo: mensagem,
          direcao: 'saida',
          tipo: 'text',
          canal: 'whatsapp',
          metadata: { source: 'zapi', context: 'campanha_reengajamento' }
        });

        // Registrar interação
        await supabase.from('interacoes').insert({
          cliente_id: lead.id,
          tipo: 'WhatsApp',
          direcao: 'Saída',
          resumo: `Campanha de Reengajamento via Z-API`,
          detalhes: mensagem,
        });

        enviados++;
        console.log(`[CAMPANHA] ✅ Enviado para ${lead.nome}`);
      } else {
        erros++;
        console.error(`[CAMPANHA] ❌ Erro ao enviar para ${lead.nome}: ${resultado.error}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        modo: 'campanha',
        total_leads: leadsFrios?.length || 0,
        enviados,
        erros,
        limite,
        provider: 'zapi',
        timestamp: agora.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  console.log('[RETOMADA Z-API] Iniciando processamento:', agora.toISOString());

  try {
    // Buscar leads frios que já concluíram o follow-up inicial mas não responderam
    const { data: followups, error: fetchError } = await supabase
      .from('lead_followups')
      .select(`
        *,
        leads_juridicos!inner(id, nome, telefone, status)
      `)
      .eq('status', 'concluido')
      .eq('respondido', false)
      .eq('followup_3_enviado', true);

    if (fetchError) {
      console.error('[RETOMADA] Erro ao buscar:', fetchError);
      throw fetchError;
    }

    console.log(`[RETOMADA] Encontrados ${followups?.length || 0} leads para retomada`);

    let enviados = 0;
    let erros = 0;
    let pulados = 0;

    for (const followup of followups || []) {
      const lead = followup.leads_juridicos;
      
      // Só processar leads frios
      if (lead.status !== 'Lead Frio') {
        console.log(`[RETOMADA] Lead ${lead.nome} não é mais Lead Frio (${lead.status}), pulando`);
        continue;
      }

      // Verificar se tem telefone
      if (!lead.telefone) {
        console.log(`[RETOMADA] Lead ${lead.nome} sem telefone, pulando`);
        continue;
      }

      // ⚠️ VERIFICAR SE LEAD TEM MENSAGENS RECENTES DE ENTRADA (conversa ativa)
      const duasHorasAtras = new Date(agora.getTime() - 2 * 60 * 60 * 1000).toISOString();
      
      const { data: mensagensRecentes } = await supabase
        .from('manychat_mensagens')
        .select('id, created_at, direcao')
        .eq('lead_id', lead.id)
        .eq('direcao', 'entrada')
        .gte('created_at', duasHorasAtras)
        .order('created_at', { ascending: false })
        .limit(1);

      if (mensagensRecentes && mensagensRecentes.length > 0) {
        console.log(`[RETOMADA] ⏸️ Lead ${lead.nome} tem conversa ativa`);
        pulados++;
        continue;
      }

      // Verificar também interações recentes
      const { data: interacoesRecentes } = await supabase
        .from('interacoes')
        .select('id, data_interacao')
        .eq('cliente_id', lead.id)
        .gte('data_interacao', duasHorasAtras)
        .order('data_interacao', { ascending: false })
        .limit(1);

      if (interacoesRecentes && interacoesRecentes.length > 0) {
        console.log(`[RETOMADA] ⏸️ Lead ${lead.nome} tem interação recente`);
        pulados++;
        continue;
      }

      // Calcular tempo desde o último follow-up (followup_3)
      const ultimoFollowup = new Date(followup.followup_3_enviado_em);
      const minutosDesdeUltimoFollowup = (agora.getTime() - ultimoFollowup.getTime()) / (1000 * 60);
      
      console.log(`[RETOMADA] Lead: ${lead.nome}, minutos desde followup_3: ${minutosDesdeUltimoFollowup.toFixed(0)}`);

      // Determinar qual retomada enviar
      let retomadaKey: string | null = null;
      let retomadaConfig: any = null;
      
      // Retomada 1: após 24h do followup_3
      if (minutosDesdeUltimoFollowup >= RETOMADA_CONFIG.retomada_1.delay_minutos && 
          minutosDesdeUltimoFollowup < RETOMADA_CONFIG.retomada_2.delay_minutos) {
        const { data: jaEnviou } = await supabase
          .from('system_events')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('acao', 'retomada_1_enviado')
          .limit(1);
        
        if (!jaEnviou || jaEnviou.length === 0) {
          retomadaKey = 'retomada_1';
          retomadaConfig = RETOMADA_CONFIG.retomada_1;
        }
      }
      // Retomada 2: após 48h do followup_3
      else if (minutosDesdeUltimoFollowup >= RETOMADA_CONFIG.retomada_2.delay_minutos && 
               minutosDesdeUltimoFollowup < RETOMADA_CONFIG.retomada_3.delay_minutos) {
        const { data: jaEnviou } = await supabase
          .from('system_events')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('acao', 'retomada_2_enviado')
          .limit(1);
        
        if (!jaEnviou || jaEnviou.length === 0) {
          retomadaKey = 'retomada_2';
          retomadaConfig = RETOMADA_CONFIG.retomada_2;
        }
      }
      // Retomada 3: após 6 dias do followup_3
      else if (minutosDesdeUltimoFollowup >= RETOMADA_CONFIG.retomada_3.delay_minutos) {
        const { data: jaEnviou } = await supabase
          .from('system_events')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('acao', 'retomada_3_enviado')
          .limit(1);
        
        if (!jaEnviou || jaEnviou.length === 0) {
          retomadaKey = 'retomada_3';
          retomadaConfig = RETOMADA_CONFIG.retomada_3;
        }
      }

      if (retomadaKey && retomadaConfig) {
        console.log(`[RETOMADA] Enviando ${retomadaKey} para ${lead.nome} via Z-API`);

        const mensagem = retomadaConfig.mensagem.replace('{{nome}}', lead.nome || 'Cliente');
        const resultado = await sendText(zapiConfig, lead.telefone, mensagem);

        if (resultado.success) {
          // Registrar no system_events
          await supabase.from('system_events').insert({
            tipo: 'retomada',
            fonte: 'zapi-automation',
            acao: `${retomadaKey}_enviado`,
            lead_id: lead.id,
            entidade_tipo: 'lead_followup',
            entidade_id: followup.id,
            dados: { 
              retomada: retomadaKey, 
              phone: lead.telefone,
              minutos_desde_followup: minutosDesdeUltimoFollowup,
              provider: 'zapi'
            },
            processado: true
          });

          // Registrar mensagem
          await supabase.from('manychat_mensagens').insert({
            subscriber_id: gerarSubscriberId(lead.telefone),
            subscriber_nome: lead.nome || 'Cliente',
            lead_id: lead.id,
            conteudo: mensagem,
            direcao: 'saida',
            tipo: 'text',
            canal: 'whatsapp',
            metadata: { source: 'zapi', context: 'retomada', retomada: retomadaKey }
          });

          // Registrar interação
          await supabase.from('interacoes').insert({
            cliente_id: lead.id,
            tipo: 'WhatsApp',
            direcao: 'Saída',
            resumo: `Retomada automática (${retomadaConfig.titulo}) via Z-API`,
            detalhes: mensagem,
          });

          enviados++;
          console.log(`[RETOMADA] ✅ ${retomadaKey} enviado para ${lead.nome}`);
        } else {
          erros++;
          console.error(`[RETOMADA] ❌ Erro ao enviar ${retomadaKey}: ${resultado.error}`);
        }
      }
    }

    console.log(`[RETOMADA] Concluído. Enviados: ${enviados}, Erros: ${erros}, Pulados: ${pulados}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processados: followups?.length || 0,
        enviados,
        erros,
        pulados_conversa_ativa: pulados,
        provider: 'zapi',
        timestamp: agora.toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('[RETOMADA] Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
