import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MANYCHAT_API_KEY = Deno.env.get('MANYCHAT_API_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Função para enviar mensagem WhatsApp via ManyChat (dentro da janela de 24h)
async function enviarWhatsApp(subscriberId: string, mensagem: string): Promise<{ success: boolean; usouTemplate: boolean }> {
  if (!MANYCHAT_API_KEY) {
    console.error('MANYCHAT_API_KEY não configurada');
    return { success: false, usouTemplate: false };
  }

  try {
    const response = await fetch('https://api.manychat.com/fb/sending/sendContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: parseInt(subscriberId),
        data: {
          version: 'v2',
          content: {
            messages: [{ type: 'text', text: mensagem }],
          },
        },
      }),
    });

    const result = await response.json();
    console.log('WhatsApp sendContent:', result);
    
    // Se sucesso, retorna
    if (result.status === 'success') {
      return { success: true, usouTemplate: false };
    }
    
    // Se falhou por janela de 24h (código 3011), retorna para tentar via Flow
    if (result.code === 3011 || result.message?.includes('24 hours')) {
      console.log('Janela de 24h expirada, precisa usar template');
      return { success: false, usouTemplate: false };
    }
    
    return { success: false, usouTemplate: false };
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    return { success: false, usouTemplate: false };
  }
}

// Função para enviar via Flow/Template (fora da janela de 24h)
// Requer flows configurados no ManyChat: "lembrete_1h" e "lembrete_24h"
async function enviarViaFlow(subscriberId: string, flowNs: string, dados: Record<string, any>): Promise<boolean> {
  if (!MANYCHAT_API_KEY) {
    console.error('MANYCHAT_API_KEY não configurada');
    return false;
  }

  try {
    console.log(`Enviando via Flow: subscriber=${subscriberId}, flow=${flowNs}, dados=`, dados);
    
    const response = await fetch('https://api.manychat.com/fb/sending/sendFlow', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: parseInt(subscriberId),
        flow_ns: flowNs,
        external_data: dados
      }),
    });

    const result = await response.json();
    console.log('WhatsApp sendFlow:', result);
    return result.status === 'success';
  } catch (error) {
    console.error('Erro ao enviar via Flow:', error);
    return false;
  }
}

