import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getZapiConfig, sendText, normalizePhone } from '../_shared/zapi-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Configuração FAST (Lead Frio - primeiras 24h)
const FAST_CONFIG = {
  1: { delay_minutos: 10, titulo: "Follow-up FAST 1 - 10min" },
  2: { delay_minutos: 240, titulo: "Follow-up FAST 2 - 4h" },
  3: { delay_minutos: 900, titulo: "Follow-up FAST 3 - 15h" },
};

// Configuração SLOW (após fase FAST ou outros status)
const SLOW_CONFIG = {
  1: { delay_minutos: 1440, titulo: "Follow-up SLOW 1 - 24h" },
  2: { delay_minutos: 2880, titulo: "Follow-up SLOW 2 - 48h" },
  3: { delay_minutos: 4320, titulo: "Follow-up SLOW 3 - 72h" },
};

// Status que permitem follow-up
const STATUS_PERMITE_FAST = ['Lead Frio'];
const STATUS_PERMITE_SLOW = ['Lead Frio', 'Em Atendimento', 'Em Negociação', 'Aguardando Contrato'];
const STATUS_BLOQUEADOS = ['Contrato Assinado', 'Ganho', 'Perdido'];

// Mensagens de follow-up personalizadas
const MENSAGENS_FAST = {
  1: (nome: string) => `Olá ${nome || ''}! 👋\n\nVi que você não conseguiu responder. Está tudo bem?\n\nEstou aqui para ajudar quando puder! 😊`,
  2: (nome: string) => `Oi ${nome || ''}! 🙂\n\nNão quero ser insistente, mas notei que ainda não conversamos sobre seu caso.\n\nSe tiver alguma dúvida, pode me chamar! Estou à disposição.`,
  3: (nome: string) => `${nome || 'Olá'}! 👋\n\nÚltima tentativa: você ainda tem interesse em resolver a questão que mencionou?\n\nSe sim, me responda e damos continuidade. Caso contrário, sem problemas! 😉`,
};

