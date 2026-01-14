import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { formatInTimeZone, toZonedTime } from "npm:date-fns-tz@3";
import { addDays, format, addWeeks, getDay } from "npm:date-fns@3";
import { ptBR } from "npm:date-fns@3/locale";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CALCOM_API_KEY = Deno.env.get('CALCOM_API_KEY');
const CALCOM_API_V1 = 'https://api.cal.com/v1';
const CALCOM_API_V2 = 'https://api.cal.com/v2';
const TIMEZONE = 'America/Manaus';

// Configuração do evento - substitua pelo seu
const CALCOM_USERNAME = 'bentes-ramos-advocacia-1ucmau';
const CALCOM_EVENT_SLUG = 'agendamentos-crm';

// Dias permitidos: 1=Segunda, 3=Quarta, 5=Sexta
const DIAS_PERMITIDOS = [1, 3, 5];
const NOMES_DIAS: Record<number, string> = {
  1: 'Segunda-feira',
  3: 'Quarta-feira',
  5: 'Sexta-feira',
};

// Horários permitidos (hora de início)
const HORARIOS_DISPONIVEIS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

interface CalComSlot {
  time: string;
}

interface CalComSlotsV1Response {
  slots: Record<string, CalComSlot[]>;
}

interface CalComBookingResponse {
  status: string;
  data: {
    id: number;
    uid: string;
    title: string;
    status: string;
    start: string;
    end: string;
    duration: number;
    eventTypeId: number;
    meetingUrl?: string;
    attendees?: Array<{
      name: string;
      email: string;
      timeZone: string;
    }>;
  };
}

// Buscar Event Type ID usando API v1
async function getEventTypeId(): Promise<number | null> {
  try {
    // API v1 usa apiKey como query param
    const url = `${CALCOM_API_V1}/event-types?apiKey=${CALCOM_API_KEY}`;
    console.log('Buscando event types v1...');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log('Resposta event-types v1:', response.status, responseText.substring(0, 500));

    if (!response.ok) {
      console.error('Erro ao buscar event types v1:', response.status);
      return null;
    }

    const data = JSON.parse(responseText);
    console.log('Event types encontrados:', data.event_types?.length || 0);
    
    // Buscar pelo slug ou retornar o primeiro
    const eventTypes = data.event_types || [];
    const eventType = eventTypes.find((et: any) => et.slug === CALCOM_EVENT_SLUG) || eventTypes[0];
    
    if (eventType) {
      console.log('Event type selecionado:', eventType.id, eventType.slug, eventType.title);
    }
    
    return eventType?.id || null;
  } catch (error) {
    console.error('Erro ao buscar event type:', error);
    return null;
  }
}

// Buscar slots disponíveis usando API v1
async function getAvailableSlots(eventTypeId: number, startTime: string, endTime: string): Promise<CalComSlotsV1Response | null> {
  try {
    const url = new URL(`${CALCOM_API_V1}/slots`);
    url.searchParams.set('apiKey', CALCOM_API_KEY || '');
    url.searchParams.set('eventTypeId', eventTypeId.toString());
    url.searchParams.set('startTime', startTime);
    url.searchParams.set('endTime', endTime);

    console.log('Buscando slots v1:', url.toString().replace(CALCOM_API_KEY || '', '***'));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log('Resposta slots v1:', response.status, responseText.substring(0, 500));

    if (!response.ok) {
      console.error('Erro ao buscar slots:', response.status);
      return null;
    }

    const data = JSON.parse(responseText);
    return data as CalComSlotsV1Response;
  } catch (error) {
    console.error('Erro ao buscar slots:', error);
    return null;
  }
}

