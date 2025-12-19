import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADVBOX_TOKEN = Deno.env.get('ADVBOX_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface AdvboxEvento {
  id: string;
  titulo: string;
  descricao?: string;
  data_inicio: string;
  data_fim?: string;
  tipo?: string;
}

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { action, google_access_token, sync_from, sync_to } = await req.json();

    console.log('Calendar Sync - Action:', action);

    // Sync from Advbox to local database
    if (action === 'sync_advbox') {
      if (!ADVBOX_TOKEN) {
        return new Response(JSON.stringify({ 
          error: 'ADVBOX_TOKEN não configurado' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Fetching events from Advbox...');
      
      // Fetch events from Advbox API
      const advboxResponse = await fetch('https://api.advbox.com.br/v1/agenda', {
        headers: {
          'Authorization': `Bearer ${ADVBOX_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!advboxResponse.ok) {
        const errorText = await advboxResponse.text();
        console.error('Advbox API error:', advboxResponse.status, errorText);
        return new Response(JSON.stringify({ 
          error: `Erro ao buscar eventos do Advbox: ${advboxResponse.status}`,
          details: errorText
        }), {
          status: advboxResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const advboxEvents: AdvboxEvento[] = await advboxResponse.json();
      console.log(`Found ${advboxEvents.length} events from Advbox`);

      // Upsert events to local database
      const compromissos = advboxEvents.map(event => ({
        id: `advbox_${event.id}`,
        titulo: event.titulo,
        descricao: event.descricao || null,
        data_inicio: event.data_inicio,
        data_fim: event.data_fim || null,
        tipo: event.tipo || 'advbox',
      }));

      for (const compromisso of compromissos) {
        const { error } = await supabase
          .from('compromissos')
          .upsert(compromisso, { onConflict: 'id' });
        
        if (error) {
          console.error('Error upserting compromisso:', error);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        synced: compromissos.length,
        message: `${compromissos.length} eventos sincronizados do Advbox`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sync from Google Calendar
    if (action === 'sync_google') {
      if (!google_access_token) {
        return new Response(JSON.stringify({ 
          error: 'Token do Google não fornecido' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Fetching events from Google Calendar...');

      const now = new Date();
      const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const googleResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${encodeURIComponent(timeMin)}&` +
        `timeMax=${encodeURIComponent(timeMax)}&` +
        `singleEvents=true&orderBy=startTime`,
        {
          headers: {
            'Authorization': `Bearer ${google_access_token}`,
          },
        }
      );

      if (!googleResponse.ok) {
        const errorText = await googleResponse.text();
        console.error('Google Calendar API error:', googleResponse.status, errorText);
        return new Response(JSON.stringify({ 
          error: `Erro ao buscar eventos do Google: ${googleResponse.status}`,
          details: errorText
        }), {
          status: googleResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const googleData = await googleResponse.json();
      const googleEvents: GoogleCalendarEvent[] = googleData.items || [];
      console.log(`Found ${googleEvents.length} events from Google Calendar`);

      // Upsert events to local database
      const compromissos = googleEvents.map(event => ({
        id: `google_${event.id}`,
        titulo: event.summary || 'Sem título',
        descricao: event.description || null,
        data_inicio: event.start.dateTime || event.start.date,
        data_fim: event.end.dateTime || event.end.date || null,
        tipo: 'google',
      }));

      for (const compromisso of compromissos) {
        const { error } = await supabase
          .from('compromissos')
          .upsert(compromisso, { onConflict: 'id' });
        
        if (error) {
          console.error('Error upserting compromisso:', error);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        synced: compromissos.length,
        message: `${compromissos.length} eventos sincronizados do Google Calendar`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Push local event to Google Calendar
    if (action === 'push_to_google') {
      if (!google_access_token) {
        return new Response(JSON.stringify({ 
          error: 'Token do Google não fornecido' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { compromisso_id } = await req.json();

      const { data: compromisso, error } = await supabase
        .from('compromissos')
        .select('*')
        .eq('id', compromisso_id)
        .single();

      if (error || !compromisso) {
        return new Response(JSON.stringify({ error: 'Compromisso não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const googleEvent = {
        summary: compromisso.titulo,
        description: compromisso.descricao,
        start: {
          dateTime: compromisso.data_inicio,
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: compromisso.data_fim || compromisso.data_inicio,
          timeZone: 'America/Sao_Paulo',
        },
      };

      const googleResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${google_access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(googleEvent),
        }
      );

      if (!googleResponse.ok) {
        const errorText = await googleResponse.text();
        console.error('Error pushing to Google:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Erro ao criar evento no Google Calendar',
          details: errorText
        }), {
          status: googleResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const createdEvent = await googleResponse.json();
      console.log('Created Google event:', createdEvent.id);

      return new Response(JSON.stringify({ 
        success: true, 
        google_event_id: createdEvent.id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Push local event to Advbox
    if (action === 'push_to_advbox') {
      if (!ADVBOX_TOKEN) {
        return new Response(JSON.stringify({ 
          error: 'ADVBOX_TOKEN não configurado' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { compromisso_id } = await req.json();

      const { data: compromisso, error } = await supabase
        .from('compromissos')
        .select('*')
        .eq('id', compromisso_id)
        .single();

      if (error || !compromisso) {
        return new Response(JSON.stringify({ error: 'Compromisso não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const advboxEvent = {
        titulo: compromisso.titulo,
        descricao: compromisso.descricao,
        data_inicio: compromisso.data_inicio,
        data_fim: compromisso.data_fim,
        tipo: compromisso.tipo,
      };

      const advboxResponse = await fetch('https://api.advbox.com.br/v1/agenda', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADVBOX_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(advboxEvent),
      });

      if (!advboxResponse.ok) {
        const errorText = await advboxResponse.text();
        console.error('Error pushing to Advbox:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Erro ao criar evento no Advbox',
          details: errorText
        }), {
          status: advboxResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const createdEvent = await advboxResponse.json();
      console.log('Created Advbox event:', createdEvent.id);

      return new Response(JSON.stringify({ 
        success: true, 
        advbox_event_id: createdEvent.id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in calendar-sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
