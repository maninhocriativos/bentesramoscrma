// v2 — cron a cada 10min, 1 envio/execução, máx 10/dia, só nosso_processo=true
import "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATAJUD_API_KEY = Deno.env.get('DATAJUD_API_KEY');

// Z-API routing constants (REGRA ABSOLUTA)
const PHONE_TRAFEGO    = '5592985888190'; // (92) 98588-8190 — "Bentes Ramos Trafego"
const PHONE_ESCRITORIO = '5592991604348'; // (92) 99160-4348 — "Bentes Ramos"

async function enviarViaZapi(supabase: any, tipoOrigem: string | null, telefone: string, mensagem: string): Promise<boolean> {
  const isTrafego = tipoOrigem === 'trafego' || tipoOrigem === 'trafego_isa';
  const targetPhone = isTrafego ? PHONE_TRAFEGO : PHONE_ESCRITORIO;
  const { data: instances } = await supabase
    .from('zapi_instances')
    .select('instance_id, token, client_token, phone_number, is_default')
    .eq('is_active', true);
  const byPhone = (instances || []).find((i: any) => i.phone_number?.replace(/\D/g, '') === targetPhone);
  const byFlag  = isTrafego
    ? (instances || []).find((i: any) => !i.is_default)
    : (instances || []).find((i: any) => i.is_default);
  const inst = byPhone || byFlag || (instances || [])[0];
  if (!inst) return false;
  let cleanPhone = telefone.replace(/\D/g, '');
  if (cleanPhone.length <= 11) cleanPhone = '55' + cleanPhone;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (inst.client_token) headers['Client-Token'] = inst.client_token;
  const response = await fetch(
    `https://api.z-api.io/instances/${inst.instance_id}/token/${inst.token}/send-text`,
    { method: 'POST', headers, body: JSON.stringify({ phone: cleanPhone, message: mensagem }) },
  );
  return response.ok;
}

// Lista de tribunais disponíveis
const TRIBUNAIS: Record<string, string> = {
  'trt1': 'api_publica_trt1', 'trt2': 'api_publica_trt2', 'trt3': 'api_publica_trt3',
  'trt4': 'api_publica_trt4', 'trt5': 'api_publica_trt5', 'trt6': 'api_publica_trt6',
  'trt7': 'api_publica_trt7', 'trt8': 'api_publica_trt8', 'trt9': 'api_publica_trt9',
  'trt10': 'api_publica_trt10', 'trt11': 'api_publica_trt11', 'trt12': 'api_publica_trt12',
  'trt13': 'api_publica_trt13', 'trt14': 'api_publica_trt14', 'trt15': 'api_publica_trt15',
  'trt16': 'api_publica_trt16', 'trt17': 'api_publica_trt17', 'trt18': 'api_publica_trt18',
  'trt19': 'api_publica_trt19', 'trt20': 'api_publica_trt20', 'trt21': 'api_publica_trt21',
  'trt22': 'api_publica_trt22', 'trt23': 'api_publica_trt23', 'trt24': 'api_publica_trt24',
  'tjac': 'api_publica_tjac', 'tjal': 'api_publica_tjal', 'tjam': 'api_publica_tjam',
  'tjap': 'api_publica_tjap', 'tjba': 'api_publica_tjba', 'tjce': 'api_publica_tjce',
  'tjdft': 'api_publica_tjdft', 'tjes': 'api_publica_tjes', 'tjgo': 'api_publica_tjgo',
  'tjma': 'api_publica_tjma', 'tjmg': 'api_publica_tjmg', 'tjms': 'api_publica_tjms',
  'tjmt': 'api_publica_tjmt', 'tjpa': 'api_publica_tjpa', 'tjpb': 'api_publica_tjpb',
  'tjpe': 'api_publica_tjpe', 'tjpi': 'api_publica_tjpi', 'tjpr': 'api_publica_tjpr',
  'tjrj': 'api_publica_tjrj', 'tjrn': 'api_publica_tjrn', 'tjro': 'api_publica_tjro',
  'tjrr': 'api_publica_tjrr', 'tjrs': 'api_publica_tjrs', 'tjsc': 'api_publica_tjsc',
  'tjse': 'api_publica_tjse', 'tjsp': 'api_publica_tjsp', 'tjto': 'api_publica_tjto',
  'trf1': 'api_publica_trf1', 'trf2': 'api_publica_trf2', 'trf3': 'api_publica_trf3',
  'trf4': 'api_publica_trf4', 'trf5': 'api_publica_trf5', 'trf6': 'api_publica_trf6',
  'stj': 'api_publica_stj', 'tst': 'api_publica_tst',
};

