import "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessoResponse {
  numeroProcesso: string;
  classe: string;
  classeCodigo?: string;
  assuntos: Array<{ nome: string; codigo?: string }>;
  tribunal: string;
  dataAjuizamento: string;
  // Campos adicionais detalhados
  grau: string;
  nivelSigilo: string;
  formato: string;
  sistemaProcessual: string;
  orgaoJulgador: string;
  status: string;
  ultimaAtualizacao: string;
  valorCausa: number | null;
  prioridade: string[];
  movimentos: Array<{
    dataHora: string;
    dataHoraRaw?: string;
    nome: string;
    complemento?: string;
    codigo?: number;
  }>;
  partes: Array<{
    nome: string;
    tipo: string;
    polo: string;
    tipoPessoa: string;
    documento?: string;
    advogados?: Array<{
      nome: string;
      oab?: string;
    }>;
  }>;
  // Dados brutos para debug
  fonteRaw?: any;
}

// Lista de tribunais disponíveis na API DataJud
const TRIBUNAIS: Record<string, string> = {
  // Tribunais Regionais do Trabalho
  'trt1': 'api_publica_trt1',
  'trt2': 'api_publica_trt2',
  'trt3': 'api_publica_trt3',
  'trt4': 'api_publica_trt4',
  'trt5': 'api_publica_trt5',
  'trt6': 'api_publica_trt6',
  'trt7': 'api_publica_trt7',
  'trt8': 'api_publica_trt8',
  'trt9': 'api_publica_trt9',
  'trt10': 'api_publica_trt10',
  'trt11': 'api_publica_trt11',
  'trt12': 'api_publica_trt12',
  'trt13': 'api_publica_trt13',
  'trt14': 'api_publica_trt14',
  'trt15': 'api_publica_trt15',
  'trt16': 'api_publica_trt16',
  'trt17': 'api_publica_trt17',
  'trt18': 'api_publica_trt18',
  'trt19': 'api_publica_trt19',
  'trt20': 'api_publica_trt20',
  'trt21': 'api_publica_trt21',
  'trt22': 'api_publica_trt22',
  'trt23': 'api_publica_trt23',
  'trt24': 'api_publica_trt24',
  // Tribunais de Justiça Estaduais
  'tjac': 'api_publica_tjac',
  'tjal': 'api_publica_tjal',
  'tjam': 'api_publica_tjam',
  'tjap': 'api_publica_tjap',
  'tjba': 'api_publica_tjba',
  'tjce': 'api_publica_tjce',
  'tjdft': 'api_publica_tjdft',
  'tjes': 'api_publica_tjes',
  'tjgo': 'api_publica_tjgo',
  'tjma': 'api_publica_tjma',
  'tjmg': 'api_publica_tjmg',
  'tjms': 'api_publica_tjms',
  'tjmt': 'api_publica_tjmt',
  'tjpa': 'api_publica_tjpa',
  'tjpb': 'api_publica_tjpb',
  'tjpe': 'api_publica_tjpe',
  'tjpi': 'api_publica_tjpi',
  'tjpr': 'api_publica_tjpr',
  'tjrj': 'api_publica_tjrj',
  'tjrn': 'api_publica_tjrn',
  'tjro': 'api_publica_tjro',
  'tjrr': 'api_publica_tjrr',
  'tjrs': 'api_publica_tjrs',
  'tjsc': 'api_publica_tjsc',
  'tjse': 'api_publica_tjse',
  'tjsp': 'api_publica_tjsp',
  'tjto': 'api_publica_tjto',
  // Tribunais Regionais Federais
  'trf1': 'api_publica_trf1',
  'trf2': 'api_publica_trf2',
  'trf3': 'api_publica_trf3',
  'trf4': 'api_publica_trf4',
  'trf5': 'api_publica_trf5',
  'trf6': 'api_publica_trf6',
  // Tribunais Superiores
  'stj': 'api_publica_stj',
  'tst': 'api_publica_tst',
};

