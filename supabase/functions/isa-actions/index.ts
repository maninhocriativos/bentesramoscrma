import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { 
  formatarDataHora, 
  formatarData, 
  formatarHora, 
  getProximaSegundaUtc, 
  isDataNaProximaSemana, 
  getProximaSegundaFormatada,
  validarAgendamento,
  getProximosDiasDisponiveis,
  getSugestoesHorarios,
  HORARIOS_DISPONIVEIS,
  DIAS_PERMITIDOS,
  NOMES_DIAS
} from '../_shared/timezone-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Aliases para compatibilidade com código existente
const formatarDataHoraManaus = formatarDataHora;
const formatarDataManaus = formatarData;
const formatarHoraManaus = formatarHora;

// Função auxiliar para enviar email de notificação
async function enviarNotificacaoEmail(
  destinatarioEmail: string,
  destinatarioNome: string,
  assunto: string,
  conteudoHtml: string
) {
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY não configurada, notificação não enviada');
    return { success: false, message: 'API de email não configurada' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Isa - Assistente Bentes & Ramos <onboarding@resend.dev>',
        to: [destinatarioEmail],
        subject: assunto,
        html: conteudoHtml,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao enviar email:', errorText);
      return { success: false, message: 'Falha ao enviar notificação' };
    }

    console.log(`Email enviado para ${destinatarioEmail}`);
    return { success: true, message: 'Notificação enviada' };
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return { success: false, message: 'Erro ao enviar notificação' };
  }
}

