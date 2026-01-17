import "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessoResponse {
  numeroProcesso: string;
  classe: string;
  assuntos: string[];
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

// Lista de tribunais para busca por CPF (busca em múltiplos)
const TRIBUNAIS_PARA_BUSCA_CPF = ['trt11', 'tjam', 'trf1'];

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
  // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
  // J = Justiça (5 = Trabalho, 8 = Estadual, 4 = Federal)
  // TR = Tribunal (ex: 11 = TRT11 ou TJ da região)
  
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
  
  // Justiça Estadual - mapear por código do tribunal
  if (justica === '8') {
    const tjNum = parseInt(tribunal);
    // Mapeamento de código para sigla do TJ
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
  console.log(`📡 URL: ${url}`);
  
  // Remover formatação do número, mantendo apenas dígitos
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
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `APIKey ${DATAJUD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: {
            bool: {
              should: [
                { match: { "partes.numeroDocumentoPrincipal": cpfLimpo } },
                { match: { "partes.cpf": cpfLimpo } }
              ],
              minimum_should_match: 1
            }
          },
          size: 20
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.hits?.hits?.length > 0) {
          console.log(`✅ Encontrados ${data.hits.hits.length} processos no ${tribunal.toUpperCase()}`);
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

// Formata data de diferentes formatos possíveis da API DataJud
function formatarData(dataStr: string | null | undefined): string {
  if (!dataStr) return 'Não informado';
  
  try {
    let date: Date | null = null;
    
    // Log para debug
    console.log(`📅 Formatando data: ${dataStr} (tipo: ${typeof dataStr})`);
    
    // Se for número (timestamp em milissegundos)
    if (typeof dataStr === 'number' || !isNaN(Number(dataStr))) {
      const timestamp = Number(dataStr);
      // DataJud pode retornar timestamp em ms 
      // Verificar se é um timestamp válido (após 1970 e antes de 2100)
      if (timestamp > 0 && timestamp < 4102444800000) {
        date = new Date(timestamp);
      }
    }
    
    // Formato ISO: 2023-10-17T00:00:00.000Z ou 2023-10-17 ou 2011-05-28
    if (!date && typeof dataStr === 'string' && dataStr.includes('-')) {
      // Extrair apenas a parte da data (ignorar timezone issues)
      const datePart = dataStr.split('T')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Mês é 0-indexed
        const day = parseInt(parts[2]);
        
        // Validar que é uma data razoável (entre 1900 e 2100)
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
    
    // Se conseguiu parsear a data, formatar
    if (date && !isNaN(date.getTime())) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      // Validar ano razoável
      if (year >= 1900 && year <= 2100) {
        console.log(`✅ Data formatada: ${day}/${month}/${year}`);
        return `${day}/${month}/${year}`;
      }
    }
    
    console.warn(`⚠️ Não foi possível formatar a data: ${dataStr}`);
  } catch (e) {
    console.error('Erro ao formatar data:', e);
  }
  
  // Retornar a string original se não conseguir formatar
  return String(dataStr);
}

// Determina o status do processo baseado nas movimentações e campos
function determinarStatus(processo: any): string {
  // Verificar campo situação se existir
  if (processo.situacao) return processo.situacao;
  
  // Verificar última movimentação para inferir status
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
  // Extrair última atualização das movimentações
  const movimentos = processo.movimentos || [];
  const ultimaAtualizacao = movimentos.length > 0 ? movimentos[0].dataHora : null;
  
  // Extrair prioridades
  const prioridades: string[] = [];
  if (processo.prioridades) {
    prioridades.push(...processo.prioridades.map((p: any) => p.nome || p));
  }
  
  // Mapear grau do processo
  const grauMap: Record<string, string> = {
    'G1': '1º Grau',
    'G2': '2º Grau', 
    'SUP': 'Superior',
    'ORI': 'Originário'
  };
  
  // Mapear polo das partes
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
  
  return {
    numeroProcesso: processo.numeroProcesso,
    classe: processo.classe?.nome || processo.classeProcessual?.nome || 'Não informado',
    assuntos: (processo.assuntos || processo.assuntosProcessuais || []).map((a: any) => a.nome || a),
    tribunal: processo.tribunal || processo.siglaTribunal || tribunalFallback.toUpperCase(),
    dataAjuizamento: formatarData(processo.dataAjuizamento || processo.dataDistribuicao || processo.dataHoraUltimaAtualizacao),
    // Campos detalhados
    grau: grauMap[processo.grau] || processo.grau || '1º Grau',
    nivelSigilo: processo.nivelSigilo === 0 ? 'Público' : processo.nivelSigilo === 1 ? 'Segredo de Justiça' : `Nível ${processo.nivelSigilo || 0}`,
    formato: processo.formato?.nome || processo.formato || 'Eletrônico',
    sistemaProcessual: processo.sistema?.nome || processo.sistemaProcessual || 'PJe',
    orgaoJulgador: processo.orgaoJulgador?.nome || processo.vara || processo.unidadeJudiciaria?.nome || 'Não informado',
    status: determinarStatus(processo),
    ultimaAtualizacao: formatarData(ultimaAtualizacao),
    valorCausa: processo.valorCausa || null,
    prioridade: prioridades,
    movimentos: movimentos.slice(0, 15).map((m: any) => ({
      dataHora: formatarData(m.dataHora),
      nome: m.nome || m.movimentoNacional?.nome || 'Movimentação',
      complemento: m.complementosTabelados?.map((c: any) => c.nome || c.descricao).join(', ') 
        || m.complemento 
        || undefined,
      codigo: m.codigo || m.movimentoNacional?.codigo
    })),
    partes: (processo.partes || []).map((p: any) => {
      // Extrair advogados da parte
      const advogados = (p.advogados || []).map((adv: any) => ({
        nome: adv.nome || 'Advogado não identificado',
        oab: adv.inscricao ? `OAB/${adv.inscricao.unidadeFederativa || ''} ${adv.inscricao.numero || ''}`.trim() : undefined
      }));
      
      const poloOriginal = (p.polo || p.tipoParte || '').toUpperCase();
      
      return {
        nome: p.nome || p.pessoa?.nome || 'Nome não informado',
        tipo: poloMap[poloOriginal] || p.polo || 'Parte',
        polo: p.polo || 'Não informado',
        tipoPessoa: p.tipoPessoa === 'FISICA' || p.pessoa?.tipoPessoa === 'FISICA' ? 'Pessoa Física' : 
                    p.tipoPessoa === 'JURIDICA' || p.pessoa?.tipoPessoa === 'JURIDICA' ? 'Pessoa Jurídica' : 'Não informado',
        documento: p.numeroDocumentoPrincipal || p.pessoa?.numeroDocumentoPrincipal || undefined,
        advogados: advogados.length > 0 ? advogados : undefined
      };
    })
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { numeroProcesso, cpf, tribunal } = await req.json();
    
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
            mensagem: 'Nenhum processo encontrado para este CPF nos tribunais consultados.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const processosFormatados = processos.map(p => formatarProcesso(p, p.tribunal));
      
      console.log(`✅ Total de ${processosFormatados.length} processos encontrados`);
      
      return new Response(
        JSON.stringify({ 
          encontrado: true, 
          multiplos: true,
          processos: processosFormatados 
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
    
    // Verificar se o input é CPF (11 dígitos)
    const inputLimpo = numeroProcesso.replace(/[^\d]/g, '');
    if (inputLimpo.length === 11) {
      // Redirecionar para busca por CPF
      console.log(`🔄 Input identificado como CPF, redirecionando...`);
      
      const processos = await buscarPorCPF(inputLimpo, TRIBUNAIS_PARA_BUSCA_CPF);
      
      if (processos.length === 0) {
        return new Response(
          JSON.stringify({ 
            encontrado: false, 
            mensagem: 'Nenhum processo encontrado para este CPF nos tribunais consultados.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const processosFormatados = processos.map(p => formatarProcesso(p, p.tribunal));
      
      return new Response(
        JSON.stringify({ 
          encontrado: true, 
          multiplos: true,
          processos: processosFormatados 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Limpar número do processo (mantém formato CNJ)
    const numeroLimpo = numeroProcesso.trim();
    console.log(`📋 Número do processo: ${numeroLimpo}`);
    
    // Detectar tribunal se não informado
    let tribunalBusca = tribunal?.toLowerCase();
    if (!tribunalBusca) {
      tribunalBusca = detectarTribunal(numeroLimpo);
      console.log(`🏛️ Tribunal detectado: ${tribunalBusca}`);
    }
    
    // Se não detectou tribunal, tentar TRT11 (Amazonas) como padrão
    if (!tribunalBusca) {
      tribunalBusca = 'trt11';
      console.log('⚠️ Tribunal não detectado, usando TRT11 como padrão');
    }
    
    const resultado = await buscarProcesso(numeroLimpo, tribunalBusca);
    
    if (!resultado.hits || resultado.hits.total.value === 0) {
      return new Response(
        JSON.stringify({ 
          encontrado: false, 
          mensagem: `Processo não encontrado no ${tribunalBusca.toUpperCase()}. Verifique o número ou selecione outro tribunal.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const processo = resultado.hits.hits[0]._source;
    const processoFormatado = formatarProcesso(processo, tribunalBusca);
    
    console.log(`✅ Processo encontrado: ${processoFormatado.classe}`);
    
    return new Response(
      JSON.stringify({ encontrado: true, processo: processoFormatado }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('❌ Erro na consulta:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar processo';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