// Lista de tribunais para busca por CPF
const TRIBUNAIS_PARA_BUSCA_CPF = [
  'trt11',
  'tjam',
  'trf1',
  'trf2',
  'trf3',
  'tjmg',
  'tjrj',
  'tjsp',
  'tjrs',
  'tjpr',
];

// Detecta se a entrada é CPF (11 dígitos numéricos)
function isCPF(input: string): boolean {
  const digits = input.replace(/[^\d]/g, '');
  return digits.length === 11;
}

// Formatar CPF para exibição
function formatCPF(cpf: string): string {
  const digits = cpf.replace(/[^\d]/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

// Detecta tribunal pelo número do processo
function detectarTribunal(numeroProcesso: string): string | null {
  const match = numeroProcesso.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/);
  if (!match) return null;
  
  const justica = match[1];
  const tribunal = match[2];
  
  // Justiça do Trabalho
  if (justica === '5') {
    const trtNum = parseInt(tribunal);
    if (trtNum >= 1 && trtNum <= 24) {
      return `trt${trtNum}`;
    }
  }
  
  // Justiça Federal
  if (justica === '4') {
    const trfNum = parseInt(tribunal);
    if (trfNum >= 1 && trfNum <= 6) {
      return `trf${trfNum}`;
    }
  }
  
  // Justiça Estadual
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
    if (TJ_CODES[tjNum]) {
      return TJ_CODES[tjNum];
    }
  }
  
  return null;
}

