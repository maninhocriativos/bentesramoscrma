// xhr polyfill removed — using native fetch
const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
// Modelo de visão configurável (default gpt-4o, que suporta imagem).
const OPENAI_VISION_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o';


interface MediaMessage {
  type: 'audio' | 'image' | 'document' | 'video';
  url: string;
  mimeType?: string;
  fileName?: string;
}

interface ProcessResult {
  transcription?: string;
  imageAnalysis?: string;
  documentType?: string;
  extractedData?: any;
}

// ============================================================
// TRANSCRIÇÃO DE ÁUDIO COM WHISPER
// ============================================================
async function transcribeAudio(audioUrl: string): Promise<string> {
  console.log('[ISA-MULTIMODAL] 🎙️ Transcrevendo áudio:', audioUrl);
  
  try {
    // Baixar o áudio
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error('Falha ao baixar áudio');
    
    const audioBlob = await audioResponse.blob();
    
    // Preparar FormData para Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'text');
    
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });
    
    if (!whisperResponse.ok) {
      const error = await whisperResponse.text();
      console.error('[ISA-MULTIMODAL] Erro Whisper:', error);
      throw new Error(`Whisper API error: ${error}`);
    }
    
    const transcription = await whisperResponse.text();
    console.log('[ISA-MULTIMODAL] ✅ Transcrição:', transcription.substring(0, 100));
    
    return transcription;
  } catch (error) {
    console.error('[ISA-MULTIMODAL] ❌ Erro na transcrição:', error);
    return '[Não foi possível transcrever o áudio]';
  }
}

// ============================================================
// ANÁLISE DE IMAGEM COM VISION
// ============================================================
async function analyzeImage(imageUrl: string, context?: string): Promise<string> {
  console.log('[ISA-MULTIMODAL] 🖼️ Analisando imagem:', imageUrl);
  
  try {
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    const apiKey = OPENAI_API_KEY;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_VISION_MODEL,
        messages: [
          {
            role: 'system',
            content: `Você é a Isa, assistente jurídica do escritório Bentes & Ramos (Direito Bancário).
Analise a imagem e CLASSIFIQUE o documento, sempre começando a resposta com:
TIPO: <um destes> → CONTRATO | EXTRATO_BANCARIO | PRINT_APP_BANCO | RG | CPF | CNH | COMPROVANTE | SELFIE | OUTRO

Critérios:
- CONTRATO: contrato de empréstimo/financiamento/cartão/consignado, cédula de crédito bancário (CCB), termo de adesão. É o documento PRINCIPAL.
- EXTRATO_BANCARIO: extrato oficial com lançamentos/débitos.
- PRINT_APP_BANCO: captura de tela do aplicativo do banco (tela de empréstimos, parcelas, contratos, saldo). NÃO é o contrato em si.
- RG/CPF/CNH: documentos de identidade.

Depois da classificação, extraia o que for relevante:
- Se CONTRATO ou PRINT_APP_BANCO ou EXTRATO: banco, valor, parcelas, e principalmente indícios de SEGURO PRESTAMISTA, TÍTULO DE CAPITALIZAÇÃO, TARIFAS ou PRODUTOS EMBUTIDOS (venda casada). Cite valores se visíveis.
- Se RG/CPF/CNH: nome, CPF, RG, datas, e se está legível.

IMPORTANTE: se o TIPO for PRINT_APP_BANCO ou EXTRATO_BANCARIO, registre explicitamente "OBSERVAÇÃO: ainda é necessário solicitar o CONTRATO ao cliente — o print/extrato não substitui o contrato."

${context ? `Contexto do caso: ${context}` : ''}`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analise esta imagem e extraia todas as informações relevantes:' },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 1000,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[ISA-MULTIMODAL] Erro Vision:', error);
      throw new Error(`Vision API error: ${error}`);
    }
    
    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || '';
    
    console.log('[ISA-MULTIMODAL] ✅ Análise da imagem:', analysis.substring(0, 100));
    return analysis;
  } catch (error) {
    console.error('[ISA-MULTIMODAL] ❌ Erro na análise de imagem:', error);
    return '[Não foi possível analisar a imagem]';
  }
}

