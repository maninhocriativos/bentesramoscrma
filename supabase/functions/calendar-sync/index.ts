import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADVBOX_TOKEN = Deno.env.get('ADVBOX_TOKEN');
const ADVBOX_API_URL = 'https://app.advbox.com.br/api/v1';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Advbox uses /posts endpoint for tasks/agenda items - real structure from API
interface AdvboxPost {
  id: number;
  task?: string;           // Title of the task
  notes?: string;          // Description/notes
  date?: string;           // Main date (e.g., "2019-03-08 00:00:00")
  date_deadline?: string;  // Deadline date
  reward?: string | null;
  local?: string | null;
  lawsuits_id?: number;
  created_at?: string;
  lawsuit?: {
    id: number;
    process_number?: string;
    customers?: Array<{ name: string; customer_id: number }>;
  };
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
    const body = await req.json();
    const { action, google_access_token, sync_from, sync_to, compromisso_id } = body;

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

      console.log('Fetching tasks/posts from Advbox with pagination...');
      console.log('Using Advbox API URL:', ADVBOX_API_URL);
      
      let allPosts: AdvboxPost[] = [];
      let offset = 0;
      const limit = 500; // Fetch 500 at a time
      let totalCount = 0;
      let hasMore = true;
      
      // Paginate through all results
      while (hasMore) {
        const advboxUrl = `${ADVBOX_API_URL}/posts?offset=${offset}&limit=${limit}`;
        console.log(`Fetching page: offset=${offset}, limit=${limit}`);
        
        const advboxResponse = await fetch(advboxUrl, {
          headers: {
            'Authorization': `Bearer ${ADVBOX_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!advboxResponse.ok) {
          const errorText = await advboxResponse.text();
          console.error('Advbox API error:', advboxResponse.status, errorText);
          return new Response(JSON.stringify({ 
            error: `Erro ao buscar tarefas do Advbox: ${advboxResponse.status}`,
            details: errorText,
            url_used: advboxUrl
          }), {
            status: advboxResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const responseText = await advboxResponse.text();
        
        try {
          const parsed = JSON.parse(responseText);
          
          // Get total count from first response
          if (offset === 0) {
            totalCount = parsed.totalCount || 0;
            console.log(`Total records in Advbox: ${totalCount}`);
          }
          
          // Handle different response formats
          const posts = Array.isArray(parsed) ? parsed : (parsed.data || parsed.items || parsed.posts || []);
          allPosts = allPosts.concat(posts);
          
          console.log(`Fetched ${posts.length} posts (total so far: ${allPosts.length})`);
          
          // Check if there are more records
          if (posts.length < limit || allPosts.length >= totalCount) {
            hasMore = false;
          } else {
            offset += limit;
          }
        } catch (parseError) {
          console.error('Error parsing Advbox response:', parseError);
          return new Response(JSON.stringify({ 
            error: 'Erro ao processar resposta do Advbox',
            details: responseText.substring(0, 200)
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      console.log(`Total fetched from Advbox: ${allPosts.length} of ${totalCount}`);

      // Prepare all compromissos for batch upsert
      const compromissosToUpsert = allPosts.map(post => {
        let titulo = post.task || 'Tarefa sem título';
        if (post.lawsuit?.process_number) {
          titulo = `${titulo} - ${post.lawsuit.process_number}`;
        }
        
        return {
          external_id: `advbox_${post.id}`,
          titulo,
          descricao: post.notes || null,
          data_inicio: post.date || post.date_deadline || post.created_at || new Date().toISOString(),
          data_fim: post.date_deadline || null,
          tipo: 'Reunião',
          origem: 'advbox',
        };
      });

      // Batch upsert in chunks of 100
      const chunkSize = 100;
      let syncedCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < compromissosToUpsert.length; i += chunkSize) {
        const chunk = compromissosToUpsert.slice(i, i + chunkSize);
        console.log(`Upserting batch ${Math.floor(i/chunkSize) + 1}/${Math.ceil(compromissosToUpsert.length/chunkSize)} (${chunk.length} items)`);
        
        const { error } = await supabase
          .from('compromissos')
          .upsert(chunk, { 
            onConflict: 'external_id',
            ignoreDuplicates: false 
          });
        
        if (error) {
          console.error('Error upserting batch:', error);
          errorCount += chunk.length;
        } else {
          syncedCount += chunk.length;
        }
      }
      
      console.log(`Synced ${syncedCount} posts from Advbox, ${errorCount} errors`);

      return new Response(JSON.stringify({ 
        success: true, 
        synced: syncedCount,
        total_fetched: allPosts.length,
        total_available: totalCount,
        errors: errorCount,
        message: `${syncedCount} tarefas sincronizadas do Advbox (${allPosts.length} de ${totalCount})${errorCount > 0 ? `, ${errorCount} erros` : ''}`
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

      if (!compromisso_id) {
        return new Response(JSON.stringify({ 
          error: 'ID do compromisso não fornecido' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Pushing compromisso to Google Calendar:', compromisso_id);

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

      if (!compromisso_id) {
        return new Response(JSON.stringify({ 
          error: 'ID do compromisso não fornecido' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Pushing compromisso to Advbox:', compromisso_id);

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

      // Map to Advbox post format
      const advboxPost = {
        title: compromisso.titulo,
        description: compromisso.descricao,
        due_date: compromisso.data_inicio,
        start_date: compromisso.data_inicio,
        end_date: compromisso.data_fim,
      };

      const advboxResponse = await fetch(`${ADVBOX_API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADVBOX_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(advboxPost),
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