// Detecta tribunal pelo número do processo
function detectarTribunal(numeroProcesso: string): string | null {
  const match = numeroProcesso.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/);
  if (!match) return null;
  
  const justica = match[1];
  const tribunal = match[2];
  
  if (justica === '5') {
    const trtNum = parseInt(tribunal);
    if (trtNum >= 1 && trtNum <= 24) return `trt${trtNum}`;
  }
  
  if (justica === '4') {
    const trfNum = parseInt(tribunal);
    if (trfNum >= 1 && trfNum <= 6) return `trf${trfNum}`;
  }
  
  if (justica === '8') {
    const tjNum = parseInt(tribunal);
    const TJ_CODES: Record<number, string> = {
      1: 'tjac', 2: 'tjal', 3: 'tjap', 4: 'tjam', 5: 'tjba',
      6: 'tjce', 7: 'tjdft', 8: 'tjes', 9: 'tjgo', 10: 'tjma',
      11: 'tjmt', 12: 'tjms', 13: 'tjmg', 14: 'tjpa', 15: 'tjpb',
      16: 'tjpr', 17: 'tjpe', 18: 'tjpi', 19: 'tjrj', 20: 'tjrn',
      21: 'tjrs', 22: 'tjro', 23: 'tjrr', 24: 'tjsc', 25: 'tjsp',
      26: 'tjse', 27: 'tjto'
    };
    if (TJ_CODES[tjNum]) return TJ_CODES[tjNum];
  }
  
  return null;
}

// Converte Date para dd/mm/yyyy no fuso de Manaus (UTC-4)
function formatDateManaus(date: Date): string {
  const m = new Date(date.getTime() - 4 * 60 * 60 * 1000); // UTC-4
  const day   = m.getUTCDate().toString().padStart(2, '0');
  const month = (m.getUTCMonth() + 1).toString().padStart(2, '0');
  const year  = m.getUTCFullYear();
  return (year >= 1900 && year <= 2100) ? `${day}/${month}/${year}` : 'Não informado';
}

// Formata data de diferentes formatos da API DataJud
function formatarData(dataStr: string | null | undefined): string {
  if (!dataStr) return 'Não informado';
  try {
    const str = String(dataStr).trim();

    // Número (timestamp em ms) — só aceita como number, não como string
    if (typeof dataStr === 'number') {
      return formatDateManaus(new Date(dataStr));
    }

    // Somente data sem hora: YYYY-MM-DD → exibir como-está (já é data brasileira)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split('-');
      return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
    }

    // ISO com hora (tem 'T'): 2023-10-17T00:00:00.000Z → converter para Manaus
    if (str.includes('T')) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) return formatDateManaus(d);
    }

    // Formato brasileiro: dd/mm/yyyy → já está correto
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;

    // Fallback genérico
    const d = new Date(str);
    if (!isNaN(d.getTime())) return formatDateManaus(d);
  } catch { /* ignore */ }
  return String(dataStr);
}