// Criar booking usando API v2 (mais moderna para bookings)
async function createBooking(
  eventTypeId: number,
  startTime: string,
  attendeeName: string,
  attendeeEmail: string,
  attendeePhone?: string,
  notes?: string
): Promise<CalComBookingResponse | null> {
  try {
    const bookingData: any = {
      start: startTime,
      eventTypeId: eventTypeId,
      attendee: {
        name: attendeeName,
        email: attendeeEmail,
        timeZone: TIMEZONE,
        language: 'pt-BR',
      },
    };

    if (attendeePhone) {
      bookingData.attendee.phoneNumber = attendeePhone;
    }

    if (notes) {
      bookingData.bookingFieldsResponses = {
        notes: notes,
      };
    }

    console.log('Criando booking v2:', JSON.stringify(bookingData, null, 2));

    const response = await fetch(`${CALCOM_API_V2}/bookings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CALCOM_API_KEY}`,
        'cal-api-version': '2024-08-13',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData),
    });

    const responseText = await response.text();
    console.log('Resposta booking v2:', response.status, responseText.substring(0, 500));

    if (!response.ok) {
      // Tentar API v1 como fallback
      console.log('Tentando criar booking via v1...');
      return await createBookingV1(eventTypeId, startTime, attendeeName, attendeeEmail, attendeePhone, notes);
    }

    const data = JSON.parse(responseText);
    return data as CalComBookingResponse;
  } catch (error) {
    console.error('Erro ao criar booking v2:', error);
    // Tentar v1 como fallback
    return await createBookingV1(eventTypeId, startTime, attendeeName, attendeeEmail, attendeePhone, notes);
  }
}

