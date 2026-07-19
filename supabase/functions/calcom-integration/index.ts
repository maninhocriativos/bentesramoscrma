// Agendamento de consultas (presencial/online) — 100% no nosso próprio
// sistema (tabela `compromissos`), sem depender de nenhum provedor externo de
// agenda. O nome do arquivo/function ficou de um Cal.com que era usado antes
// (API quebrada há meses) — mantido só pra não precisar atualizar os outros
// callers (isa-actions, isa-auto-process, AgendarConsultaModal) que já
// dependem do formato de resposta daqui, não de como ela é gerada.
//
// Consultas ONLINE usam uma sala de vídeo fixa reutilizável (não dá pra gerar
// um link de Google Meet único por consulta sem Google Workspace + Domain-Wide
// Delegation, que este projeto não tem — testado e confirmado nesta sessão).
const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";
import { toZonedTime, fromZonedTime } from "npm:date-fns-tz@3";
import { addDays, addWeeks, format, getDay } from "npm:date-fns@3";
import { ptBR } from "npm:date-fns@3/locale";
import { resolveInstanceForLead } from "../_shared/zapi-helper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TIMEZONE = 'America/Manaus';

// Mesmo endereço usado no timbre das petições (src/lib/petitionFooter.ts).
const ENDERECO_ESCRITORIO = 'Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040';

// Sala de vídeo fixa e reutilizável para consultas online — não precisa de
// conta/API nenhuma (Jitsi Meet é gratuito e funciona só com a URL). Como o
// índice único uq_compromissos_slot_consulta já impede dois agendamentos no
// mesmo horário, a sala nunca tem duas consultas simultâneas nela.
const LINK_REUNIAO_ONLINE = 'https://meet.jit.si/BentesRamosAdvocacia-ConsultaJuridica';

// Dias permitidos: 1=Segunda, 3=Quarta, 5=Sexta
const DIAS_PERMITIDOS = [1, 3, 5];
const NOMES_DIAS: Record<number, string> = {
  1: 'Segunda-feira',
  3: 'Quarta-feira',
  5: 'Sexta-feira',
};

// Horários permitidos (hora de início, fuso de Manaus)
const HORARIOS_DISPONIVEIS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