// Determina status do processo
function determinarStatus(processo: any): string {
  if (processo.situacao) return processo.situacao;
  const movimentos = processo.movimentos || [];
  if (movimentos.length > 0) {
    const ultima = movimentos[0].nome?.toLowerCase() || '';
    if (ultima.includes('arquiv')) return 'Arquivado';
    if (ultima.includes('baixa') || ultima.includes('trânsito')) return 'Transitado em Julgado';
    if (ultima.includes('sentença')) return 'Com Sentença';
    if (ultima.includes('suspen')) return 'Suspenso';
    if (ultima.includes('recurso') || ultima.includes('apelação')) return 'Em Grau Recursal';
    if (ultima.includes('audiência')) return 'Aguardando Audiência';
    if (ultima.includes('conclus')) return 'Concluso para Decisão';
  }
  return 'Em Andamento';
}

// Busca processo no DataJud
async function buscarProcesso(numeroProcesso: string, tribunal: string): Promise<any> {
  if (!DATAJUD_API_KEY) throw new Error('DATAJUD_API_KEY não configurada');
  
  const apiName = TRIBUNAIS[tribunal];
  if (!apiName) throw new Error(`Tribunal ${tribunal} não suportado`);
  
  const url = `https://api-publica.datajud.cnj.jus.br/${apiName}/_search`;
  const numeroLimpo = numeroProcesso.replace(/[^\d]/g, '');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `APIKey ${DATAJUD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: { match: { numeroProcesso: numeroLimpo } },
      size: 1
    }),
  });
  
  if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
  return await response.json();
}

// Valida se o processo pertence ao escritório comparando OABs do DataJud
// com os OABs cadastrados em office_settings e perfis.
// Retorna true se confirmar, ou true como fallback quando os dados não estão disponíveis.
async function pertenceAoEscritorio(processoDataJud: any, supabase: any): Promise<boolean> {
  const [{ data: settings }, { data: perfis }] = await Promise.all([
    supabase.from('office_settings').select('oab_number, oab_state').maybeSingle(),
    supabase.from('perfis').select('oab_numero, oab_uf').not('oab_numero', 'is', null),
  ]);

  const oabsEscritorio: string[] = [];
  if (settings?.oab_number) {
    const num = String(settings.oab_number).replace(/\D/g, '');
    const uf  = (settings.oab_state || 'AM').toUpperCase();
    if (num) oabsEscritorio.push(`${num}${uf}`);
  }
  for (const p of (perfis || [])) {
    if (p.oab_numero) {
      const num = String(p.oab_numero).replace(/\D/g, '');
      const uf  = (p.oab_uf || 'AM').toUpperCase();
      if (num) oabsEscritorio.push(`${num}${uf}`);
    }
  }

  if (oabsEscritorio.length === 0) {
    console.warn('[Monitor] Nenhuma OAB configurada — aceitando processo sem validação extra');
    return true;
  }

  // Extrair OABs dos advogados retornados pelo DataJud
  const partes: any[] = processoDataJud.partes || [];
  const oabsNoProcesso: string[] = [];
  for (const parte of partes) {
    const advs = [...(parte.advogados || []), ...(parte.representantes || []), ...(parte.procuradores || [])];
    for (const adv of advs) {
      for (const oab of (adv.oabs || [])) {
        const num = String(oab.numero || '').replace(/\D/g, '');
        const uf  = (oab.uf || '').toUpperCase();
        if (num) oabsNoProcesso.push(`${num}${uf}`);
      }
    }
  }

  if (oabsNoProcesso.length === 0) {
    // DataJud não retornou advogados — confia no flag nosso_processo
    return true;
  }

  const pertence = oabsNoProcesso.some(oab => oabsEscritorio.includes(oab));
  if (!pertence) {
    console.warn(`[Monitor] ⚠️ Processo com advogados [${oabsNoProcesso.join(', ')}] não bate com escritório [${oabsEscritorio.join(', ')}]`);
  }
  return pertence;
}

// Formata mensagem de atualização para o lead
function formatarMensagemAtualizacao(processo: any, nomeCliente: string): string {
  const status = determinarStatus(processo);
  const classe = processo.classe?.nome || 'Não informado';
  const ultimaMovimentacao = processo.movimentos?.[0];
  
  let mensagem = `📋 *Atualização do seu Processo*\n\n`;
  mensagem += `Olá, ${nomeCliente}!\n\n`;
  mensagem += `Segue a atualização semanal do seu processo:\n\n`;
  mensagem += `📌 *Número:* ${processo.numeroProcesso}\n`;
  mensagem += `📁 *Classe:* ${classe}\n`;
  mensagem += `📊 *Status Atual:* ${status}\n\n`;
  
  if (ultimaMovimentacao) {
    mensagem += `🔄 *Última Movimentação:*\n`;
    mensagem += `📅 Data: ${formatarData(ultimaMovimentacao.dataHora)}\n`;
    mensagem += `📝 ${ultimaMovimentacao.nome || 'Movimentação'}\n`;
    if (ultimaMovimentacao.complementosTabelados?.length > 0) {
      const complemento = ultimaMovimentacao.complementosTabelados.map((c: any) => c.nome).join(', ');
      mensagem += `ℹ️ ${complemento}\n`;
    }
  }
  
  mensagem += `\n💼 *Bentes & Ramos Advocacia*\n`;
  mensagem += `Qualquer dúvida, estamos à disposição!`;
  
  return mensagem;
}


// Formata mensagem proativa mensal para o cliente (usa movimentos_json do sync diário)
function formatarMensagemMensal(processos: any[], nomeCliente: string): string {
  const nome = (nomeCliente || 'Cliente').split(' ')[0];
  const mes = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Manaus', month: 'long', year: 'numeric',
  });

  let msg = `Olá, ${nome}! 😊\n\n`;
  msg += `📋 *Atualização dos seus processos — ${mes}*\n\n`;

  for (let i = 0; i < processos.length; i++) {
    const p = processos[i];
    if (i > 0) msg += '\n─────────────────\n\n';
    msg += `*${i + 1}. ${p.titulo_acao || 'Processo Jurídico'}*\n`;
    msg += `📌 Nº ${p.numero_processo}\n`;
    if (p.tribunal) msg += `🏛️ ${p.tribunal}${p.orgao_julgador ? ` — ${p.orgao_julgador}` : ''}\n`;
    msg += `📊 Status: *${p.status || 'Em Andamento'}*\n`;

    const movs: any[] = p.movimentos_json || [];
    if (movs.length > 0) {
      const ultima = movs[0];
      const data = formatarData(ultima.dataHora || ultima.data);
      msg += `📅 Última movimentação (${data}):\n`;
      msg += `_${ultima.nome || 'Movimentação'}`;
      if (ultima.complemento) msg += ` — ${String(ultima.complemento).substring(0, 120)}`;
      msg += '_\n';
    } else {
      msg += `📅 Sem movimentações registradas ainda\n`;
    }
  }

  msg += `\n💼 *Bentes & Ramos Advocacia*\n`;
  msg += `Qualquer dúvida, estamos à disposição! 🙏`;
  return msg;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, lead_id, numero_processo, subscriber_id } = await req.json();
    
    // Ação: Consulta de processo sob demanda (quando lead pede)
    if (action === 'consultar_para_lead') {
      console.log(`🔍 Consultando processo ${numero_processo} para lead ${lead_id}`);
      
      if (!numero_processo) {
        return new Response(
          JSON.stringify({ success: false, error: 'Número do processo não informado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Buscar dados do lead
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('nome')
        .eq('id', lead_id)
        .single();
      
      // Detectar tribunal
      let tribunal = detectarTribunal(numero_processo);
      if (!tribunal) tribunal = 'tjam'; // Default
      
      try {
        const resultado = await buscarProcesso(numero_processo, tribunal);
        
        if (!resultado.hits || resultado.hits.total.value === 0) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              mensagem: `Não encontrei o processo ${numero_processo} no ${tribunal.toUpperCase()}. Verifique o número e tente novamente.` 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const processo = resultado.hits.hits[0]._source;
        const mensagem = formatarMensagemAtualizacao(processo, lead?.nome || 'Cliente');
        
        // Registrar evento
        await supabase.from('system_events').insert({
          tipo: 'processo',
          fonte: 'isa_consulta',
          acao: 'processo_consultado_lead',
          lead_id,
          dados: { numero_processo, tribunal, status: determinarStatus(processo) },
        });
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            mensagem,
            dados: {
              numero: processo.numeroProcesso,
              classe: processo.classe?.nome,
              status: determinarStatus(processo),
              tribunal: tribunal.toUpperCase(),
              ultimaMovimentacao: processo.movimentos?.[0]
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        console.error('❌ Erro ao consultar processo:', err);
        return new Response(
          JSON.stringify({ 
            success: false, 
            mensagem: 'Ocorreu um erro ao consultar o processo. Tente novamente mais tarde.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Ação: Monitoramento automático — cron a cada 10min, 1 cliente por execução, máx 10/dia
    if (action === 'monitor_semanal') {

      const agora = new Date();
      const MAX_POR_DIA = 10;

      // Rate limit diário: máx 10 envios por dia
      const inicioDia = new Date(agora);
      inicioDia.setHours(0, 0, 0, 0);
      const { count: enviadosHoje } = await supabase
        .from('system_events')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'processo')
        .eq('acao', 'atualizacao_processo_enviada')
        .gte('created_at', inicioDia.toISOString());

      if ((enviadosHoje ?? 0) >= MAX_POR_DIA) {
        console.log(`[Monitor] Limite diário atingido (${enviadosHoje}/${MAX_POR_DIA}). Aguardando amanhã.`);
        return new Response(
          JSON.stringify({ success: true, enviados: 0, motivo: 'limite_diario', enviados_hoje: enviadosHoje }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar o próximo processo a notificar:
      // - Do escritório (nosso_processo = true)
      // - Notificação ativa
      // - Status ativo
      // - Com número e cliente com telefone
      // - Ordenado por ultima_notificacao_at ASC NULLS FIRST (mais antigo/nunca notificado primeiro)
      const { data: processos } = await supabase
        .from('processos')
        .select(`
          id, numero_processo, titulo_acao, status, cliente_id,
          frequencia_notificacao_dias, ultima_notificacao_at,
          leads_juridicos!inner (id, nome, telefone, tipo_origem)
        `)
        .in('status', ['Em Andamento', 'Suspenso'])
        .not('numero_processo', 'is', null)
        .eq('notificacao_ativa', true)
        .eq('nosso_processo', true)
        .order('ultima_notificacao_at', { ascending: true, nullsFirst: true })
        .limit(20); // busca 20 para filtrar pela janela de frequência

      if (!processos || processos.length === 0) {
        console.log('[Monitor] Nenhum processo ativo para monitorar.');
        return new Response(
          JSON.stringify({ success: true, enviados: 0, motivo: 'sem_processos' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Encontrar o primeiro que já passou sua janela de frequência
      let proc: any = null;
      for (const p of processos) {
        const frequencia = (p as any).frequencia_notificacao_dias || 30;
        const ultima = (p as any).ultima_notificacao_at ? new Date((p as any).ultima_notificacao_at) : null;
        if (!ultima) { proc = p; break; } // nunca notificado — enviar
        const dias = Math.floor((agora.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24));
        if (dias >= frequencia) { proc = p; break; }
      }

      if (!proc) {
        console.log('[Monitor] Nenhum processo com janela de frequência vencida.');
        return new Response(
          JSON.stringify({ success: true, enviados: 0, motivo: 'todos_dentro_da_janela' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const lead = proc.leads_juridicos as any;
      const frequencia = proc.frequencia_notificacao_dias || 30;

      if (!lead?.telefone) {
        console.log(`[Monitor] Lead sem telefone para processo ${proc.numero_processo}.`);
        return new Response(
          JSON.stringify({ success: true, enviados: 0, motivo: 'sem_telefone' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        let tribunal = detectarTribunal(proc.numero_processo);
        if (!tribunal) tribunal = 'tjam';

        const resultado = await buscarProcesso(proc.numero_processo, tribunal);

        if (!resultado.hits || resultado.hits.total.value === 0) {
          console.log(`[Monitor] Processo ${proc.numero_processo} não encontrado no DataJud.`);
          return new Response(
            JSON.stringify({ success: true, enviados: 0, motivo: 'nao_encontrado_datajud', numero: proc.numero_processo }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const processoAtualizado = resultado.hits.hits[0]._source;

        // Validar se o processo é realmente do escritório pelo OAB
        const ehNosso = await pertenceAoEscritorio(processoAtualizado, supabase);
        if (!ehNosso) {
          console.log(`[Monitor] ⛔ Processo ${proc.numero_processo} não pertence ao escritório (OAB não bate). Marcando nosso_processo=false.`);
          await supabase.from('processos').update({ nosso_processo: false }).eq('id', proc.id);
          return new Response(
            JSON.stringify({ success: true, enviados: 0, motivo: 'processo_outro_escritorio', numero: proc.numero_processo }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const novoStatus = determinarStatus(processoAtualizado);

        // Verificar se houve movimentação recente
        const ultimaMovimentacao = processoAtualizado.movimentos?.[0];
        let houveMudanca = false;
        if (ultimaMovimentacao?.dataHora) {
          const diasAtras = new Date();
          diasAtras.setDate(diasAtras.getDate() - frequencia);
          houveMudanca = new Date(ultimaMovimentacao.dataHora) > diasAtras;
        }

        // Atualizar status no banco se mudou
        if (novoStatus !== proc.status) {
          await supabase.from('processos').update({ status: novoStatus }).eq('id', proc.id);
        }

        const mensagem = formatarMensagemAtualizacao(processoAtualizado, lead.nome || 'Cliente');
        // Routing null-safe: tráfego → instância tráfego; qualquer outro → escritório
        const tipoOrigem = lead.tipo_origem ?? 'escritorio';
        const enviado = await enviarViaZapi(supabase, tipoOrigem, lead.telefone, mensagem);

        if (enviado) {
          await supabase.from('processos')
            .update({ ultima_notificacao_at: agora.toISOString() })
            .eq('id', proc.id);

          await supabase.from('system_events').insert({
            tipo: 'processo', fonte: 'isa_monitor', acao: 'atualizacao_processo_enviada',
            lead_id: proc.cliente_id,
            dados: { numero_processo: proc.numero_processo, status: novoStatus, houve_mudanca: houveMudanca, frequencia_dias: frequencia },
          });

          await supabase.from('interacoes').insert({
            cliente_id: proc.cliente_id, tipo: 'Mensagem',
            resumo: `Atualização do processo ${proc.numero_processo}`,
            detalhes: `Status: ${novoStatus}. ${houveMudanca ? 'Movimentação recente.' : 'Sem novas movimentações.'} Freq: ${frequencia} dias.`,
            direcao: 'saida',
          });

          // Registrar no chat (manychat_mensagens) para aparecer na timeline do lead
          const phoneClean = (lead.telefone || '').replace(/\D/g, '');
          const phoneE164  = phoneClean.length <= 11 ? '55' + phoneClean : phoneClean;
          await supabase.from('manychat_mensagens').insert({
            subscriber_id:   `zapi_${phoneE164}`,
            subscriber_nome: 'Bentes & Ramos (Processos)',
            lead_id:         proc.cliente_id,
            conteudo:        mensagem,
            direcao:         'saida',
            tipo:            'text',
            canal:           'whatsapp',
            metadata: { source: 'processo_monitor', numero_processo: proc.numero_processo, status: novoStatus },
          });

          console.log(`[Monitor] ✅ Enviado para ${lead.nome} (${proc.numero_processo}) — ${(enviadosHoje ?? 0) + 1}/${MAX_POR_DIA} hoje`);

          return new Response(
            JSON.stringify({ success: true, enviados: 1, lead: lead.nome, numero_processo: proc.numero_processo, enviados_hoje: (enviadosHoje ?? 0) + 1 }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, enviados: 0, motivo: 'falha_zapi', numero: proc.numero_processo }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (err: any) {
        console.error(`[Monitor] ❌ Erro ao processar ${proc.numero_processo}:`, err);
        return new Response(
          JSON.stringify({ success: false, erro: err.message, numero: proc.numero_processo }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // ─── Notificação mensal proativa para leads do escritório ──────────────────
    if (action === 'notificar_mensal_escritorio') {
      console.log('📅 Iniciando notificação mensal do escritório...');

      // Buscar todos os processos ativos com dados do lead
      const { data: processos } = await supabase
        .from('processos')
        .select(`
          id, numero_processo, titulo_acao, status, tribunal, orgao_julgador,
          movimentos_json, data_ultima_atualizacao, cliente_id,
          lead:leads_juridicos!inner(id, nome, telefone, tipo_origem)
        `)
        .not('status', 'in', '("Arquivado","Perdido","Transitado em Julgado")')
        .not('numero_processo', 'is', null)
        .not('cliente_id', 'is', null)
        .eq('nosso_processo', true);

      if (!processos || processos.length === 0) {
        return new Response(JSON.stringify({ success: true, enviados: 0, message: 'Nenhum processo ativo' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Filtrar somente leads do escritório (não tráfego)
      const processosEsc = processos.filter((p: any) => {
        const tipo = p.lead?.tipo_origem;
        return tipo !== 'trafego' && tipo !== 'trafego_isa';
      });

      // Agrupar por lead (um envio por cliente com todos os processos dele)
      const leadMap = new Map<string, { lead: any; processos: any[] }>();
      for (const proc of processosEsc) {
        const lid = proc.cliente_id;
        if (!lid) continue;
        if (!leadMap.has(lid)) leadMap.set(lid, { lead: proc.lead, processos: [] });
        leadMap.get(lid)!.processos.push(proc);
      }

      console.log(`📊 ${leadMap.size} clientes do escritório com processos ativos`);

      // Limite de envio por dia (evita spam em reprocessamentos)
      const MAX_POR_EXECUCAO = 50;
      const vinte5diasAtras = new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString();

      let enviados = 0;
      let pulados  = 0;
      let erros    = 0;

      for (const [leadId, { lead, processos: procs }] of leadMap) {
        if (enviados >= MAX_POR_EXECUCAO) break;
        if (!lead?.telefone) { pulados++; continue; }

        // Verificar se já enviamos notificação mensal recentemente (últimos 25 dias)
        const { data: jaEnviado } = await supabase
          .from('system_events')
          .select('id')
          .eq('tipo', 'notificacao_mensal_escritorio')
          .eq('lead_id', leadId)
          .gte('created_at', vinte5diasAtras)
          .limit(1);

        if (jaEnviado?.length) {
          console.log(`⏭️ Lead ${leadId} — notificação mensal já enviada, pulando`);
          pulados++;
          continue;
        }

        try {
          const mensagem = formatarMensagemMensal(procs, lead.nome);
          const enviado  = await enviarViaZapi(supabase, null, lead.telefone, mensagem);

          if (enviado) {
            enviados++;
            await supabase.from('system_events').insert({
              tipo: 'notificacao_mensal_escritorio',
              fonte: 'processo_status_monitor',
              acao: 'mensal_enviado',
              lead_id: leadId,
              dados: { processos: procs.map((p: any) => p.numero_processo), total: procs.length },
            });
            console.log(`✅ Notificação mensal enviada para ${lead.nome} (${procs.length} processo(s))`);
          } else {
            erros++;
          }
        } catch (err) {
          console.error(`❌ Erro ao notificar ${leadId}:`, err);
          erros++;
        }

        // Anti-spam: 2s entre envios
        await new Promise(r => setTimeout(r, 2000));
      }

      console.log(`📊 Mensal concluído: ${enviados} enviados, ${pulados} pulados, ${erros} erros`);
      return new Response(
        JSON.stringify({ success: true, enviados, pulados, erros, total_clientes: leadMap.size }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('❌ Erro na função:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
