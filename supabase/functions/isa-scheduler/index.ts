const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";
import { 
  formatarDataHora, 
  formatarData, 
  formatarHora, 
  formatarDataExtenso, 
  formatarDataHoraExtenso,
  getHojeManaus,
  getInicioHojeUtc,
  getInicioAmanhaUtc,
  MANAUS_TIMEZONE
} from '../_shared/timezone-helpers.ts';
import {
  getZapiConfig,
  sendText,
  gerarSubscriberId,
  enviarParaLead,
  enviarMensagemZapi,
} from '../_shared/zapi-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Função para enviar mensagem WhatsApp via Z-API
async function enviarWhatsApp(
  supabase: any,
  phone: string, 
  mensagem: string,
  leadId?: string,
  leadNome?: string
): Promise<{ success: boolean; metodo: string }> {
  const config = await getZapiConfig(supabase);
  
  if (!config) {
    console.error('[ISA-SCHEDULER] Z-API não configurado');
    return { success: false, metodo: 'falhou' };
  }

  const result = await sendText(config, phone, mensagem);
  
  if (result.success && leadId) {
    // Registrar mensagem
    await supabase.from('manychat_mensagens').insert({
      subscriber_id: gerarSubscriberId(phone),
      subscriber_nome: leadNome || 'Cliente',
      lead_id: leadId,
      conteudo: mensagem,
      direcao: 'saida',
      tipo: 'text',
      canal: 'whatsapp',
      metadata: { source: 'zapi', context: 'isa_scheduler' }
    });
  }

  return { 
    success: result.success, 
    metodo: result.success ? 'zapi' : 'falhou' 
  };
}

// Enviar lembrete com dados formatados
async function enviarLembreteCompromisso(
  supabase: any,
  phone: string,
  tipoLembrete: '1h' | '24h',
  dados: { nome: string; titulo: string; dataFormatada: string },
  leadId?: string
): Promise<{ enviado: boolean; metodo: string }> {
  
  const mensagem = tipoLembrete === '1h'
    ? `⏰ Olá ${dados.nome}! Lembrando que seu atendimento "${dados.titulo}" está marcado para daqui 1 hora (${dados.dataFormatada}). Até logo!`
    : `📅 Olá ${dados.nome}! Passando para lembrar que amanhã você tem um atendimento "${dados.titulo}" marcado para ${dados.dataFormatada}. Confirma sua presença? ✅`;

  const result = await enviarWhatsApp(supabase, phone, mensagem, leadId, dados.nome);
  
  return { enviado: result.success, metodo: result.metodo };
}

// Função para enviar email via Resend
async function enviarEmail(to: string[], subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY não configurada');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Isa - Bentes & Ramos <noreply@bentesramoscrm.com.br>',
        to,
        subject,
        html,
      }),
    });

    const result = await response.json();
    console.log('Email enviado:', result);
    return response.ok;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return false;
  }
}