// ============================================================
// EXTRAÇÃO E ANÁLISE DE PDF
// ============================================================
async function extractAndAnalyzePDF(pdfUrl: string, context?: string): Promise<string> {
  console.log('[ISA-MULTIMODAL] 📄 Extraindo texto de PDF:', pdfUrl);
  
  try {
    // Baixar o PDF
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) throw new Error('Falha ao baixar PDF');
    
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);
    
    // Extrair texto bruto do PDF (parser simples para PDFs com texto embutido)
    let extractedText = '';
    const textDecoder = new TextDecoder('latin1');
    const rawText = textDecoder.decode(pdfBytes);
    
    // Método 1: Extrair streams de texto do PDF
    const textMatches = rawText.matchAll(/\(([^)]+)\)/g);
    const textParts: string[] = [];
    for (const match of textMatches) {
      const part = match[1];
      // Filtrar lixo binário - manter apenas strings com caracteres legíveis
      if (part.length > 2 && /[a-zA-ZÀ-ÿ0-9]{2,}/.test(part)) {
        textParts.push(part);
      }
    }
    
    // Método 2: Buscar texto entre BT/ET (text objects)
    const btEtMatches = rawText.matchAll(/BT\s([\s\S]*?)ET/g);
    for (const match of btEtMatches) {
      const block = match[1];
      const tjMatches = block.matchAll(/\(([^)]+)\)\s*Tj/g);
      for (const tj of tjMatches) {
        if (tj[1].length > 1) textParts.push(tj[1]);
      }
    }
    
    extractedText = textParts.join(' ').substring(0, 8000);
    
    console.log('[ISA-MULTIMODAL] Texto extraído do PDF:', extractedText.substring(0, 200));
    
    // Se não extraiu texto suficiente, provavelmente é um PDF escaneado
    // Nesse caso, converter primeira página para imagem via Vision
    if (extractedText.trim().length < 50) {
      console.log('[ISA-MULTIMODAL] PDF parece escaneado, usando Vision para OCR...');
      
      // Para PDFs escaneados, enviar a URL diretamente para o modelo de visão
      // Alguns modelos conseguem ler PDFs diretamente
      const apiUrl = 'https://api.openai.com/v1/chat/completions';
      
      const apiKey = OPENAI_API_KEY;
      
      const ocrResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENAI_VISION_MODEL,
          messages: [
            {
              role: 'system',
              content: `Você é um extrator de dados de documentos jurídicos e financeiros.
Analise este documento PDF e extraia TODAS as informações relevantes.

Se for um CONTRATO DE EMPRÉSTIMO/FINANCIAMENTO:
- Taxa de juros mensal e anual
- CET (Custo Efetivo Total)
- Valor financiado e valor total com juros
- Presença de SEGURO PRESTAMISTA (valor e se foi contratado voluntariamente)
- Presença de CAPITALIZAÇÃO ou título de capitalização
- IOF, tarifas e outros encargos
- Prazo e número de parcelas

Se for um EXTRATO BANCÁRIO:
- Débitos suspeitos (seguros, capitalização, tarifas)
- Parcelas de empréstimo
- Descontos recorrentes não identificados

${context ? `Contexto: ${context}` : ''}`
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Analise este documento e extraia todas as informações financeiras e jurídicas relevantes:' },
                { 
                  type: 'image_url', 
                  image_url: { url: pdfUrl } 
                }
              ]
            }
          ],
          max_tokens: 2000,
        }),
      });
      
      if (ocrResponse.ok) {
        const ocrData = await ocrResponse.json();
        const ocrAnalysis = ocrData.choices?.[0]?.message?.content || '';
        if (ocrAnalysis.length > 20) {
          console.log('[ISA-MULTIMODAL] ✅ OCR do PDF concluído');
          return ocrAnalysis;
        }
      }
      
      return '[PDF recebido mas não foi possível extrair o texto. O documento pode estar protegido ou ser uma imagem escaneada de baixa qualidade. Peça ao cliente para enviar uma foto legível das páginas principais do contrato.]';
    }
    
    // Analisar o texto extraído com GPT
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    const apiKey = OPENAI_API_KEY;
    
    const analysisResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_VISION_MODEL,
        messages: [
          {
            role: 'system',
            content: `Você é uma assistente jurídica especializada em Direito Bancário.
Analise o texto do documento abaixo e identifique:

1. **JUROS ABUSIVOS**: Taxa de juros mensal e anual. Compare com a taxa média do Banco Central. Indique se são abusivos.
2. **SEGURO PRESTAMISTA**: Verifique se há cobrança de seguro prestamista. Informe o valor e se configura venda casada.
3. **CAPITALIZAÇÃO**: Verifique se há título de capitalização ou seguro de capitalização embutido.
4. **CET**: Custo Efetivo Total - se estiver muito acima da taxa de juros, há encargos ocultos.
5. **TARIFAS ABUSIVAS**: TAC, TEC, tarifa de cadastro, etc.
6. **IOF**: Valor cobrado.
7. **VALOR FINANCIADO vs VALOR TOTAL**: Calcule a diferença.

Formate a resposta de forma clara e objetiva para que um advogado possa avaliar rapidamente.

${context ? `Contexto adicional: ${context}` : ''}`
          },
          {
            role: 'user',
            content: `Analise este documento:\n\n${extractedText}`
          }
        ],
        max_tokens: 2000,
      }),
    });
    
    if (!analysisResponse.ok) {
      throw new Error('Falha na análise do PDF');
    }
    
    const analysisData = await analysisResponse.json();
    const analysis = analysisData.choices?.[0]?.message?.content || '';
    
    console.log('[ISA-MULTIMODAL] ✅ Análise do PDF concluída:', analysis.substring(0, 100));
    return analysis;
    
  } catch (error) {
    console.error('[ISA-MULTIMODAL] ❌ Erro ao processar PDF:', error);
    return '[Não foi possível processar o PDF. Peça ao cliente para enviar fotos das páginas principais do contrato.]';
  }
}