const MENSAGENS_SLOW = {
  1: (nome: string) => `Olá ${nome || ''}! 🌟\n\nFaz um tempinho que não falamos. Como está indo?\n\nSe precisar, ainda estou por aqui para ajudar no seu caso!`,
  2: (nome: string) => `Oi ${nome || ''}! 👋\n\nPassando para ver se surgiu alguma dúvida ou se posso ajudar em algo.\n\nQualquer coisa, é só chamar!`,
  3: (nome: string) => `${nome || 'Olá'}! 😊\n\nSei que a rotina é corrida. Mas fico à disposição se quiser retomar nossa conversa sobre seu caso.\n\nAbraço!`,
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'process'; // 'process', 'create', 'pause', 'resume'
    
    console.log('[Z-API Followup] Action:', action);
    
    // Buscar TODAS as instâncias ativas para roteamento por lead
    const { data: allInstances } = await supabase
      .from('zapi_instances')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    if (!allInstances || allInstances.length === 0) {
      return new Response(JSON.stringify({ error: 'Z-API not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default config (Bentes Ramos) para ações que não dependem do lead
    const zapiConfig = {
      instance_id: allInstances[0].instance_id,
      token: allInstances[0].token,
      client_token: allInstances[0].client_token,
      name: allInstances[0].name,
      phone_number: allInstances[0].phone_number,
    };
    
    switch (action) {
      case 'create': {
        // Create follow-up for a specific lead
        const { lead_id, subscriber_id, telefone } = body;
        if (!lead_id || !telefone) {
          return new Response(JSON.stringify({ error: 'Missing lead_id or telefone' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const result = await createFollowup(supabase, lead_id, subscriber_id, telefone);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'pause': {
        const { lead_id, reason } = body;
        const result = await pauseFollowup(supabase, lead_id, reason || 'manual_pause');
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'resume': {
        const { lead_id } = body;
        const result = await resumeFollowup(supabase, lead_id);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'process':
      default: {
        // Process all pending follow-ups
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
    console.error('[Z-API Followup] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function createFollowup(supabase: any, leadId: string, subscriberId: string, telefone: string) {
  // Check if already exists
  const { data: existing } = await supabase
    .from('zapi_followups')
    .select('id')
    .eq('lead_id', leadId)
    .maybeSingle();
  
  if (existing) {
    return { success: false, message: 'Follow-up already exists for this lead' };
  }
  
  const normalizedPhone = normalizePhone(telefone);
  const normalizedSubId = subscriberId || `zapi_${normalizedPhone}`;
  
  // Calculate first follow-up time (FAST 1 - 10 min)
  const nextFollowupAt = new Date(Date.now() + FAST_CONFIG[1].delay_minutos * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('zapi_followups')
    .insert({
      lead_id: leadId,
      subscriber_id: normalizedSubId,
      telefone: normalizedPhone,
      next_followup_at: nextFollowupAt,
      status: 'ativo',
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Z-API Followup] Create error:', error);
    return { success: false, error: error.message };
  }
  
  console.log('[Z-API Followup] Created:', data.id);
  return { success: true, followup: data };
}

async function pauseFollowup(supabase: any, leadId: string, reason: string) {
  const { error } = await supabase
    .from('zapi_followups')
    .update({ status: 'pausado', lock_reason: reason, updated_at: new Date().toISOString() })
    .eq('lead_id', leadId);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, message: 'Follow-up paused' };
}

async function resumeFollowup(supabase: any, leadId: string) {
  // Calculate next follow-up based on current stage
  const { data: followup } = await supabase
    .from('zapi_followups')
    .select('*')
    .eq('lead_id', leadId)
    .single();
  
  if (!followup) {
    return { success: false, error: 'Follow-up not found' };
  }
  
  const nextFollowupAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min from now
  
  const { error } = await supabase
    .from('zapi_followups')
    .update({ 
      status: 'ativo', 
      lock_reason: null, 
      next_followup_at: nextFollowupAt,
      updated_at: new Date().toISOString() 
    })
    .eq('lead_id', leadId);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, message: 'Follow-up resumed' };
}

async function processFollowups(supabase: any, zapiConfig: any) {
  const now = new Date();
  const results: any[] = [];
  
  // Buscar TODAS as instâncias para roteamento por lead
  const { data: allInstances } = await supabase
    .from('zapi_instances')
    .select('instance_id, is_default, name, token, client_token, phone_number')
    .eq('is_active', true);

  // Get all active follow-ups that are due
  const { data: pendingFollowups, error } = await supabase
    .from('zapi_followups')
    .select(`
      *,
      lead:leads_juridicos(id, nome, status, lead_state, telefone, linha_whatsapp, tipo_origem)
    `)
    .eq('status', 'ativo')
    .eq('respondido', false)
    .lte('next_followup_at', now.toISOString())
    .limit(50);
  
  if (error) {
    console.error('[Z-API Followup] Query error:', error);
    return results;
  }
  
  console.log(`[Z-API Followup] Found ${pendingFollowups?.length || 0} pending follow-ups`);
  
  for (const followup of pendingFollowups || []) {
    try {
      const lead = followup.lead;
      
      // Skip if lead status is blocked
      if (!lead || STATUS_BLOQUEADOS.includes(lead.status)) {
        await supabase
          .from('zapi_followups')
          .update({ status: 'bloqueado', lock_reason: `Status bloqueado: ${lead?.status}` })
          .eq('id', followup.id);
        continue;
      }
      
      // Check for human attendance
      const { data: subscriber } = await supabase
        .from('manychat_subscribers')
        .select('atendimento_humano')
        .eq('lead_id', lead.id)
        .maybeSingle();
      
      if (subscriber?.atendimento_humano) {
        await supabase
          .from('zapi_followups')
          .update({ status: 'pausado', lock_reason: 'atendimento_humano' })
          .eq('id', followup.id);
        continue;
      }
      
      // Check for recent activity (last 30 min)
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { data: recentMsgs } = await supabase
        .from('manychat_mensagens')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('direcao', 'entrada')
        .gte('created_at', thirtyMinAgo)
        .limit(1);
      
      if (recentMsgs && recentMsgs.length > 0) {
        // Lead is active, reschedule
        const nextAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
        await supabase
          .from('zapi_followups')
          .update({ next_followup_at: nextAt })
          .eq('id', followup.id);
        continue;
      }
      
      // Determine which stage to send
      const stageFast = followup.stage_fast || 0;
      const stageSlow = followup.stage_slow || 0;
      
      let message: string | null = null;
      let newStageFast = stageFast;
      let newStageSlow = stageSlow;
      let tipoEnviado = '';
      let nextDelay = 0;
      
      // FAST stage (Lead Frio only)
      if (STATUS_PERMITE_FAST.includes(lead.status) && stageFast < 3) {
        const nextStage = (stageFast + 1) as 1 | 2 | 3;
        message = MENSAGENS_FAST[nextStage](lead.nome);
        newStageFast = nextStage;
        tipoEnviado = `FAST_${nextStage}`;
        
        if (nextStage < 3) {
          const nextConfig = FAST_CONFIG[(nextStage + 1) as 1 | 2 | 3];
          nextDelay = nextConfig.delay_minutos;
        } else {
          // Move to SLOW
          nextDelay = SLOW_CONFIG[1].delay_minutos;
        }
      }
      // SLOW stage
      else if (STATUS_PERMITE_SLOW.includes(lead.status) && stageSlow < 3) {
        const nextStage = (stageSlow + 1) as 1 | 2 | 3;
        message = MENSAGENS_SLOW[nextStage](lead.nome);
        newStageSlow = nextStage;
        tipoEnviado = `SLOW_${nextStage}`;
        
        if (nextStage < 3) {
          const nextConfig = SLOW_CONFIG[(nextStage + 1) as 1 | 2 | 3];
          nextDelay = nextConfig.delay_minutos;
        } else {
          // Completed
          nextDelay = 0;
        }
      }
      
      if (!message) {
        // All stages completed
        await supabase
          .from('zapi_followups')
          .update({ status: 'concluido', updated_at: now.toISOString() })
          .eq('id', followup.id);
        continue;
      }
      
      // REGRA ESTRITA: resolver instância correta por lead
      const isTrafego = lead.linha_whatsapp === 'trafego_isa' || lead.linha_whatsapp === 'trafego' ||
                        lead.tipo_origem === 'trafego' || lead.tipo_origem === 'trafego_isa';
      let leadZapiConfig = zapiConfig;
      if (allInstances && allInstances.length > 1) {
        const target = isTrafego 
          ? allInstances.find((i: any) => !i.is_default) || allInstances[0]
          : allInstances.find((i: any) => i.is_default) || allInstances[0];
        leadZapiConfig = {
          instance_id: target.instance_id,
          token: target.token,
          client_token: target.client_token,
          name: target.name,
          phone_number: target.phone_number,
        };
      }

      // Send message via Z-API
      console.log(`[Z-API Followup] Sending ${tipoEnviado} to ${lead.nome} (${followup.telefone}) via ${leadZapiConfig.name}`);
      const sendResult = await sendText(leadZapiConfig, followup.telefone, message);
      
      if (sendResult.success) {
        // Save message to history
        await supabase.from('manychat_mensagens').insert({
          subscriber_id: followup.subscriber_id,
          subscriber_nome: 'Isa (Automação)',
          lead_id: lead.id,
          conteudo: message,
          direcao: 'saida',
          tipo: 'text',
          canal: 'whatsapp',
          metadata: {
            source: 'zapi_followup',
            followup_type: tipoEnviado,
            message_id: sendResult.messageId,
          },
        });
        
        // Update follow-up record
        const updateData: any = {
          stage_fast: newStageFast,
          stage_slow: newStageSlow,
          last_outbound_at: now.toISOString(),
          total_followups_enviados: (followup.total_followups_enviados || 0) + 1,
          ultimo_tipo_enviado: tipoEnviado,
          updated_at: now.toISOString(),
        };
        
        if (nextDelay > 0) {
          updateData.next_followup_at = new Date(now.getTime() + nextDelay * 60 * 1000).toISOString();
        } else {
          updateData.status = 'concluido';
        }
        
        await supabase
          .from('zapi_followups')
          .update(updateData)
          .eq('id', followup.id);
        
        // Register interaction
        await supabase.from('interacoes').insert({
          cliente_id: lead.id,
          tipo: 'WhatsApp',
          direcao: 'Saída',
          resumo: `Follow-up ${tipoEnviado} enviado automaticamente`,
          detalhes: message.substring(0, 200),
        });
        
        results.push({
          lead_id: lead.id,
          lead_nome: lead.nome,
          tipo: tipoEnviado,
          success: true,
        });
        
        console.log(`[Z-API Followup] ✅ ${tipoEnviado} sent to ${lead.nome}`);
      } else {
        console.error(`[Z-API Followup] ❌ Failed to send to ${lead.nome}:`, sendResult.error);
        results.push({
          lead_id: lead.id,
          lead_nome: lead.nome,
          tipo: tipoEnviado,
          success: false,
          error: sendResult.error,
        });
      }
      
    } catch (err: any) {
      console.error(`[Z-API Followup] Error processing:`, err);
    }
  }
  
  return results;
}
