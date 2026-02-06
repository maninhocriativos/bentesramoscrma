import "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encode as hexEncode } from "https://deno.land/std@0.190.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ESCAVADOR_API_KEY = Deno.env.get('ESCAVADOR_API_KEY');
const DATAJUD_API_KEY = Deno.env.get('DATAJUD_API_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =====================================================
// UTILITÁRIOS
// =====================================================

function normalizarCNJ(input: string): string {
  return input.replace(/[^\d]/g, '');
}

function formatarCNJ(cnj: string): string {
  const clean = normalizarCNJ(cnj);
  if (clean.length !== 20) return cnj;
  return `${clean.slice(0,7)}-${clean.slice(7,9)}.${clean.slice(9,13)}.${clean.slice(13,14)}.${clean.slice(14,16)}.${clean.slice(16,20)}`;
}

function validarCNJ(cnj: string): boolean {
  const clean = normalizarCNJ(cnj);
  return clean.length === 20 && /^\d{20}$/.test(clean);
}

async function gerarHashMovimentacao(cnj: string, data: string, titulo: string, descricao: string): Promise<string> {
  const normalized = [
    cnj || '',
    data || '',
    (titulo || '').toLowerCase().trim(),
    (descricao || '').toLowerCase().trim().replace(/\s+/g, ' ')
  ].join('|');
  
  const encoder = new TextEncoder();
  const data_array = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data_array);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function formatarData(dataStr: string | null | undefined): string {
  if (!dataStr) return 'Não informado';
  try {
    const date = new Date(dataStr);
    if (isNaN(date.getTime())) return dataStr;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dataStr;
  }
}

// =====================================================
// RETRY COM BACKOFF
// =====================================================

async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3,
  timeoutMs = 12000
): Promise<{ response: Response | null; error: string | null; httpCode: number | null; durationMs: number }> {
  const delays = [2000, 5000, 10000];
  const startTime = Date.now();
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.status === 429 && attempt < maxRetries) {
        console.log(`⏳ Rate limit (429), aguardando ${delays[attempt]}ms...`);
        await new Promise(r => setTimeout(r, delays[attempt]));
        continue;
      }
      
      return { 
        response, 
        error: null, 
        httpCode: response.status,
        durationMs: Date.now() - startTime 
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log(`⏱️ Timeout após ${timeoutMs}ms, tentativa ${attempt + 1}/${maxRetries + 1}`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, delays[Math.min(attempt, delays.length - 1)]));
          continue;
        }
        return { response: null, error: 'TIMEOUT', httpCode: null, durationMs: Date.now() - startTime };
      }
      
      return { response: null, error: err.message, httpCode: null, durationMs: Date.now() - startTime };
    }
  }
  
  return { response: null, error: 'MAX_RETRIES', httpCode: null, durationMs: Date.now() - startTime };
}

// =====================================================
// ESCAVADOR API v2
// =====================================================

async function buscarEscavador(cnj: string): Promise<{ data: any; error: string | null; httpCode: number | null; durationMs: number }> {
  if (!ESCAVADOR_API_KEY) {
    return { data: null, error: 'ESCAVADOR_API_KEY não configurada', httpCode: null, durationMs: 0 };
  }
  
  console.log(`🔍 [Escavador] Buscando CNJ: ${formatarCNJ(cnj)}`);
  
  const { response, error, httpCode, durationMs } = await fetchWithRetry(
    `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(formatarCNJ(cnj))}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (error || !response) {
    console.error(`❌ [Escavador] Erro: ${error}`);
    return { data: null, error: error || 'Request failed', httpCode, durationMs };
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [Escavador] HTTP ${response.status}: ${errorText.slice(0, 200)}`);
    return { data: null, error: `HTTP ${response.status}`, httpCode: response.status, durationMs };
  }
  
  const data = await response.json();
  console.log(`✅ [Escavador] Sucesso em ${durationMs}ms`);
  return { data, error: null, httpCode: response.status, durationMs };
}

