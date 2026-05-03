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

// Formata data de diferentes formatos possíveis da API DataJud
function formatarData(dataStr: string | null | undefined): string {
  if (!dataStr) return 'Não informado';
  
  try {
    let date: Date | null = null;
    
    // Se for número (timestamp em milissegundos)
    if (typeof dataStr === 'number' || !isNaN(Number(dataStr))) {
      const timestamp = Number(dataStr);
      if (timestamp > 0 && timestamp < 4102444800000) {
        date = new Date(timestamp);
      }
    }
    
    // Formato ISO: 2023-10-17T00:00:00.000Z
    if (!date && typeof dataStr === 'string' && dataStr.includes('-')) {
      const datePart = dataStr.split('T')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          date = new Date(year, month, day);
        }
      }
    }
    
    // Formato brasileiro: dd/mm/yyyy
    if (!date && typeof dataStr === 'string' && dataStr.includes('/')) {
      const parts = dataStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        if (year >= 1900 && year <= 2100) {
          date = new Date(year, month, day);
        }
      }
    }
    
    if (date && !isNaN(date.getTime())) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      if (year >= 1900 && year <= 2100) {
        return `${day}/${month}/${year}`;
      }
    }
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


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // PAUSADO — notificações de processo desativadas temporariamente
  const ATIVO = false;
  if (!ATIVO) {
    console.log('[PROCESSO-MONITOR] Função pausada (ATIVO=false)');
    return new Response(JSON.stringify({ success: true, paused: true, message: 'Função pausada temporariamente' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
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
    
    // Ação: Monitoramento automático com frequência personalizável
    if (action === 'monitor_semanal') {
      console.log('📋 Iniciando monitoramento de processos com frequência personalizável...');
      
      const agora = new Date();
      
      // Buscar todos os processos ativos com notificação ativa
      const { data: processos } = await supabase
        .from('processos')
        .select(`
          id,
          numero_processo,
          titulo_acao,
          status,
          cliente_id,
          frequencia_notificacao_dias,
          ultima_notificacao_at,
          notificacao_ativa,
          leads_juridicos!inner (
            id,
            nome,
            telefone,
            tipo_origem
          )
        `)
        .in('status', ['Em Andamento', 'Suspenso'])
        .not('numero_processo', 'is', null)
        .eq('notificacao_ativa', true);
      
      if (!processos || processos.length === 0) {
        console.log('📭 Nenhum processo ativo para monitorar');
        return new Response(
          JSON.stringify({ success: true, processados: 0, mensagem: 'Nenhum processo ativo' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`📊 ${processos.length} processos para avaliar`);
      
      let enviados = 0;
      let erros = 0;
      let ignorados = 0;
      
      for (const proc of processos) {
        if (!proc.numero_processo) continue;
        
        // Verificar se está na hora de enviar baseado na frequência
        const frequencia = proc.frequencia_notificacao_dias || 7;
        const ultimaNotificacao = proc.ultima_notificacao_at ? new Date(proc.ultima_notificacao_at) : null;
        
        if (ultimaNotificacao) {
          const diasDesdeUltima = Math.floor((agora.getTime() - ultimaNotificacao.getTime()) / (1000 * 60 * 60 * 24));
          if (diasDesdeUltima < frequencia) {
            console.log(`⏭️ Processo ${proc.numero_processo}: próxima notificação em ${frequencia - diasDesdeUltima} dias`);
            ignorados++;
            continue;
          }
        }
        
        const leadId = proc.cliente_id;
        const lead = proc.leads_juridicos as any;
        
        try {
          // Detectar tribunal e buscar dados atualizados
          let tribunal = detectarTribunal(proc.numero_processo);
          if (!tribunal) tribunal = 'tjam';
          
          const resultado = await buscarProcesso(proc.numero_processo, tribunal);
          
          if (resultado.hits && resultado.hits.total.value > 0) {
            const processoAtualizado = resultado.hits.hits[0]._source;
            const novoStatus = determinarStatus(processoAtualizado);
            
            // Verificar se houve movimentação recente
            const ultimaMovimentacao = processoAtualizado.movimentos?.[0];
            let houveMudanca = false;
            
            if (ultimaMovimentacao?.dataHora) {
              const dataMovimentacao = new Date(ultimaMovimentacao.dataHora);
              const diasAtras = new Date();
              diasAtras.setDate(diasAtras.getDate() - frequencia);
              houveMudanca = dataMovimentacao > diasAtras;
            }
            
            // Atualizar status do processo no banco se mudou
            if (novoStatus !== proc.status) {
              await supabase
                .from('processos')
                .update({ status: novoStatus })
                .eq('id', proc.id);
            }
            
            if (lead?.telefone) {
              // Gerar mensagem personalizada
              const mensagem = formatarMensagemAtualizacao(processoAtualizado, lead?.nome || 'Cliente');

              // Enviar via Z-API usando telefone + origem do lead
              const enviado = await enviarViaZapi(supabase, lead?.tipo_origem ?? null, lead.telefone, mensagem);
              
              if (enviado) {
                enviados++;
                console.log(`✅ Atualização enviada para ${lead?.nome} (${proc.numero_processo}) - frequência ${frequencia} dias`);
                
                // Atualizar data da última notificação
                await supabase
                  .from('processos')
                  .update({ ultima_notificacao_at: agora.toISOString() })
                  .eq('id', proc.id);
                
                // Registrar evento
                await supabase.from('system_events').insert({
                  tipo: 'processo',
                  fonte: 'isa_monitor',
                  acao: 'atualizacao_processo_enviada',
                  lead_id: leadId,
                  dados: { 
                    numero_processo: proc.numero_processo, 
                    status: novoStatus,
                    houve_mudanca: houveMudanca,
                    frequencia_dias: frequencia
                  },
                });
                
                // Registrar interação
                await supabase.from('interacoes').insert({
                  cliente_id: leadId,
                  tipo: 'Mensagem',
                  resumo: `Atualização do processo ${proc.numero_processo}`,
                  detalhes: `Status: ${novoStatus}. ${houveMudanca ? 'Houve movimentação recente.' : 'Sem novas movimentações.'} Frequência: ${frequencia} dias.`,
                  direcao: 'saida',
                });
              }
            }
          }
          
          // Delay entre requisições para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (err) {
          console.error(`❌ Erro ao processar ${proc.numero_processo}:`, err);
          erros++;
        }
      }
      
      console.log(`📊 Monitoramento concluído: ${enviados} enviados, ${ignorados} ignorados, ${erros} erros`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          processados: processos.length,
          enviados,
          ignorados,
          erros
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