// Templates de email
function gerarEmailTarefa(tarefa: any, responsavel: any, tipo: 'nova' | 'atualizada' | 'prazo') {
  const cores: Record<string, string> = {
    'Urgente': '#dc2626',
    'Alta': '#ea580c',
    'Media': '#ca8a04',
    'Baixa': '#16a34a'
  };
  const prioridadeCor = cores[tarefa.prioridade] || '#6b7280';

  const dataLimite = tarefa.data_limite 
    ? formatarDataManaus(tarefa.data_limite)
    : 'Não definida';

  const titulos = {
    nova: `🔔 Nova Tarefa Atribuída: ${tarefa.titulo}`,
    atualizada: `📝 Tarefa Atualizada: ${tarefa.titulo}`,
    prazo: `⚠️ Prazo se Aproximando: ${tarefa.titulo}`
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Bentes & Ramos Advogados</h1>
          <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px;">Sistema de Gestão Jurídica</p>
        </div>
        
        <div style="padding: 30px;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
            Olá <strong>${responsavel?.nome || 'Usuário'}</strong>,
          </p>
          
          <div style="background-color: #f1f5f9; border-left: 4px solid ${prioridadeCor}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">${tarefa.titulo}</h2>
            
            ${tarefa.descricao ? `<p style="color: #64748b; margin: 0 0 15px 0; font-size: 14px;">${tarefa.descricao}</p>` : ''}
            
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
              <div>
                <span style="color: #94a3b8; font-size: 12px; display: block;">Prioridade</span>
                <span style="color: ${prioridadeCor}; font-weight: 600;">${tarefa.prioridade}</span>
              </div>
              <div>
                <span style="color: #94a3b8; font-size: 12px; display: block;">Data Limite</span>
                <span style="color: #1e293b; font-weight: 600;">${dataLimite}</span>
              </div>
              <div>
                <span style="color: #94a3b8; font-size: 12px; display: block;">Status</span>
                <span style="color: #1e293b; font-weight: 600;">${tarefa.status}</span>
              </div>
            </div>
          </div>
          
          <p style="color: #64748b; font-size: 14px; margin: 0;">
            Acesse o sistema para mais detalhes e gerenciar suas tarefas.
          </p>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Esta é uma mensagem automática enviada por Isa, sua assistente virtual.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function gerarEmailCompromisso(compromisso: any, responsavel: any) {
  const dataInicio = formatarDataHoraManaus(compromisso.data_inicio);
  const dataFim = compromisso.data_fim 
    ? formatarDataHoraManaus(compromisso.data_fim)
    : null;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Bentes & Ramos Advogados</h1>
          <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px;">Sistema de Gestão Jurídica</p>
        </div>
        
        <div style="padding: 30px;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
            Olá <strong>${responsavel?.nome || 'Usuário'}</strong>,
          </p>
          
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">📅 ${compromisso.titulo}</h2>
            
            ${compromisso.descricao ? `<p style="color: #64748b; margin: 0 0 15px 0; font-size: 14px;">${compromisso.descricao}</p>` : ''}
            
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
              <div>
                <span style="color: #94a3b8; font-size: 12px; display: block;">Tipo</span>
                <span style="color: #1e293b; font-weight: 600;">${compromisso.tipo}</span>
              </div>
              <div>
                <span style="color: #94a3b8; font-size: 12px; display: block;">Início</span>
                <span style="color: #1e293b; font-weight: 600;">${dataInicio}</span>
              </div>
              ${dataFim ? `
              <div>
                <span style="color: #94a3b8; font-size: 12px; display: block;">Término</span>
                <span style="color: #1e293b; font-weight: 600;">${dataFim}</span>
              </div>
              ` : ''}
            </div>
          </div>
          
          <p style="color: #64748b; font-size: 14px; margin: 0;">
            Não se esqueça de adicionar ao seu calendário!
          </p>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Esta é uma mensagem automática enviada por Isa, sua assistente virtual.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, data } = await req.json();
    console.log('Isa Action:', action, data);

    let result: any = { success: false, message: 'Ação não reconhecida' };

    // Função auxiliar para buscar perfil do usuário
    async function buscarPerfil(userId: string) {
      const { data } = await supabase
        .from('perfis')
        .select('nome, email')
        .eq('id', userId)
        .single();
      return data;
    }

    switch (action) {
      case 'verificar_disponibilidade': {
        const { data: dataParam, hora_inicio, hora_fim } = data;
        
        // Validar data conforme regras de agendamento
        const dataVerificar = new Date(`${dataParam}T12:00:00-04:00`);
        const validacao = validarAgendamento(dataVerificar, hora_inicio);
        
        if (!validacao.valido) {
          result = {
            success: false,
            disponivel: false,
            message: `⚠️ ${validacao.motivo}`,
            data: {
              sugestoes: validacao.sugestoes,
              dias_disponiveis: getProximosDiasDisponiveis(3),
              horarios_validos: HORARIOS_DISPONIVEIS
            }
          };
          break;
        }
        
        // Construir range de busca para o dia inteiro ou horário específico
        const dataBase = dataParam; // YYYY-MM-DD
        let inicioRange: string;
        let fimRange: string;
        
        if (hora_inicio) {
          // Horário específico - buscar conflitos em janela de 2 horas
          inicioRange = `${dataBase}T${hora_inicio}:00-04:00`;
          const horaFimCalc = hora_fim || `${(parseInt(hora_inicio.split(':')[0]) + 1).toString().padStart(2, '0')}:00`;
          fimRange = `${dataBase}T${horaFimCalc}:00-04:00`;
        } else {
          // Dia inteiro - horário comercial 09:00 às 17:00
          inicioRange = `${dataBase}T09:00:00-04:00`;
          fimRange = `${dataBase}T17:00:00-04:00`;
        }
        
        // Buscar compromissos no range
        const { data: compromissos, error } = await supabase
          .from('compromissos')
          .select('id, titulo, tipo, data_inicio, data_fim, leads_juridicos(nome)')
          .gte('data_inicio', inicioRange)
          .lte('data_inicio', fimRange)
          .order('data_inicio', { ascending: true });
        
        if (error) {
          console.error('Erro ao verificar disponibilidade:', error);
          result = { success: false, message: `Erro ao verificar agenda: ${error.message}` };
        } else {
          const compromissosFormatados = (compromissos || []).map((c: any) => ({
            titulo: c.titulo,
            tipo: c.tipo,
            horario: formatarHoraManaus(c.data_inicio),
            horario_fim: c.data_fim ? formatarHoraManaus(c.data_fim) : null,
            cliente: c.leads_juridicos?.nome || null,
          }));
          
          const horariosOcupados = compromissosFormatados.map((c: any) => c.horario);
          const horariosLivres = getSugestoesHorarios(dataVerificar, horariosOcupados);
          const temConflito = hora_inicio && horariosOcupados.includes(hora_inicio);
          
          if (compromissos && compromissos.length === 0) {
            result = { 
              success: true, 
              disponivel: true,
              message: hora_inicio 
                ? `✅ Horário ${hora_inicio} está DISPONÍVEL em ${formatarDataManaus(dataBase)}.`
                : `✅ Agenda LIVRE em ${formatarDataManaus(dataBase)}. Horários disponíveis: ${HORARIOS_DISPONIVEIS.join(', ')}`,
              data: { 
                compromissos: [], 
                sugestao_horarios: HORARIOS_DISPONIVEIS,
                horarios_validos: HORARIOS_DISPONIVEIS
              }
            };
          } else {
            result = { 
              success: true, 
              disponivel: !temConflito,
              message: temConflito
                ? `⚠️ CONFLITO: Já existe compromisso às ${hora_inicio} em ${formatarDataManaus(dataBase)}. Horários livres: ${horariosLivres.join(', ') || 'Nenhum'}`
                : `📅 Agenda de ${formatarDataManaus(dataBase)}: ${compromissos?.length} compromisso(s). Horários livres: ${horariosLivres.join(', ') || 'Nenhum'}`,
              data: { 
                compromissos: compromissosFormatados,
                horarios_ocupados: horariosOcupados,
                horarios_livres: horariosLivres,
                horarios_validos: HORARIOS_DISPONIVEIS
              }
            };
          }
        }
        break;
      }

      case 'criar_compromisso': {
        const { titulo, tipo, data_inicio, data_fim, descricao, lead_id, processo_id, responsavel_id } = data;
        
        const horaInicio = new Date(data_inicio);
        const horaStr = formatarHoraManaus(horaInicio);
        
        // Se tem lead_id, é atendimento e deve respeitar todas as regras
        if (lead_id) {
          const validacao = validarAgendamento(horaInicio, horaStr);
          if (!validacao.valido) {
            console.log(`⚠️ Compromisso com lead rejeitado: ${validacao.motivo}`);
            result = {
              success: false,
              message: `⚠️ POLÍTICA DE AGENDAMENTO: ${validacao.motivo}`,
              data: { 
                sugestoes: validacao.sugestoes,
                dias_disponiveis: getProximosDiasDisponiveis(3)
              }
            };
            break;
          }
        }
        
        const horaFim = data_fim ? new Date(data_fim) : new Date(horaInicio.getTime() + 60 * 60 * 1000); // +1h padrão
        
        const { data: conflitos } = await supabase
          .from('compromissos')
          .select('id, titulo, data_inicio')
          .gte('data_inicio', new Date(horaInicio.getTime() - 60 * 60 * 1000).toISOString()) // 1h antes
          .lte('data_inicio', horaFim.toISOString())
          .limit(1);
        
        if (conflitos && conflitos.length > 0) {
          const conflito = conflitos[0];
          console.log('⚠️ Conflito de horário detectado:', conflito);
          result = { 
            success: false, 
            message: `⚠️ CONFLITO: Já existe "${conflito.titulo}" agendado às ${formatarHoraManaus(conflito.data_inicio)}. Use verificar_disponibilidade para encontrar um horário livre.` 
          };
          break;
        }
        
        const { data: compromisso, error } = await supabase
          .from('compromissos')
          .insert({
            titulo,
            tipo: tipo || 'Reunião',
            data_inicio,
            data_fim,
            descricao,
            lead_id,
            processo_id,
            responsavel_id,
          })
          .select()
          .single();

        if (error) {
          console.error('Erro ao criar compromisso:', error);
          result = { success: false, message: `Erro ao criar compromisso: ${error.message}` };
        } else {
          // Enviar notificação ao responsável se definido
          if (responsavel_id) {
            const responsavel = await buscarPerfil(responsavel_id);
            if (responsavel?.email) {
              const emailHtml = gerarEmailCompromisso(compromisso, responsavel);
              await enviarNotificacaoEmail(
                responsavel.email,
                responsavel.nome || 'Usuário',
                `📅 Novo Compromisso: ${titulo}`,
                emailHtml
              );
            }
          }
          result = { success: true, message: `Compromisso "${titulo}" criado com sucesso para ${formatarDataHoraManaus(data_inicio)} (horário de Manaus). ${responsavel_id ? 'Notificação enviada ao responsável.' : ''}`, data: compromisso };
        }
        break;
      }

      case 'agendar_atendimento': {
        const { lead_id, lead_nome, data_inicio, data_fim, descricao, responsavel_id } = data;

        if (!lead_id) {
          result = { success: false, message: 'lead_id não informado para agendar atendimento' };
          break;
        }

        // Validar completamente o agendamento
        const dataAgendamento = new Date(data_inicio);
        const horaStr = formatarHoraManaus(dataAgendamento);
        const validacao = validarAgendamento(dataAgendamento, horaStr);
        
        if (!validacao.valido) {
          console.log(`⚠️ Agendamento rejeitado: ${validacao.motivo}`);
          result = {
            success: false,
            message: `⚠️ POLÍTICA DE AGENDAMENTO: ${validacao.motivo}`,
            data: { 
              sugestoes: validacao.sugestoes,
              dias_disponiveis: getProximosDiasDisponiveis(3),
              horarios_validos: HORARIOS_DISPONIVEIS
            }
          };
          break;
        }

        // Verificar se já existe compromisso futuro para este lead
        const agora = new Date().toISOString();
        const { data: compromissosExistentes } = await supabase
          .from('compromissos')
          .select('id, titulo, data_inicio')
          .eq('lead_id', lead_id)
          .gte('data_inicio', agora)
          .order('data_inicio', { ascending: true })
          .limit(1);

        if (compromissosExistentes && compromissosExistentes.length > 0) {
          const existente = compromissosExistentes[0];
          console.log(`⚠️ Lead ${lead_id} já possui compromisso agendado: ${existente.titulo} em ${existente.data_inicio}`);
          result = {
            success: false,
            message: `Este lead já possui um atendimento agendado: "${existente.titulo}" para ${formatarDataHoraManaus(existente.data_inicio)}. Verifique a agenda antes de criar novo agendamento.`,
            data: { compromisso_existente: existente },
          };
          break;
        }

        // Verificar conflito de horário na agenda geral
        const horaInicio = new Date(data_inicio);
        const horaFim = data_fim ? new Date(data_fim) : new Date(horaInicio.getTime() + 60 * 60 * 1000);
        
        const { data: conflitos } = await supabase
          .from('compromissos')
          .select('id, titulo, data_inicio, leads_juridicos(nome)')
          .gte('data_inicio', new Date(horaInicio.getTime() - 60 * 60 * 1000).toISOString())
          .lte('data_inicio', horaFim.toISOString())
          .limit(1);
        
        if (conflitos && conflitos.length > 0) {
          const conflito = conflitos[0] as any;
          const clienteConflito = conflito.leads_juridicos?.nome || 'outro cliente';
          console.log('⚠️ Conflito de horário detectado para atendimento:', conflito);
          result = { 
            success: false, 
            message: `⚠️ CONFLITO DE HORÁRIO: Já existe atendimento com ${clienteConflito} às ${formatarHoraManaus(conflito.data_inicio)}. Use verificar_disponibilidade para encontrar um horário livre antes de propor ao cliente.` 
          };
          break;
        }

        const titulo = data.titulo || `Atendimento - ${lead_nome || 'Lead'}`;

        const { data: compromisso, error } = await supabase
          .from('compromissos')
          .insert({
            titulo,
            tipo: 'Atendimento',
            data_inicio,
            data_fim,
            descricao,
            lead_id,
            responsavel_id,
          })
          .select()
          .single();

        if (error) {
          console.error('Erro ao agendar atendimento:', error);
          result = { success: false, message: `Erro ao agendar atendimento: ${error.message}` };
        } else {
          // Enviar notificação ao responsável se definido
          if (responsavel_id) {
            const responsavel = await buscarPerfil(responsavel_id);
            if (responsavel?.email) {
              const emailHtml = gerarEmailCompromisso(compromisso, responsavel);
              await enviarNotificacaoEmail(
                responsavel.email,
                responsavel.nome || 'Usuário',
                `📅 Atendimento agendado: ${titulo}`,
                emailHtml
              );
            }
          }

          result = {
            success: true,
            message: `Atendimento "${titulo}" agendado com sucesso para ${formatarDataHoraManaus(data_inicio)} (horário de Manaus). ${responsavel_id ? 'Notificação enviada ao responsável.' : ''}`,
            data: compromisso,
          };
        }

        break;
      }

      case 'criar_tarefa': {
        const { titulo, descricao, data_limite, prioridade, cliente_id, processo_id, responsavel_id } = data;
        
        const { data: tarefa, error } = await supabase
          .from('tarefas')
          .insert({
            titulo,
            descricao,
            data_limite,
            prioridade: prioridade || 'Media',
            status: 'Pendente',
            cliente_id,
            processo_id,
            responsavel_id,
          })
          .select()
          .single();

        if (error) {
          console.error('Erro ao criar tarefa:', error);
          result = { success: false, message: `Erro ao criar tarefa: ${error.message}` };
        } else {
          // Enviar notificação ao responsável se definido
          let notificacaoEnviada = false;
          if (responsavel_id) {
            const responsavel = await buscarPerfil(responsavel_id);
            if (responsavel?.email) {
              const emailHtml = gerarEmailTarefa(tarefa, responsavel, 'nova');
              const emailResult = await enviarNotificacaoEmail(
                responsavel.email,
                responsavel.nome || 'Usuário',
                `🔔 Nova Tarefa: ${titulo}`,
                emailHtml
              );
              notificacaoEnviada = emailResult.success;
            }
          }
          
          // Criar notificação de prazo se houver data limite
          if (data_limite && responsavel_id) {
            await supabase.from('notificacoes_prazos').insert({
              tarefa_id: tarefa.id,
              titulo: `Prazo: ${titulo}`,
              tipo: 'tarefa',
              data_prazo: data_limite,
              destinatario_id: responsavel_id,
              dias_antecedencia: 3,
            });
          }
          
          result = { 
            success: true, 
            message: `Tarefa "${titulo}" criada com sucesso${notificacaoEnviada ? '. Notificação enviada ao responsável.' : '.'}`, 
            data: tarefa 
          };
        }
        break;
      }

      case 'notificar_prazos_proximos': {
        // Buscar tarefas com prazo nos próximos 3 dias
        const hoje = new Date();
        const tresDias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000);
        
        const { data: tarefas, error } = await supabase
          .from('tarefas')
          .select('*, perfis!tarefas_responsavel_id_fkey(nome, email)')
          .lte('data_limite', tresDias.toISOString().split('T')[0])
          .gte('data_limite', hoje.toISOString().split('T')[0])
          .in('status', ['Pendente', 'Em Andamento'])
          .not('responsavel_id', 'is', null);

        if (error) {
          result = { success: false, message: `Erro ao buscar tarefas: ${error.message}` };
          break;
        }

        let notificacoesEnviadas = 0;
        for (const tarefa of tarefas || []) {
          const responsavel = tarefa.perfis;
          if (responsavel?.email) {
            const emailHtml = gerarEmailTarefa(tarefa, responsavel, 'prazo');
            const emailResult = await enviarNotificacaoEmail(
              responsavel.email,
              responsavel.nome || 'Usuário',
              `⚠️ Prazo se Aproxima: ${tarefa.titulo}`,
              emailHtml
            );
            if (emailResult.success) notificacoesEnviadas++;
          }
        }

        result = { 
          success: true, 
          message: `${notificacoesEnviadas} notificação(ões) de prazo enviada(s)`,
          data: { total: tarefas?.length || 0, enviadas: notificacoesEnviadas }
        };
        break;
      }

      case 'buscar_contratos_clicksign': {
        const clicksignApiKey = Deno.env.get('CLICKSIGN_API_KEY');
        if (!clicksignApiKey) {
          result = { success: false, message: 'Chave da API do Clicksign não configurada' };
          break;
        }

        try {
          const response = await fetch(`https://app.clicksign.com/api/v1/documents?access_token=${clicksignApiKey}&page=1`, {
            method: 'GET',
          });

          if (!response.ok) {
            throw new Error('Falha ao buscar documentos do Clicksign');
          }

          const clicksignData = await response.json();
          const documents = clicksignData.documents || [];
          
          const mapStatus = (doc: any): string => {
            if (doc.status === 'closed') return 'Finalizado';
            if (doc.status === 'canceled') return 'Cancelado';
            if (doc.status === 'running') {
              const signers = doc.signers || [];
              const allSigned = signers.length > 0 && signers.every((s: any) => s.signed_at);
              const anySigned = signers.some((s: any) => s.signed_at);
              if (allSigned) return 'Assinado';
              if (anySigned) return 'Assinatura Parcial';
              return 'Aguardando Assinatura';
            }
            return 'Documento Enviado';
          };

          const contratos = documents.map((doc: any) => ({
            nome: doc.filename?.replace(/\.[^/.]+$/, '') || 'Documento',
            status: mapStatus(doc),
            signatarios: doc.signers?.map((s: any) => ({
              nome: s.name,
              email: s.email,
              assinou: !!s.signed_at,
              dataAssinatura: s.signed_at
            })) || [],
            dataEnvio: doc.created_at,
            dataAtualizacao: doc.updated_at,
          }));

          const pendentes = contratos.filter((c: any) => ['Aguardando Assinatura', 'Assinatura Parcial'].includes(c.status));
          const finalizados = contratos.filter((c: any) => ['Assinado', 'Finalizado'].includes(c.status));

          result = { 
            success: true, 
            message: `Encontrados ${contratos.length} contratos: ${pendentes.length} pendentes de assinatura, ${finalizados.length} finalizados`,
            data: { total: contratos.length, pendentes, finalizados, todos: contratos }
          };
        } catch (e) {
          console.error('Erro ao buscar contratos:', e);
          result = { success: false, message: 'Erro ao conectar com Clicksign' };
        }
        break;
      }

      case 'buscar_lead': {
        const { nome, email, telefone } = data;
        
        let query = supabase.from('leads_juridicos').select('*');
        
        if (nome) query = query.ilike('nome', `%${nome}%`);
        if (email) query = query.ilike('email', `%${email}%`);
        if (telefone) query = query.ilike('telefone', `%${telefone}%`);
        
        const { data: leads, error } = await query.limit(10);

        if (error) {
          result = { success: false, message: `Erro ao buscar lead: ${error.message}` };
        } else if (leads && leads.length > 0) {
          result = { success: true, message: `Encontrado(s) ${leads.length} lead(s)`, data: leads };
        } else {
          result = { success: true, message: 'Nenhum lead encontrado com esses critérios', data: [] };
        }
        break;
      }

      case 'criar_interacao': {
        const { cliente_id, tipo, resumo, detalhes, direcao } = data;
        
        const { data: interacao, error } = await supabase
          .from('interacoes')
          .insert({
            cliente_id,
            tipo,
            resumo,
            detalhes,
            direcao: direcao || 'Saída',
            data_interacao: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          result = { success: false, message: `Erro ao registrar interação: ${error.message}` };
        } else {
          result = { success: true, message: 'Interação registrada com sucesso', data: interacao };
        }
        break;
      }

      case 'listar_compromissos': {
        const { data_inicio, data_fim } = data;
        
        let query = supabase
          .from('compromissos')
          .select('*, leads_juridicos(nome)')
          .order('data_inicio', { ascending: true });

        if (data_inicio) query = query.gte('data_inicio', data_inicio);
        if (data_fim) query = query.lte('data_inicio', data_fim);

        const { data: compromissos, error } = await query.limit(20);

        if (error) {
          result = { success: false, message: `Erro ao buscar compromissos: ${error.message}` };
        } else {
          result = { success: true, message: `${compromissos?.length || 0} compromisso(s) encontrado(s)`, data: compromissos };
        }
        break;
      }

      case 'listar_tarefas_pendentes': {
        const { data: tarefas, error } = await supabase
          .from('tarefas')
          .select('*, leads_juridicos(nome), processos(titulo_acao)')
          .in('status', ['Pendente', 'Em Andamento'])
          .order('data_limite', { ascending: true })
          .limit(20);

        if (error) {
          result = { success: false, message: `Erro ao buscar tarefas: ${error.message}` };
        } else {
          result = { success: true, message: `${tarefas?.length || 0} tarefa(s) pendente(s)`, data: tarefas };
        }
        break;
      }

      case 'atualizar_tarefa': {
        const { tarefa_id, status, data_conclusao } = data;
        
        const updateData: any = { status };
        if (status === 'Concluída') {
          updateData.data_conclusao = data_conclusao || new Date().toISOString();
        }

        const { data: tarefa, error } = await supabase
          .from('tarefas')
          .update(updateData)
          .eq('id', tarefa_id)
          .select()
          .single();

        if (error) {
          result = { success: false, message: `Erro ao atualizar tarefa: ${error.message}` };
        } else {
          result = { success: true, message: `Tarefa atualizada para "${status}"`, data: tarefa };
        }
        break;
      }

      case 'listar_usuarios': {
        const { data: usuarios, error } = await supabase
          .from('perfis')
          .select('id, nome, email, cargo')
          .eq('aprovado', true);

        if (error) {
          result = { success: false, message: `Erro ao buscar usuários: ${error.message}` };
        } else {
          result = { success: true, message: `${usuarios?.length || 0} usuário(s) encontrado(s)`, data: usuarios };
        }
        break;
      }
    }

    console.log('Resultado:', result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro em isa-actions:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