// ============================================================
// CLASSIFICAÇÃO E EXTRAÇÃO DE DOCUMENTOS
// ============================================================
async function classifyAndExtractDocument(
  imageUrl: string, 
  leadId: string,
  supabase: any
): Promise<{ type: string; data: any; saved: boolean }> {
  console.log('[ISA-MULTIMODAL] 📄 Classificando documento para lead:', leadId);
  
  try {
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    const apiKey = OPENAI_API_KEY;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_VISION_MODEL,
        messages: [
          {
            role: 'system',
            content: `Você é um extrator de dados de documentos. Analise a imagem e retorne um JSON com:
{
  "tipo_documento": "RG|CPF|CNH|COMPROVANTE_RESIDENCIA|COMPROVANTE_RENDA|CONTRATO|PROCURACAO|OUTRO",
  "dados_extraidos": {
    "nome_completo": "se disponível",
    "cpf": "se disponível (apenas números)",
    "rg": "se disponível",
    "data_nascimento": "YYYY-MM-DD se disponível",
    "endereco": "se disponível",
    "cidade": "se disponível",
    "uf": "se disponível",
    "cep": "se disponível"
  },
  "qualidade": "BOA|MEDIA|RUIM",
  "observacoes": "qualquer observação relevante"
}

IMPORTANTE: Retorne APENAS o JSON, sem markdown.`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extraia os dados deste documento:' },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 500,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Falha na API de visão');
    }
    
    const data = await response.json();
    let extracted: any = {};
    
    try {
      const content = data.choices?.[0]?.message?.content || '{}';
      // Limpar possíveis markdown
      const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extracted = JSON.parse(cleanJson);
    } catch (e) {
      console.error('[ISA-MULTIMODAL] Erro ao parsear JSON:', e);
      extracted = { tipo_documento: 'OUTRO', dados_extraidos: {}, qualidade: 'RUIM' };
    }
    
    // Salvar documento recebido no checklist
    const docType = extracted.tipo_documento || 'OUTRO';
    
    // Verificar se já existe no checklist
    const { data: existingDoc } = await supabase
      .from('lead_docs_checklist')
      .select('id')
      .eq('lead_id', leadId)
      .eq('doc_type', docType)
      .maybeSingle();
    
    if (existingDoc) {
      // Atualizar como recebido
      await supabase
        .from('lead_docs_checklist')
        .update({
          received: true,
          received_at: new Date().toISOString(),
          notes: `Documento recebido via WhatsApp. Qualidade: ${extracted.qualidade || 'N/A'}`
        })
        .eq('id', existingDoc.id);
    } else {
      // Criar novo registro
      await supabase
        .from('lead_docs_checklist')
        .insert({
          lead_id: leadId,
          doc_type: docType,
          doc_label: docType.replace(/_/g, ' '),
          received: true,
          received_at: new Date().toISOString(),
          notes: `Documento recebido via WhatsApp. Qualidade: ${extracted.qualidade || 'N/A'}`
        });
    }
    
    // Se extraiu dados contratuais, salvar
    if (extracted.dados_extraidos && Object.keys(extracted.dados_extraidos).length > 0) {
      const dadosContrato = extracted.dados_extraidos;
      
      // Verificar se já existe registro de contract_data
      const { data: existingContract } = await supabase
        .from('lead_contract_data')
        .select('id, dados_extras')
        .eq('lead_id', leadId)
        .maybeSingle();
      
      if (existingContract) {
        // Merge com dados existentes
        const dadosAtuais = existingContract.dados_extras || {};
        await supabase
          .from('lead_contract_data')
          .update({
            cpf: dadosContrato.cpf || existingContract.cpf,
            rg: dadosContrato.rg || existingContract.rg,
            data_nascimento: dadosContrato.data_nascimento || existingContract.data_nascimento,
            endereco: dadosContrato.endereco || existingContract.endereco,
            cidade: dadosContrato.cidade || existingContract.cidade,
            uf: dadosContrato.uf || existingContract.uf,
            cep: dadosContrato.cep || existingContract.cep,
            dados_extras: { ...dadosAtuais, ...dadosContrato },
            updated_at: new Date().toISOString()
          })
          .eq('id', existingContract.id);
      } else {
        // Criar novo registro
        await supabase
          .from('lead_contract_data')
          .insert({
            lead_id: leadId,
            cpf: dadosContrato.cpf,
            rg: dadosContrato.rg,
            data_nascimento: dadosContrato.data_nascimento,
            endereco: dadosContrato.endereco,
            cidade: dadosContrato.cidade,
            uf: dadosContrato.uf,
            cep: dadosContrato.cep,
            dados_extras: dadosContrato
          });
      }
      
      // Atualizar nome do lead se extraído
      if (dadosContrato.nome_completo) {
        await supabase
          .from('leads_juridicos')
          .update({ nome: dadosContrato.nome_completo })
          .eq('id', leadId);
      }
    }
    
    console.log('[ISA-MULTIMODAL] ✅ Documento classificado:', docType);
    
    return {
      type: docType,
      data: extracted.dados_extraidos || {},
      saved: true
    };
  } catch (error) {
    console.error('[ISA-MULTIMODAL] ❌ Erro ao classificar documento:', error);
    return { type: 'ERRO', data: {}, saved: false };
  }
}