async function buscarEscavadorPorCPF(cpf: string): Promise<{ data: any[]; error: string | null }> {
  if (!ESCAVADOR_API_KEY) {
    return { data: [], error: 'ESCAVADOR_API_KEY não configurada' };
  }
  
  const cpfLimpo = cpf.replace(/[^\d]/g, '');
  console.log(`🔍 [Escavador] Buscando CPF: ${cpfLimpo}`);
  
  const { response, error } = await fetchWithRetry(
    `https://api.escavador.com/api/v2/envolvido/processos?cpf_cnpj=${cpfLimpo}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (error || !response || !response.ok) {
    return { data: [], error: error || 'Request failed' };
  }
  
  const data = await response.json();
  return { data: data.items || [], error: null };
}

// =====================================================
// DATAJUD API (FALLBACK)
// =====================================================

async function buscarDataJud(cnj: string): Promise<{ data: any; error: string | null; httpCode: number | null; durationMs: number }> {
  if (!DATAJUD_API_KEY) {
    return { data: null, error: 'DATAJUD_API_KEY não configurada', httpCode: null, durationMs: 0 };
  }
  
  console.log(`🔍 [DataJud] Buscando CNJ: ${formatarCNJ(cnj)}`);
  
  // DataJud usa número do tribunal extraído do CNJ
  const tribunalCode = cnj.slice(13, 16);
  const tribunalMapping: Record<string, string> = {
    '802': 'api_publica_tjam', // TJAM
    '801': 'api_publica_tjac', // TJAC
    // Adicione mais mapeamentos conforme necessário
  };
  
  const endpoint = tribunalMapping[tribunalCode] || 'api_publica_tjsp';
  
  const { response, error, httpCode, durationMs } = await fetchWithRetry(
    `https://api-publica.datajud.cnj.jus.br/${endpoint}/_search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: {
          match: {
            numeroProcesso: normalizarCNJ(cnj)
          }
        }
      })
    }
  );
  
  if (error || !response) {
    console.error(`❌ [DataJud] Erro: ${error}`);
    return { data: null, error: error || 'Request failed', httpCode, durationMs };
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [DataJud] HTTP ${response.status}: ${errorText.slice(0, 200)}`);
    return { data: null, error: `HTTP ${response.status}`, httpCode: response.status, durationMs };
  }
  
  const data = await response.json();
  const hit = data?.hits?.hits?.[0]?._source;
  
  if (!hit) {
    return { data: null, error: 'NOT_FOUND', httpCode: 200, durationMs };
  }
  
  console.log(`✅ [DataJud] Sucesso em ${durationMs}ms`);
  return { data: hit, error: null, httpCode: 200, durationMs };
}

// =====================================================
// NORMALIZAÇÃO DOS DADOS
// =====================================================

function normalizarEscavador(data: any, cnj: string): any {
  const fonteTribunal = data?.fontes?.find((f: any) => f.tipo === 'TRIBUNAL') || data?.fontes?.[0];
  
  const partes = (fonteTribunal?.partes || data?.partes || data?.envolvidos || []).map((p: any) => ({
    nome: p.nome || p.pessoa?.nome || 'Desconhecido',
    tipo: p.tipo_participacao || p.tipo || 'Parte',
    polo: p.polo?.toUpperCase() === 'ATIVO' ? 'AT' : (p.polo?.toUpperCase() === 'PASSIVO' ? 'PA' : 'OUTRO'),
    tipoPessoa: p.tipo_pessoa || 'FISICA',
    documento: p.cpf || p.cnpj || null,
    advogados: (p.advogados || []).map((adv: any) => ({
      nome: adv.nome,
      oab: adv.inscricoes?.[0] ? `OAB/${adv.inscricoes[0].uf || ''} ${adv.inscricoes[0].numero || ''}`.trim() : adv.oab
    }))
  }));

  const movimentos = (fonteTribunal?.movimentacoes || data?.movimentacoes || []).slice(0, 100).map((m: any) => ({
    dataHora: formatarData(m.data || m.data_hora),
    dataHoraRaw: m.data || m.data_hora || new Date().toISOString(),
    nome: m.titulo || m.conteudo || m.descricao || 'Movimentação',
    complemento: m.conteudo || m.complemento || null,
    codigo: null
  }));

  let status = 'Em Andamento';
  const statusPredito = fonteTribunal?.status_predito || data?.status_predito;
  if (statusPredito === 'INATIVO' || statusPredito === 'BAIXADO') status = 'Arquivado';
  else if (statusPredito === 'SUSPENSO') status = 'Suspenso';

  const assuntos = (fonteTribunal?.assuntos || data?.assuntos || []).map((a: any) => ({
    nome: typeof a === 'string' ? a : (a.nome || a.descricao || String(a)),
    codigo: a.codigo ? String(a.codigo) : undefined
  }));

  return {
    cnj: normalizarCNJ(cnj),
    cnjFormatado: formatarCNJ(cnj),
    numeroProcesso: data.numero_cnj || fonteTribunal?.numero_processo,
    classe: fonteTribunal?.classe?.nome || data?.titulo_classe || data?.classe || 'Processo',
    classeCodigo: fonteTribunal?.classe?.codigo ? String(fonteTribunal.classe.codigo) : undefined,
    assuntos,
    tribunal: fonteTribunal?.nome?.match(/TJ|TRT|TRF|STJ|STF/)?.[0] || fonteTribunal?.sigla || data?.sigla_tribunal || 'Não informado',
    dataAjuizamento: formatarData(fonteTribunal?.data_inicio || data?.data_inicio),
    grau: fonteTribunal?.grau || '1º Grau',
    nivelSigilo: data?.segredo_justica ? 'Segredo de Justiça' : 'Público',
    formato: 'Eletrônico',
    sistemaProcessual: fonteTribunal?.sistema || 'Escavador',
    orgaoJulgador: fonteTribunal?.orgao_julgador?.nome || fonteTribunal?.vara || 'Não informado',
    status,
    statusDetalhado: statusPredito || status,
    ultimaAtualizacao: formatarData(fonteTribunal?.data_ultima_movimentacao || data?.data_ultima_movimentacao),
    valorCausa: fonteTribunal?.valor_causa || data?.valor_causa || null,
    prioridade: [],
    movimentos,
    partes,
    fonte: 'escavador',
    fonteRaw: data
  };
}

function normalizarDataJud(data: any, cnj: string): any {
  const partes = (data.partes || []).map((p: any) => ({
    nome: p.nome || 'Desconhecido',
    tipo: p.tipo || 'Parte',
    polo: p.polo || 'OUTRO',
    tipoPessoa: p.tipoPessoa || 'FISICA',
    documento: null,
    advogados: []
  }));

  const movimentos = (data.movimentos || []).slice(0, 100).map((m: any) => ({
    dataHora: formatarData(m.dataHora),
    dataHoraRaw: m.dataHora || new Date().toISOString(),
    nome: m.nome || 'Movimentação',
    complemento: m.complemento || null,
    codigo: m.codigo
  }));

  return {
    cnj: normalizarCNJ(cnj),
    cnjFormatado: formatarCNJ(cnj),
    numeroProcesso: data.numeroProcesso,
    classe: data.classe?.nome || 'Processo',
    classeCodigo: data.classe?.codigo ? String(data.classe.codigo) : undefined,
    assuntos: (data.assuntos || []).map((a: any) => ({ nome: a.nome, codigo: a.codigo })),
    tribunal: data.tribunal || 'Não informado',
    dataAjuizamento: formatarData(data.dataAjuizamento),
    grau: data.grau || '1º Grau',
    nivelSigilo: data.nivelSigilo === 0 ? 'Público' : 'Segredo de Justiça',
    formato: data.formato?.nome || 'Eletrônico',
    sistemaProcessual: 'DataJud',
    orgaoJulgador: data.orgaoJulgador?.nome || 'Não informado',
    status: 'Em Andamento',
    statusDetalhado: data.situacao || 'Em Andamento',
    ultimaAtualizacao: formatarData(data.dataHoraUltimaAtualizacao),
    valorCausa: data.valorCausa || null,
    prioridade: data.prioridade || [],
    movimentos,
    partes,
    fonte: 'datajud',
    fonteRaw: data
  };
}

// =====================================================
// CACHE E PERSISTÊNCIA
// =====================================================

async function verificarCache(cnj: string): Promise<{ cached: boolean; processo: any | null }> {
  const cnjNorm = normalizarCNJ(cnj);
  
  const { data, error } = await supabase
    .from('processos')
    .select('*, processo_movimentacoes(*), processo_partes(*)')
    .eq('cnj_normalizado', cnjNorm)
    .single();
  
  if (error || !data) {
    return { cached: false, processo: null };
  }
  
  // Cache válido por 30 minutos
  const cacheValidUntil = data.cache_valid_until ? new Date(data.cache_valid_until) : null;
  const agora = new Date();
  
  if (cacheValidUntil && cacheValidUntil > agora) {
    console.log(`📦 Cache válido encontrado para CNJ ${formatarCNJ(cnj)}`);
    return { cached: true, processo: data };
  }
  
  return { cached: false, processo: data };
}

async function persistirProcesso(processo: any, advogadoResponsavel?: string): Promise<{ id: string; movimentacoesNovas: number }> {
  const cnjNorm = normalizarCNJ(processo.cnj);
  const cacheValidUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
  
  // Upsert processo
  const { data: processoDb, error: processoError } = await supabase
    .from('processos')
    .upsert({
      numero_processo: processo.cnjFormatado,
      cnj_normalizado: cnjNorm,
      titulo_acao: processo.classe,
      tribunal: processo.tribunal,
      classe_cnj: processo.classe,
      classe_cnj_codigo: processo.classeCodigo,
      orgao_julgador: processo.orgaoJulgador,
      grau: processo.grau,
      assunto: processo.assuntos?.[0]?.nome || null,
      valor_causa: processo.valorCausa,
      status: processo.status,
      status_detalhado: processo.statusDetalhado,
      ajuizado_em: processo.dataAjuizamento !== 'Não informado' ? processo.dataAjuizamento : null,
      ultima_atualizacao: processo.ultimaAtualizacao !== 'Não informado' ? processo.ultimaAtualizacao : null,
      fonte_preferida: processo.fonte,
      fonte_raw: processo.fonteRaw,
      cache_valid_until: cacheValidUntil.toISOString(),
      advogado_responsavel: advogadoResponsavel,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'cnj_normalizado',
      ignoreDuplicates: false
    })
    .select('id')
    .single();
  
  if (processoError) {
    console.error('❌ Erro ao persistir processo:', processoError);
    throw processoError;
  }
  
  const processoId = processoDb.id;
  let movimentacoesNovas = 0;
  
  // Inserir movimentações com anti-duplicação
  for (const mov of (processo.movimentos || [])) {
    const hashUnico = await gerarHashMovimentacao(
      cnjNorm,
      mov.dataHoraRaw,
      mov.nome,
      mov.complemento || ''
    );
    
    const { error: movError } = await supabase
      .from('processo_movimentacoes')
      .upsert({
        processo_id: processoId,
        data_movimento: mov.dataHoraRaw,
        movimento_titulo: mov.nome,
        movimento_descricao: mov.complemento,
        movimento_cnj_codigo: mov.codigo ? String(mov.codigo) : null,
        origem: processo.fonte,
        hash_unico: hashUnico
      }, {
        onConflict: 'hash_unico',
        ignoreDuplicates: true
      });
    
    if (!movError) {
      movimentacoesNovas++;
    }
  }
  
  // Inserir partes com anti-duplicação
  for (const parte of (processo.partes || [])) {
    const hashParte = await gerarHashMovimentacao(
      processoId,
      parte.tipo,
      parte.nome,
      parte.documento || ''
    );
    
    await supabase
      .from('processo_partes')
      .upsert({
        processo_id: processoId,
        tipo: parte.tipo,
        nome: parte.nome,
        polo: parte.polo,
        tipo_pessoa: parte.tipoPessoa,
        documento: parte.documento,
        advogados: parte.advogados,
        hash_unico: hashParte
      }, {
        onConflict: 'hash_unico',
        ignoreDuplicates: true
      });
  }
  
  return { id: processoId, movimentacoesNovas };
}

async function registrarSyncLog(
  processoId: string | null,
  cnj: string,
  origemTentada: string,
  status: string,
  httpCode: number | null,
  mensagem: string,
  duracaoMs: number,
  movimentacoesNovas: number = 0
) {
  await supabase
    .from('processo_sync_log')
    .insert({
      processo_id: processoId,
      cnj: normalizarCNJ(cnj),
      origem_tentada: origemTentada,
      status,
      http_code: httpCode,
      mensagem,
      duracao_ms: duracaoMs,
      movimentacoes_novas: movimentacoesNovas
    });
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Aceitar tanto camelCase quanto snake_case
    const numeroProcesso = body.numero_processo || body.numeroProcesso;
    const cpf = body.cpf;
    const nome = body.nome;
    const oab = body.oab;
    const action = body.action;
    const forceRefresh = body.force_refresh || body.forceRefresh || false;
    const persistir = body.persistir || false;
    const advogadoResponsavel = body.advogadoResponsavel || body.advogado_responsavel;
    
    console.log(`📋 Consulta: action=${action}, cnj=${numeroProcesso}, cpf=${cpf}, force=${forceRefresh}`);

    // ========== BUSCA POR CPF ==========
    if ((action === 'buscar_por_cpf' || action === 'busca_cpf') && cpf) {
      const { data: processos, error } = await buscarEscavadorPorCPF(cpf);
      
      if (error || processos.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false,
            encontrado: false, 
            error: error || 'Nenhum processo encontrado para este CPF',
            processos: [],
            fonte: 'escavador'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const processosFormatados = processos.map((p: any) => ({
        numeroProcesso: p.numero_cnj,
        titulo: p.titulo || `${p.titulo_polo_ativo || 'Autor'} X ${p.titulo_polo_passivo || 'Réu'}`,
        tribunal: p.sigla_tribunal || null,
        dataAjuizamento: formatarData(p.data_inicio),
        ultimaAtualizacao: formatarData(p.data_ultima_movimentacao),
        status: p.status_predito === 'ATIVO' ? 'Em Andamento' : 
                p.status_predito === 'INATIVO' ? 'Arquivado' : 
                p.status_predito || 'Indefinido',
        fonte: 'escavador'
      }));
      
      return new Response(
        JSON.stringify({ 
          success: true,
          encontrado: true,
          multiplos: true,
          processos: processosFormatados,
          total: processosFormatados.length,
          fonte: 'escavador'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ========== BUSCA POR NÚMERO CNJ ==========
    if (!numeroProcesso) {
      return new Response(
        JSON.stringify({ error: 'Número do processo, CPF, nome ou OAB é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cnjNormalizado = normalizarCNJ(numeroProcesso);
    const cnjFormatado = formatarCNJ(cnjNormalizado);
    
    if (!validarCNJ(cnjNormalizado)) {
      return new Response(
        JSON.stringify({ 
          success: false,
          encontrado: false,
          error: 'Formato de CNJ inválido. Use: NNNNNNN-DD.AAAA.J.TR.OOOO' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== VERIFICAR CACHE ==========
    if (!forceRefresh) {
      const { cached, processo: cachedProcesso } = await verificarCache(cnjNormalizado);
      
      if (cached && cachedProcesso) {
        console.log(`📦 Retornando cache para ${cnjFormatado}`);
        return new Response(
          JSON.stringify({ 
            success: true,
            encontrado: true,
            processo: {
              ...cachedProcesso,
              cnjFormatado,
              fonte: cachedProcesso.fonte_preferida || 'cache',
              movimentos: cachedProcesso.processo_movimentacoes || [],
              partes: cachedProcesso.processo_partes || []
            },
            fonte: 'cache',
            cacheHit: true,
            warnings: []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== BUSCAR NO ESCAVADOR (PRINCIPAL) ==========
    const warnings: string[] = [];
    let processoNormalizado: any = null;
    let fonteUsada = 'escavador';
    
    const escavadorResult = await buscarEscavador(cnjNormalizado);
    
    if (escavadorResult.data) {
      processoNormalizado = normalizarEscavador(escavadorResult.data, cnjNormalizado);
      
      // Verificar se dados estão completos
      const dadosIncompletos = !processoNormalizado.movimentos?.length || 
                               !processoNormalizado.classe ||
                               processoNormalizado.classe === 'Processo';
      
      if (dadosIncompletos) {
        warnings.push('Dados do Escavador podem estar incompletos');
        
        // Tentar complementar com DataJud
        const datajudResult = await buscarDataJud(cnjNormalizado);
        if (datajudResult.data) {
          const datajudNorm = normalizarDataJud(datajudResult.data, cnjNormalizado);
          
          // Mesclar dados se DataJud tiver mais movimentações
          if (datajudNorm.movimentos?.length > (processoNormalizado.movimentos?.length || 0)) {
            processoNormalizado.movimentos = datajudNorm.movimentos;
            warnings.push('Movimentações complementadas via DataJud');
            fonteUsada = 'both';
          }
          
          await registrarSyncLog(null, cnjNormalizado, 'datajud', 'OK', datajudResult.httpCode, 'Complementação', datajudResult.durationMs);
        }
      }
      
      await registrarSyncLog(null, cnjNormalizado, 'escavador', 'OK', escavadorResult.httpCode, 'Sucesso', escavadorResult.durationMs);
      
    } else {
      // ========== FALLBACK PARA DATAJUD ==========
      console.log(`⚠️ Escavador falhou, tentando DataJud...`);
      warnings.push(`Escavador indisponível: ${escavadorResult.error}`);
      
      await registrarSyncLog(null, cnjNormalizado, 'escavador', 'ERROR', escavadorResult.httpCode, escavadorResult.error || 'Erro desconhecido', escavadorResult.durationMs);
      
      const datajudResult = await buscarDataJud(cnjNormalizado);
      
      if (datajudResult.data) {
        processoNormalizado = normalizarDataJud(datajudResult.data, cnjNormalizado);
        fonteUsada = 'datajud';
        warnings.push('Dados obtidos via DataJud (fallback)');
        
        await registrarSyncLog(null, cnjNormalizado, 'datajud', 'OK', datajudResult.httpCode, 'Fallback sucesso', datajudResult.durationMs);
      } else {
        await registrarSyncLog(null, cnjNormalizado, 'datajud', 'ERROR', datajudResult.httpCode, datajudResult.error || 'Erro desconhecido', datajudResult.durationMs);
        
        // Verificar se existe cache antigo
        const { processo: cachedProcesso } = await verificarCache(cnjNormalizado);
        if (cachedProcesso) {
          warnings.push('Retornando dados do cache (APIs indisponíveis)');
          return new Response(
            JSON.stringify({ 
              success: true,
              encontrado: true,
              processo: cachedProcesso,
              fonte: 'cache_stale',
              cacheHit: true,
              warnings
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            success: false,
            encontrado: false, 
            error: 'Processo não encontrado em nenhuma fonte (Escavador e DataJud)',
            warnings
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== PERSISTIR SE SOLICITADO ==========
    let processoId: string | null = null;
    let movimentacoesNovas = 0;
    
    if (persistir && processoNormalizado) {
      try {
        const result = await persistirProcesso(processoNormalizado, advogadoResponsavel);
        processoId = result.id;
        movimentacoesNovas = result.movimentacoesNovas;
        console.log(`💾 Processo persistido: ${processoId}, ${movimentacoesNovas} movimentações novas`);
      } catch (err: any) {
        console.error('❌ Erro ao persistir:', err);
        warnings.push('Erro ao salvar no banco de dados');
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        encontrado: true,
        processo: processoNormalizado,
        fonte: fonteUsada,
        cacheHit: false,
        processoId,
        movimentacoesNovas,
        warnings
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro geral:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