// Resolve a instância Z-API correta (regra tráfego/escritório) a partir de um
// leadId OU de um subscriberId do chat (quando ainda não há lead vinculado).
async function resolverZapiInstanceId(
  supabase: any,
  leadId?: string | null,
  subscriberId?: string | null,
): Promise<string | undefined> {
  if (leadId) {
    const { data: lead } = await supabase
      .from('leads_juridicos')
      .select('linha_whatsapp, tipo_origem')
      .eq('id', leadId)
      .maybeSingle();
    if (lead) return await resolveInstanceForLead(supabase, lead);
  }
  if (subscriberId) {
    const { data: subscriber } = await supabase
      .from('manychat_subscribers')
      .select('linha_whatsapp')
      .eq('subscriber_id', subscriberId)
      .maybeSingle();
    if (subscriber) return await resolveInstanceForLead(supabase, { linha_whatsapp: subscriber.linha_whatsapp });
  }
  return undefined;
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

// Gera os horários disponíveis a partir da regra fixa de dias/horários do
// escritório — não depende de nenhuma API externa. A exclusão dos horários já
// ocupados (por outra consulta, presencial ou online) é feita depois, contra
// `compromissos`.
function gerarSlots(startTime: string, endTime: string): Array<{ label: string; short: string; datetime: string }> {
  const resultado: Array<{ label: string; short: string; datetime: string }> = [];
  const agora = new Date();
  let cursor = toZonedTime(new Date(startTime), TIMEZONE);
  const fim = new Date(endTime);

  while (cursor <= fim && resultado.length < 30) {
    const diaSemana = getDay(cursor);
    if (DIAS_PERMITIDOS.includes(diaSemana)) {
      const diaStr = format(cursor, 'yyyy-MM-dd');
      for (const hora of HORARIOS_DISPONIVEIS) {
        // Constrói o horário como hora LOCAL de Manaus (não do servidor) e
        // converte pra UTC de verdade — evita slots saindo com o horário
        // errado por confundir fuso do servidor com fuso de Manaus.
        const slotUtc = fromZonedTime(`${diaStr}T${hora}:00`, TIMEZONE);
        if (slotUtc > agora) {
          resultado.push(formatarSlotParaExibicao(slotUtc.toISOString()));
        }
      }
    }
    cursor = addDays(cursor, 1);
  }

  return resultado.slice(0, 12);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    console.log('=== Agendamento (calcom-integration) ===');
    console.log('Action:', action);
    console.log('Params:', JSON.stringify(params, null, 2));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ========================================
    // ACTION: buscar_horarios
    // ========================================
    if (action === 'buscar_horarios') {
      // Range de datas: próximas 3 semanas, começando da próxima semana.
      const hoje = new Date();
      const proximaSegunda = addDays(hoje, (8 - getDay(hoje)) % 7 || 7);
      const fimRange = addWeeks(proximaSegunda, 3);

      const startTime = proximaSegunda.toISOString();
      const endTime = fimRange.toISOString();

      const horariosBrutos = gerarSlots(startTime, endTime);

      // Exclui horários já ocupados em `compromissos` (qualquer modalidade).
      // Usa `hoje` (não `startTime`, que já é "próxima segunda no mesmo
      // horário do dia atual") como piso, pra não deixar escapar nada entre
      // agora e o início do range.
      const { data: ocupados } = await supabase
        .from('compromissos')
        .select('data_inicio')
        .not('modalidade', 'is', null)
        .neq('confirmacao_status', 'cancelado')
        .gte('data_inicio', hoje.toISOString())
        .lte('data_inicio', endTime);
      const ocupadosSet = new Set((ocupados || []).map((o: any) => new Date(o.data_inicio).toISOString()));
      const horariosFormatados = horariosBrutos.filter(h => !ocupadosSet.has(new Date(h.datetime).toISOString()));

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
      const { datetime, nome, telefone, leadId, subscriberId, modalidade = 'online' } = params;

      if (!datetime || !nome) {
        return new Response(
          JSON.stringify({ success: false, error: 'Dados obrigatórios: datetime, nome' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const zapiInstanceId = await resolverZapiInstanceId(supabase, leadId, subscriberId);

      const dataInicio = new Date(datetime).toISOString();
      const dataFim = new Date(new Date(datetime).getTime() + 60 * 60 * 1000).toISOString();
      const localReuniao = modalidade === 'presencial' ? ENDERECO_ESCRITORIO : LINK_REUNIAO_ONLINE;

      // Índice único uq_compromissos_slot_consulta garante atomicidade real
      // contra dois agendamentos (presencial ou online) no mesmo horário —
      // a checagem em buscar_horarios é só otimização de UX.
      const { data: compromisso, error: compromissoError } = await supabase
        .from('compromissos')
        .insert({
          titulo: `Consulta Jurídica (${modalidade === 'presencial' ? 'Presencial' : 'Online'}) - ${nome}`,
          tipo: 'Reunião',
          modalidade,
          local_reuniao: localReuniao,
          data_inicio: dataInicio,
          data_fim: dataFim,
          descricao: modalidade === 'presencial'
            ? `Agendamento presencial via chat/CRM.\n\nLocal: ${localReuniao}`
            : `Agendamento online via chat/CRM.\n\nSala de vídeo: ${localReuniao}`,
          lead_id: leadId || null,
          nome_contato: nome,
          telefone_contato: telefone || null,
          subscriber_id: subscriberId || null,
          zapi_instance_id: zapiInstanceId || null,
          origem: 'crm',
          confirmacao_status: 'confirmado',
          confirmado_em: new Date().toISOString(),
        })
        .select()
        .single();

      if (compromissoError) {
        console.error('Erro ao criar compromisso:', compromissoError);
        if (compromissoError.code === '23505') {
          return new Response(
            JSON.stringify({ success: false, error: 'Esse horário acabou de ser reservado. Por favor, escolha outro.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: 'Não foi possível criar o agendamento.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Registrar interação
      if (leadId) {
        await supabase.from('interacoes').insert({
          cliente_id: leadId,
          tipo: 'Agendamento',
          resumo: `Consulta ${modalidade === 'presencial' ? 'presencial' : 'online'} agendada para ${format(new Date(dataInicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
          detalhes: `Agendamento criado diretamente no CRM.`,
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
        acao: modalidade === 'presencial' ? 'agendamento_presencial_criado' : 'agendamento_online_criado',
        fonte: 'crm',
        lead_id: leadId || null,
        entidade_tipo: 'compromisso',
        entidade_id: compromisso?.id,
        dados: {
          start: dataInicio,
          end: dataFim,
          local_reuniao: localReuniao,
          modalidade,
          subscriber_id: subscriberId,
        },
      });

      // Formatar data para exibição
      const dataFormatada = format(
        toZonedTime(new Date(dataInicio), TIMEZONE),
        "EEEE, dd 'de' MMMM 'às' HH:mm",
        { locale: ptBR }
      );

      const mensagem = modalidade === 'presencial'
        ? `✅ Agendamento confirmado para ${dataFormatada}!\n\n📍 Local: ${localReuniao}`
        : `✅ Agendamento confirmado para ${dataFormatada}!\n\n📹 Link da reunião: ${localReuniao}`;

      return new Response(
        JSON.stringify({
          success: true,
          booking: {
            id: compromisso.id,
            uid: compromisso.id,
            start: dataInicio,
            end: dataFim,
            dataFormatada,
            ...(modalidade === 'online' ? { meetingUrl: localReuniao } : {}),
          },
          modalidade,
          localReuniao,
          compromisso_id: compromisso?.id,
          mensagem,
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

      const date = new Date(datetime);
      const zonedDate = toZonedTime(date, TIMEZONE);
      const diaSemana = getDay(zonedDate);
      const hora = format(zonedDate, 'HH:mm');

      const diaEHoraPermitidos = DIAS_PERMITIDOS.includes(diaSemana) && HORARIOS_DISPONIVEIS.includes(hora);

      let disponivel = false;
      if (diaEHoraPermitidos) {
        const { data: ocupado } = await supabase
          .from('compromissos')
          .select('id')
          .not('modalidade', 'is', null)
          .neq('confirmacao_status', 'cancelado')
          .eq('data_inicio', date.toISOString())
          .maybeSingle();
        disponivel = !ocupado;
      }

      let horariosAlternativos: Array<{ label: string; short: string; datetime: string }> = [];
      if (!disponivel) {
        const startOfDayDate = new Date(date);
        startOfDayDate.setHours(0, 0, 0, 0);
        const endOfDayDate = new Date(date);
        endOfDayDate.setHours(23, 59, 59, 999);
        const horariosDoDia = gerarSlots(startOfDayDate.toISOString(), endOfDayDate.toISOString());

        const { data: ocupados } = await supabase
          .from('compromissos')
          .select('data_inicio')
          .not('modalidade', 'is', null)
          .neq('confirmacao_status', 'cancelado')
          .gte('data_inicio', startOfDayDate.toISOString())
          .lte('data_inicio', endOfDayDate.toISOString());
        const ocupadosSet = new Set((ocupados || []).map((o: any) => new Date(o.data_inicio).toISOString()));
        horariosAlternativos = horariosDoDia.filter(h => !ocupadosSet.has(new Date(h.datetime).toISOString())).slice(0, 3);
      }

      return new Response(
        JSON.stringify({
          success: true,
          disponivel,
          horarios_alternativos: horariosAlternativos,
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