// ============================================================
// ENVIO DE CONTRATO VIA CLICKSIGN
// ============================================================
async function sendContract(
  leadId: string,
  modeloId: string,
  supabase: any
): Promise<{ success: boolean; message: string; contractUrl?: string }> {
  console.log('[ISA-MULTIMODAL] 📝 Enviando contrato para lead:', leadId);
  
  try {
    // Buscar dados do lead
    const { data: lead } = await supabase
      .from('leads_juridicos')
      .select('*, lead_contract_data(*)')
      .eq('id', leadId)
      .single();
    
    if (!lead) {
      return { success: false, message: 'Lead não encontrado' };
    }
    
    // Verificar se tem dados suficientes
    const contractData = lead.lead_contract_data?.[0];
    if (!contractData?.cpf) {
      return { 
        success: false, 
        message: 'Dados insuficientes para gerar contrato. CPF é obrigatório.' 
      };
    }
    
    // Chamar edge function do Clicksign
    const { data: clicksignResult, error } = await supabase.functions.invoke('clicksign', {
      body: {
        action: 'criar_documento',
        leadId,
        modeloId,
        dados: {
          nome: lead.nome,
          cpf: contractData.cpf,
          email: lead.email,
          telefone: lead.telefone,
          ...contractData
        }
      }
    });
    
    if (error || !clicksignResult?.success) {
      return { 
        success: false, 
        message: clicksignResult?.error || 'Erro ao criar contrato no Clicksign' 
      };
    }
    
    // Atualizar lead
    await supabase
      .from('leads_juridicos')
      .update({
        lead_state: 'CONTRACT_SENT',
        contract_sent_at: new Date().toISOString(),
        link_contrato: clicksignResult.documentUrl,
        state_updated_at: new Date().toISOString()
      })
      .eq('id', leadId);
    
    // Registrar histórico de estado
    await supabase.from('lead_state_history').insert({
      lead_id: leadId,
      from_state: lead.lead_state,
      to_state: 'CONTRACT_SENT',
      changed_by: 'isa_auto',
      reason: 'Contrato enviado automaticamente pela Isa'
    });
    
    console.log('[ISA-MULTIMODAL] ✅ Contrato enviado:', clicksignResult.documentUrl);
    
    return {
      success: true,
      message: 'Contrato criado e enviado para assinatura',
      contractUrl: clicksignResult.documentUrl
    };
  } catch (error) {
    console.error('[ISA-MULTIMODAL] ❌ Erro ao enviar contrato:', error);
    return { success: false, message: 'Erro interno ao processar contrato' };
  }
}