// Fallback: Criar booking usando API v1
async function createBookingV1(
  eventTypeId: number,
  startTime: string,
  attendeeName: string,
  attendeeEmail: string,
  attendeePhone?: string,
  notes?: string
): Promise<CalComBookingResponse | null> {
  try {
    const bookingData = {
      eventTypeId,
      start: startTime,
      end: new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(),
      name: attendeeName,
      email: attendeeEmail,
      timeZone: TIMEZONE,
      language: 'pt-BR',
      metadata: notes ? { notes } : undefined,
    };

    console.log('Criando booking v1:', JSON.stringify(bookingData, null, 2));

    const url = `${CALCOM_API_V1}/bookings?apiKey=${CALCOM_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData),
    });

    const responseText = await response.text();
    console.log('Resposta booking v1:', response.status, responseText.substring(0, 500));

    if (!response.ok) {
      console.error('Erro ao criar booking v1:', response.status);
      return null;
    }

    const data = JSON.parse(responseText);
    // Adaptar resposta v1 para formato v2
    return {
      status: 'success',
      data: {
        id: data.id,
        uid: data.uid,
        title: data.title,
        status: data.status,
        start: data.startTime,
        end: data.endTime,
        duration: 60,
        eventTypeId: data.eventTypeId,
        meetingUrl: data.metadata?.videoCallUrl,
      }
    };
  } catch (error) {
    console.error('Erro ao criar booking v1:', error);
    return null;
  }
}

// Formatar horários para exibição
function formatarSlotParaExibicao(slotTime: string): { label: string; short: string; datetime: string } {
  const date = new Date(slotTime);
  const zonedDate = toZonedTime(date, TIMEZONE);
  
  const diaSemana = getDay(zonedDate);
  const nomeDia = NOMES_DIAS[diaSemana] || format(zonedDate, 'EEEE', { locale: ptBR });
  const dataFormatada = format(zonedDate, "dd/MM", { locale: ptBR });
  const horaFormatada = format(zonedDate, "HH:mm", { locale: ptBR });
  
  return {
    label: `${nomeDia}, ${dataFormatada} às ${horaFormatada}`,
    short: `${dataFormatada} ${horaFormatada}`,
    datetime: slotTime,
  };
}

// Filtrar slots para apenas os dias e horários permitidos
function filtrarSlotsPermitidos(slots: Record<string, CalComSlot[]>): Array<{ label: string; short: string; datetime: string }> {
  const resultado: Array<{ label: string; short: string; datetime: string }> = [];
  
  for (const [dateKey, daySlots] of Object.entries(slots)) {
    for (const slot of daySlots) {
      const slotTime = slot.time;
      const date = new Date(slotTime);
      const zonedDate = toZonedTime(date, TIMEZONE);
      const diaSemana = getDay(zonedDate);
      const hora = format(zonedDate, 'HH:mm');
      
      // Verificar se é um dia permitido
      if (!DIAS_PERMITIDOS.includes(diaSemana)) continue;
      
      // Verificar se é um horário permitido
      if (!HORARIOS_DISPONIVEIS.includes(hora)) continue;
      
      resultado.push(formatarSlotParaExibicao(slotTime));
    }
  }
  
  // Ordenar por data/hora
  resultado.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  
  // Limitar a 6 opções
  return resultado.slice(0, 6);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    console.log('=== Cal.com Integration ===');
    console.log('Action:', action);
    console.log('Params:', JSON.stringify(params, null, 2));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se API key está configurada
    if (!CALCOM_API_KEY) {
      console.error('CALCOM_API_KEY não configurada!');
      return new Response(
        JSON.stringify({ success: false, error: 'API Key do Cal.com não configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Buscar Event Type ID
    const eventTypeId = await getEventTypeId();
    if (!eventTypeId) {
      console.error('Event type não encontrado');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Event type não encontrado no Cal.com. Verifique se a API Key tem permissão e se o evento existe.',
          horarios: [] // Retornar array vazio para não quebrar o fluxo
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Event Type ID:', eventTypeId);

    // ========================================
    // ACTION: buscar_horarios
    // ========================================
    if (action === 'buscar_horarios') {
      // Calcular range de datas (próximas 3 semanas, começando da próxima semana)
      const hoje = new Date();
      const proximaSegunda = addDays(hoje, (8 - getDay(hoje)) % 7 || 7);
      const fimRange = addWeeks(proximaSegunda, 3);
      
      const startTime = proximaSegunda.toISOString();
      const endTime = fimRange.toISOString();

      console.log('Buscando horários de', startTime, 'até', endTime);

      const slotsResponse = await getAvailableSlots(eventTypeId, startTime, endTime);
      
      if (!slotsResponse || !slotsResponse.slots) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Não foi possível buscar horários disponíveis',
            horarios: []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const horariosFormatados = filtrarSlotsPermitidos(slotsResponse.slots);
      console.log('Horários formatados:', horariosFormatados.length);

      return new Response(
        JSON.stringify({ 
          success: true, 
          horarios: horariosFormatados,
          mensagem: horariosFormatados.length > 0 
            ? `Encontrei ${horariosFormatados.length} horários disponíveis para agendamento.`
            : 'Não há horários disponíveis no momento. Por favor, entre em contato conosco.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // ACTION: agendar
    // ========================================
    if (action === 'agendar') {
      const { datetime, nome, email, telefone, leadId, subscriberId, notas } = params;

      if (!datetime || !nome || !email) {
        return new Response(
          JSON.stringify({ success: false, error: 'Dados obrigatórios: datetime, nome, email' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Criar booking no Cal.com
      const booking = await createBooking(
        eventTypeId,
        datetime,
        nome,
        email,
        telefone,
        notas
      );

      if (!booking || booking.status !== 'success') {
        return new Response(
          JSON.stringify({ success: false, error: 'Não foi possível criar o agendamento no Cal.com' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      const bookingData = booking.data;

      // Criar compromisso no CRM
      const { data: compromisso, error: compromissoError } = await supabase
        .from('compromissos')
        .insert({
          titulo: `Consulta Jurídica - ${nome}`,
          tipo: 'Reunião',
          data_inicio: bookingData.start,
          data_fim: bookingData.end,
          descricao: `Agendamento via Cal.com.\n\nUID: ${bookingData.uid}\nDuração: ${bookingData.duration} min\n${bookingData.meetingUrl ? `Link: ${bookingData.meetingUrl}` : ''}`,
          lead_id: leadId || null,
          origem: 'cal.com',
          external_id: bookingData.uid,
          confirmacao_status: 'confirmado',
          confirmado_em: new Date().toISOString(),
        })
        .select()
        .single();

      if (compromissoError) {
        console.error('Erro ao criar compromisso:', compromissoError);
      }

      // Registrar interação
      if (leadId) {
        await supabase.from('interacoes').insert({
          cliente_id: leadId,
          tipo: 'Agendamento',
          resumo: `Consulta agendada via Cal.com para ${format(new Date(bookingData.start), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
          detalhes: `Agendamento criado automaticamente via API do Cal.com.\nUID: ${bookingData.uid}`,
          direcao: 'entrada',
          data_interacao: new Date().toISOString(),
        });

        // Atualizar status do lead
        const { data: lead } = await supabase
          .from('leads_juridicos')
          .select('status')
          .eq('id', leadId)
          .single();

        if (lead?.status === 'Lead Frio') {
          await supabase
            .from('leads_juridicos')
            .update({ status: 'Em Atendimento', updated_at: new Date().toISOString() })
            .eq('id', leadId);
        }
      }

      // Criar evento de sistema
      await supabase.from('system_events').insert({
        tipo: 'agendamento',
        acao: 'calcom_booking_created',
        fonte: 'cal.com',
        lead_id: leadId || null,
        entidade_tipo: 'compromisso',
        entidade_id: compromisso?.id,
        dados: {
          booking_id: bookingData.id,
          booking_uid: bookingData.uid,
          start: bookingData.start,
          end: bookingData.end,
          meeting_url: bookingData.meetingUrl,
          subscriber_id: subscriberId,
        },
      });

      // Formatar data para exibição
      const dataFormatada = format(
        toZonedTime(new Date(bookingData.start), TIMEZONE),
        "EEEE, dd 'de' MMMM 'às' HH:mm",
        { locale: ptBR }
      );

      return new Response(
        JSON.stringify({ 
          success: true, 
          booking: {
            id: bookingData.id,
            uid: bookingData.uid,
            start: bookingData.start,
            end: bookingData.end,
            meetingUrl: bookingData.meetingUrl,
            dataFormatada,
          },
          compromisso_id: compromisso?.id,
          mensagem: `✅ Agendamento confirmado para ${dataFormatada}!\n\nVocê receberá um e-mail de confirmação.${bookingData.meetingUrl ? `\n\n📹 Link da reunião: ${bookingData.meetingUrl}` : ''}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // ACTION: verificar_disponibilidade
    // ========================================
    if (action === 'verificar_disponibilidade') {
      const { datetime } = params;

      if (!datetime) {
        return new Response(
          JSON.stringify({ success: false, error: 'Data/hora obrigatória' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Buscar slots do dia específico
      const date = new Date(datetime);
      const startOfDayDate = new Date(date);
      startOfDayDate.setHours(0, 0, 0, 0);
      const endOfDayDate = new Date(date);
      endOfDayDate.setHours(23, 59, 59, 999);

      const slotsResponse = await getAvailableSlots(eventTypeId, startOfDayDate.toISOString(), endOfDayDate.toISOString());
      
      if (!slotsResponse || !slotsResponse.slots) {
        return new Response(
          JSON.stringify({ success: false, disponivel: false, error: 'Não foi possível verificar disponibilidade' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se o horário específico está disponível
      const horariosDisponiveis = filtrarSlotsPermitidos(slotsResponse.slots);
      const disponivel = horariosDisponiveis.some(h => h.datetime === datetime);

      return new Response(
        JSON.stringify({ 
          success: true, 
          disponivel,
          horarios_alternativos: disponivel ? [] : horariosDisponiveis.slice(0, 3),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação não reconhecida' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro na função calcom-integration:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
