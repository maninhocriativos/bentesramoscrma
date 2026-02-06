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
// DATAJUD API (FALLBACK) - Mapeamento completo de tribunais
// =====================================================

function getDataJudEndpoint(cnj: string): string {
  // Extrair código do tribunal do CNJ (posições 13-16 no formato sem pontuação)
  const cnjClean = normalizarCNJ(cnj);
  const justicaCode = cnjClean.slice(13, 14); // 8 = Estadual, 4 = Federal, 5 = Trabalho
  const tribunalCode = cnjClean.slice(14, 16); // Código do tribunal
  
  console.log(`📍 [DataJud] Justiça: ${justicaCode}, Tribunal: ${tribunalCode}`);
  
  // Mapeamento completo de tribunais estaduais (J=8)
  const tribunaisEstaduais: Record<string, string> = {
    '01': 'api_publica_tjac', // Acre
    '02': 'api_publica_tjal', // Alagoas
    '03': 'api_publica_tjap', // Amapá
    '04': 'api_publica_tjam', // Amazonas
    '05': 'api_publica_tjba', // Bahia
    '06': 'api_publica_tjce', // Ceará
    '07': 'api_publica_tjdft', // DF
    '08': 'api_publica_tjes', // Espírito Santo
    '09': 'api_publica_tjgo', // Goiás
    '10': 'api_publica_tjma', // Maranhão
    '11': 'api_publica_tjmt', // Mato Grosso
    '12': 'api_publica_tjms', // Mato Grosso do Sul
    '13': 'api_publica_tjmg', // Minas Gerais
    '14': 'api_publica_tjpa', // Pará
    '15': 'api_publica_tjpb', // Paraíba
    '16': 'api_publica_tjpr', // Paraná
    '17': 'api_publica_tjpe', // Pernambuco
    '18': 'api_publica_tjpi', // Piauí
    '19': 'api_publica_tjrj', // Rio de Janeiro
    '20': 'api_publica_tjrn', // Rio Grande do Norte
    '21': 'api_publica_tjrs', // Rio Grande do Sul
    '22': 'api_publica_tjro', // Rondônia
    '23': 'api_publica_tjrr', // Roraima
    '24': 'api_publica_tjsc', // Santa Catarina
    '25': 'api_publica_tjsp', // São Paulo
    '26': 'api_publica_tjse', // Sergipe
    '27': 'api_publica_tjto', // Tocantins
  };
  
  // Mapeamento de tribunais federais (J=4)
  const tribunaisFederais: Record<string, string> = {
    '01': 'api_publica_trf1',
    '02': 'api_publica_trf2',
    '03': 'api_publica_trf3',
    '04': 'api_publica_trf4',
    '05': 'api_publica_trf5',
    '06': 'api_publica_trf6',
  };
  
  // Mapeamento de tribunais do trabalho (J=5)
  const tribunaisTrabalho: Record<string, string> = {
    '01': 'api_publica_trt1',
    '02': 'api_publica_trt2',
    '03': 'api_publica_trt3',
    '04': 'api_publica_trt4',
    '05': 'api_publica_trt5',
    '06': 'api_publica_trt6',
    '07': 'api_publica_trt7',
    '08': 'api_publica_trt8',
    '09': 'api_publica_trt9',
    '10': 'api_publica_trt10',
    '11': 'api_publica_trt11',
    '12': 'api_publica_trt12',
    '13': 'api_publica_trt13',
    '14': 'api_publica_trt14',
    '15': 'api_publica_trt15',
    '16': 'api_publica_trt16',
    '17': 'api_publica_trt17',
    '18': 'api_publica_trt18',
    '19': 'api_publica_trt19',
    '20': 'api_publica_trt20',
    '21': 'api_publica_trt21',
    '22': 'api_publica_trt22',
    '23': 'api_publica_trt23',
    '24': 'api_publica_trt24',
  };
  
  let endpoint = 'api_publica_tjsp'; // fallback
  
  if (justicaCode === '8') {
    endpoint = tribunaisEstaduais[tribunalCode] || 'api_publica_tjsp';
  } else if (justicaCode === '4') {
    endpoint = tribunaisFederais[tribunalCode] || 'api_publica_trf1';
  } else if (justicaCode === '5') {
    endpoint = tribunaisTrabalho[tribunalCode] || 'api_publica_trt1';
  }
  
  console.log(`📍 [DataJud] Endpoint selecionado: ${endpoint}`);
  return endpoint;
}