// ============================================================
// BUSCAR CONTEXTO COMPLETO DO LEAD
// ============================================================
async function getFullLeadContext(leadId: string, supabase: any): Promise<any> {
  const [
    { data: lead },
    { data: classification },
    { data: contractData },
    { data: docsChecklist },
    { data: stateHistory },
    { data: mensagens },
    { data: interacoes },
    { data: compromissos },
    { data: followup },
    { data: processos },
    { data: honorarios }
  ] = await Promise.all([
    supabase.from('leads_juridicos').select('*').eq('id', leadId).single(),
    supabase.from('lead_classifications').select('*').eq('lead_id', leadId).maybeSingle(),
    supabase.from('lead_contract_data').select('*').eq('lead_id', leadId).maybeSingle(),
    supabase.from('lead_docs_checklist').select('*').eq('lead_id', leadId),
    supabase.from('lead_state_history').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(10),
    supabase.from('manychat_mensagens').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(30),
    supabase.from('interacoes').select('*').eq('cliente_id', leadId).order('data_interacao', { ascending: false }).limit(15),
    supabase.from('compromissos').select('*').eq('lead_id', leadId).order('data_inicio', { ascending: false }).limit(5),
    supabase.from('lead_followups').select('*').eq('lead_id', leadId).maybeSingle(),
    supabase.from('processos').select('*').eq('cliente_id', leadId),
    supabase.from('honorarios').select('*, parcelas(*)').eq('cliente_id', leadId)
  ]);

  return {
    lead,
    classification,
    contractData,
    docsChecklist: docsChecklist || [],
    stateHistory: stateHistory || [],
    mensagens: mensagens || [],
    interacoes: interacoes || [],
    compromissos: compromissos || [],
    followup,
    processos: processos || [],
    honorarios: honorarios || [],
    // Métricas calculadas
    totalMensagens: mensagens?.length || 0,
    diasDesdeContato: lead?.created_at 
      ? Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0,
    docsRecebidos: docsChecklist?.filter((d: any) => d.received).length || 0,
    docsPendentes: docsChecklist?.filter((d: any) => !d.received).length || 0,
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { 
      action, 
      subscriberId, 
      leadId, 
      mediaUrl, 
      mediaType,
      mimeType,
      context,
      modeloId
    } = body;

    console.log('[ISA-MULTIMODAL] Ação:', action, '| Lead:', leadId);

    let result: any = {};

    switch (action) {
      case 'transcribe_audio':
        const transcription = await transcribeAudio(mediaUrl);
        result = { success: true, transcription };
        break;

      case 'analyze_image':
        const analysis = await analyzeImage(mediaUrl, context);
        result = { success: true, analysis };
        break;

      case 'process_document':
        if (!leadId) {
          result = { success: false, error: 'leadId obrigatório' };
        } else {
          const docResult = await classifyAndExtractDocument(mediaUrl, leadId, supabase);
          result = { success: true, ...docResult };
        }
        break;

      case 'send_contract':
        if (!leadId) {
          result = { success: false, error: 'leadId obrigatório' };
        } else {
          result = await sendContract(leadId, modeloId || 'default', supabase);
        }
        break;

      case 'get_lead_context':
        if (!leadId) {
          result = { success: false, error: 'leadId obrigatório' };
        } else {
          const context = await getFullLeadContext(leadId, supabase);
          result = { success: true, context };
        }
        break;

      case 'process_media':
        // Processamento automático baseado no tipo de mídia
        if (mediaType === 'audio' || mimeType?.includes('audio') || mediaUrl?.includes('.ogg')) {
          const transcription = await transcribeAudio(mediaUrl);
          result = { 
            success: true, 
            type: 'audio',
            transcription,
            message: `🎙️ Transcrição do áudio: "${transcription}"`
          };
        } else if (mediaType === 'document' || mimeType?.includes('pdf') || mediaUrl?.match(/\.pdf/i)) {
          // PDF / Documento - extrair texto e analisar
          const pdfAnalysis = await extractAndAnalyzePDF(mediaUrl, context);
          result = {
            success: true,
            mediaType: 'pdf',
            analysis: pdfAnalysis,
            message: pdfAnalysis
          };
          
          // Se tem leadId, salvar no checklist de documentos
          if (leadId) {
            const docType = 'CONTRATO_PDF';
            const { data: existingDoc } = await supabase
              .from('lead_docs_checklist')
              .select('id')
              .eq('lead_id', leadId)
              .eq('doc_type', docType)
              .maybeSingle();
            
            if (existingDoc) {
              await supabase
                .from('lead_docs_checklist')
                .update({
                  received: true,
                  received_at: new Date().toISOString(),
                  notes: `PDF recebido e analisado via WhatsApp`
                })
                .eq('id', existingDoc.id);
            } else {
              await supabase
                .from('lead_docs_checklist')
                .insert({
                  lead_id: leadId,
                  doc_type: docType,
                  doc_label: 'Contrato PDF',
                  received: true,
                  received_at: new Date().toISOString(),
                  notes: `PDF recebido e analisado via WhatsApp`
                });
            }
          }
        } else if (mediaType === 'image' || mimeType?.includes('image') || mediaUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
          // Se tem leadId, processar como documento
          if (leadId) {
            const docResult = await classifyAndExtractDocument(mediaUrl, leadId, supabase);
            result = {
              success: true,
              mediaType: 'document',
              documentType: docResult.type,
              data: docResult.data,
              saved: docResult.saved,
              message: `📄 Documento ${docResult.type} processado e salvo.`
            };
          } else {
            const analysis = await analyzeImage(mediaUrl, context);
            result = {
              success: true,
              mediaType: 'image',
              analysis,
              message: analysis
            };
          }
        } else {
          result = { 
            success: false, 
            error: 'Tipo de mídia não suportado',
            supportedTypes: ['audio', 'image', 'pdf', 'document']
          };
        }
        break;

      default:
        result = { success: false, error: `Ação desconhecida: ${action}` };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[ISA-MULTIMODAL] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
