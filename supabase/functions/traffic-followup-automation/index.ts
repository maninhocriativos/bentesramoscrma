import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getZapiConfig, sendText, sendImage, normalizePhone } from '../_shared/zapi-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ============================================
// CONFIGURAÇÃO DOS 11 ESTÁGIOS DE FOLLOW-UP
// Novos estágios: 3min e 15min adicionados
// ============================================
const STAGES_CONFIG = {
  '3min':   { delay_minutes: 3,      label: 'Triagem Rápida',    next: '15min' },
  '15min':  { delay_minutes: 15,     label: 'Reforço Triagem',   next: '10min' },
  '10min':  { delay_minutes: 10,     label: 'Quebra de Padrão',  next: '3h'  },
  '3h':     { delay_minutes: 180,    label: 'Aversão à Perda',   next: '8h'  },
  '8h':     { delay_minutes: 480,    label: 'Escassez',          next: '24h' },
  '24h':    { delay_minutes: 1440,   label: 'Ultimato Lógico',   next: '34h' },
  '34h':    { delay_minutes: 2040,   label: 'Prova Social',      next: '42h' },
  '42h':    { delay_minutes: 2520,   label: 'Último Lembrete',   next: '72h' },
  '72h':    { delay_minutes: 4320,   label: 'Última Chance',     next: '6d'  },
  '6d':     { delay_minutes: 8640,   label: 'Reflexão',          next: '7d'  },
  '7d':     { delay_minutes: 10080,  label: 'Arquivamento',      next: null  },
};

// URL da imagem de prova social (34h) - pode ser URL pública ou storage
// Usando URL do preview do projeto
const PROVA_SOCIAL_IMAGE_URL = 'https://bentesramoscrma.lovable.app/images/prova-social-bradesco.jpg';

// Delay entre mensagens para evitar bloqueio (em ms)
const DELAY_BETWEEN_MESSAGES = 5000; // 5 segundos

