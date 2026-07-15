import "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  const normalized = [cnj || '', data || '', (titulo || '').toLowerCase().trim(), (descricao || '').toLowerCase().trim().replace(/\s+/g, ' ')].join('|');
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
  } catch { return dataStr; }
}

function toDbDate(val: any): string | null {
  if (!val || val === 'Não informado') return null;
  if (typeof val === 'string') {
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const ptBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ptBr) return `${ptBr[3]}-${ptBr[2]}-${ptBr[1]}`;
    if (/^\d{14}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  }
  try { const d = new Date(val); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10); } catch { /* noop */ }
  return null;
}

// =====================================================
// RETRY COM BACKOFF
// =====================================================

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, timeoutMs = 12000): Promise<{ response: Response | null; error: string | null; httpCode: number | null; durationMs: number }> {
  const delays = [2000, 5000, 10000];
  const startTime = Date.now();
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.status === 429 && attempt < maxRetries) { await new Promise(r => setTimeout(r, delays[attempt])); continue; }
      return { response, error: null, httpCode: response.status, durationMs: Date.now() - startTime };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (attempt < maxRetries) { await new Promise(r => setTimeout(r, delays[Math.min(attempt, delays.length - 1)])); continue; }
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
  if (!ESCAVADOR_API_KEY) return { data: null, error: 'ESCAVADOR_API_KEY não configurada', httpCode: null, durationMs: 0 };
  console.log(`🔍 [Escavador] Buscando CNJ: ${formatarCNJ(cnj)}`);
  const { response, error, httpCode, durationMs } = await fetchWithRetry(
    `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(formatarCNJ(cnj))}`,
    { method: 'GET', headers: { 'Authorization': `Bearer ${ESCAVADOR_API_KEY}`, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' } }
  );
  if (error || !response) return { data: null, error: error || 'Request failed', httpCode, durationMs };
  if (!response.ok) { await response.text(); return { data: null, error: `HTTP ${response.status}`, httpCode: response.status, durationMs }; }
  const data = await response.json();
  try {
    const movUrl = `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(formatarCNJ(cnj))}/movimentacoes?pagina=1`;
    const { response: movResp } = await fetchWithRetry(movUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${ESCAVADOR_API_KEY}`, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' } }, 2, 10000);
    data._movimentacoes = (movResp && movResp.ok) ? ((await movResp.json())?.items || []) : [];
  } catch { data._movimentacoes = []; }
  console.log(`✅ [Escavador] Sucesso em ${durationMs}ms`);
  return { data, error: null, httpCode: response.status, durationMs };
}

async function buscarEscavadorPorCPF(cpf: string): Promise<{ data: any[]; error: string | null }> {
  if (!ESCAVADOR_API_KEY) return { data: [], error: 'ESCAVADOR_API_KEY não configurada' };
  const cpfLimpo = cpf.replace(/[^\d]/g, '');
  const { response, error } = await fetchWithRetry(
    `https://api.escavador.com/api/v2/envolvido/processos?cpf_cnpj=${cpfLimpo}`,
    { method: 'GET', headers: { 'Authorization': `Bearer ${ESCAVADOR_API_KEY}`, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' } }
  );
  if (error || !response || !response.ok) return { data: [], error: error || 'Request failed' };
  const data = await response.json();
  return { data: data.items || [], error: null };
}

// =====================================================
// DATAJUD API (FALLBACK)
// =====================================================

function getDataJudEndpoint(cnj: string): string {
  const cnjClean = normalizarCNJ(cnj);
  const justicaCode = cnjClean.slice(13, 14);
  const tribunalCode = cnjClean.slice(14, 16);
  const estaduais: Record<string, string> = { '01':'api_publica_tjac','02':'api_publica_tjal','03':'api_publica_tjap','04':'api_publica_tjam','05':'api_publica_tjba','06':'api_publica_tjce','07':'api_publica_tjdft','08':'api_publica_tjes','09':'api_publica_tjgo','10':'api_publica_tjma','11':'api_publica_tjmt','12':'api_publica_tjms','13':'api_publica_tjmg','14':'api_publica_tjpa','15':'api_publica_tjpb','16':'api_publica_tjpr','17':'api_publica_tjpe','18':'api_publica_tjpi','19':'api_publica_tjrj','20':'api_publica_tjrn','21':'api_publica_tjrs','22':'api_publica_tjro','23':'api_publica_tjrr','24':'api_publica_tjsc','25':'api_publica_tjsp','26':'api_publica_tjse','27':'api_publica_tjto' };
  const federais: Record<string, string> = { '01':'api_publica_trf1','02':'api_publica_trf2','03':'api_publica_trf3','04':'api_publica_trf4','05':'api_publica_trf5','06':'api_publica_trf6' };
  const trabalho: Record<string, string> = { '01':'api_publica_trt1','02':'api_publica_trt2','03':'api_publica_trt3','04':'api_publica_trt4','05':'api_publica_trt5','06':'api_publica_trt6','07':'api_publica_trt7','08':'api_publica_trt8','09':'api_publica_trt9','10':'api_publica_trt10','11':'api_publica_trt11','12':'api_publica_trt12','13':'api_publica_trt13','14':'api_publica_trt14','15':'api_publica_trt15','16':'api_publica_trt16','17':'api_publica_trt17','18':'api_publica_trt18','19':'api_publica_trt19','20':'api_publica_trt20','21':'api_publica_trt21','22':'api_publica_trt22','23':'api_publica_trt23','24':'api_publica_trt24' };
  if (justicaCode === '8') return estaduais[tribunalCode] || 'api_publica_tjam';
  if (justicaCode === '4') return federais[tribunalCode] || 'api_publica_trf1';
  if (justicaCode === '5') return trabalho[tribunalCode] || 'api_publica_trt1';
  return 'api_publica_tjam';
}

async function buscarDataJud(cnj: string): Promise<{ data: any; error: string | null; httpCode: number | null; durationMs: number }> {
  if (!DATAJUD_API_KEY) return { data: null, error: 'DATAJUD_API_KEY não configurada', httpCode: null, durationMs: 0 };
  const endpoint = getDataJudEndpoint(cnj);
  console.log(`🔍 [DataJud] Buscando CNJ: ${formatarCNJ(cnj)} em ${endpoint}`);
  const { response, error, httpCode, durationMs } = await fetchWithRetry(
    `https://api-publica.datajud.cnj.jus.br/${endpoint}/_search`,
    { method: 'POST', headers: { 'Authorization': `APIKey ${DATAJUD_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: { match: { numeroProcesso: normalizarCNJ(cnj) } }, size: 1 }) }
  );
  if (error || !response) return { data: null, error: error || 'Request failed', httpCode, durationMs };
  if (!response.ok) return { data: null, error: `HTTP ${response.status}`, httpCode: response.status, durationMs };
  const data = await response.json();
  const hits = data?.hits?.hits || [];
  if (hits.length === 0) return { data: null, error: 'NOT_FOUND', httpCode: 200, durationMs };
  const hit = hits[0]?._source;
  if (!hit) return { data: null, error: 'NOT_FOUND', httpCode: 200, durationMs };
  console.log(`✅ [DataJud] Sucesso em ${durationMs}ms`);
  return { data: hit, error: null, httpCode: 200, durationMs };
}

// =====================================================
// NORMALIZAÇÃO
// =====================================================

function normalizarEscavador(data: any, cnj: string): any {
  const fonteTribunal = data?.fontes?.find((f: any) => f.tipo === 'TRIBUNAL') || data?.fontes?.[0];
  const capa = fonteTribunal?.capa || {};
  const rawEnvolvidos = fonteTribunal?.envolvidos || data?.envolvidos || fonteTribunal?.partes || data?.partes || [];
  const partes = rawEnvolvidos.map((p: any) => {
    const polo = (p.polo || '').toUpperCase();
    let tipoNorm = p.tipo_normalizado || p.tipo || p.tipo_participacao || 'Parte';
    const poloNorm = polo === 'ATIVO' ? 'AT' : (polo === 'PASSIVO' ? 'PA' : 'OUTRO');
    if (tipoNorm === 'Outro' || tipoNorm === 'ATIVO' || tipoNorm === 'PASSIVO') { if (poloNorm === 'AT') tipoNorm = 'Autor'; else if (poloNorm === 'PA') tipoNorm = 'Réu'; }
    return { nome: p.nome || p.pessoa?.nome || 'Desconhecido', tipo: tipoNorm, polo: poloNorm, tipoPessoa: p.tipo_pessoa || 'FISICA', documento: p.cpf || p.cnpj || null, advogados: (p.advogados || []).map((adv: any) => ({ nome: adv.nome, oab: adv.oabs?.[0] ? `OAB/${adv.oabs[0].uf || ''} ${adv.oabs[0].numero || ''}`.trim() : adv.oab || null })) };
  });
  const rawMovs = data._movimentacoes || fonteTribunal?.movimentacoes || data?.movimentacoes || [];
  const movimentos = rawMovs.slice(0, 100).map((m: any) => {
    let rawDate = m.data || m.data_hora || new Date().toISOString();
    if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())) rawDate = rawDate.trim() + 'T00:00:00Z';
    return { dataHora: formatarData(rawDate), dataHoraRaw: rawDate, nome: m.classificacao_predita?.nome || m.titulo || m.tipo_movimento || m.conteudo || m.descricao || 'Movimentação', complemento: m.conteudo || m.complemento || m.descricao_complementar || null, codigo: m.codigo || null };
  });
  let status = 'Em Andamento';
  const statusPredito = fonteTribunal?.status_predito || data?.status_predito;
  if (statusPredito === 'INATIVO' || statusPredito === 'BAIXADO') status = 'Arquivado';
  else if (statusPredito === 'SUSPENSO') status = 'Suspenso';
  let assuntos: any[] = [];
  if (capa.assuntos_normalizados?.length) assuntos = capa.assuntos_normalizados.map((a: any) => ({ nome: a.nome || a.descricao || String(a), codigo: a.codigo ? String(a.codigo) : undefined }));
  else if (capa.assunto_principal_normalizado) assuntos = [{ nome: capa.assunto_principal_normalizado.nome_com_pai || capa.assunto_principal_normalizado.nome || capa.assunto, codigo: capa.assunto_principal_normalizado.id ? String(capa.assunto_principal_normalizado.id) : undefined }];
  else if (capa.assunto) assuntos = [{ nome: capa.assunto }];
  else assuntos = (fonteTribunal?.assuntos || data?.assuntos || []).map((a: any) => ({ nome: typeof a === 'string' ? a : (a.nome || a.descricao || String(a)), codigo: a.codigo ? String(a.codigo) : undefined }));
  const classe = capa.classe || fonteTribunal?.classe?.nome || data?.titulo_classe || data?.classe || 'Processo';
  const classeCodigo = fonteTribunal?.classe?.codigo ? String(fonteTribunal.classe.codigo) : undefined;
  const tribunalSigla = fonteTribunal?.tribunal?.sigla || fonteTribunal?.sigla || fonteTribunal?.nome?.match(/TJ\w+|TRT\d+|TRF\d+|STJ|STF/)?.[0] || 'Não informado';
  const orgaoJulgador = capa.orgao_julgador || capa.orgao_julgador_normatizado?.nome || fonteTribunal?.orgao_julgador?.nome || fonteTribunal?.vara || 'Não informado';
  const valorCausa = capa.valor_causa?.valor ? parseFloat(capa.valor_causa.valor) : (fonteTribunal?.valor_causa || data?.valor_causa || null);
  const dataAjuizamento = fonteTribunal?.data_inicio || data?.data_inicio || null;
  const dataDistribuicao = capa.data_distribuicao || fonteTribunal?.data_distribuicao || null;
  // ✅ FIX 4 — numeroProcesso com fallback garantido
  const numeroProcesso = data.numero_cnj || fonteTribunal?.numero_processo || formatarCNJ(cnj);
  return { cnj: normalizarCNJ(cnj), cnjFormatado: formatarCNJ(cnj), numeroProcesso, classe, classeCodigo, assuntos, tribunal: tribunalSigla, dataAjuizamento, dataDistribuicao, grau: fonteTribunal?.grau_formatado || fonteTribunal?.grau || '1º Grau', nivelSigilo: data?.segredo_justica || fonteTribunal?.segredo_justica ? 'Segredo de Justiça' : 'Público', formato: 'Eletrônico', sistemaProcessual: fonteTribunal?.sistema || 'Escavador', orgaoJulgador, status, statusDetalhado: statusPredito || status, ultimaAtualizacao: fonteTribunal?.data_ultima_movimentacao || data?.data_ultima_movimentacao || null, valorCausa, prioridade: [], movimentos, partes, fonte: 'escavador', fonteRaw: data };
}

function normalizarDataJud(data: any, cnj: string): any {
  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const toIsoIfPossible = (v: unknown): string => { if (!v) return new Date().toISOString(); if (typeof v === 'string') { const s = v.trim(); if (/^\d{14}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}Z`; const d = new Date(s); if (!isNaN(d.getTime())) return d.toISOString(); return s; } const d = new Date(v as any); if (!isNaN(d.getTime())) return d.toISOString(); return String(v); };
  const normalizePolo = (v: unknown): string => { const s = String(v ?? '').trim().toUpperCase(); if (!s) return 'OUTRO'; if (['AT','ATIVO','POLO ATIVO','A'].includes(s)) return 'AT'; if (['PA','PASSIVO','POLO PASSIVO','R','REU','RÉU'].includes(s)) return 'PA'; return s; };
  const normalizeAdvogados = (p: any) => { const raw = [...asArray<any>(p?.advogados), ...asArray<any>(p?.representantes), ...asArray<any>(p?.procuradores)]; return raw.map((adv) => { if (!adv) return null; if (typeof adv === 'string') return { nome: adv, oab: null }; return { nome: adv.nome || adv.nomeCompleto || adv.nomeAdvogado || 'Advogado', oab: adv.oab || adv.numeroOAB || adv.inscricaoOAB || null }; }).filter(Boolean); };
  const rawPartes: Array<any> = [];
  rawPartes.push(...asArray<any>(data?.partes));
  rawPartes.push(...asArray<any>(data?.poloAtivo).map((p) => ({ ...p, __polo: 'AT', __tipo: 'Autor' })));
  rawPartes.push(...asArray<any>(data?.poloPassivo).map((p) => ({ ...p, __polo: 'PA', __tipo: 'Réu' })));
  if (data?.polo && typeof data.polo === 'object') { const poloObj = data.polo as Record<string, unknown>; rawPartes.push(...asArray<any>(poloObj.ativo).map((p) => ({ ...p, __polo: 'AT', __tipo: 'Autor' }))); rawPartes.push(...asArray<any>(poloObj.passivo).map((p) => ({ ...p, __polo: 'PA', __tipo: 'Réu' }))); rawPartes.push(...asArray<any>(poloObj.outros).map((p) => ({ ...p, __polo: 'OUTRO' }))); }
  const partes = rawPartes.map((p: any) => { if (!p) return null; const nome = typeof p === 'string' ? p : p.nome || p.nomeCompleto || p.pessoa?.nome || 'Desconhecido'; const documento = typeof p === 'object' ? p.cpf || p.cnpj || p.cpfCnpj || p.documento || null : null; const polo = normalizePolo(p.polo ?? p.__polo ?? p.poloParte ?? p.poloProcessual); let tipo = (typeof p === 'object' ? (p.tipo || p.tipoParte || p.qualificacao || p.__tipo) : null) || 'Parte'; if (tipo === 'Parte') { if (polo === 'AT') tipo = 'Autor'; else if (polo === 'PA') tipo = 'Réu'; } const tipoPessoa = p.tipoPessoa || p.tipo_pessoa || (documento ? String(documento).replace(/\D/g, '').length > 11 ? 'JURIDICA' : 'FISICA' : 'FISICA'); return { nome, tipo, polo, tipoPessoa, documento, advogados: normalizeAdvogados(p) }; }).filter(Boolean);
  const rawMovimentos = asArray<any>(data?.movimentos).length ? asArray<any>(data.movimentos) : asArray<any>(data?.movimentacoes);
  const movimentos = rawMovimentos.slice(0, 100).map((m: any) => { const dataHoraRaw = toIsoIfPossible(m?.dataHora ?? m?.data ?? m?.data_movimento); const comp = m?.complemento || (() => { const comps = asArray<any>(m?.complementosTabelados); if (comps.length === 0) return null; return comps.map((c) => c?.nome || c?.descricao || c?.valor).filter(Boolean).join('; ') || null; })(); return { dataHora: formatarData(dataHoraRaw), dataHoraRaw, nome: m?.nome || m?.movimentoNome || m?.descricao || 'Movimentação', complemento: comp, codigo: m?.codigo || m?.codigoMovimento || m?.codigoNacional || null }; });
  const classeNome = data.classe?.nome || data.classeProcessual?.nome || data.classeProcessual || 'Processo';
  const classeCodigo = data.classe?.codigo || data.classeProcessual?.codigo;
  const assuntos = asArray<any>(data.assuntos).map((a: any) => ({ nome: typeof a === 'string' ? a : a?.nome || a?.descricao || String(a), codigo: a?.codigo ? String(a.codigo) : undefined }));
  let status = 'Em Andamento';
  if (data.situacao) { const sit = String(data.situacao).toLowerCase(); if (sit.includes('arquivado') || sit.includes('baixado') || sit.includes('transitado')) status = 'Arquivado'; else if (sit.includes('suspenso')) status = 'Suspenso'; }
  return { cnj: normalizarCNJ(cnj), cnjFormatado: formatarCNJ(cnj), numeroProcesso: data.numeroProcesso || formatarCNJ(cnj), classe: classeNome, classeCodigo: classeCodigo ? String(classeCodigo) : undefined, assuntos, tribunal: data.tribunal || data.siglaTribunal || 'Não informado', dataAjuizamento: toIsoIfPossible(data.dataAjuizamento), dataDistribuicao: data.dataDistribuicao ? toIsoIfPossible(data.dataDistribuicao) : null, grau: data.grau || data.grauProcesso || '1º Grau', nivelSigilo: data.nivelSigilo === 0 || data.nivelSigilo === '0' ? 'Público' : 'Segredo de Justiça', formato: data.formato?.nome || 'Eletrônico', sistemaProcessual: 'DataJud', orgaoJulgador: data.orgaoJulgador?.nome || data.orgaoJulgador || 'Não informado', status, statusDetalhado: data.situacao || status, ultimaAtualizacao: toIsoIfPossible(data.dataHoraUltimaAtualizacao || data.dataUltimaAtualizacao), valorCausa: data.valorCausa || null, prioridade: data.prioridade || [], movimentos, partes, fonte: 'datajud', fonteRaw: data };
}

// =====================================================
// CACHE
// =====================================================

async function verificarCache(cnj: string): Promise<{ cached: boolean; processo: any | null }> {
  const cnjNorm = normalizarCNJ(cnj);
  const { data, error } = await supabase.from('processos').select('*, processo_movimentacoes(*), processo_partes(*)').eq('cnj_normalizado', cnjNorm).maybeSingle();
  if (error || !data) return { cached: false, processo: null };
  const cacheValidUntil = data.cache_valid_until ? new Date(data.cache_valid_until) : null;
  if (cacheValidUntil && cacheValidUntil > new Date()) { console.log(`📦 Cache válido para ${formatarCNJ(cnj)}`); return { cached: true, processo: data }; }
  return { cached: false, processo: data };
}

// ✅ FIX 1 — mapeia campos do banco para o formato ProcessoExterno que o frontend espera
function mapearCacheParaFrontend(cachedProcesso: any): any {
  return {
    ...cachedProcesso,
    // Frontend espera "movimentos" — banco retorna "processo_movimentacoes"
    movimentos: cachedProcesso.processo_movimentacoes?.map((m: any) => ({
      dataHora:    m.data_movimento ? new Date(m.data_movimento).toLocaleDateString('pt-BR') : '',
      dataHoraRaw: m.data_movimento,
      nome:        m.movimento_titulo || 'Movimentação',
      complemento: m.movimento_descricao || null,
      codigo:      m.movimento_cnj_codigo ? Number(m.movimento_cnj_codigo) : null,
    })) || cachedProcesso.movimentos_json || [],
    // Frontend espera "partes" — banco retorna "processo_partes"
    partes: cachedProcesso.processo_partes?.map((p: any) => ({
      nome:       p.nome,
      tipo:       p.tipo,
      polo:       p.polo || '',
      tipoPessoa: p.tipo_pessoa || 'FISICA',
      documento:  p.documento || null,
      advogados:  Array.isArray(p.advogados) ? p.advogados : [],
    })) || cachedProcesso.partes_json || [],
    // Campos de exibição normalizados para o componente ConsultaProcessoExterno
    numeroProcesso:    cachedProcesso.numero_processo || '',
    classe:            cachedProcesso.classe_cnj || cachedProcesso.titulo_acao || 'Processo',
    assuntos:          cachedProcesso.assunto ? [{ nome: cachedProcesso.assunto }] : [],
    tribunal:          cachedProcesso.tribunal || '',
    dataAjuizamento:   cachedProcesso.data_ajuizamento ? new Date(cachedProcesso.data_ajuizamento).toLocaleDateString('pt-BR') : 'Não informado',
    grau:              cachedProcesso.grau || '',
    nivelSigilo:       cachedProcesso.segredo_justica ? 'Segredo de Justiça' : 'Público',
    formato:           'Eletrônico',
    sistemaProcessual: cachedProcesso.sistema_judicial || 'DataJud',
    orgaoJulgador:     cachedProcesso.orgao_julgador || '',
    status:            cachedProcesso.status || 'Em Andamento',
    statusDetalhado:   cachedProcesso.status_detalhado || cachedProcesso.status || '',
    ultimaAtualizacao: cachedProcesso.data_ultima_atualizacao ? new Date(cachedProcesso.data_ultima_atualizacao).toLocaleDateString('pt-BR') : 'Não informado',
    valorCausa:        cachedProcesso.valor_causa || null,
    prioridade:        [],
    fonte:             cachedProcesso.fonte_preferida || 'cache',
  };
}

// =====================================================
// PERSISTÊNCIA
// =====================================================

// Resolve cliente_id pelo nome do cliente do processo -- mesma regra usada no
// backfill de 2026-07-13 (que levou a vinculacao de 31% pra 99% dos processos
// existentes): nome bate com EXATAMENTE UM lead -> vincula; nao bate com
// nenhum -> cria um lead novo a partir do proprio processo; bate com mais de
// um -> nao arrisca, deixa null pra revisao manual. Sem isso, todo processo
// novo criado automaticamente (ex: DJEN achando um CNJ ainda nao cadastrado)
// nasceria sem cliente_id de novo, reabrindo o mesmo buraco aos poucos.
async function resolverClienteId(nomeCliente: string): Promise<string | null> {
  const nomeNorm = nomeCliente.trim().replace(/\s+/g, ' ');
  if (!nomeNorm) return null;

  const { data: matches } = await supabase.from('leads_juridicos').select('id').ilike('nome', nomeNorm);
  if (matches && matches.length === 1) return matches[0].id;
  if (matches && matches.length > 1) return null;

  const { data: novoLead, error } = await supabase
    .from('leads_juridicos')
    .insert({
      nome: nomeNorm,
      status: 'Contrato Assinado',
      origem: 'Processo Existente',
      canal_origem: 'auto_processo',
      tipo_origem: 'escritorio',
    })
    .select('id')
    .single();

  if (error) { console.error('❌ Erro ao criar lead automático:', error); return null; }
  return novoLead?.id ?? null;
}

async function persistirProcesso(processo: any, processoIdExistente?: string | null, advogadoResponsavel?: string): Promise<{ id: string; movimentacoesNovas: number }> {
  const cnjNorm = normalizarCNJ(processo.cnj);
  const cacheValidUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const dadosProcesso: Record<string, any> = {
    numero_processo:         processo.cnjFormatado,
    cnj_normalizado:         cnjNorm,
    titulo_acao:             processo.classe || null,
    tribunal:                processo.tribunal || null,
    classe_cnj:              processo.classe || null,
    classe_cnj_codigo:       processo.classeCodigo || null,
    orgao_julgador:          processo.orgaoJulgador || null,
    grau:                    processo.grau || null,
    assunto:                 processo.assuntos?.[0]?.nome || null,
    valor_causa:             processo.valorCausa || null,
    status:                  processo.status || 'Em Andamento',
    status_detalhado:        processo.statusDetalhado || null,
    data_ajuizamento:        toDbDate(processo.dataAjuizamento),
    data_distribuicao:       toDbDate(processo.dataDistribuicao) || toDbDate(processo.dataAjuizamento),
    data_ultima_atualizacao: toDbDate(processo.ultimaAtualizacao) || nowIso,
    fonte_preferida:         processo.fonte || null,
    fonte_raw:               processo.fonteRaw || null,
    dados_datajud:           processo.fonteRaw || null,
    ultima_consulta_api_at:  nowIso,
    partes_json:             Array.isArray(processo.partes) && processo.partes.length > 0 ? processo.partes : null,
    movimentos_json:         Array.isArray(processo.movimentos) && processo.movimentos.length > 0 ? processo.movimentos : null,
    cache_valid_until:       cacheValidUntil,
    updated_at:              nowIso,
    sync_error_count:        0,
    last_sync_error:         null,
  };

  if (advogadoResponsavel) dadosProcesso.advogado_responsavel = advogadoResponsavel;

  // Popula nome_cliente do polo AT — nunca do Réu. `polo === 'AT'` é o sinal mais
  // confiável (não depende de terminologia); o fallback por `tipo` cobre os casos em
  // que só temos o rótulo cru da fonte (trabalhista usa "Reclamante", execução usa
  // "Exequente", recursos usam "Recorrente/Apelante/Agravante" etc.).
  if (!dadosProcesso.nome_cliente && Array.isArray(processo.partes)) {
    const TERMOS_POLO_ATIVO = [
      'autor', 'requerente', 'reclamante', 'exequente', 'exeqüente',
      'recorrente', 'apelante', 'agravante', 'impetrante', 'embargante',
      'demandante', 'suscitante',
    ];
    const autor = processo.partes.find((p: any) =>
      p.polo === 'AT' || TERMOS_POLO_ATIVO.some(t => String(p.tipo || '').toLowerCase().includes(t))
    );
    if (autor?.nome && autor.nome !== 'Desconhecido') dadosProcesso.nome_cliente = autor.nome.toUpperCase();
    if (autor?.documento) { const digits = String(autor.documento).replace(/\D/g, ''); if (digits.length >= 11) dadosProcesso.cpf_cliente = digits; }
  }

  let processoId: string;

  if (processoIdExistente) {
    const { data: existing } = await supabase.from('processos').select('nome_cliente, cpf_cliente, cliente_id').eq('id', processoIdExistente).single();
    if (existing?.nome_cliente) { delete dadosProcesso.nome_cliente; delete dadosProcesso.cpf_cliente; }
    if (!existing?.cliente_id) {
      const nomeParaVincular = dadosProcesso.nome_cliente || existing?.nome_cliente;
      if (nomeParaVincular) {
        const clienteId = await resolverClienteId(nomeParaVincular);
        if (clienteId) dadosProcesso.cliente_id = clienteId;
      }
    }
    const { error } = await supabase.from('processos').update(dadosProcesso).eq('id', processoIdExistente);
    if (error) { console.error('❌ Erro ao atualizar processo:', error); throw error; }
    processoId = processoIdExistente;
    console.log(`✅ Processo atualizado: ${processoId}`);
  } else {
    // ✅ FIX 2 — fallback por numero_processo quando cnj_normalizado não existe
    const { data: existingByCnj } = await supabase.from('processos').select('id, nome_cliente, cpf_cliente, cliente_id').eq('cnj_normalizado', cnjNorm).maybeSingle();
    const { data: existingByNumero } = !existingByCnj
      ? await supabase.from('processos').select('id, nome_cliente, cpf_cliente, cliente_id').eq('numero_processo', processo.cnjFormatado).maybeSingle()
      : { data: null };
    const existing = existingByCnj || existingByNumero;

    if (existing?.nome_cliente) { delete dadosProcesso.nome_cliente; delete dadosProcesso.cpf_cliente; }

    if (!existing?.cliente_id) {
      const nomeParaVincular = dadosProcesso.nome_cliente || existing?.nome_cliente;
      if (nomeParaVincular) {
        const clienteId = await resolverClienteId(nomeParaVincular);
        if (clienteId) dadosProcesso.cliente_id = clienteId;
      }
    }

    // Encontrou por numero_processo mas sem cnj_normalizado — atualiza em vez de upsert
    if (existing?.id && !existingByCnj) {
      dadosProcesso.cnj_normalizado = cnjNorm;
      const { error } = await supabase.from('processos').update(dadosProcesso).eq('id', existing.id);
      if (error) throw error;
      processoId = existing.id;
      console.log(`✅ Processo atualizado (fallback numero_processo): ${processoId}`);
    } else {
      const { data: processoDb, error: processoError } = await supabase
        .from('processos')
        .upsert(dadosProcesso, { onConflict: 'cnj_normalizado', ignoreDuplicates: false })
        .select('id')
        .single();
      if (processoError) { console.error('❌ Erro ao persistir processo:', processoError); throw processoError; }
      processoId = processoDb.id;
      console.log(`✅ Processo criado/atualizado: ${processoId}`);
    }
  }

  // Movimentações com anti-duplicação por hash
  let movimentacoesNovas = 0;
  for (const mov of (processo.movimentos || [])) {
    const hashUnico = await gerarHashMovimentacao(cnjNorm, mov.dataHoraRaw || '', mov.nome, mov.complemento || '');
    const { error: movError } = await supabase.from('processo_movimentacoes').upsert({ processo_id: processoId, data_movimento: mov.dataHoraRaw, movimento_titulo: mov.nome, movimento_descricao: mov.complemento, movimento_cnj_codigo: mov.codigo ? String(mov.codigo) : null, origem: processo.fonte, hash_unico: hashUnico }, { onConflict: 'hash_unico' });
    if (!movError) movimentacoesNovas++;
  }

  // Partes com anti-duplicação por hash
  for (const parte of (processo.partes || [])) {
    const hashParte = await gerarHashMovimentacao(processoId, parte.tipo, parte.nome, parte.documento || '');
    await supabase.from('processo_partes').upsert({ processo_id: processoId, tipo: parte.tipo, nome: parte.nome, polo: parte.polo, tipo_pessoa: parte.tipoPessoa, documento: parte.documento, advogados: parte.advogados, hash_unico: hashParte }, { onConflict: 'hash_unico', ignoreDuplicates: true });
  }

  return { id: processoId, movimentacoesNovas };
}

async function registrarSyncLog(processoId: string | null, cnj: string, origemTentada: string, status: string, httpCode: number | null, mensagem: string, duracaoMs: number, movimentacoesNovas = 0) {
  await supabase.from('processo_sync_log').insert({ processo_id: processoId, cnj: normalizarCNJ(cnj), origem_tentada: origemTentada, status, http_code: httpCode, mensagem, duracao_ms: duracaoMs, movimentacoes_novas: movimentacoesNovas });
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const numeroProcesso      = body.numero_processo || body.numeroProcesso;
    const cpf                 = body.cpf;
    const action              = body.action;
    const forceRefresh        = body.force_refresh || body.forceRefresh || false;
    const persistir           = body.persistir || false;
    const processoIdExistente = body.processo_id || body.processoId || null;
    const advogadoResponsavel = body.advogadoResponsavel || body.advogado_responsavel;

    console.log(`📋 Consulta: action=${action}, cnj=${numeroProcesso}, force=${forceRefresh}, persistir=${persistir}, processoId=${processoIdExistente}`);

    // ========== BUSCA POR CPF ==========
    if ((action === 'buscar_por_cpf' || action === 'busca_cpf') && cpf) {
      const { data: processos, error } = await buscarEscavadorPorCPF(cpf);
      if (error || processos.length === 0) {
        return new Response(JSON.stringify({ success: false, encontrado: false, error: error || 'Nenhum processo encontrado', processos: [], fonte: 'escavador' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ✅ FIX 3 — normaliza para o formato ProcessoExterno completo que o frontend espera
      const processosFormatados = processos.map((p: any) => {
        const partes: any[] = [];
        if (p.titulo_polo_ativo)   partes.push({ nome: p.titulo_polo_ativo,   tipo: 'Autor', polo: 'AT', tipoPessoa: 'FISICA', advogados: [] });
        if (p.titulo_polo_passivo) partes.push({ nome: p.titulo_polo_passivo, tipo: 'Réu',   polo: 'PA', tipoPessoa: 'FISICA', advogados: [] });
        return {
          numeroProcesso:    p.numero_cnj || '',
          classe:            p.titulo_classe || p.classe || 'Processo',
          classeCodigo:      p.classe_codigo || undefined,
          assuntos:          p.assunto ? [{ nome: p.assunto }] : [],
          tribunal:          p.sigla_tribunal || '',
          dataAjuizamento:   p.data_inicio ? formatarData(p.data_inicio) : 'Não informado',
          grau:              p.grau || '',
          nivelSigilo:       p.segredo_justica ? 'Segredo de Justiça' : 'Público',
          formato:           'Eletrônico',
          sistemaProcessual: 'Escavador',
          orgaoJulgador:     p.orgao_julgador || p.vara || '',
          status:            p.status_predito === 'ATIVO' ? 'Em Andamento' : p.status_predito === 'INATIVO' ? 'Arquivado' : 'Em Andamento',
          ultimaAtualizacao: p.data_ultima_movimentacao ? formatarData(p.data_ultima_movimentacao) : 'Não informado',
          valorCausa:        p.valor_causa ? parseFloat(p.valor_causa) : null,
          prioridade:        [],
          movimentos:        [],
          partes,
        };
      });

      return new Response(JSON.stringify({ success: true, encontrado: true, multiplos: true, processos: processosFormatados, total: processosFormatados.length, fonte: 'escavador' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========== BUSCA POR CNJ ==========
    if (!numeroProcesso) return new Response(JSON.stringify({ error: 'Número do processo é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const cnjNormalizado = normalizarCNJ(numeroProcesso);
    const cnjFormatado   = formatarCNJ(cnjNormalizado);
    if (!validarCNJ(cnjNormalizado)) return new Response(JSON.stringify({ success: false, encontrado: false, error: 'Formato de CNJ inválido. Use: NNNNNNN-DD.AAAA.J.TR.OOOO' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // ========== CACHE ==========
    if (!forceRefresh) {
      const { cached, processo: cachedProcesso } = await verificarCache(cnjNormalizado);
      if (cached && cachedProcesso) {
        // ✅ FIX 1 — usa mapearCacheParaFrontend em vez de retornar dados brutos do banco
        const processoMapeado = mapearCacheParaFrontend(cachedProcesso);
        return new Response(JSON.stringify({ success: true, encontrado: true, processo: processoMapeado, fonte: 'cache', cacheHit: true, warnings: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ========== BUSCAR NO ESCAVADOR ==========
    const warnings: string[] = [];
    let processoNormalizado: any = null;
    let fonteUsada = 'escavador';

    const escavadorResult = await buscarEscavador(cnjNormalizado);

    if (escavadorResult.data) {
      processoNormalizado = normalizarEscavador(escavadorResult.data, cnjNormalizado);
      const dadosIncompletos = !processoNormalizado.movimentos?.length || !processoNormalizado.classe || processoNormalizado.classe === 'Processo';
      if (dadosIncompletos) {
        warnings.push('Dados do Escavador podem estar incompletos');
        const datajudResult = await buscarDataJud(cnjNormalizado);
        if (datajudResult.data) {
          const datajudNorm = normalizarDataJud(datajudResult.data, cnjNormalizado);
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
        const { processo: cachedProcesso } = await verificarCache(cnjNormalizado);
        if (cachedProcesso) {
          warnings.push('Retornando dados do cache (APIs indisponíveis)');
          const processoMapeado = mapearCacheParaFrontend(cachedProcesso);
          return new Response(JSON.stringify({ success: true, encontrado: true, processo: processoMapeado, fonte: 'cache_stale', cacheHit: true, warnings }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ success: false, encontrado: false, error: 'Processo não encontrado em nenhuma fonte', warnings }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ========== PERSISTIR ==========
    let processoId: string | null = null;
    let movimentacoesNovas = 0;
    if (persistir && processoNormalizado) {
      try {
        const result = await persistirProcesso(processoNormalizado, processoIdExistente, advogadoResponsavel);
        processoId = result.id; movimentacoesNovas = result.movimentacoesNovas;
        console.log(`💾 Persistido: ${processoId}, ${movimentacoesNovas} novas movimentações`);
      } catch (err: any) {
        console.error('❌ Erro ao persistir:', err);
        warnings.push(`Erro ao salvar: ${err?.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, encontrado: true, processo: processoNormalizado, fonte: fonteUsada, cacheHit: false, processoId, movimentacoesNovas, warnings }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro geral:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