async function buscarProcesso(numeroProcesso: string, tribunal: string): Promise<any> {
  const DATAJUD_API_KEY = Deno.env.get('DATAJUD_API_KEY');
  
  if (!DATAJUD_API_KEY) {
    throw new Error('API Key do DataJud não configurada');
  }
  
  const apiName = TRIBUNAIS[tribunal];
  if (!apiName) {
    throw new Error(`Tribunal ${tribunal} não suportado`);
  }
  
  const url = `https://api-publica.datajud.cnj.jus.br/${apiName}/_search`;
  
  console.log(`🔍 Buscando processo ${numeroProcesso} no tribunal ${tribunal}...`);
  
  const numeroLimpo = numeroProcesso.replace(/[^\d]/g, '');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `APIKey ${DATAJUD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: {
        match: {
          numeroProcesso: numeroLimpo
        }
      },
      size: 10
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Erro na API DataJud: ${response.status} - ${errorText}`);
    throw new Error(`Erro ao consultar API: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}

async function buscarPorCPF(cpf: string, tribunais: string[]): Promise<any[]> {
  const DATAJUD_API_KEY = Deno.env.get('DATAJUD_API_KEY');
  
  if (!DATAJUD_API_KEY) {
    throw new Error('API Key do DataJud não configurada');
  }
  
  const cpfLimpo = cpf.replace(/[^\d]/g, '');
  const resultados: any[] = [];
  
  console.log(`🔍 Buscando processos por CPF ${formatCPF(cpfLimpo)} em ${tribunais.length} tribunais...`);
  
  for (const tribunal of tribunais) {
    const apiName = TRIBUNAIS[tribunal];
    if (!apiName) continue;
    
    const url = `https://api-publica.datajud.cnj.jus.br/${apiName}/_search`;
    
    try {
      console.log(`📡 Consultando ${tribunal.toUpperCase()}...`);
      
      const queryBody = {
        query: {
          bool: {
            should: [
              { match: { "partes.numeroDocumentoPrincipal": cpfLimpo } },
              { match: { "partes.pessoa.numeroDocumentoPrincipal": cpfLimpo } },
              { wildcard: { "partes.numeroDocumentoPrincipal": `*${cpfLimpo}*` } },
              { term: { "partes.numeroDocumentoPrincipal": cpfLimpo } }
            ],
            minimum_should_match: 1
          }
        },
        size: 30
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `APIKey ${DATAJUD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryBody),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`📊 Total hits ${tribunal.toUpperCase()}: ${data.hits?.total?.value || 0}`);
        
        if (data.hits?.hits?.length > 0) {
          for (const hit of data.hits.hits) {
            resultados.push({
              ...hit._source,
              tribunal: tribunal.toUpperCase()
            });
          }
        }
      }
    } catch (err) {
      console.error(`⚠️ Erro ao consultar ${tribunal}:`, err);
    }
  }
  
  return resultados;
}

// =====================================================
// NORMALIZAÇÃO DE DATAS (CRÍTICO!)
// Suporta múltiplos formatos: YYYYMMDDHHmmss, ISO, timestamp, BR
// =====================================================
function formatarData(dataStr: string | number | null | undefined): string {
  if (!dataStr) return 'Não informado';
  
  try {
    let date: Date | null = null;
    const input = String(dataStr).trim();
    
    console.log(`📅 Formatando data: ${input} (tipo: ${typeof dataStr})`);
    
    // FORMATO 1: YYYYMMDDHHmmss (14 dígitos) - formato DataJud/Projudi
    // Ex: 20240720203148 -> 2024-07-20 20:31:48
    if (/^\d{14}$/.test(input)) {
      const year = parseInt(input.substring(0, 4));
      const month = parseInt(input.substring(4, 6)) - 1;
      const day = parseInt(input.substring(6, 8));
      const hour = parseInt(input.substring(8, 10));
      const minute = parseInt(input.substring(10, 12));
      const second = parseInt(input.substring(12, 14));
      
      if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        date = new Date(year, month, day, hour, minute, second);
        console.log(`✅ Parseado como YYYYMMDDHHmmss: ${date.toISOString()}`);
      }
    }
    
    // FORMATO 2: YYYYMMDDHHmm (12 dígitos)
    if (!date && /^\d{12}$/.test(input)) {
      const year = parseInt(input.substring(0, 4));
      const month = parseInt(input.substring(4, 6)) - 1;
      const day = parseInt(input.substring(6, 8));
      const hour = parseInt(input.substring(8, 10));
      const minute = parseInt(input.substring(10, 12));
      
      if (year >= 1900 && year <= 2100) {
        date = new Date(year, month, day, hour, minute, 0);
        console.log(`✅ Parseado como YYYYMMDDHHmm: ${date.toISOString()}`);
      }
    }
    
    // FORMATO 3: YYYYMMDD (8 dígitos)
    if (!date && /^\d{8}$/.test(input)) {
      const year = parseInt(input.substring(0, 4));
      const month = parseInt(input.substring(4, 6)) - 1;
      const day = parseInt(input.substring(6, 8));
      
      if (year >= 1900 && year <= 2100) {
        date = new Date(year, month, day);
        console.log(`✅ Parseado como YYYYMMDD: ${date.toISOString()}`);
      }
    }
    
    // FORMATO 4: Timestamp em milissegundos (número grande)
    if (!date && /^\d{13}$/.test(input)) {
      const timestamp = parseInt(input);
      if (timestamp > 0 && timestamp < 4102444800000) {
        date = new Date(timestamp);
        console.log(`✅ Parseado como timestamp ms: ${date.toISOString()}`);
      }
    }
    
    // FORMATO 5: ISO 8601 (2023-10-17T00:00:00.000Z ou similar)
    if (!date && input.includes('-') && input.length >= 10) {
      const datePart = input.split('T')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        
        if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          // Se tiver hora, usar
          if (input.includes('T')) {
            date = new Date(input);
          } else {
            date = new Date(year, month, day);
          }
          console.log(`✅ Parseado como ISO: ${date.toISOString()}`);
        }
      }
    }
    
    // FORMATO 6: Brasileiro dd/mm/yyyy ou dd/mm/yyyy HH:mm
    if (!date && input.includes('/')) {
      const mainPart = input.split(' ')[0];
      const timePart = input.split(' ')[1];
      const parts = mainPart.split('/');
      
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        
        if (year >= 1900 && year <= 2100) {
          if (timePart && timePart.includes(':')) {
            const [hour, minute] = timePart.split(':').map(Number);
            date = new Date(year, month, day, hour || 0, minute || 0, 0);
          } else {
            date = new Date(year, month, day);
          }
          console.log(`✅ Parseado como BR: ${date.toISOString()}`);
        }
      }
    }
    
    // Se conseguiu parsear, formatar como DD/MM/YYYY HH:mm
    if (date && !isNaN(date.getTime())) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hour = date.getHours();
      const minute = date.getMinutes();
      
      if (year >= 1900 && year <= 2100) {
        // Se tiver hora diferente de 00:00, incluir
        if (hour > 0 || minute > 0) {
          const hourStr = hour.toString().padStart(2, '0');
          const minStr = minute.toString().padStart(2, '0');
          return `${day}/${month}/${year} ${hourStr}:${minStr}`;
        }
        return `${day}/${month}/${year}`;
      }
    }
    
    console.warn(`⚠️ Não foi possível formatar a data: ${input}`);
  } catch (e) {
    console.error('Erro ao formatar data:', e);
  }
  
  return String(dataStr);
}

// Parsear data para timestamptz (para persistência no banco)
function parseDataParaTimestamp(dataStr: string | number | null | undefined): string | null {
  if (!dataStr) return null;
  
  try {
    const input = String(dataStr).trim();
    let date: Date | null = null;
    
    // YYYYMMDDHHmmss
    if (/^\d{14}$/.test(input)) {
      const year = parseInt(input.substring(0, 4));
      const month = parseInt(input.substring(4, 6)) - 1;
      const day = parseInt(input.substring(6, 8));
      const hour = parseInt(input.substring(8, 10));
      const minute = parseInt(input.substring(10, 12));
      const second = parseInt(input.substring(12, 14));
      date = new Date(year, month, day, hour, minute, second);
    }
    // YYYYMMDD
    else if (/^\d{8}$/.test(input)) {
      const year = parseInt(input.substring(0, 4));
      const month = parseInt(input.substring(4, 6)) - 1;
      const day = parseInt(input.substring(6, 8));
      date = new Date(year, month, day);
    }
    // ISO
    else if (input.includes('-')) {
      date = new Date(input);
    }
    // Timestamp
    else if (/^\d{13}$/.test(input)) {
      date = new Date(parseInt(input));
    }
    
    if (date && !isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch (e) {
    console.error('Erro ao parsear data para timestamp:', e);
  }
  
  return null;
}

// Determina o status do processo baseado nas movimentações e campos
function determinarStatus(processo: any): string {
  if (processo.situacao) return processo.situacao;
  
  const movimentos = processo.movimentos || [];
  if (movimentos.length > 0) {
    const ultimaMovimentacao = movimentos[0].nome?.toLowerCase() || '';
    
    if (ultimaMovimentacao.includes('arquiv')) return 'Arquivado';
    if (ultimaMovimentacao.includes('baixa') || ultimaMovimentacao.includes('trânsito em julgado')) return 'Transitado em Julgado';
    if (ultimaMovimentacao.includes('sentença')) return 'Com Sentença';
    if (ultimaMovimentacao.includes('suspen')) return 'Suspenso';
    if (ultimaMovimentacao.includes('recurso') || ultimaMovimentacao.includes('apelação')) return 'Em Grau Recursal';
    if (ultimaMovimentacao.includes('audiência')) return 'Aguardando Audiência';
    if (ultimaMovimentacao.includes('pericia') || ultimaMovimentacao.includes('perícia')) return 'Em Perícia';
    if (ultimaMovimentacao.includes('conclus')) return 'Concluso para Decisão';
    if (ultimaMovimentacao.includes('citação') || ultimaMovimentacao.includes('intimação')) return 'Aguardando Citação/Intimação';
    if (ultimaMovimentacao.includes('distribuí')) return 'Distribuído';
  }
  
  return 'Em Andamento';
}

function formatarProcesso(processo: any, tribunalFallback: string): ProcessoResponse {
  const movimentos = processo.movimentos || [];
  const ultimaAtualizacao = movimentos.length > 0 ? movimentos[0].dataHora : null;
  
  const prioridades: string[] = [];
  if (processo.prioridades) {
    prioridades.push(...processo.prioridades.map((p: any) => p.nome || p));
  }
  
  const grauMap: Record<string, string> = {
    'G1': '1º Grau',
    'G2': '2º Grau', 
    'SUP': 'Superior',
    'ORI': 'Originário'
  };
  
  const poloMap: Record<string, string> = {
    'AT': 'Autor',
    'PA': 'Autor', 
    'AUTOR': 'Autor',
    'RÉU': 'Réu',
    'REU': 'Réu',
    'PP': 'Réu',
    'PASSIVE': 'Réu',
    'TE': 'Terceiro',
    'TERCEIRO': 'Terceiro',
    'VI': 'Vítima',
    'FL': 'Falido'
  };
  
  // Extrair código da classe
  const classeCodigo = processo.classe?.codigo || processo.classeProcessual?.codigo || null;
  const classeNome = processo.classe?.nome || processo.classeProcessual?.nome || 'Não informado';
  
  // Processar assuntos com código
  const assuntosRaw = processo.assuntos || processo.assuntosProcessuais || [];
  const assuntos = assuntosRaw.map((a: any) => ({
    nome: a.nome || String(a),
    codigo: a.codigo ? String(a.codigo) : undefined
  }));
  
  // Processar movimentações com código e data raw
  const movimentosFormatados = movimentos.slice(0, 50).map((m: any, index: number) => ({
    dataHora: formatarData(m.dataHora),
    dataHoraRaw: m.dataHora,
    nome: m.nome || m.movimentoNacional?.nome || 'Movimentação',
    complemento: m.complementosTabelados?.map((c: any) => c.nome || c.descricao).join(', ') 
      || m.complemento 
      || undefined,
    codigo: m.codigo || m.movimentoNacional?.codigo
  }));
  
  return {
    numeroProcesso: processo.numeroProcesso,
    classe: classeNome,
    classeCodigo: classeCodigo ? String(classeCodigo) : undefined,
    assuntos,
    tribunal: processo.tribunal || processo.siglaTribunal || tribunalFallback.toUpperCase(),
    dataAjuizamento: formatarData(processo.dataAjuizamento || processo.dataDistribuicao || processo.dataHoraUltimaAtualizacao),
    grau: grauMap[processo.grau] || processo.grau || '1º Grau',
    nivelSigilo: processo.nivelSigilo === 0 ? 'Público' : processo.nivelSigilo === 1 ? 'Segredo de Justiça' : `Nível ${processo.nivelSigilo || 0}`,
    formato: processo.formato?.nome || processo.formato || 'Eletrônico',
    sistemaProcessual: processo.sistema?.nome || processo.sistemaProcessual || 'PJe',
    orgaoJulgador: processo.orgaoJulgador?.nome || processo.vara || processo.unidadeJudiciaria?.nome || 'Não informado',
    status: determinarStatus(processo),
    ultimaAtualizacao: formatarData(ultimaAtualizacao),
    valorCausa: processo.valorCausa || null,
    prioridade: prioridades,
    movimentos: movimentosFormatados,
    partes: (processo.partes || processo.poloAtivo?.concat(processo.poloPassivo || []) || []).map((p: any) => {
      // Debug para ver estrutura real
      console.log('📋 Parte raw:', JSON.stringify(p).substring(0, 500));
      
      // Advogados podem estar em diversos caminhos
      const advogadosRaw = p.advogados || p.representantes || p.procuradores || [];
      const advogados = advogadosRaw.map((adv: any) => {
        // O nome pode estar direto ou em pessoa.nome
        const nomeAdv = adv.nome || adv.pessoa?.nome || adv.nomeAdvogado || 'Advogado não identificado';
        
        // OAB pode estar em inscricao ou direto
        let oab: string | undefined;
        if (adv.inscricao) {
          const uf = adv.inscricao.unidadeFederativa || adv.inscricao.uf || '';
          const num = adv.inscricao.numero || adv.inscricao.numeroOAB || '';
          if (uf || num) oab = `OAB/${uf} ${num}`.trim();
        } else if (adv.numeroOAB || adv.oab) {
          oab = `OAB ${adv.numeroOAB || adv.oab}`;
        }
        
        return { nome: nomeAdv, oab };
      });
      
      const poloOriginal = (p.polo || p.tipoParte || p.tipoParticipacao || '').toUpperCase();
      
      // Nome da parte pode estar em diversos caminhos
      const nomeParte = p.nome || p.pessoa?.nome || p.nomeCompleto || p.razaoSocial || p.nomeParte || 'Nome não informado';
      
      // Tipo de pessoa
      let tipoPessoa = 'Não informado';
      if (p.tipoPessoa === 'FISICA' || p.pessoa?.tipoPessoa === 'FISICA' || p.cpf) {
        tipoPessoa = 'Pessoa Física';
      } else if (p.tipoPessoa === 'JURIDICA' || p.pessoa?.tipoPessoa === 'JURIDICA' || p.cnpj) {
        tipoPessoa = 'Pessoa Jurídica';
      }
      
      // Documento pode estar em diversos campos
      const documento = p.numeroDocumentoPrincipal 
        || p.pessoa?.numeroDocumentoPrincipal 
        || p.cpf 
        || p.cnpj 
        || p.documento
        || undefined;
      
      return {
        nome: nomeParte,
        tipo: poloMap[poloOriginal] || p.polo || p.tipoParte || 'Parte',
        polo: p.polo || p.tipoParte || 'Não informado',
        tipoPessoa,
        documento,
        advogados: advogados.length > 0 ? advogados : undefined
      };
    }),
    fonteRaw: processo // Guardar dados brutos para debug
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { numeroProcesso, cpf, tribunal, persistir, advogadoResponsavel } = await req.json();
    
    // Criar cliente Supabase para persistência
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Busca por CPF
    if (cpf) {
      const cpfLimpo = cpf.replace(/[^\d]/g, '');
      
      if (cpfLimpo.length !== 11) {
        return new Response(
          JSON.stringify({ error: 'CPF inválido. Deve conter 11 dígitos.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`📋 Buscando por CPF: ${formatCPF(cpfLimpo)}`);
      
      const processos = await buscarPorCPF(cpfLimpo, TRIBUNAIS_PARA_BUSCA_CPF);
      
      if (processos.length === 0) {
        return new Response(
          JSON.stringify({ 
            encontrado: false, 
            mensagem: 'Nenhum processo encontrado para este CPF nos tribunais consultados.',
            tempoMs: Date.now() - startTime
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const processosFormatados = processos.map(p => formatarProcesso(p, p.tribunal));
      
      console.log(`✅ Total de ${processosFormatados.length} processos encontrados em ${Date.now() - startTime}ms`);
      
      return new Response(
        JSON.stringify({ 
          encontrado: true, 
          multiplos: true,
          processos: processosFormatados,
          tempoMs: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Busca por número do processo
    if (!numeroProcesso) {
      return new Response(
        JSON.stringify({ error: 'Número do processo ou CPF é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verificar se o input é CPF
    const inputLimpo = numeroProcesso.replace(/[^\d]/g, '');
    if (inputLimpo.length === 11) {
      console.log(`🔄 Input identificado como CPF, redirecionando...`);
      
      const processos = await buscarPorCPF(inputLimpo, TRIBUNAIS_PARA_BUSCA_CPF);
      
      if (processos.length === 0) {
        return new Response(
          JSON.stringify({ 
            encontrado: false, 
            mensagem: 'Nenhum processo encontrado para este CPF nos tribunais consultados.',
            tempoMs: Date.now() - startTime
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const processosFormatados = processos.map(p => formatarProcesso(p, p.tribunal));
      
      return new Response(
        JSON.stringify({ 
          encontrado: true, 
          multiplos: true,
          processos: processosFormatados,
          tempoMs: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const numeroLimpo = numeroProcesso.trim();
    console.log(`📋 Número do processo: ${numeroLimpo}`);
    
    let tribunalBusca = tribunal?.toLowerCase();
    if (!tribunalBusca) {
      tribunalBusca = detectarTribunal(numeroLimpo);
      console.log(`🏛️ Tribunal detectado: ${tribunalBusca}`);
    }
    
    if (!tribunalBusca) {
      tribunalBusca = 'tjam';
      console.log('⚠️ Tribunal não detectado, usando TJAM como padrão');
    }
    
    const resultado = await buscarProcesso(numeroLimpo, tribunalBusca);
    
    if (!resultado.hits || resultado.hits.total.value === 0) {
      return new Response(
        JSON.stringify({ 
          encontrado: false, 
          mensagem: `Processo não encontrado no ${tribunalBusca.toUpperCase()}. Verifique o número ou selecione outro tribunal.`,
          tempoMs: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const processoRaw = resultado.hits.hits[0]._source;
    const processoFormatado = formatarProcesso(processoRaw, tribunalBusca);
    
    console.log(`✅ Processo encontrado: ${processoFormatado.classe} em ${Date.now() - startTime}ms`);
    
    // Persistir no banco se solicitado
    if (persistir) {
      try {
        console.log('💾 Persistindo processo no banco...');
        
        // Upsert do processo principal
        const { data: processoDb, error: processoError } = await supabase
          .from('processos')
          .upsert({
            // usa o número digitado pelo usuário (mantém máscara/pontuação), para bater com a busca do sistema
            numero_processo: numeroLimpo,
            advogado_responsavel: advogadoResponsavel || null,
            tribunal: processoFormatado.tribunal,
            sistema: processoFormatado.sistemaProcessual,
            sigilo: processoFormatado.nivelSigilo,
            status: processoFormatado.status,
            classe_cnj_codigo: processoFormatado.classeCodigo,
            classe_cnj_nome: processoFormatado.classe,
            titulo_acao: processoFormatado.classe,
            orgao_julgador: processoFormatado.orgaoJulgador,
            grau_formato: `${processoFormatado.grau} • ${processoFormatado.formato}`,
            ajuizado_em: parseDataParaTimestamp(processoRaw.dataAjuizamento || processoRaw.dataDistribuicao),
            ultima_atualizacao: parseDataParaTimestamp(processoRaw.movimentos?.[0]?.dataHora),
            fonte_raw: processoRaw,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'numero_processo',
            ignoreDuplicates: false
          })
          .select('id')
          .single();
        
        if (processoError) {
          console.error('❌ Erro ao salvar processo:', processoError);
        } else if (processoDb) {
          const processoId = processoDb.id;
          console.log(`✅ Processo salvo com ID: ${processoId}`);
          
          // Limpar e inserir assuntos
          await supabase.from('processo_assuntos').delete().eq('processo_id', processoId);
          
          if (processoFormatado.assuntos.length > 0) {
            const assuntosInsert = processoFormatado.assuntos.map(a => ({
              processo_id: processoId,
              assunto_cnj_codigo: a.codigo,
              assunto_nome: a.nome
            }));
            
            const { error: assuntosError } = await supabase
              .from('processo_assuntos')
              .insert(assuntosInsert);
            
            if (assuntosError) {
              console.error('❌ Erro ao salvar assuntos:', assuntosError);
            } else {
              console.log(`✅ ${assuntosInsert.length} assuntos salvos`);
            }
          }
          
          // Limpar e inserir movimentações
          await supabase.from('processo_movimentacoes').delete().eq('processo_id', processoId);
          
          if (processoFormatado.movimentos.length > 0) {
            const movimentosInsert = processoFormatado.movimentos.map((m, idx) => ({
              processo_id: processoId,
              movimento_cnj_codigo: m.codigo ? String(m.codigo) : null,
              movimento_titulo: m.nome,
              movimento_descricao: m.complemento,
              data_movimento: parseDataParaTimestamp(m.dataHoraRaw),
              ordem: idx
            }));
            
            const { error: movError } = await supabase
              .from('processo_movimentacoes')
              .insert(movimentosInsert);
            
            if (movError) {
              console.error('❌ Erro ao salvar movimentações:', movError);
            } else {
              console.log(`✅ ${movimentosInsert.length} movimentações salvas`);
            }
          }
        }
      } catch (persistError) {
        console.error('❌ Erro na persistência:', persistError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        encontrado: true, 
        processo: processoFormatado,
        tempoMs: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('❌ Erro na consulta:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar processo';
    return new Response(
      JSON.stringify({ error: errorMessage, tempoMs: Date.now() - startTime }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
