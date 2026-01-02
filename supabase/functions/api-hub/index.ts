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
    
    // ManyChat Webhook - Redirecionar para manychat-webhook para processamento completo
    if (path === '/webhook/manychat' || path.startsWith('/manychat')) {
      const subscriberIdRaw = body.subscriber_id || body.id?.toString() || `api_${Date.now()}`;
      const subscriberId = subscriberIdRaw.toString().replace(/^\[|\]$/g, '').trim();
      
      const nomeRaw = body.name || body.first_name || body.subscriber?.name || 'Desconhecido';
      const nome = nomeRaw.toString().replace(/^\[|\]$/g, '').trim();
      
      const telefoneRaw = body.phone || body.subscriber?.phone || body.telefone;
      const telefone = telefoneRaw ? telefoneRaw.toString().replace(/^\[|\]$/g, '').trim() : null;
      
      const email = body.email || body.subscriber?.email;
      const mensagemRaw = body.last_input_text || body.text || body.message || body.mensagem;
      const mensagem = mensagemRaw ? mensagemRaw.toString().replace(/^\[|\]$/g, '').trim() : null;

      // Detectar canal
      let canal = 'facebook';
      const payloadStr = JSON.stringify(body).toLowerCase();
      if (payloadStr.includes('instagram') || payloadStr.includes('"ig_')) canal = 'instagram';
      else if (payloadStr.includes('whatsapp') || payloadStr.includes('"wa_') || telefone) canal = 'whatsapp';

      // Tentar encontrar subscriber existente com lead vinculado
      let leadId: string | null = null;
      
      const { data: existingSubscriber } = await supabase
        .from('manychat_subscribers')
        .select('lead_id')
        .eq('subscriber_id', subscriberId)
        .maybeSingle();
      
      if (existingSubscriber?.lead_id) {
        leadId = existingSubscriber.lead_id;
        console.log('[API-HUB] Lead já vinculado ao subscriber:', leadId);
      } else {
        // Buscar lead pelo telefone (normalizado)
        if (telefone) {
          const telefoneLimpo = telefone.toString().replace(/\D/g, '');
          const { data: leadByPhone } = await supabase
            .from('leads_juridicos')
            .select('id, nome')
            .or(`telefone.ilike.%${telefoneLimpo.slice(-9)}%,telefone.ilike.%${telefoneLimpo}%`)
            .limit(1)
            .maybeSingle();
          
          if (leadByPhone) {
            leadId = leadByPhone.id;
            console.log('[API-HUB] Lead encontrado por telefone:', leadByPhone.nome);
          }
        }
        
        // Buscar por email se não encontrou por telefone
        if (!leadId && email) {
          const { data: leadByEmail } = await supabase
            .from('leads_juridicos')
            .select('id, nome')
            .ilike('email', email)
            .limit(1)
            .maybeSingle();
          
          if (leadByEmail) {
            leadId = leadByEmail.id;
            console.log('[API-HUB] Lead encontrado por email:', leadByEmail.nome);
          }
        }
        
        // Buscar por nome
        if (!leadId && nome && nome !== 'Desconhecido') {
          const { data: leadByName } = await supabase
            .from('leads_juridicos')
            .select('id, nome')
            .ilike('nome', `%${nome}%`)
            .limit(1)
            .maybeSingle();
          
          if (leadByName) {
            leadId = leadByName.id;
            console.log('[API-HUB] Lead encontrado por nome:', leadByName.nome);
          }
        }
        
        // CRIAR LEAD AUTOMATICAMENTE se não encontrou
        const temDadosParaCriarLead = (nome && nome !== 'Desconhecido') || telefone || email;
        
        if (!leadId && temDadosParaCriarLead) {
          const nomeDoLead = (nome && nome !== 'Desconhecido') 
            ? nome 
            : telefone 
              ? `Contato ${telefone}` 
              : `Contato via ${canal}`;
          
          // Determinar origem baseado no canal
          let origem = 'ManyChat';
          if (canal === 'instagram') origem = 'Instagram';
          else if (canal === 'facebook') origem = 'Facebook';
          else if (canal === 'whatsapp') origem = 'WhatsApp';
          
          console.log('[API-HUB] Criando novo lead automaticamente:', nomeDoLead);
          
          const { data: newLead, error: leadError } = await supabase
            .from('leads_juridicos')
            .insert({
              nome: nomeDoLead,
              telefone: telefone || null,
              email: email || null,
              status: 'Lead Frio',
              origem: origem,
              resumo_ia: `Lead criado automaticamente via ${origem}. Primeiro contato em ${new Date().toLocaleDateString('pt-BR')}.`,
            })
            .select()
            .single();
          
          if (leadError) {
            console.error('[API-HUB] Erro ao criar lead:', leadError);
          } else {
            leadId = newLead.id;
            console.log('[API-HUB] Novo lead criado:', newLead.nome, leadId);
            
            // Registrar evento de criação de lead
            await supabase.from('system_events').insert({
              tipo: 'lead',
              fonte: 'manychat',
              acao: 'lead_criado_automatico',
              entidade_tipo: 'lead',
              entidade_id: leadId,
              lead_id: leadId,
              ...eventData,
              dados: {
                nome: nomeDoLead,
                telefone: telefone,
                email: email,
                canal: canal,
                origem: origem,
                subscriber_id: subscriberId,
              },
              processado: true,
            });
          }
        }
      }

      // Upsert subscriber com lead_id vinculado
      await supabase
        .from('manychat_subscribers')
        .upsert({
          subscriber_id: subscriberId,
          nome: nome,
          telefone: telefone,
          email: email,
          canal: canal,
          lead_id: leadId,
          ultima_interacao: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'subscriber_id',
        });

      // Log event
      await supabase.from('system_events').insert({
        tipo: 'mensagem',
        fonte: 'manychat',
        acao: 'mensagem_recebida',
        entidade_tipo: 'mensagem',
        entidade_id: leadId,
        lead_id: leadId,
        ...eventData,
        dados: { subscriber_id: subscriberId, nome, telefone, mensagem, canal, ...body },
        processado: true,
      });

      // Store message - detectar tipo de mídia
      if (subscriberId && mensagem) {
        // Detectar tipo de conteúdo pela URL
        let tipoMensagem = 'text';
        const mensagemLower = mensagem.toString().toLowerCase();
        
        if (mensagemLower.match(/\.(ogg|mp3|wav|m4a|aac)(\?|$)/)) {
          tipoMensagem = 'audio';
        } else if (mensagemLower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/)) {
          tipoMensagem = 'image';
        } else if (mensagemLower.match(/\.(mp4|webm|mov)(\?|$)/)) {
          tipoMensagem = 'video';
        } else if (mensagemLower.match(/\.(pdf|doc|docx|xls|xlsx)(\?|$)/)) {
          tipoMensagem = 'document';
        }
        
        console.log('[API-HUB] Tipo detectado:', tipoMensagem, '- Mensagem:', mensagem.substring(0, 100));
        
        await supabase.from('manychat_mensagens').insert({
          subscriber_id: subscriberId,
          subscriber_nome: nome,
          conteudo: mensagem,
          canal: canal,
          tipo: tipoMensagem,
          direcao: 'entrada',
          lead_id: leadId
        });
        console.log('[API-HUB] Mensagem salva para subscriber:', subscriberId, 'tipo:', tipoMensagem);
      }

      response = { success: true, lead_id: leadId, lead_criado: !existingSubscriber?.lead_id && leadId ? true : false };
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