// Enviar lembrete com fallback para template quando fora da janela de 24h
async function enviarLembreteCompromisso(
  subscriberId: string, 
  tipoLembrete: '1h' | '24h',
  dados: { nome: string; titulo: string; dataFormatada: string }
): Promise<{ enviado: boolean; metodo: 'direto' | 'template' | 'falhou' }> {
  
  const mensagem = tipoLembrete === '1h'
    ? `⏰ Olá ${dados.nome}! Lembrando que seu atendimento "${dados.titulo}" está marcado para daqui 1 hora (${dados.dataFormatada}). Até logo!`
    : `📅 Olá ${dados.nome}! Passando para lembrar que amanhã você tem um atendimento "${dados.titulo}" marcado para ${dados.dataFormatada}. Confirma sua presença? ✅`;

  // Tenta envio direto primeiro
  const resultDireto = await enviarWhatsApp(subscriberId, mensagem);
  
  if (resultDireto.success) {
    return { enviado: true, metodo: 'direto' };
  }
  
  // Se falhou (provavelmente janela de 24h), tenta via Flow/Template
  // Flows esperados no ManyChat: "lembrete_compromisso_1h" e "lembrete_compromisso_24h"
  const flowNs = tipoLembrete === '1h' ? 'lembrete_compromisso_1h' : 'lembrete_compromisso_24h';
  
  console.log(`Tentando envio via template: ${flowNs}`);
  const resultFlow = await enviarViaFlow(subscriberId, flowNs, {
    nome: dados.nome,
    titulo: dados.titulo,
    data: dados.dataFormatada
  });
  
  if (resultFlow) {
    return { enviado: true, metodo: 'template' };
  }
  
  return { enviado: false, metodo: 'falhou' };
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
    console.log(`Isa Scheduler executando task: ${task}`);

    const results: any = { task, timestamp: new Date().toISOString(), actions: [] };

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
        // 24h: entre 23h e 25h antes (primeiro lembrete)
        // 1h: entre 0 e 90 minutos antes (segundo lembrete - janela ampliada)
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

        // Buscar subscriber do lead para enviar WhatsApp
        if (lead?.id) {
          const { data: subscriber } = await supabase
            .from('manychat_subscribers')
            .select('subscriber_id')
            .eq('lead_id', lead.id)
            .single();

          if (subscriber?.subscriber_id) {
            const dataFormatada = formatarDataHoraExtenso(dataComp);

            // Usar a nova função que faz fallback para template
            const resultado = await enviarLembreteCompromisso(
              subscriber.subscriber_id,
              tipoLembrete as '1h' | '24h',
              {
                nome: lead.nome || 'Cliente',
                titulo: comp.titulo,
                dataFormatada
              }
            );

            // Registrar evento
            await supabase.from('system_events').insert({
              tipo: 'notificacao',
              fonte: 'isa_scheduler',
              acao: `lembrete_${tipoLembrete}`,
              entidade_tipo: 'compromisso',
              entidade_id: comp.id,
              lead_id: lead.id,
              dados: { 
                enviado: resultado.enviado, 
                metodo: resultado.metodo,
                tipoLembrete,
                dataFormatada
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

      if (comp?.leads_juridicos) {
        const lead = comp.leads_juridicos;
        const { data: subscriber } = await supabase
          .from('manychat_subscribers')
          .select('subscriber_id')
          .eq('lead_id', lead.id)
          .single();

        if (subscriber?.subscriber_id) {
          const dataFormatada = formatarDataHoraExtenso(comp.data_inicio);

          const mensagem = `✅ ${lead.nome || 'Cliente'}, seu atendimento foi agendado com sucesso!\n\n📋 *${comp.titulo}*\n📅 ${dataFormatada}\n\nCaso precise remarcar, é só nos avisar. Até lá! 👋`;

          await enviarWhatsApp(subscriber.subscriber_id, mensagem);

          results.actions.push({
            tipo: 'confirmacao_imediata',
            compromisso: comp.titulo,
            lead: lead.nome
          });
        }
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
          leads_juridicos!compromissos_lead_id_fkey (id, nome)
        `)
        .lte('data_fim', agora.toISOString())
        .gte('data_fim', ontem.toISOString());

      for (const comp of compromissos || []) {
        const lead = comp.leads_juridicos;
        if (!lead?.id) continue;

        // Verificar se já foi enviado
        const { data: jaEnviado } = await supabase
          .from('system_events')
          .select('id')
          .eq('tipo', 'notificacao')
          .eq('acao', 'followup_pos_atendimento')
          .eq('entidade_id', comp.id)
          .single();

        if (jaEnviado) continue;

        const { data: subscriber } = await supabase
          .from('manychat_subscribers')
          .select('subscriber_id')
          .eq('lead_id', lead.id)
          .single();

        if (subscriber?.subscriber_id) {
          const mensagem = `Olá ${lead.nome || ''}! 😊\n\nEsperamos que seu atendimento "${comp.titulo}" tenha sido produtivo.\n\nComo podemos ajudá-lo(a) a partir de agora? Estamos à disposição para qualquer dúvida. 💼`;

          await enviarWhatsApp(subscriber.subscriber_id, mensagem);

          await supabase.from('system_events').insert({
            tipo: 'notificacao',
            fonte: 'isa_scheduler',
            acao: 'followup_pos_atendimento',
            entidade_tipo: 'compromisso',
            entidade_id: comp.id,
            lead_id: lead.id,
            dados: { enviado: true }
          });

          results.actions.push({
            tipo: 'followup_pos_atendimento',
            compromisso: comp.titulo,
            lead: lead.nome
          });
        }
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

      // Leads em atendimento sem interação há 7+ dias
      const { data: leadsSemRetorno } = await supabase
        .from('leads_juridicos')
        .select(`
          id, nome, telefone, email, status, updated_at,
          interacoes (data_interacao)
        `)
        .eq('status', 'Em Atendimento')
        .order('updated_at', { ascending: true });

      const leadsAlerta = leadsSemRetorno?.filter(lead => {
        const ultimaInteracao = lead.interacoes?.sort((a: any, b: any) => 
          new Date(b.data_interacao).getTime() - new Date(a.data_interacao).getTime()
        )[0];
        
        const dataRef = ultimaInteracao?.data_interacao || lead.updated_at;
        return new Date(dataRef) < ha7dias;
      });

      if (leadsAlerta?.length) {
        let conteudo = `<p style="color: #4a5568; font-size: 16px;">Os seguintes leads estão sem interação há mais de 7 dias:</p>`;
        conteudo += `<table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr style="background-color: #edf2f7;">
            <th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0;">Lead</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0;">Status</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0;">Última Atividade</th>
          </tr>`;

        for (const lead of leadsAlerta) {
          const ultimaInteracao = lead.interacoes?.sort((a: any, b: any) => 
            new Date(b.data_interacao).getTime() - new Date(a.data_interacao).getTime()
          )[0];
          const dataRef = ultimaInteracao?.data_interacao || lead.updated_at;
          
          conteudo += `<tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${lead.nome || 'Sem nome'}</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${lead.status}</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${formatarData(dataRef)}</td>
          </tr>`;
        }
        conteudo += '</table>';
        conteudo += `<p style="color: #e53e3e; font-size: 14px; margin-top: 15px;">⚠️ Atenção: ${leadsAlerta.length} lead(s) precisam de follow-up urgente!</p>`;

        // Buscar gerentes/admins
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('role', ['Administrador', 'Gerente']);

        const { data: usuarios } = await supabase
          .from('perfis')
          .select('id, email')
          .in('id', roles?.map(r => r.user_id) || [])
          .eq('aprovado', true);

        const emails = usuarios?.map(u => u.email).filter(Boolean) as string[];

        if (emails.length > 0) {
          await enviarEmail(
            emails,
            `⚠️ ${leadsAlerta.length} Leads Sem Retorno - Ação Necessária`,
            emailTemplate('Leads Sem Retorno', conteudo)
          );

          results.actions.push({
            tipo: 'email_leads_sem_retorno',
            leads_alertados: leadsAlerta.length,
            destinatarios: emails.length
          });
        }
      }
    }

    // ==================== EMAIL: PRAZOS PRÓXIMOS ====================
    if (task === 'email_prazos_proximos' || task === 'all') {
      const hoje = new Date();
      const em7dias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Buscar compromissos do tipo "Prazo" nos próximos 7 dias
      const { data: prazos } = await supabase
        .from('compromissos')
        .select(`
          *,
          processos (numero_processo, titulo_acao),
          leads_juridicos!compromissos_lead_id_fkey (nome)
        `)
        .eq('tipo', 'Prazo')
        .gte('data_inicio', hoje.toISOString())
        .lte('data_inicio', em7dias.toISOString())
        .order('data_inicio');

      if (prazos?.length) {
        let conteudo = `<p style="color: #4a5568; font-size: 16px;">Você tem ${prazos.length} prazo(s) nos próximos 7 dias:</p>`;
        conteudo += `<table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr style="background-color: #fed7d7;">
            <th style="padding: 10px; text-align: left; border: 1px solid #feb2b2;">Data</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #feb2b2;">Prazo</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #feb2b2;">Processo/Cliente</th>
          </tr>`;

        for (const prazo of prazos) {
          const diasRestantes = Math.ceil((new Date(prazo.data_inicio).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          const corLinha = diasRestantes <= 2 ? '#fff5f5' : '#ffffff';

          conteudo += `<tr style="background-color: ${corLinha};">
            <td style="padding: 10px; border: 1px solid #e2e8f0;">
              <strong>${formatarData(prazo.data_inicio)}</strong>
              <br><small style="color: ${diasRestantes <= 2 ? '#e53e3e' : '#718096'}">${diasRestantes} dia(s)</small>
            </td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${prazo.titulo}</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">
              ${prazo.processos?.numero_processo || ''} 
              ${prazo.leads_juridicos?.nome ? `- ${prazo.leads_juridicos.nome}` : ''}
            </td>
          </tr>`;
        }
        conteudo += '</table>';

        const prazosUrgentes = prazos.filter(p => {
          const dias = Math.ceil((new Date(p.data_inicio).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          return dias <= 2;
        });

        if (prazosUrgentes.length > 0) {
          conteudo += `<p style="color: #e53e3e; font-size: 14px; margin-top: 15px; font-weight: bold;">🚨 ${prazosUrgentes.length} prazo(s) vencem em até 2 dias!</p>`;
        }

        // Enviar para advogados e gerentes
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['Administrador', 'Advogado', 'Gerente']);

        const { data: usuarios } = await supabase
          .from('perfis')
          .select('id, email')
          .in('id', roles?.map(r => r.user_id) || [])
          .eq('aprovado', true);

        const emails = usuarios?.map(u => u.email).filter(Boolean) as string[];

        if (emails.length > 0) {
          await enviarEmail(
            emails,
            `⚖️ ${prazos.length} Prazos Processuais - Próximos 7 Dias`,
            emailTemplate('Prazos Processuais Próximos', conteudo)
          );

          results.actions.push({
            tipo: 'email_prazos_proximos',
            prazos: prazos.length,
            urgentes: prazosUrgentes.length,
            destinatarios: emails.length
          });
        }
      }
    }

    // ==================== EMAIL: RELATÓRIO SEMANAL ====================
    if (task === 'email_relatorio_semanal') {
      const hoje = new Date();
      const semanaPassada = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Métricas da semana
      const { count: novosLeads } = await supabase
        .from('leads_juridicos')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', semanaPassada.toISOString());

      const { count: leadsConvertidos } = await supabase
        .from('leads_juridicos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Cliente')
        .gte('updated_at', semanaPassada.toISOString());

      const { count: compromissosSemana } = await supabase
        .from('compromissos')
        .select('*', { count: 'exact', head: true })
        .gte('data_inicio', semanaPassada.toISOString())
        .lte('data_inicio', hoje.toISOString());

      const { count: tarefasConcluidas } = await supabase
        .from('tarefas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'concluida')
        .gte('data_conclusao', semanaPassada.toISOString());

      const { count: interacoesSemana } = await supabase
        .from('interacoes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', semanaPassada.toISOString());

      // Leads por status
      const { data: leadsStatus } = await supabase
        .from('leads_juridicos')
        .select('status');

      const statusCount: Record<string, number> = {};
      leadsStatus?.forEach(l => {
        statusCount[l.status || 'Sem status'] = (statusCount[l.status || 'Sem status'] || 0) + 1;
      });

      let conteudo = `
        <p style="color: #4a5568; font-size: 16px;">Aqui está o resumo da semana de ${formatarData(semanaPassada)} a ${formatarData(hoje)}:</p>
        
        <div style="display: flex; flex-wrap: wrap; gap: 15px; margin: 20px 0;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; min-width: 120px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold;">${novosLeads || 0}</div>
            <div style="font-size: 12px; opacity: 0.9;">Novos Leads</div>
          </div>
          <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 20px; border-radius: 10px; min-width: 120px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold;">${leadsConvertidos || 0}</div>
            <div style="font-size: 12px; opacity: 0.9;">Convertidos</div>
          </div>
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 10px; min-width: 120px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold;">${compromissosSemana || 0}</div>
            <div style="font-size: 12px; opacity: 0.9;">Compromissos</div>
          </div>
          <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: 10px; min-width: 120px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold;">${tarefasConcluidas || 0}</div>
            <div style="font-size: 12px; opacity: 0.9;">Tarefas Concluídas</div>
          </div>
        </div>

        <h3 style="color: #2d3748; margin-top: 25px;">📊 Leads por Status</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          ${Object.entries(statusCount).map(([status, count]) => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${status}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${count}</td>
            </tr>
          `).join('')}
        </table>

        <p style="color: #718096; font-size: 14px; margin-top: 20px;">
          💬 Total de interações na semana: <strong>${interacoesSemana || 0}</strong>
        </p>
      `;

      // Enviar para admins e gerentes
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['Administrador', 'Gerente']);

      const { data: usuarios } = await supabase
        .from('perfis')
        .select('id, email')
        .in('id', roles?.map(r => r.user_id) || [])
        .eq('aprovado', true);

      const emails = usuarios?.map(u => u.email).filter(Boolean) as string[];

      if (emails.length > 0) {
        await enviarEmail(
          emails,
          `📈 Relatório Semanal - ${formatarData(semanaPassada)} a ${formatarData(hoje)}`,
          emailTemplate('Relatório Semanal', conteudo)
        );

        results.actions.push({
          tipo: 'email_relatorio_semanal',
          novosLeads,
          convertidos: leadsConvertidos,
          destinatarios: emails.length
        });
      }
    }

    // Registrar execução
    await supabase.from('system_events').insert({
      tipo: 'automacao',
      fonte: 'isa_scheduler',
      acao: task,
      dados: results
    });

    console.log('Isa Scheduler concluído:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no Isa Scheduler:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
