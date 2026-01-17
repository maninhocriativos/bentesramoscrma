import "npm:@supabase/supabase-js@2";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lista de tribunais disponíveis na API DataJud
const TRIBUNAIS: Record<string, string> = {
  'trt11': 'api_publica_trt11',
  'tjam': 'api_publica_tjam',
  'trf1': 'api_publica_trf1',
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

async function buscarProcessoDataJud(numeroProcesso: string, tribunal: string): Promise<any> {
  const DATAJUD_API_KEY = Deno.env.get('DATAJUD_API_KEY');
  if (!DATAJUD_API_KEY) throw new Error('DATAJUD_API_KEY not configured');
  
  const apiName = TRIBUNAIS[tribunal] || `api_publica_${tribunal}`;
  const url = `https://api-publica.datajud.cnj.jus.br/${apiName}/_search`;
  
  console.log(`🔍 Buscando ${numeroProcesso} no ${tribunal}...`);
  
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
  
  if (!response.ok) {
    console.error(`❌ Erro API: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  return data.hits?.hits?.[0]?._source || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { processos } = await req.json();
    
    if (!processos || !Array.isArray(processos)) {
      return new Response(
        JSON.stringify({ error: 'Array de processos é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const resultados = [];
    
    for (const numero of processos) {
      console.log(`\n📋 Processando: ${numero}`);
      
      // Verificar se já existe
      const { data: existing } = await supabaseClient
        .from('processos')
        .select('id, numero_processo')
        .eq('numero_processo', numero)
        .maybeSingle();
      
      if (existing) {
        console.log(`⚠️ Processo já existe: ${numero}`);
        resultados.push({ numero, status: 'exists', id: existing.id });
        continue;
      }
      
      // Detectar tribunal
      const tribunal = detectarTribunal(numero);
      if (!tribunal) {
        console.log(`❌ Tribunal não detectado: ${numero}`);
        resultados.push({ numero, status: 'error', message: 'Tribunal não detectado' });
        continue;
      }
      
      // Buscar dados na API DataJud
      const processoData = await buscarProcessoDataJud(numero, tribunal);
      
      // Preparar dados para inserção
      const insertData = {
        numero_processo: numero,
        titulo_acao: processoData?.classe?.nome || processoData?.classeProcessual?.nome || 'Processo Importado',
        status: 'Em Andamento',
        advogado_responsavel: null,
        cliente_id: null,
        frequencia_notificacao_dias: 7,
        notificacao_ativa: true,
      };
      
      // Tentar vincular cliente se houver parte autora
      if (processoData?.partes) {
        const parteAutor = processoData.partes.find((p: any) => 
          p.polo === 'AT' || p.polo === 'PA' || p.tipoParte?.includes('AUTOR')
        );
        
        if (parteAutor?.nome) {
          // Buscar lead pelo nome
          const { data: lead } = await supabaseClient
            .from('leads_juridicos')
            .select('id, nome')
            .ilike('nome', `%${parteAutor.nome.split(' ')[0]}%`)
            .limit(1)
            .maybeSingle();
          
          if (lead) {
            insertData.cliente_id = lead.id;
            console.log(`✅ Cliente vinculado: ${lead.nome}`);
          }
        }
      }
      
      // Inserir no banco
      const { data: inserted, error } = await supabaseClient
        .from('processos')
        .insert(insertData)
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Erro ao inserir: ${error.message}`);
        resultados.push({ numero, status: 'error', message: error.message });
      } else {
        console.log(`✅ Processo importado: ${numero}`);
        resultados.push({ numero, status: 'imported', id: inserted.id, titulo: insertData.titulo_acao });
      }
    }
    
    console.log(`\n📊 Resumo: ${resultados.filter(r => r.status === 'imported').length} importados`);
    
    return new Response(
      JSON.stringify({ success: true, resultados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Erro:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
