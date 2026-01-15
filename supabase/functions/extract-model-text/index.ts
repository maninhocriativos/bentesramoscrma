import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { modelId } = await req.json();

    if (!modelId) {
      return new Response(
        JSON.stringify({ error: "modelId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar modelo
    const { data: model, error: modelError } = await supabase
      .from("petition_models")
      .select("*")
      .eq("id", modelId)
      .single();

    if (modelError || !model) {
      return new Response(
        JSON.stringify({ error: "Modelo não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Baixar arquivo
    const fileUrl = model.file_url;
    const fileType = model.file_type;

    let extractedText = "";
    let extractedSections: Record<string, string> = {};

    // Para DOCX, podemos tentar extrair texto simples
    // Para PDF, precisamos de um serviço externo ou biblioteca
    // Por ora, vamos simular uma extração básica

    try {
      const response = await fetch(fileUrl);
      const buffer = await response.arrayBuffer();

      if (fileType === "docx") {
        // Extração básica de DOCX (XML dentro do ZIP)
        // Em produção, usar uma biblioteca como mammoth ou docx
        const text = await extractDocxText(new Uint8Array(buffer));
        extractedText = text;
      } else if (fileType === "pdf") {
        // Para PDF, precisamos de pdf-parse ou similar
        // Por ora, marcamos como pendente
        extractedText = "[PDF - Extração pendente. Faça upload de DOCX para extração automática.]";
      }

      // Tentar identificar seções
      if (extractedText && extractedText.length > 100) {
        extractedSections = identifySections(extractedText);
      }

      // Detectar variáveis
      const variables = extractVariables(extractedText);

      // Atualizar modelo
      await supabase
        .from("petition_models")
        .update({
          extracted_text: extractedText,
          extracted_sections: extractedSections,
          updated_at: new Date().toISOString(),
        })
        .eq("id", modelId);

      // Criar chunks para RAG
      await createChunks(supabase, modelId, model.petition_type_slug, extractedSections, extractedText);

      return new Response(
        JSON.stringify({
          success: true,
          extractedLength: extractedText.length,
          sectionsFound: Object.keys(extractedSections).length,
          variablesFound: variables.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (extractError) {
      console.error("Erro na extração:", extractError);
      
      await supabase
        .from("petition_models")
        .update({
          extracted_text: "[Erro na extração - tente novamente ou faça upload de outro arquivo]",
          updated_at: new Date().toISOString(),
        })
        .eq("id", modelId);

      return new Response(
        JSON.stringify({ error: "Erro ao extrair texto", details: String(extractError) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Erro geral:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Extração simplificada de DOCX (busca texto no XML)
async function extractDocxText(buffer: Uint8Array): Promise<string> {
  // DOCX é um ZIP contendo XML
  // Precisamos descompactar e ler word/document.xml
  // Esta é uma implementação simplificada

  try {
    // Converter para string e buscar conteúdo entre tags <w:t>
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const content = decoder.decode(buffer);
    
    // Buscar padrões de texto em XML do Word
    const textMatches = content.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    const texts = textMatches.map(match => {
      const textMatch = match.match(/>([^<]*)</);
      return textMatch ? textMatch[1] : "";
    });

    return texts.join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return "[Não foi possível extrair texto do DOCX]";
  }
}

// Identificar seções do documento
function identifySections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lowerText = text.toLowerCase();

  // Padrões comuns em petições
  const patterns = [
    { key: "qualificacao", patterns: ["qualificação", "qualificacao", "autor,", "autora,", "requerente"] },
    { key: "fatos", patterns: ["dos fatos", "da situação fática", "histórico", "breve relato"] },
    { key: "fundamentos", patterns: ["do direito", "dos fundamentos", "fundamentação jurídica", "mérito"] },
    { key: "pedidos", patterns: ["dos pedidos", "do pedido", "requer", "pede deferimento"] },
    { key: "provas", patterns: ["das provas", "provas a produzir", "meios de prova"] },
    { key: "jurisprudencia", patterns: ["jurisprudência", "precedentes", "entendimento"] },
  ];

  for (const { key, patterns: sectionPatterns } of patterns) {
    for (const pattern of sectionPatterns) {
      const index = lowerText.indexOf(pattern);
      if (index !== -1) {
        // Extrair um trecho após o padrão encontrado
        const start = index;
        const end = Math.min(index + 2000, text.length);
        sections[key] = text.substring(start, end).trim();
        break;
      }
    }
  }

  return sections;
}

// Extrair variáveis do modelo
function extractVariables(text: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = text.match(regex) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, "").trim()))];
}

// Criar chunks para RAG
async function createChunks(
  supabase: any,
  modelId: string,
  petitionTypeSlug: string | null,
  sections: Record<string, string>,
  fullText: string
) {
  // Deletar chunks antigos
  await supabase
    .from("model_chunks")
    .delete()
    .eq("model_id", modelId);

  const chunks: Array<{
    model_id: string;
    petition_type_slug: string | null;
    chunk_type: string;
    content: string;
  }> = [];

  // Criar chunks por seção
  for (const [sectionType, content] of Object.entries(sections)) {
    if (content && content.length > 50) {
      // Dividir em chunks menores se necessário
      const chunkSize = 800;
      for (let i = 0; i < content.length; i += chunkSize) {
        chunks.push({
          model_id: modelId,
          petition_type_slug: petitionTypeSlug,
          chunk_type: sectionType,
          content: content.substring(i, i + chunkSize).trim(),
        });
      }
    }
  }

  // Se não encontrou seções, criar chunks do texto completo
  if (chunks.length === 0 && fullText.length > 50) {
    const chunkSize = 800;
    for (let i = 0; i < fullText.length; i += chunkSize) {
      chunks.push({
        model_id: modelId,
        petition_type_slug: petitionTypeSlug,
        chunk_type: "geral",
        content: fullText.substring(i, i + chunkSize).trim(),
      });
    }
  }

  // Inserir chunks
  if (chunks.length > 0) {
    await supabase.from("model_chunks").insert(chunks);
  }

  // TODO: Gerar embeddings com OpenAI e salvar no campo embedding
  // Isso requer OPENAI_API_KEY configurada
}