// ============================================
// TEMPLATES DE MENSAGEM (Agressivo/Desafiador)
// ============================================
function getMessageTemplate(stage: string, leadNome: string): { text: string; image?: string } {
  const nome = leadNome || 'Cliente';
  
  switch (stage) {
    case '3min':
      // Nova mensagem - Triagem rápida (Menu de opções)
      return {
        text: `Olá, aqui é a Isa do Bentes & Ramos Advogados. Recebi seu contato e para direcionar seu atendimento para o especialista correto agora mesmo, me diga:

Qual dessas situações mais se aproxima do seu caso?

1️⃣ Empréstimo consignado ou pessoal 
2️⃣ Descontos indevidos no benefício ou salário 
3️⃣ Seguro prestamista ou proteção financeira no empréstimo 
4️⃣ Cartão de crédito consignado (RMC/RCC) 
5️⃣ Juros abusivos 
6️⃣ Tarifa bancária indevida 
7️⃣ Outro problema bancário

(Digite apenas o número)`
      };
    
    case '15min':
      // Nova mensagem - Reforço da triagem
      return {
        text: `${nome}, vi que você ainda não escolheu a opção. Sem problemas!

Se estiver na dúvida, digite *7* que eu te ajudo a identificar seu caso.

⏰ Não deixe para depois - em casos bancários, cada dia que passa é dinheiro que você pode estar perdendo para o banco.`
      };
    
    case '10min':
      return {
        text: `Oi, ${nome}. Vi que você clicou no nosso anúncio sobre os juros abusivos, mas não concluiu.

Deixa eu ser direta: o banco aposta que você vai ter preguiça de correr atrás dos seus direitos. É assim que eles lucram bilhões.

Eu estou com a calculadora aberta aqui. Me manda o contrato agora ou diz 'OI' para eu te falar quanto você pode recuperar.`
      };
    
    case '3h':
      return {
        text: `Ainda por aqui? Só para te lembrar: esse dinheiro que o banco te cobrou indevidamente não rende na sua conta, rende na deles.

A análise é gratuita e rápida. Você realmente prefere deixar esse valor para o banco do que colocar no seu bolso? Estou aguardando.`
      };
    
    case '8h':
      return {
        text: `${nome}, estou fechando a agenda de análises de hoje.

Muita gente descobre que tem R$ 2.000, R$ 5.000 para receber e nem sabia. Você vai dormir hoje com essa dúvida?

Me manda o 'ok' aqui que eu priorizo seu atendimento amanhã cedo. Não deixe para depois o que já é seu por direito.`
      };
    
    case '24h':
      return {
        text: `Já se passaram 24h. Se fosse o banco te cobrando, eles já teriam te ligado 10 vezes, certo?

Eu estou aqui para fazer o caminho inverso: tirar o dinheiro deles e devolver para você. Mas eu não posso querer isso mais do que você.

Vamos dar andamento ou vou arquivar seu caso como 'cliente que aceita pagar juros abusivos'?`
      };
    
    case '34h':
      return {
        text: `Acabei de analisar o caso de outro cliente aqui. Olha o que o juiz decidiu:

🏦 *Banco condenado a pagar R$ 8.000,00 por cobrança indevida.*

Isso poderia ser você. Mas só se você me responder.

Me manda seu contrato ou diz 'QUERO' que eu analiso seu caso agora.`,
        image: PROVA_SOCIAL_IMAGE_URL
      };
    
    case '42h':
      return {
        text: `${nome}, essa é a minha penúltima tentativa de te ajudar.

Você clicou no anúncio porque queria saber se tem dinheiro a receber. Eu estou aqui, de graça, te oferecendo exatamente isso.

É só me responder. Não deixe o banco ganhar de novo.`
      };
    
    case '72h':
      return {
        text: `Última chance, ${nome}. 

Depois dessa mensagem, vou arquivar seu contato e focar em quem realmente quer resolver o problema com o banco.

Se você ainda tem interesse, responde agora. Caso contrário, boa sorte com os juros abusivos.`
      };
    
    case '6d':
      return {
        text: `Oi ${nome}! Passou um tempinho...

Sei que a rotina é corrida, mas pensei em você hoje. Aquele assunto dos juros abusivos ainda está aí.

Se surgiu alguma dúvida ou se quiser retomar, é só me chamar. Tô por aqui! 😉`
      };
    
    case '7d':
      return {
        text: `${nome}, estou encerrando seu atendimento por falta de retorno.

Se um dia quiser revisitar o assunto, é só me chamar novamente.

Cuide-se! 👋`
      };
    
    default:
      return { text: '' };
  }
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================
function getNextStage(currentStage: string | null): string {
  if (!currentStage) return '3min'; // Começa com triagem rápida
  const config = STAGES_CONFIG[currentStage as keyof typeof STAGES_CONFIG];
  return config?.next || '';
}

function getDelayForStage(stage: string): number {
  return STAGES_CONFIG[stage as keyof typeof STAGES_CONFIG]?.delay_minutes || 0;
}

function calculateNextMessageTime(stage: string): Date {
  const delayMinutes = getDelayForStage(stage);
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// MAIN SERVE
// ============================================
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'process';
    
    console.log('[Traffic Followup] Action:', action);
    
    // Get Z-API config
    const zapiConfig = await getZapiConfig(supabase);
    if (!zapiConfig) {
      return new Response(JSON.stringify({ error: 'Z-API not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    switch (action) {
      case 'enroll': {
        // Inscrever lead de tráfego no follow-up
        const { lead_id, telefone, subscriber_id } = body;
        if (!lead_id || !telefone) {
          return new Response(JSON.stringify({ error: 'Missing lead_id or telefone' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const result = await enrollLead(supabase, lead_id, telefone, subscriber_id);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'mark_responded': {
        // Marcar que lead respondeu (para automação)
        const { lead_id } = body;
        const result = await markAsResponded(supabase, lead_id);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'backfill': {
        // Verificar leads de tráfego existentes e inscrevê-los
        const result = await backfillTrafficLeads(supabase);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'process':
      default: {
        // Processar follow-ups pendentes
        const results = await processFollowups(supabase, zapiConfig);
        return new Response(JSON.stringify({ 
          success: true, 
          processed: results.length,
          results 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
  } catch (error: any) {
    console.error('[Traffic Followup] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ============================================
// INSCREVER LEAD NO FOLLOW-UP
// ============================================
async function enrollLead(supabase: any, leadId: string, telefone: string, subscriberId?: string): Promise<any> {
  // Verificar se lead é de tráfego
  const { data: lead } = await supabase
    .from('leads_juridicos')
    .select('id, nome, tipo_origem, status')
    .eq('id', leadId)
    .single();
  
  if (!lead) {
    return { success: false, error: 'Lead not found' };
  }
  
  if (lead.tipo_origem !== 'trafego') {
    return { success: false, error: 'Lead não é de tráfego' };
  }
  
  // Verificar se já existe
  const { data: existing } = await supabase
    .from('traffic_followups')
    .select('id, status')
    .eq('lead_id', leadId)
    .maybeSingle();
  
  if (existing) {
    return { success: false, message: 'Lead already enrolled', existing };
  }
  
  const normalizedPhone = normalizePhone(telefone);
  const firstStage = '10min';
  const nextMessageAt = calculateNextMessageTime(firstStage);
  
  const { data, error } = await supabase
    .from('traffic_followups')
    .insert({
      lead_id: leadId,
      subscriber_id: subscriberId || `zapi_${normalizedPhone}`,
      telefone: normalizedPhone,
      status: 'new',
      automation_active: true,
      current_stage: null, // Ainda não enviou nada
      next_message_at: nextMessageAt.toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Traffic Followup] Enroll error:', error);
    return { success: false, error: error.message };
  }
  
  console.log(`[Traffic Followup] Enrolled: ${lead.nome} (${leadId})`);
  return { success: true, followup: data };
}

// ============================================
// MARCAR COMO RESPONDIDO
// ============================================
async function markAsResponded(supabase: any, leadId: string): Promise<any> {
  const { error } = await supabase
    .from('traffic_followups')
    .update({ 
      status: 'responded', 
      automation_active: false,
      last_inbound_at: new Date().toISOString(),
      updated_at: new Date().toISOString() 
    })
    .eq('lead_id', leadId);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  console.log(`[Traffic Followup] Marked as responded: ${leadId}`);
  return { success: true };
}

// ============================================
// BACKFILL - Inscrever leads de tráfego existentes
// ============================================
async function backfillTrafficLeads(supabase: any): Promise<any> {
  // Buscar leads de tráfego que ainda não estão no follow-up
  const { data: trafficLeads, error } = await supabase
    .from('leads_juridicos')
    .select('id, nome, telefone, tipo_origem, created_at, status')
    .eq('tipo_origem', 'trafego')
    .not('telefone', 'is', null)
    .not('status', 'in', '("Ganho","Perdido","Contrato Assinado")');
  
  if (error) {
    console.error('[Traffic Followup] Backfill query error:', error);
    return { success: false, error: error.message };
  }
  
  const enrolled: any[] = [];
  const skipped: any[] = [];
  
  for (const lead of trafficLeads || []) {
    // Verificar se já está inscrito
    const { data: existing } = await supabase
      .from('traffic_followups')
      .select('id')
      .eq('lead_id', lead.id)
      .maybeSingle();
    
    if (existing) {
      skipped.push({ id: lead.id, nome: lead.nome, reason: 'already_enrolled' });
      continue;
    }
    
    // Calcular em qual estágio deveria estar baseado no created_at
    const createdAt = new Date(lead.created_at);
    const now = new Date();
    const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);
    
    // Determinar estágio atual baseado no tempo decorrido
    // Inclui os novos estágios de 3min e 15min
    let currentStage: string | null = null;
    let nextStage = '3min';
    
    if (minutesSinceCreation >= 10080) {
      // Mais de 7 dias - arquivar
      currentStage = '7d';
      nextStage = '';
    } else if (minutesSinceCreation >= 8640) {
      currentStage = '6d';
      nextStage = '7d';
    } else if (minutesSinceCreation >= 4320) {
      currentStage = '72h';
      nextStage = '6d';
    } else if (minutesSinceCreation >= 2520) {
      currentStage = '42h';
      nextStage = '72h';
    } else if (minutesSinceCreation >= 2040) {
      currentStage = '34h';
      nextStage = '42h';
    } else if (minutesSinceCreation >= 1440) {
      currentStage = '24h';
      nextStage = '34h';
    } else if (minutesSinceCreation >= 480) {
      currentStage = '8h';
      nextStage = '24h';
    } else if (minutesSinceCreation >= 180) {
      currentStage = '3h';
      nextStage = '8h';
    } else if (minutesSinceCreation >= 25) {
      // 10min + 15min = 25min
      currentStage = '10min';
      nextStage = '3h';
    } else if (minutesSinceCreation >= 18) {
      // 3min + 15min = 18min
      currentStage = '15min';
      nextStage = '10min';
    } else if (minutesSinceCreation >= 3) {
      currentStage = '3min';
      nextStage = '15min';
    }
    
    // Se já passou de 7 dias, arquivar diretamente
    const status = currentStage === '7d' ? 'archived' : 'in_progress';
    const automationActive = status !== 'archived' && nextStage !== '';
    
    const nextMessageAt = automationActive && nextStage 
      ? calculateNextMessageTime(nextStage)
      : null;
    
    const { data, error: insertError } = await supabase
      .from('traffic_followups')
      .insert({
        lead_id: lead.id,
        subscriber_id: `zapi_${normalizePhone(lead.telefone)}`,
        telefone: normalizePhone(lead.telefone),
        status,
        automation_active: automationActive,
        current_stage: currentStage,
        next_message_at: nextMessageAt?.toISOString(),
        stages_sent: currentStage ? { [currentStage]: { simulated: true, at: now.toISOString() } } : {},
      })
      .select()
      .single();
    
    if (insertError) {
      skipped.push({ id: lead.id, nome: lead.nome, reason: insertError.message });
    } else {
      enrolled.push({ id: lead.id, nome: lead.nome, currentStage, nextStage });
    }
  }
  
  console.log(`[Traffic Followup] Backfill complete: ${enrolled.length} enrolled, ${skipped.length} skipped`);
  return { success: true, enrolled: enrolled.length, skipped: skipped.length, details: { enrolled, skipped } };
}

// ============================================
// PROCESSAR FOLLOW-UPS PENDENTES
// ============================================
async function processFollowups(supabase: any, zapiConfig: any): Promise<any[]> {
  const now = new Date();
  const results: any[] = [];
  
  // Buscar follow-ups pendentes
  const { data: pendingFollowups, error } = await supabase
    .from('traffic_followups')
    .select(`
      *,
      lead:leads_juridicos(id, nome, telefone, status, tipo_origem)
    `)
    .eq('automation_active', true)
    .not('status', 'in', '("responded","archived")')
    .lte('next_message_at', now.toISOString())
    .order('next_message_at', { ascending: true })
    .limit(20); // Processar em lotes
  
  if (error) {
    console.error('[Traffic Followup] Query error:', error);
    return results;
  }
  
  console.log(`[Traffic Followup] Found ${pendingFollowups?.length || 0} pending follow-ups`);
  
  for (const followup of pendingFollowups || []) {
    try {
      const lead = followup.lead;
      
      // Validações
      if (!lead) {
        await supabase
          .from('traffic_followups')
          .update({ automation_active: false, pause_reason: 'Lead not found' })
          .eq('id', followup.id);
        continue;
      }
      
      // Parar se lead não é mais de tráfego
      if (lead.tipo_origem !== 'trafego') {
        await supabase
          .from('traffic_followups')
          .update({ automation_active: false, pause_reason: 'Lead não é mais tráfego' })
          .eq('id', followup.id);
        continue;
      }
      
      // Parar se lead tem status bloqueado
      const blockedStatuses = ['Ganho', 'Perdido', 'Contrato Assinado'];
      if (blockedStatuses.includes(lead.status)) {
        await supabase
          .from('traffic_followups')
          .update({ automation_active: false, status: 'archived', pause_reason: `Status: ${lead.status}` })
          .eq('id', followup.id);
        continue;
      }
      
      // Verificar se houve resposta recente (últimos 30 min)
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { data: recentMsgs } = await supabase
        .from('manychat_mensagens')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('direcao', 'entrada')
        .gte('created_at', thirtyMinAgo)
        .limit(1);
      
      if (recentMsgs && recentMsgs.length > 0) {
        // Lead respondeu! Marcar como respondido
        await markAsResponded(supabase, lead.id);
        results.push({ lead_id: lead.id, nome: lead.nome, action: 'marked_responded' });
        continue;
      }
      
      // Determinar próximo estágio a enviar
      const nextStage = getNextStage(followup.current_stage);
      
      if (!nextStage) {
        // Todos os estágios concluídos
        await supabase
          .from('traffic_followups')
          .update({ status: 'archived', automation_active: false })
          .eq('id', followup.id);
        continue;
      }
      
      // Obter template da mensagem
      const template = getMessageTemplate(nextStage, lead.nome);
      
      if (!template.text) {
        console.error(`[Traffic Followup] No template for stage ${nextStage}`);
        continue;
      }
      
      console.log(`[Traffic Followup] Sending ${nextStage} to ${lead.nome} (${followup.telefone})`);
      
      // Enviar imagem primeiro se houver (estágio 34h)
      if (template.image) {
        const imageResult = await sendImage(zapiConfig, followup.telefone, template.image, '');
        console.log(`[Traffic Followup] Image sent:`, imageResult.success);
        await sleep(2000); // Delay entre imagem e texto
      }
      
      // Enviar mensagem de texto
      const sendResult = await sendText(zapiConfig, followup.telefone, template.text);
      
      if (sendResult.success) {
        // Registrar mensagem no histórico
        await supabase.from('manychat_mensagens').insert({
          subscriber_id: followup.subscriber_id,
          subscriber_nome: 'Isa (Follow-up)',
          lead_id: lead.id,
          conteudo: template.text,
          direcao: 'saida',
          tipo: 'text',
          canal: 'whatsapp',
          metadata: {
            source: 'traffic_followup',
            stage: nextStage,
            stage_label: STAGES_CONFIG[nextStage as keyof typeof STAGES_CONFIG]?.label,
            message_id: sendResult.messageId,
          },
        });
        
        // Atualizar registro de follow-up
        const stagesSent = { ...(followup.stages_sent || {}), [nextStage]: { at: now.toISOString() } };
        const subsequentStage = getNextStage(nextStage);
        const nextMessageAt = subsequentStage ? calculateNextMessageTime(subsequentStage) : null;
        
        await supabase
          .from('traffic_followups')
          .update({
            current_stage: nextStage,
            stages_sent: stagesSent,
            last_message_at: now.toISOString(),
            total_messages_sent: (followup.total_messages_sent || 0) + 1,
            status: 'in_progress',
            next_message_at: nextMessageAt?.toISOString(),
            automation_active: !!subsequentStage,
          })
          .eq('id', followup.id);
        
        // Registrar interação
        await supabase.from('interacoes').insert({
          cliente_id: lead.id,
          tipo: 'WhatsApp',
          direcao: 'Saída',
          resumo: `Follow-up Tráfego: ${STAGES_CONFIG[nextStage as keyof typeof STAGES_CONFIG]?.label}`,
          detalhes: template.text.substring(0, 300),
        });
        
        results.push({
          lead_id: lead.id,
          nome: lead.nome,
          stage: nextStage,
          success: true,
        });
        
        console.log(`[Traffic Followup] ✅ ${nextStage} sent to ${lead.nome}`);
        
        // Delay entre mensagens para evitar bloqueio
        await sleep(DELAY_BETWEEN_MESSAGES);
        
      } else {
        console.error(`[Traffic Followup] ❌ Failed to send to ${lead.nome}:`, sendResult.error);
        results.push({
          lead_id: lead.id,
          nome: lead.nome,
          stage: nextStage,
          success: false,
          error: sendResult.error,
        });
      }
      
    } catch (err: any) {
      console.error(`[Traffic Followup] Error processing:`, err);
    }
  }
  
  return results;
}