async function buscarDataJud(cnj: string): Promise<{ data: any; error: string | null; httpCode: number | null; durationMs: number }> {
  if (!DATAJUD_API_KEY) {
    return { data: null, error: 'DATAJUD_API_KEY não configurada', httpCode: null, durationMs: 0 };
  }
  
  console.log(`🔍 [DataJud] Buscando CNJ: ${formatarCNJ(cnj)}`);
  
  const endpoint = getDataJudEndpoint(cnj);
  
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
        },
        size: 1
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
  const hits = data?.hits?.hits || [];
  
  if (hits.length === 0) {
    console.log(`❌ [DataJud] Nenhum resultado para CNJ ${formatarCNJ(cnj)}`);
    return { data: null, error: 'NOT_FOUND', httpCode: 200, durationMs };
  }
  
  const hit = hits[0]?._source;
  
  if (!hit) {
    return { data: null, error: 'NOT_FOUND', httpCode: 200, durationMs };
  }
  
  console.log(`✅ [DataJud] Sucesso em ${durationMs}ms - Movimentos: ${hit.movimentos?.length || 0}, Partes: ${hit.partes?.length || 0}`);
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
  const rawMovCount = Array.isArray(data?.movimentos)
    ? data.movimentos.length
    : Array.isArray(data?.movimentacoes)
      ? data.movimentacoes.length
      : 0;

  const rawPartesCount = Array.isArray(data?.partes)
    ? data.partes.length
    : Array.isArray(data?.poloAtivo)
      ? data.poloAtivo.length
      : Array.isArray(data?.poloPassivo)
        ? data.poloPassivo.length
        : 0;

  console.log(
    `🔄 [DataJud] Normalizando dados - Raw partes: ${rawPartesCount}, Raw movimentos: ${rawMovCount}`,
  );

  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  const toIsoIfPossible = (v: unknown): string => {
    if (!v) return new Date().toISOString();

    if (typeof v === "string") {
      const s = v.trim();
      // YYYYMMDDHHmmss
      if (/^\d{14}$/.test(s)) {
        const year = s.slice(0, 4);
        const month = s.slice(4, 6);
        const day = s.slice(6, 8);
        const hour = s.slice(8, 10);
        const min = s.slice(10, 12);
        const sec = s.slice(12, 14);
        return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
      }

      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString();
      return s;
    }

    // number | Date | other
    const d = new Date(v as any);
    if (!isNaN(d.getTime())) return d.toISOString();
    return String(v);
  };

  const normalizePolo = (v: unknown): string => {
    const s = String(v ?? "").trim().toUpperCase();
    if (!s) return "OUTRO";

    if (["AT", "ATIVO", "POLO ATIVO", "A"].includes(s)) return "AT";
    if (["PA", "PASSIVO", "POLO PASSIVO", "R", "REU", "RÉU"].includes(s)) return "PA";

    // Alguns tribunais retornam o polo como texto; manter.
    return s;
  };

  const normalizeAdvogados = (p: any) => {
    const raw = [
      ...asArray<any>(p?.advogados),
      ...asArray<any>(p?.representantes),
      ...asArray<any>(p?.procuradores),
    ];

    return raw
      .map((adv) => {
        if (!adv) return null;
        if (typeof adv === "string") return { nome: adv, oab: null };

        return {
          nome: adv.nome || adv.nomeCompleto || adv.nomeAdvogado || adv.advogado || "Advogado",
          oab:
            adv.oab ||
            adv.numeroOAB ||
            adv.inscricaoOAB ||
            adv.oabNumero ||
            adv.numero_inscricao ||
            null,
        };
      })
      .filter(Boolean);
  };

  // =====================================================
  // PARTES (DataJud varia bastante entre índices/tribunais)
  // =====================================================

  const rawPartes: Array<any> = [];

  // 1) padrão direto
  rawPartes.push(...asArray<any>(data?.partes));

  // 2) polos em arrays separados
  rawPartes.push(
    ...asArray<any>(data?.poloAtivo).map((p) => ({ ...p, __polo: "AT", __tipo: "Autor" })),
  );
  rawPartes.push(
    ...asArray<any>(data?.poloPassivo).map((p) => ({ ...p, __polo: "PA", __tipo: "Réu" })),
  );

  // 3) polo como objeto com chaves comuns
  if (data?.polo && typeof data.polo === "object") {
    const poloObj = data.polo as Record<string, unknown>;
    rawPartes.push(
      ...asArray<any>(poloObj.ativo).map((p) => ({ ...p, __polo: "AT", __tipo: "Autor" })),
    );
    rawPartes.push(
      ...asArray<any>(poloObj.passivo).map((p) => ({ ...p, __polo: "PA", __tipo: "Réu" })),
    );
    rawPartes.push(...asArray<any>(poloObj.outros).map((p) => ({ ...p, __polo: "OUTRO" })));
  }

  const partes = rawPartes
    .map((p: any) => {
      if (!p) return null;

      const nome =
        typeof p === "string"
          ? p
          : p.nome || p.nomeCompleto || p.pessoa?.nome || p.parte?.nome || "Desconhecido";

      const documento =
        typeof p === "object"
          ? p.cpf || p.cnpj || p.cpfCnpj || p.numeroDocumentoPrincipal || p.documento || null
          : null;

      const polo = normalizePolo(p.polo ?? p.__polo ?? p.poloParte ?? p.poloProcessual);

      let tipo =
        (typeof p === "object" ? (p.tipo || p.tipoParte || p.qualificacao || p.__tipo) : null) ||
        "Parte";

      // Quando vier só polo, inferir um tipo amigável
      if (tipo === "Parte") {
        if (polo === "AT") tipo = "Autor";
        else if (polo === "PA") tipo = "Réu";
      }

      const tipoPessoa =
        p.tipoPessoa ||
        p.tipo_pessoa ||
        (documento
          ? String(documento).replace(/\D/g, "").length > 11
            ? "JURIDICA"
            : "FISICA"
          : "FISICA");

      const advogados = normalizeAdvogados(p);

      return {
        nome,
        tipo,
        polo,
        tipoPessoa,
        documento,
        advogados,
      };
    })
    .filter(Boolean);

  // =====================================================
  // MOVIMENTOS
  // =====================================================

  const rawMovimentos = asArray<any>(data?.movimentos).length
    ? asArray<any>(data.movimentos)
    : asArray<any>(data?.movimentacoes);

  const movimentos = rawMovimentos.slice(0, 100).map((m: any) => {
    const dataHoraRaw = toIsoIfPossible(m?.dataHora ?? m?.data ?? m?.data_movimento);

    const comp =
      m?.complemento ||
      (() => {
        const comps = asArray<any>(m?.complementosTabelados);
        if (comps.length === 0) return null;
        const txt = comps
          .map((c) => c?.nome || c?.descricao || c?.valor)
          .filter(Boolean)
          .join("; ");
        return txt || null;
      })();

    return {
      dataHora: formatarData(dataHoraRaw),
      dataHoraRaw,
      nome: m?.nome || m?.movimentoNome || m?.descricao || "Movimentação",
      complemento: comp,
      codigo: m?.codigo || m?.codigoMovimento || m?.codigoNacional || null,
    };
  });

  // Extrair informações de classe e assuntos
  const classeNome =
    data.classe?.nome ||
    data.classeProcessual?.nome ||
    data.classeProcessual ||
    data.classe?.descricao ||
    "Processo";

  const classeCodigo = data.classe?.codigo || data.classeProcessual?.codigo;

  const assuntos = asArray<any>(data.assuntos).map((a: any) => ({
    nome: typeof a === "string" ? a : a?.nome || a?.descricao || String(a),
    codigo: a?.codigo ? String(a.codigo) : undefined,
  }));

  // Determinar status baseado em campos do DataJud
  let status = "Em Andamento";
  if (data.situacao) {
    const sit = String(data.situacao).toLowerCase();
    if (sit.includes("arquivado") || sit.includes("baixado") || sit.includes("transitado")) {
      status = "Arquivado";
    } else if (sit.includes("suspenso")) {
      status = "Suspenso";
    }
  }

  const resultado = {
    cnj: normalizarCNJ(cnj),
    cnjFormatado: formatarCNJ(cnj),
    numeroProcesso: data.numeroProcesso,
    classe: classeNome,
    classeCodigo: classeCodigo ? String(classeCodigo) : undefined,
    assuntos,
    tribunal: data.tribunal || data.siglaTribunal || "Não informado",
    // Em vários índices do DataJud isso vem como string 14 dígitos
    dataAjuizamento: formatarData(toIsoIfPossible(data.dataAjuizamento)),
    grau: data.grau || data.grauProcesso || "1º Grau",
    nivelSigilo: data.nivelSigilo === 0 || data.nivelSigilo === "0" ? "Público" : "Segredo de Justiça",
    formato: data.formato?.nome || data.formatoProcesso || "Eletrônico",
    sistemaProcessual: "DataJud",
    orgaoJulgador: data.orgaoJulgador?.nome || data.orgaoJulgador || "Não informado",
    status,
    statusDetalhado: data.situacao || status,
    ultimaAtualizacao: formatarData(toIsoIfPossible(data.dataHoraUltimaAtualizacao || data.dataUltimaAtualizacao)),
    valorCausa: data.valorCausa || null,
    prioridade: data.prioridade || [],
    movimentos,
    partes,
    fonte: "datajud",
    fonteRaw: data,
  };

  console.log(`✅ [DataJud] Normalizado: ${partes.length} partes, ${movimentos.length} movimentos`);
  return resultado;
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
  const nowIso = new Date().toISOString();

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
      dados_datajud: processo.fonteRaw,
      ultima_consulta_api_at: nowIso,
      data_ultima_atualizacao: processo.fonteRaw?.dataHoraUltimaAtualizacao || nowIso,
      partes_json: Array.isArray(processo.partes) && processo.partes.length > 0 ? processo.partes : null,
      movimentos_json:
        Array.isArray(processo.movimentos) && processo.movimentos.length > 0
          ? processo.movimentos.slice(0, 50)
          : null,
      cache_valid_until: cacheValidUntil.toISOString(),
      advogado_responsavel: advogadoResponsavel,
      updated_at: nowIso,
    }, {
      // 'cnj_normalizado' não é UNIQUE; usar o campo com UNIQUE index
      onConflict: 'numero_processo',
      ignoreDuplicates: false,
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
