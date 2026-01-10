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
  movimentos: Array<{
    dataHora: string;
    nome: string;
    complemento?: string;
  }>;
  partes: Array<{
    nome: string;
    tipo: string;
  }>;
}

// Lista de tribunais disponíveis na API DataJud
const TRIBUNAIS = {
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
  
  // Justiça Estadual - mapear por região (simplificado)
  if (justica === '8') {
    // Por padrão, retornar null para buscar em múltiplos TJs
    return null;
  }
  
  return null;
}

async function buscarProcesso(numeroProcesso: string, tribunal: string): Promise<any> {
  const DATAJUD_API_KEY = Deno.env.get('DATAJUD_API_KEY');
  
  if (!DATAJUD_API_KEY) {
    throw new Error('API Key do DataJud não configurada');
  }
  
  const apiName = TRIBUNAIS[tribunal as keyof typeof TRIBUNAIS];
  if (!apiName) {
    throw new Error(`Tribunal ${tribunal} não suportado`);
  }
  
  const url = `https://api-publica.datajud.cnj.jus.br/${apiName}/_search`;
  
  console.log(`🔍 Buscando processo ${numeroProcesso} no tribunal ${tribunal}...`);
  console.log(`📡 URL: ${url}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `APIKey ${DATAJUD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: {
        match: {
          numeroProcesso: numeroProcesso.replace(/[^\d]/g, '')
        }
      },
      size: 1
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { numeroProcesso, tribunal } = await req.json();
    
    if (!numeroProcesso) {
      return new Response(
        JSON.stringify({ error: 'Número do processo é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Limpar número do processo (remover pontos, traços, etc)
    const numeroLimpo = numeroProcesso.replace(/[^\d-\.]/g, '').trim();
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
          mensagem: 'Processo não encontrado. Verifique o número e o tribunal.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const processo = resultado.hits.hits[0]._source;
    
    // Formatar resposta
    const processoFormatado: ProcessoResponse = {
      numeroProcesso: processo.numeroProcesso,
      classe: processo.classe?.nome || 'Não informado',
      assuntos: processo.assuntos?.map((a: any) => a.nome) || [],
      tribunal: processo.tribunal || tribunalBusca.toUpperCase(),
      dataAjuizamento: processo.dataAjuizamento,
      movimentos: (processo.movimentos || []).slice(0, 10).map((m: any) => ({
        dataHora: m.dataHora,
        nome: m.nome,
        complemento: m.complementosTabelados?.map((c: any) => c.nome).join(', ') || undefined
      })),
      partes: (processo.partes || []).map((p: any) => ({
        nome: p.nome || 'Nome não informado',
        tipo: p.polo === 'PA' ? 'Autor' : p.polo === 'PP' ? 'Réu' : p.polo
      }))
    };
    
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
