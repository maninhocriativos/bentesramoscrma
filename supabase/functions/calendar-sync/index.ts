import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MANAUS_TZ = 'America/Manaus';
// ID do usuário dono do calendário compartilhado do escritório (fallback para usuários sem calendário próprio)
const OFFICE_CALENDAR_USER_ID = Deno.env.get('CALENDAR_OFFICE_USER_ID') || '5c775450-665f-4f43-99cb-efb6167d4e20';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapTipoToColor(tipo: string): string {
  const colors: Record<string, string> = {
    'Audiência': '11', // Tomato
    'Reunião':   '5',  // Banana
    'Prazo':     '6',  // Tangerine
    'Tarefa':    '2',  // Sage
    'Outro':     '8',  // Graphite
  };
  return colors[tipo] || '8';
}

function mapColorToTipo(colorId?: string): string {
  const tipos: Record<string, string> = {
    '11': 'Audiência',
    '5':  'Reunião',
    '6':  'Prazo',
    '2':  'Tarefa',
    '8':  'Outro',
  };
  return tipos[colorId || '8'] || 'Reunião';
}

async function getValidAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: tokenData } = await supabase
    .from('google_calendar_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!tokenData) return null;

  const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at) : null;
  const isExpired = expiresAt && expiresAt < new Date(Date.now() + 60000); // 1min de margem

  if (isExpired && tokenData.refresh_token) {
    // Buscar credenciais
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);

    const creds = (settings || []).reduce((acc: any, s: any) => { acc[s.key] = s.value; return acc; }, {});

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: tokenData.refresh_token,
        client_id: creds['GOOGLE_OAUTH_CLIENT_ID'],
        client_secret: creds['GOOGLE_OAUTH_CLIENT_SECRET'],
        grant_type: 'refresh_token',
      }),
    });

    const newTokens = await res.json();
    if (newTokens.access_token) {
      await supabase
        .from('google_calendar_tokens')
        .update({
          access_token: newTokens.access_token,
          expires_at: new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString(),
        })
        .eq('user_id', userId);
      return newTokens.access_token;
    }
    return null;
  }

  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { action, user_id, compromisso_id, google_event_id } = body;

    console.log('[calendar-sync] Action:', action, '| user_id:', user_id);

    // ═══════════════════════════════════════════════════════════════════════
    // PUSH: CRM → Google Calendar (criar ou atualizar evento)
    // ═══════════════════════════════════════════════════════════════════════
    if (action === 'push_to_google') {
      if (!user_id || !compromisso_id) {
        return new Response(JSON.stringify({ error: 'user_id e compromisso_id são obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Tenta token do usuário; fallback ao calendário compartilhado do escritório
      let accessToken = await getValidAccessToken(supabase, user_id);
      if (!accessToken && user_id !== OFFICE_CALENDAR_USER_ID) {
        accessToken = await getValidAccessToken(supabase, OFFICE_CALENDAR_USER_ID);
      }
      if (!accessToken) {
        return new Response(JSON.stringify({ skipped: true, reason: 'no_calendar_token' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: comp, error } = await supabase
        .from('compromissos')
        .select('*')
        .eq('id', compromisso_id)
        .single();

      if (error || !comp) {
        return new Response(JSON.stringify({ error: 'Compromisso não encontrado' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const dataFim = comp.data_fim || new Date(new Date(comp.data_inicio).getTime() + 3600000).toISOString();

      const googleEvent = {
        summary: comp.titulo,
        description: comp.descricao || '',
        colorId: mapTipoToColor(comp.tipo),
        start: { dateTime: comp.data_inicio, timeZone: MANAUS_TZ },
        end:   { dateTime: dataFim,          timeZone: MANAUS_TZ },
        extendedProperties: {
          private: {
            crm_id:   comp.id,
            crm_tipo: comp.tipo,
          }
        }
      };

      let googleRes: Response;
      let method = 'POST';
      let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

      // Se já tem google_event_id, atualiza em vez de criar
      if (comp.google_event_id) {
        method = 'PUT';
        url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${comp.google_event_id}`;
      }

      googleRes = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(googleEvent),
      });

      if (!googleRes.ok) {
        const errText = await googleRes.text();
        // Se o evento não existe mais no Google, cria um novo
        if (googleRes.status === 404 && comp.google_event_id) {
          googleRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(googleEvent),
          });
        }
        if (!googleRes.ok) {
          return new Response(JSON.stringify({ error: 'Erro ao criar/atualizar no Google', details: errText }), {
            status: googleRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const createdEvent = await googleRes.json();

      // Salvar google_event_id no CRM
      await supabase
        .from('compromissos')
        .update({ google_event_id: createdEvent.id })
        .eq('id', comp.id);

      console.log('[calendar-sync] Push OK:', createdEvent.id);
      return new Response(JSON.stringify({ success: true, google_event_id: createdEvent.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PULL: Google Calendar → CRM (importar eventos)
    // ═══════════════════════════════════════════════════════════════════════
    if (action === 'pull_from_google') {
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accessToken = await getValidAccessToken(supabase, user_id);
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'Token inválido ou expirado' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Buscar eventos do Google: 30 dias atrás até 90 dias à frente
      const now = new Date();
      const timeMin = new Date(now.getTime() - 30 * 24 * 3600000).toISOString();
      const timeMax = new Date(now.getTime() + 90 * 24 * 3600000).toISOString();

      const googleRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&` +
        `singleEvents=true&orderBy=startTime&maxResults=500`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!googleRes.ok) {
        const errText = await googleRes.text();
        return new Response(JSON.stringify({ error: 'Erro ao buscar eventos do Google', details: errText }), {
          status: googleRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const googleData = await googleRes.json();
      const events = googleData.items || [];
      console.log('[calendar-sync] Google events found:', events.length);

      // Buscar google_event_ids já salvos no CRM para evitar duplicatas
      const { data: existing } = await supabase
        .from('compromissos')
        .select('google_event_id')
        .not('google_event_id', 'is', null);

      const existingIds = new Set((existing || []).map((e: any) => e.google_event_id));

      // Importar apenas eventos novos que não vieram do CRM
      const toImport = events.filter((ev: any) => {
        if (existingIds.has(ev.id)) return false; // já existe
        // Ignorar eventos que o CRM criou (têm crm_id nas extendedProperties)
        if (ev.extendedProperties?.private?.crm_id) return false;
        return true;
      });

      console.log('[calendar-sync] New events to import:', toImport.length);

      let imported = 0;
      for (const ev of toImport) {
        const dataInicio = ev.start.dateTime || ev.start.date;
        const dataFim    = ev.end.dateTime   || ev.end.date || null;

        const { error: insertErr } = await supabase
          .from('compromissos')
          .insert({
            titulo:          ev.summary || 'Evento do Google',
            descricao:       ev.description || null,
            data_inicio:     dataInicio,
            data_fim:        dataFim,
            tipo:            mapColorToTipo(ev.colorId),
            origem:          'google',
            google_event_id: ev.id,
          });

        if (!insertErr) imported++;
      }

      return new Response(JSON.stringify({
        success: true,
        total_google: events.length,
        novos_importados: imported,
        ja_existentes: existingIds.size,
        mensagem: `${imported} novos eventos importados do Google Calendar`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SYNC FULL: bidirecional completo
    // ═══════════════════════════════════════════════════════════════════════
    if (action === 'sync_full') {
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accessToken = await getValidAccessToken(supabase, user_id);
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'Token inválido ou expirado' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 1. Exportar compromissos locais que ainda não têm google_event_id
      const { data: localComps } = await supabase
        .from('compromissos')
        .select('*')
        .is('google_event_id', null)
        .is('origem', null); // apenas os criados no CRM

      let exportados = 0;
      let exportErros = 0;

      for (const comp of localComps || []) {
        try {
          const dataFim = comp.data_fim || new Date(new Date(comp.data_inicio).getTime() + 3600000).toISOString();
          const googleEvent = {
            summary: comp.titulo,
            description: comp.descricao || '',
            colorId: mapTipoToColor(comp.tipo),
            start: { dateTime: comp.data_inicio, timeZone: MANAUS_TZ },
            end:   { dateTime: dataFim,          timeZone: MANAUS_TZ },
            extendedProperties: { private: { crm_id: comp.id, crm_tipo: comp.tipo } }
          };

          const res = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(googleEvent),
            }
          );

          if (res.ok) {
            const created = await res.json();
            await supabase
              .from('compromissos')
              .update({ google_event_id: created.id })
              .eq('id', comp.id);
            exportados++;
          } else {
            exportErros++;
          }
        } catch {
          exportErros++;
        }
      }

      // 2. Importar eventos do Google que não estão no CRM
      const now = new Date();
      const timeMin = new Date(now.getTime() - 30 * 24 * 3600000).toISOString();
      const timeMax = new Date(now.getTime() + 90 * 24 * 3600000).toISOString();

      const googleRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&` +
        `singleEvents=true&orderBy=startTime&maxResults=500`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      let importados = 0;
      if (googleRes.ok) {
        const googleData = await googleRes.json();
        const events = googleData.items || [];

        const { data: existing } = await supabase
          .from('compromissos')
          .select('google_event_id')
          .not('google_event_id', 'is', null);

        const existingIds = new Set((existing || []).map((e: any) => e.google_event_id));

        for (const ev of events) {
          if (existingIds.has(ev.id)) continue;
          if (ev.extendedProperties?.private?.crm_id) continue;

          const { error } = await supabase
            .from('compromissos')
            .insert({
              titulo:          ev.summary || 'Evento do Google',
              descricao:       ev.description || null,
              data_inicio:     ev.start.dateTime || ev.start.date,
              data_fim:        ev.end.dateTime || ev.end.date || null,
              tipo:            mapColorToTipo(ev.colorId),
              origem:          'google',
              google_event_id: ev.id,
            });

          if (!error) importados++;
        }
      }

      console.log(`[calendar-sync] Sync full: ${exportados} exportados, ${importados} importados`);

      return new Response(JSON.stringify({
        success: true,
        exportados,
        exportErros,
        importados,
        mensagem: `Sincronização completa: ${exportados} enviados ao Google, ${importados} importados do Google`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DELETE: remover evento do Google quando deletado no CRM
    // ═══════════════════════════════════════════════════════════════════════
    if (action === 'delete_from_google') {
      if (!user_id || !google_event_id) {
        return new Response(JSON.stringify({ error: 'user_id e google_event_id são obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let accessToken = await getValidAccessToken(supabase, user_id);
      if (!accessToken && user_id !== OFFICE_CALENDAR_USER_ID) {
        accessToken = await getValidAccessToken(supabase, OFFICE_CALENDAR_USER_ID);
      }
      if (!accessToken) {
        return new Response(JSON.stringify({ skipped: true, reason: 'no_calendar_token' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${google_event_id}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      // 410 = já foi deletado, tudo bem
      if (!res.ok && res.status !== 410) {
        return new Response(JSON.stringify({ error: 'Erro ao deletar evento no Google' }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[calendar-sync] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
