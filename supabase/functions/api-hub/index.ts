import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-source',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const url = new URL(req.url);
  const path = url.pathname.replace('/api-hub', '');
  
  // Get request metadata
  const ipOrigem = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const source = req.headers.get('x-source') || 'unknown';

  try {
    let body: any = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    console.log(`[API-HUB] ${req.method} ${path} from ${source}`);
    console.log('[API-HUB] Body:', JSON.stringify(body));

    // Route handling
    let response: any = { success: true };
    let eventData: any = {
      ip_origem: ipOrigem,
      user_agent: userAgent,
      dados: body,
      metadata: { path, method: req.method }
    };

    // === WEBHOOK ROUTES ===
    
    // ManyChat Webhook
    if (path === '/webhook/manychat' || path.startsWith('/manychat')) {
      const subscriberId = body.subscriber_id || body.id;
      const nome = body.name || body.first_name || body.subscriber?.name;
      const telefone = body.phone || body.subscriber?.phone;
      const mensagem = body.last_input_text || body.text || body.message;

      // Try to find linked lead
      let leadId = null;
      if (telefone) {
        const { data: lead } = await supabase
          .from('leads_juridicos')
          .select('id')
          .or(`telefone.ilike.%${telefone.slice(-8)}%`)
          .maybeSingle();
        leadId = lead?.id;
      }

      // Log event
      await supabase.from('system_events').insert({
        tipo: 'webhook',
        fonte: 'manychat',
        acao: 'received',
        entidade_tipo: 'mensagem',
        lead_id: leadId,
        ...eventData,
        dados: { subscriber_id: subscriberId, nome, telefone, mensagem, ...body }
      });

      // Store message
      if (subscriberId && mensagem) {
        await supabase.from('manychat_mensagens').insert({
          subscriber_id: subscriberId,
          subscriber_nome: nome,
          conteudo: mensagem,
          direcao: 'entrada',
          lead_id: leadId
        });
      }

      response = { success: true, lead_id: leadId };
    }

    // Clicksign Webhook
    else if (path === '/webhook/clicksign' || path.startsWith('/clicksign')) {
      const event = body.event || {};
      const document = body.document || event.document || {};
      const eventName = event.name || body.event_name;
      
      // Map Clicksign events to status
      const statusMap: Record<string, string> = {
        'upload': 'Documento enviado',
        'add_signer': 'Signatário adicionado',
        'sign': 'Assinatura realizada',
        'close': 'Documento finalizado',
        'cancel': 'Documento cancelado',
        'deadline': 'Prazo expirado'
      };

      const status = statusMap[eventName] || eventName;

      // Find leads with this document
      if (document.key) {
        const { data: leads } = await supabase
          .from('leads_juridicos')
          .select('id')
          .ilike('link_contrato', `%${document.key}%`);

        for (const lead of leads || []) {
          // Log event
          await supabase.from('system_events').insert({
            tipo: 'contrato',
            fonte: 'clicksign',
            acao: 'updated',
            entidade_tipo: 'contrato',
            lead_id: lead.id,
            ...eventData,
            dados: { document_key: document.key, status, event_name: eventName }
          });

          // Create interaction
          await supabase.from('interacoes').insert({
            cliente_id: lead.id,
            tipo: 'Contrato',
            resumo: `Clicksign: ${status}`,
            detalhes: `Documento: ${document.key}`,
            direcao: 'Entrada'
          });

          // Update lead status if signed
          if (eventName === 'close') {
            await supabase
              .from('leads_juridicos')
              .update({ status: 'Contrato Assinado' })
              .eq('id', lead.id);
          }
        }
      }

      response = { success: true, status };
    }

    // Zapier/Make/n8n Webhook
    else if (path === '/webhook/automation' || path.startsWith('/zapier') || path.startsWith('/make') || path.startsWith('/n8n')) {
      const automationSource = path.includes('zapier') ? 'zapier' : 
                               path.includes('make') ? 'make' : 
                               path.includes('n8n') ? 'n8n' : 'automation';
      
      const action = body.action || 'trigger';
      const leadId = body.lead_id;
      const leadEmail = body.email;
      const leadTelefone = body.telefone;

      // Try to find lead
      let resolvedLeadId = leadId;
      if (!resolvedLeadId && (leadEmail || leadTelefone)) {
        const { data: lead } = await supabase
          .from('leads_juridicos')
          .select('id')
          .or(`email.eq.${leadEmail},telefone.ilike.%${leadTelefone?.slice(-8) || ''}%`)
          .maybeSingle();
        resolvedLeadId = lead?.id;
      }

      // Log event
      await supabase.from('system_events').insert({
        tipo: 'webhook',
        fonte: automationSource,
        acao: action,
        entidade_tipo: body.entity_type || 'lead',
        entidade_id: body.entity_id,
        lead_id: resolvedLeadId,
        ...eventData
      });

      // Handle specific actions
      if (action === 'update_lead' && resolvedLeadId) {
        const updates: any = {};
        if (body.status) updates.status = body.status;
        if (body.nome) updates.nome = body.nome;
        if (body.email) updates.email = body.email;
        if (body.telefone) updates.telefone = body.telefone;
        
        if (Object.keys(updates).length > 0) {
          await supabase.from('leads_juridicos').update(updates).eq('id', resolvedLeadId);
        }
      }

      if (action === 'create_lead') {
        const { data: newLead } = await supabase
          .from('leads_juridicos')
          .insert({
            nome: body.nome,
            email: body.email,
            telefone: body.telefone,
            origem: body.origem || automationSource,
            tipo_acao: body.tipo_acao,
            status: body.status || 'Lead Frio'
          })
          .select()
          .single();
        
        response = { success: true, lead: newLead };
      }

      if (action === 'create_interaction' && resolvedLeadId) {
        await supabase.from('interacoes').insert({
          cliente_id: resolvedLeadId,
          tipo: body.interaction_type || 'Nota',
          resumo: body.resumo || body.summary,
          detalhes: body.detalhes || body.details,
          direcao: body.direcao || 'Saída'
        });
      }

      response = { ...response, lead_id: resolvedLeadId };
    }

    // WhatsApp Webhook
    else if (path === '/webhook/whatsapp' || path.startsWith('/whatsapp')) {
      const telefone = body.from || body.phone || body.sender;
      const mensagem = body.text || body.message || body.body;
      const nome = body.profile?.name || body.name;

      // Find lead by phone
      let leadId = null;
      if (telefone) {
        const cleanPhone = telefone.replace(/\D/g, '').slice(-8);
        const { data: lead } = await supabase
          .from('leads_juridicos')
          .select('id')
          .ilike('telefone', `%${cleanPhone}%`)
          .maybeSingle();
        leadId = lead?.id;
      }

      // Log event
      await supabase.from('system_events').insert({
        tipo: 'mensagem',
        fonte: 'whatsapp',
        acao: 'received',
        entidade_tipo: 'mensagem',
        lead_id: leadId,
        ...eventData,
        dados: { telefone, mensagem, nome }
      });

      // Create interaction if lead found
      if (leadId && mensagem) {
        await supabase.from('interacoes').insert({
          cliente_id: leadId,
          tipo: 'WhatsApp',
          resumo: mensagem.substring(0, 100),
          detalhes: mensagem,
          direcao: 'Entrada'
        });
      }

      response = { success: true, lead_id: leadId };
    }

    // === API ROUTES ===

    // Get events (for dashboard)
    else if (path === '/events' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const tipo = url.searchParams.get('tipo');
      const fonte = url.searchParams.get('fonte');
      const leadId = url.searchParams.get('lead_id');

      let query = supabase
        .from('system_events')
        .select('*, leads_juridicos(nome)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (tipo) query = query.eq('tipo', tipo);
      if (fonte) query = query.eq('fonte', fonte);
      if (leadId) query = query.eq('lead_id', leadId);

      const { data, error } = await query;
      if (error) throw error;

      response = { success: true, events: data };
    }

    // Get stats
    else if (path === '/stats' && req.method === 'GET') {
      const since = url.searchParams.get('since') || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: stats } = await supabase
        .from('system_events')
        .select('tipo, fonte, acao')
        .gte('created_at', since);

      const byTipo: Record<string, number> = {};
      const byFonte: Record<string, number> = {};
      const byAcao: Record<string, number> = {};

      for (const event of stats || []) {
        byTipo[event.tipo] = (byTipo[event.tipo] || 0) + 1;
        byFonte[event.fonte] = (byFonte[event.fonte] || 0) + 1;
        byAcao[event.acao] = (byAcao[event.acao] || 0) + 1;
      }

      response = { 
        success: true, 
        total: stats?.length || 0,
        by_tipo: byTipo,
        by_fonte: byFonte,
        by_acao: byAcao
      };
    }

    // Health check
    else if (path === '/health' || path === '/') {
      response = { 
        success: true, 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        endpoints: [
          'POST /webhook/manychat',
          'POST /webhook/clicksign', 
          'POST /webhook/automation',
          'POST /webhook/whatsapp',
          'GET /events',
          'GET /stats',
          'GET /health'
        ]
      };
    }

    // Unknown route
    else {
      // Log unknown request
      await supabase.from('system_events').insert({
        tipo: 'sistema',
        fonte: 'api-hub',
        acao: 'unknown_route',
        ...eventData,
        erro: `Unknown route: ${path}`
      });

      response = { success: false, error: 'Unknown endpoint', path };
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API-HUB] Error:', errorMessage);

    // Log error
    await supabase.from('system_events').insert({
      tipo: 'sistema',
      fonte: 'api-hub',
      acao: 'error',
      ip_origem: ipOrigem,
      user_agent: userAgent,
      erro: errorMessage,
      dados: { path }
    });

    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