// Template de email base
function emailTemplate(title: string, content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; margin-top: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a365d; margin: 0; font-size: 28px;">🤖 Isa - Assistente IA</h1>
          <p style="color: #718096; margin: 5px 0 0 0;">Bentes & Ramos Advocacia</p>
        </div>
        
        <h2 style="color: #2d3748; font-size: 20px; margin-bottom: 20px;">${title}</h2>
        
        ${content}
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
        
        <p style="color: #a0aec0; font-size: 12px; text-align: center;">
          Este é um email automático gerado pela Isa. Acesse o sistema para mais detalhes.
        </p>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }


  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { task } = await req.json();
    console.log(`[ISA-SCHEDULER Z-API] Executando task: ${task}`);

    const results: any = { task, timestamp: new Date().toISOString(), actions: [], provider: 'zapi' };

    // ==================== LEMBRETES DE COMPROMISSOS ====================
    if (task === 'lembretes_compromissos' || task === 'all') {
      const agora = new Date();
      const em24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
      const em1h = new Date(agora.getTime() + 60 * 60 * 1000);

      // Buscar compromissos das próximas 24h
      const { data: compromissos } = await supabase
        .from('compromissos')
        .select(`
          *,
          leads_juridicos!compromissos_lead_id_fkey (id, nome, telefone, email)
        `)
        .gte('data_inicio', agora.toISOString())
        .lte('data_inicio', em24h.toISOString())
        .order('data_inicio');

      for (const comp of compromissos || []) {
        const dataComp = new Date(comp.data_inicio);
        const diffMinutos = (dataComp.getTime() - agora.getTime()) / (1000 * 60);
        const lead = comp.leads_juridicos;

        // Determinar tipo de lembrete baseado no tempo restante
        let tipoLembrete = '';
        if (diffMinutos <= 90 && diffMinutos >= 0) tipoLembrete = '1h';
        else if (diffMinutos <= 25 * 60 && diffMinutos >= 23 * 60) tipoLembrete = '24h';

        if (!tipoLembrete) continue;

        // Verificar se já foi enviado
        const { data: notificacoesExistentes } = await supabase
          .from('system_events')
          .select('id')
          .eq('tipo', 'notificacao')
          .eq('acao', `lembrete_${tipoLembrete}`)
          .eq('entidade_id', comp.id)
          .single();

        if (notificacoesExistentes) continue;

        // Verificar se lead tem telefone
        if (lead?.telefone) {
          const dataFormatada = formatarDataHoraExtenso(dataComp);

          const resultado = await enviarLembreteCompromisso(
            supabase,
            lead.telefone,
            tipoLembrete as '1h' | '24h',
            {
              nome: lead.nome || 'Cliente',
              titulo: comp.titulo,
              dataFormatada
            },
            lead.id
          );

          // Registrar evento
          await supabase.from('system_events').insert({
            tipo: 'notificacao',
            fonte: 'zapi_scheduler',
            acao: `lembrete_${tipoLembrete}`,
            entidade_tipo: 'compromisso',
            entidade_id: comp.id,
            lead_id: lead.id,
            dados: { 
              enviado: resultado.enviado, 
              metodo: resultado.metodo,
              tipoLembrete,
              dataFormatada,
              provider: 'zapi'
            }
          });

          results.actions.push({
            tipo: 'lembrete_whatsapp',
            tipoLembrete,
            compromisso: comp.titulo,
            lead: lead.nome,
            enviado: resultado.enviado,
            metodo: resultado.metodo
          });
        }
      }
    }

    // ==================== LEMBRETES DE CONSULTA (presencial/online) — 24h/5h/2h ====================
    // Só compromissos criados pelo novo fluxo de agendamento (modalidade setada).
    // Dedup pelas próprias colunas timestamp (mais barato que consultar
    // system_events por linha a cada ciclo do cron), gravando também em
    // system_events para manter o padrão de auditoria do resto do sistema.
    if (task === 'lembretes_compromissos' || task === 'all') {
      const agora = new Date();
      const em26h = new Date(agora.getTime() + 26 * 60 * 60 * 1000);

      const { data: consultas } = await supabase
        .from('compromissos')
        .select('*')
        .not('modalidade', 'is', null)
        .neq('confirmacao_status', 'cancelado')
        .gte('data_inicio', agora.toISOString())
        .lte('data_inicio', em26h.toISOString());

      const JANELAS = [
        { campo: 'lembrete_24h_enviado_em', min: 23 * 60, max: 25 * 60, label: '24h' },
        { campo: 'lembrete_5h_enviado_em', min: 4.5 * 60, max: 5.5 * 60, label: '5h' },
        { campo: 'lembrete_2h_enviado_em', min: 1.5 * 60, max: 2.5 * 60, label: '2h' },
      ] as const;

      for (const comp of consultas || []) {
        const diffMin = (new Date(comp.data_inicio).getTime() - agora.getTime()) / 60000;
        const janela = JANELAS.find(j => diffMin >= j.min && diffMin <= j.max && !comp[j.campo]);
        if (!janela) continue;

        const nome = comp.nome_contato || 'Cliente';
        const telefone = comp.telefone_contato;
        const dataFormatada = formatarDataHoraExtenso(new Date(comp.data_inicio));
        const localTexto = comp.modalidade === 'presencial'
          ? `📍 Presencial: ${comp.local_reuniao}`
          : `📹 Online: ${comp.local_reuniao || 'o link será enviado em breve'}`;
        const mensagem = `⏰ Olá ${nome}! Lembrando da sua consulta jurídica marcada para ${dataFormatada}.\n\n${localTexto}\n\nAté lá!`;

        let enviado = false;
        if (comp.lead_id) {
          const r = await enviarParaLead(supabase, comp.lead_id, mensagem, `consulta_lembrete_${janela.label}`);
          enviado = r.success;
        } else if (telefone) {
          const r = await enviarMensagemZapi(supabase, telefone, mensagem, {
            context: `consulta_lembrete_${janela.label}`,
            instanceId: comp.zapi_instance_id || undefined,
          });
          enviado = r.success;
          // enviarMensagemZapi só grava manychat_mensagens quando há leadId nas
          // options; sem lead vinculado, gravamos aqui pra aparecer no histórico.
          if (enviado && comp.subscriber_id) {
            await supabase.from('manychat_mensagens').insert({
              subscriber_id: comp.subscriber_id,
              subscriber_nome: nome,
              conteudo: mensagem,
              tipo: 'text',
              direcao: 'saida',
              lead_id: null,
            });
          }
        }

        await supabase.from('compromissos').update({ [janela.campo]: new Date().toISOString() }).eq('id', comp.id);
        await supabase.from('system_events').insert({
          tipo: 'notificacao',
          fonte: 'isa_scheduler',
          acao: `consulta_lembrete_${janela.label}`,
          entidade_tipo: 'compromisso',
          entidade_id: comp.id,
          lead_id: comp.lead_id,
          dados: { enviado, modalidade: comp.modalidade },
        });

        results.actions.push({
          tipo: 'consulta_lembrete',
          janela: janela.label,
          compromisso: comp.titulo,
          contato: nome,
          enviado,
        });
      }
    }

    // ==================== VERIFICAÇÃO DE NÃO COMPARECIMENTO ====================
    // Roda para compromissos de consulta (modalidade setada) cujo horário já
    // passou; se o cliente não mandou nenhuma mensagem desde o início da
    // consulta, dispara uma verificação. Marca sempre (respondeu ou não) para
    // nunca reprocessar o mesmo compromisso.
    if (task === 'verificacao_comparecimento' || task === 'all') {
      const agora = new Date();
      const janelaIni = new Date(agora.getTime() - 90 * 60 * 1000);
      const janelaFim = new Date(agora.getTime() - 30 * 60 * 1000);

      const { data: consultas } = await supabase
        .from('compromissos')
        .select('*')
        .not('modalidade', 'is', null)
        .neq('confirmacao_status', 'cancelado')
        .is('verificacao_comparecimento_em', null)
        .gte('data_inicio', janelaIni.toISOString())
        .lte('data_inicio', janelaFim.toISOString());

      for (const comp of consultas || []) {
        let respondeu = false;

        if (comp.lead_id) {
          const { data } = await supabase
            .from('manychat_mensagens')
            .select('id')
            .eq('lead_id', comp.lead_id)
            .eq('direcao', 'entrada')
            .gt('created_at', comp.data_inicio)
            .limit(1);
          respondeu = !!data?.length;
        } else if (comp.subscriber_id) {
          const { data } = await supabase
            .from('manychat_mensagens')
            .select('id')
            .eq('subscriber_id', comp.subscriber_id)
            .eq('direcao', 'entrada')
            .gt('created_at', comp.data_inicio)
            .limit(1);
          respondeu = !!data?.length;
        }

        if (!respondeu) {
          const nome = comp.nome_contato || '';
          const mensagem = `Olá ${nome}! 👋\n\nNotamos que o horário da sua consulta (${formatarDataHoraExtenso(new Date(comp.data_inicio))}) já passou. Você conseguiu comparecer/participar? Se precisar remarcar, é só nos avisar. 📅`;

          if (comp.lead_id) {
            await enviarParaLead(supabase, comp.lead_id, mensagem, 'consulta_verificacao_comparecimento');
          } else if (comp.telefone_contato) {
            const r = await enviarMensagemZapi(supabase, comp.telefone_contato, mensagem, {
              context: 'consulta_verificacao_comparecimento',
              instanceId: comp.zapi_instance_id || undefined,
            });
            if (r.success && comp.subscriber_id) {
              await supabase.from('manychat_mensagens').insert({
                subscriber_id: comp.subscriber_id,
                subscriber_nome: nome || 'Cliente',
                conteudo: mensagem,
                tipo: 'text',
                direcao: 'saida',
                lead_id: null,
              });
            }
          }
        }

        // Marca sempre, respondeu ou não, para nunca reprocessar.
        await supabase.from('compromissos').update({ verificacao_comparecimento_em: new Date().toISOString() }).eq('id', comp.id);
        await supabase.from('system_events').insert({
          tipo: 'notificacao',
          fonte: 'isa_scheduler',
          acao: 'consulta_verificacao_comparecimento',
          entidade_tipo: 'compromisso',
          entidade_id: comp.id,
          lead_id: comp.lead_id,
          dados: { respondeu, modalidade: comp.modalidade },
        });

        results.actions.push({
          tipo: 'consulta_verificacao_comparecimento',
          compromisso: comp.titulo,
          respondeu,
        });
      }
    }

    // ==================== CONFIRMAÇÃO IMEDIATA (chamado ao criar compromisso) ====================
    if (task === 'confirmacao_imediata') {
      const { compromissoId } = await req.json();

      const { data: comp } = await supabase
        .from('compromissos')
        .select(`
          *,
          leads_juridicos!compromissos_lead_id_fkey (id, nome, telefone)
        `)
        .eq('id', compromissoId)
        .single();

      if (comp?.leads_juridicos?.telefone) {
        const lead = comp.leads_juridicos;
        const dataFormatada = formatarDataHoraExtenso(comp.data_inicio);

        const mensagem = `✅ ${lead.nome || 'Cliente'}, seu atendimento foi agendado com sucesso!\n\n📋 *${comp.titulo}*\n📅 ${dataFormatada}\n\nCaso precise remarcar, é só nos avisar. Até lá! 👋`;

        await enviarWhatsApp(supabase, lead.telefone, mensagem, lead.id, lead.nome);

        results.actions.push({
          tipo: 'confirmacao_imediata',
          compromisso: comp.titulo,
          lead: lead.nome
        });
      }
    }

    // ==================== FOLLOW-UP PÓS ATENDIMENTO ====================
    if (task === 'followup_pos_atendimento' || task === 'all') {
      const agora = new Date();
      const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

      // Buscar compromissos que terminaram nas últimas 24h
      const { data: compromissos } = await supabase
        .from('compromissos')
        .select(`
          *,
          leads_juridicos!compromissos_lead_id_fkey (id, nome, telefone)
        `)
        .lte('data_fim', agora.toISOString())
        .gte('data_fim', ontem.toISOString());

      for (const comp of compromissos || []) {
        const lead = comp.leads_juridicos;
        if (!lead?.id || !lead?.telefone) continue;

        // Verificar se já foi enviado
        const { data: jaEnviado } = await supabase
          .from('system_events')
          .select('id')
          .eq('tipo', 'notificacao')
          .eq('acao', 'followup_pos_atendimento')
          .eq('entidade_id', comp.id)
          .single();

        if (jaEnviado) continue;

        const mensagem = `Olá ${lead.nome || ''}! 😊\n\nEsperamos que seu atendimento "${comp.titulo}" tenha sido produtivo.\n\nComo podemos ajudá-lo(a) a partir de agora? Estamos à disposição para qualquer dúvida. 💼`;

        await enviarWhatsApp(supabase, lead.telefone, mensagem, lead.id, lead.nome);

        await supabase.from('system_events').insert({
          tipo: 'notificacao',
          fonte: 'zapi_scheduler',
          acao: 'followup_pos_atendimento',
          entidade_tipo: 'compromisso',
          entidade_id: comp.id,
          lead_id: lead.id,
          dados: { enviado: true, provider: 'zapi' }
        });

        results.actions.push({
          tipo: 'followup_pos_atendimento',
          compromisso: comp.titulo,
          lead: lead.nome
        });
      }
    }

    // ==================== EMAIL: AGENDA DO DIA ====================
    if (task === 'email_agenda_dia' || task === 'all') {
      // Buscar advogados/gerentes
      const { data: usuarios } = await supabase
        .from('perfis')
        .select('id, nome, email, cargo')
        .eq('aprovado', true);

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['Administrador', 'Advogado', 'Gerente']);

      const hoje = new Date();
      const hojeManaus = getHojeManaus();
      const inicioHojeUtc = getInicioHojeUtc();
      const amanhaUtc = getInicioAmanhaUtc();

      const { data: compromissosHoje } = await supabase
        .from('compromissos')
        .select(`
          *,
          leads_juridicos!compromissos_lead_id_fkey (nome)
        `)
        .gte('data_inicio', inicioHojeUtc.toISOString())
        .lt('data_inicio', amanhaUtc.toISOString())
        .order('data_inicio');

      const { data: tarefasHoje } = await supabase
        .from('tarefas')
        .select('*')
        .eq('data_limite', hojeManaus)
        .neq('status', 'concluida');

      if ((compromissosHoje?.length || 0) > 0 || (tarefasHoje?.length || 0) > 0) {
        let conteudo = `<p style="color: #4a5568; font-size: 16px;">Bom dia! Aqui está sua agenda para hoje, ${formatarDataExtenso(hoje)}:</p>`;

        if (compromissosHoje?.length) {
          conteudo += `<h3 style="color: #2d3748; margin-top: 20px;">📅 Compromissos (${compromissosHoje.length})</h3><ul style="color: #4a5568;">`;
          for (const c of compromissosHoje) {
            const hora = formatarHora(c.data_inicio);
            conteudo += `<li><strong>${hora}</strong> - ${c.titulo} ${c.leads_juridicos?.nome ? `(${c.leads_juridicos.nome})` : ''}</li>`;
          }
          conteudo += '</ul>';
        }

        if (tarefasHoje?.length) {
          conteudo += `<h3 style="color: #2d3748; margin-top: 20px;">📋 Tarefas com prazo hoje (${tarefasHoje.length})</h3><ul style="color: #4a5568;">`;
          for (const t of tarefasHoje) {
            conteudo += `<li>${t.titulo} - <em style="color: ${t.prioridade === 'alta' ? '#e53e3e' : '#718096'}">${t.prioridade}</em></li>`;
          }
          conteudo += '</ul>';
        }

        // Enviar para usuários com role adequado
        const emailsDestino = usuarios
          ?.filter(u => roles?.some(r => r.user_id === u.id))
          .map(u => u.email)
          .filter(Boolean) as string[];

        if (emailsDestino.length > 0) {
          await enviarEmail(
            emailsDestino,
            `📅 Sua Agenda para Hoje - ${formatarData(hoje)}`,
            emailTemplate('Agenda do Dia', conteudo)
          );

          results.actions.push({
            tipo: 'email_agenda_dia',
            destinatarios: emailsDestino.length,
            compromissos: compromissosHoje?.length || 0,
            tarefas: tarefasHoje?.length || 0
          });
        }
      }
    }

    // ==================== EMAIL: LEADS SEM RETORNO ====================
    if (task === 'email_leads_sem_retorno' || task === 'all') {
      const ha7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const { data: leadsSemRetorno } = await supabase
        .from('leads_juridicos')
        .select(`
          id, nome, telefone, email, status, updated_at,
          interacoes (data_interacao)
        `)
        .eq('status', 'Em Atendimento')
        .order('updated_at', { ascending: true });

      const leadsAlerta = leadsSemRetorno?.filter(lead => {
        const ultimaInteracao = lead.interacoes?.length 
          ? Math.max(...lead.interacoes.map((i: any) => new Date(i.data_interacao).getTime()))
          : new Date(lead.updated_at).getTime();
        return ultimaInteracao < ha7dias.getTime();
      });

      if (leadsAlerta?.length) {
        const { data: admins } = await supabase
          .from('perfis')
          .select('email')
          .eq('aprovado', true)
          .in('cargo', ['Administrador', 'Gerente']);

        const emailsAdmin = admins?.map(a => a.email).filter(Boolean) as string[];

        if (emailsAdmin.length > 0) {
          let conteudo = `<p style="color: #e53e3e; font-weight: bold;">⚠️ Atenção! Existem ${leadsAlerta.length} leads sem contato há mais de 7 dias:</p><ul style="color: #4a5568;">`;
          
          for (const lead of leadsAlerta.slice(0, 10)) {
            conteudo += `<li><strong>${lead.nome}</strong> - ${lead.telefone || lead.email || 'Sem contato'}</li>`;
          }
          
          if (leadsAlerta.length > 10) {
            conteudo += `<li>... e mais ${leadsAlerta.length - 10} leads</li>`;
          }
          conteudo += '</ul>';

          await enviarEmail(
            emailsAdmin,
            `⚠️ Alerta: ${leadsAlerta.length} Leads Sem Retorno`,
            emailTemplate('Leads Sem Retorno', conteudo)
          );

          results.actions.push({
            tipo: 'email_leads_sem_retorno',
            quantidade: leadsAlerta.length
          });
        }
      }
    }

    // ==================== EMAIL: PRAZOS PRÓXIMOS ====================
    if (task === 'email_prazos_proximos' || task === 'all') {
      const em7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const hoje = new Date();

      const { data: tarefasPrazo } = await supabase
        .from('tarefas')
        .select('*, responsavel:perfis(nome, email)')
        .neq('status', 'concluida')
        .lte('data_limite', em7dias.toISOString().split('T')[0])
        .order('data_limite');

      if (tarefasPrazo?.length) {
        // Agrupar por responsável
        const porResponsavel: Record<string, any[]> = {};
        
        for (const tarefa of tarefasPrazo) {
          const email = tarefa.responsavel?.email || 'sem_responsavel';
          if (!porResponsavel[email]) porResponsavel[email] = [];
          porResponsavel[email].push(tarefa);
        }

        for (const [email, tarefas] of Object.entries(porResponsavel)) {
          if (email === 'sem_responsavel') continue;

          let conteudo = `<p style="color: #4a5568; font-size: 16px;">Você tem ${tarefas.length} tarefa(s) com prazo nos próximos 7 dias:</p><ul>`;
          
          for (const t of tarefas) {
            const diasRestantes = Math.ceil((new Date(t.data_limite).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            const urgencia = diasRestantes <= 2 ? 'color: #e53e3e; font-weight: bold;' : 'color: #4a5568;';
            conteudo += `<li style="${urgencia}">${t.titulo} - Prazo: ${formatarData(t.data_limite)} (${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''})</li>`;
          }
          conteudo += '</ul>';

          await enviarEmail(
            [email],
            `📋 Prazos Próximos - ${tarefas.length} tarefa(s)`,
            emailTemplate('Prazos Próximos', conteudo)
          );
        }

        results.actions.push({
          tipo: 'email_prazos_proximos',
          tarefas: tarefasPrazo.length
        });
      }
    }

    // ==================== EMAIL: INTIMAÇÕES PENDENTES ====================
    if (task === 'email_intimacoes_pendentes' || task === 'all') {
      // Mesma lógica de prazo (contagem de dias úteis por tipo de ato) usada na
      // tela de Intimações (IntimacoesPage.tsx, calcularPrazos/getUrgencyInfo) —
      // reimplementada aqui pq a function roda em Deno, sem acesso ao front.
      const isWeekendDate = (d: Date) => { const day = d.getDay(); return day === 0 || day === 6; };
      const addDaysDate = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
      const addBusinessDaysDate = (d: Date, n: number) => {
        let r = new Date(d), added = 0;
        while (added < n) { r = addDaysDate(r, 1); if (!isWeekendDate(r)) added++; }
        return r;
      };
      const calcularPrazoFatal = (intimacao: any): Date | null => {
        const baseStr = intimacao.data_publicacao || intimacao.data_intimacao || intimacao.data_disponibilizacao;
        if (!baseStr) return null;
        const base = new Date(baseStr);
        if (isNaN(base.getTime())) return null;
        const tipo = (intimacao.tipo_intimacao || '').toLowerCase();
        let pf = 20;
        if (tipo.includes('embargos')) pf = 10;
        else if (tipo.includes('manifestação') || tipo.includes('manifestacao')) pf = 10;
        else if (tipo.includes('ciência') || tipo.includes('ciencia')) pf = 15;
        else if (tipo.includes('sessão') || tipo.includes('sessao') || tipo.includes('julgamento')) pf = 0;
        else if (tipo.includes('pagamento')) pf = 15;
        if (pf === 0) return null;
        let start = addDaysDate(base, 1);
        while (isWeekendDate(start)) start = addDaysDate(start, 1);
        return addBusinessDaysDate(start, pf);
      };
      const urgenciaIntimacao = (intimacao: any) => {
        const fatal = calcularPrazoFatal(intimacao);
        if (!fatal) return { level: 'none' as const, dias: null as number | null, fatal: null as Date | null };
        const dias = Math.ceil((fatal.getTime() - Date.now()) / 86400000);
        const level = dias < 0 ? 'overdue' as const : dias <= 7 ? 'urgent' as const : dias <= 15 ? 'warning' as const : 'safe' as const;
        return { level, dias, fatal };
      };

      const { data: pendentes } = await supabase
        .from('intimacoes')
        .select('id, processo_cnj, processo_titulo, tipo_intimacao, tribunal, data_publicacao, data_intimacao, data_disponibilizacao, advogado_id, oab_numero, oab_uf')
        .eq('lida', false);

      if (pendentes?.length) {
        // Resolve o responsável de cada intimação: por advogado_id (preciso) ou,
        // na falta dele, pela OAB/UF que gerou a busca (mesma lógica do
        // resolverResponsavel() da tela de Intimações).
        const { data: perfisComOab } = await supabase
          .from('perfis')
          .select('id, nome, email, oab_numero, oab_uf')
          .eq('aprovado', true);

        const porId = new Map((perfisComOab || []).map((p: any) => [p.id, p]));
        const porOab = new Map((perfisComOab || []).filter((p: any) => p.oab_numero).map((p: any) => [`${p.oab_numero}-${p.oab_uf || 'AM'}`, p]));

        const porEmail: Record<string, { nome: string; itens: any[] }> = {};
        for (const it of pendentes) {
          const responsavel = (it.advogado_id && porId.get(it.advogado_id))
            || (it.oab_numero && porOab.get(`${it.oab_numero}-${it.oab_uf || 'AM'}`));
          if (!responsavel?.email) continue;
          (porEmail[responsavel.email] ??= { nome: responsavel.nome, itens: [] }).itens.push(it);
        }

        let totalEnviados = 0;
        for (const [email, { nome, itens }] of Object.entries(porEmail)) {
          const comUrgencia = itens
            .map(it => ({ it, u: urgenciaIntimacao(it) }))
            .sort((a, b) => (a.u.dias ?? 9999) - (b.u.dias ?? 9999));

          const urgentes = comUrgencia.filter(x => x.u.level === 'overdue' || x.u.level === 'urgent').length;

          let conteudo = `<p style="color: #4a5568; font-size: 16px;">Olá${nome ? ` ${nome.split(' ')[0]}` : ''}! Você tem <strong>${itens.length}</strong> intimação(ões)/publicação(ões) ainda não lida(s)${urgentes ? `, sendo <strong style="color:#e53e3e;">${urgentes} com prazo urgente ou vencido</strong>` : ''}:</p><ul style="padding-left: 18px;">`;

          for (const { it, u } of comUrgencia.slice(0, 20)) {
            const cor = u.level === 'overdue' ? '#e53e3e' : u.level === 'urgent' ? '#dd6b20' : u.level === 'warning' ? '#d69e2e' : '#4a5568';
            const label = u.level === 'overdue' ? `Vencido há ${Math.abs(u.dias!)}d`
              : u.level === 'urgent' ? (u.dias === 0 ? 'Vence hoje!' : `Faltam ${u.dias}d`)
              : u.level === 'warning' ? `Faltam ${u.dias}d`
              : '';
            conteudo += `<li style="color:${cor}; margin-bottom: 6px;"><strong>${it.tipo_intimacao || 'Publicação'}</strong> — ${it.processo_titulo || it.processo_cnj || 'Processo não identificado'} (${it.tribunal || '—'})${label ? ` · <strong>${label}</strong>` : ''}</li>`;
          }
          if (itens.length > 20) conteudo += `<li style="color:#718096;">e mais ${itens.length - 20}...</li>`;
          conteudo += '</ul><p style="margin-top:20px;"><a href="https://bentesramoscrm.com.br/intimacoes" style="color:#1a365d; font-weight:600;">Ver todas no sistema →</a></p>';

          const enviado = await enviarEmail(
            [email],
            `📬 ${itens.length} intimação(ões) pendente(s)${urgentes ? ` — ${urgentes} urgente(s)` : ''}`,
            emailTemplate('Intimações Pendentes', conteudo)
          );
          if (enviado) totalEnviados++;
        }

        results.actions.push({
          tipo: 'email_intimacoes_pendentes',
          pendentes: pendentes.length,
          destinatarios: Object.keys(porEmail).length,
          enviados: totalEnviados,
        });
      }
    }

    // Registrar execução
    await supabase.from('system_events').insert({
      tipo: 'scheduler',
      fonte: 'zapi_isa_scheduler',
      acao: task,
      dados: results,
      processado: true
    });

    console.log('[ISA-SCHEDULER] Resultado:', JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ISA-SCHEDULER] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
