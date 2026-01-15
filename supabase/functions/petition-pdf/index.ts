import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { petitionId, documentId } = await req.json();

    if (!petitionId) {
      return new Response(
        JSON.stringify({ error: "petitionId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[petition-pdf] Gerando PDF para petição: ${petitionId}`);

    // Buscar o documento mais recente ou específico
    let query = supabase
      .from("petition_documents")
      .select("*")
      .eq("petition_id", petitionId);

    if (documentId) {
      query = query.eq("id", documentId);
    } else {
      query = query.order("version", { ascending: false }).limit(1);
    }

    const { data: docData, error: docError } = await query.single();

    if (docError || !docData) {
      console.error("[petition-pdf] Documento não encontrado:", docError);
      return new Response(
        JSON.stringify({ error: "Documento não encontrado. Gere o rascunho primeiro." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!docData.html_content) {
      return new Response(
        JSON.stringify({ error: "Documento não possui conteúdo HTML" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[petition-pdf] Processando documento v${docData.version}`);

    // Montar HTML completo com estilos
    const fullHtml = buildPdfHtml(docData.html_content);

    // Iniciar Puppeteer
    console.log("[petition-pdf] Iniciando Puppeteer...");
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });

    // Gerar PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: {
        top: "25mm",
        bottom: "25mm",
        left: "25mm",
        right: "20mm",
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 8px; width: 100%; text-align: center; color: #666;">
          <span class="title"></span>
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 8px; width: 100%; text-align: center; color: #666; padding: 0 20mm;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `,
    });

    await browser.close();
    console.log(`[petition-pdf] PDF gerado com ${pdfBuffer.length} bytes`);

    // Upload do PDF para Storage
    const fileName = `petition-${petitionId}-v${docData.version}.pdf`;
    const filePath = `petitions/${petitionId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[petition-pdf] Erro no upload:", uploadError);
      throw uploadError;
    }

    // Gerar URL pública
    const { data: urlData } = supabase.storage
      .from("documentos")
      .getPublicUrl(filePath);

    const pdfUrl = urlData.publicUrl;
    console.log(`[petition-pdf] PDF salvo em: ${pdfUrl}`);

    // Atualizar documento com URL do PDF
    const { error: updateError } = await supabase
      .from("petition_documents")
      .update({ pdf_url: pdfUrl })
      .eq("id", docData.id);

    if (updateError) {
      console.error("[petition-pdf] Erro ao atualizar documento:", updateError);
    }

    // Registrar no audit log
    await supabase.from("petition_audit_log").insert({
      petition_id: petitionId,
      action: "pdf_generated",
      actor: "system",
      meta: {
        document_id: docData.id,
        version: docData.version,
        file_path: filePath,
      },
    });

    // Atualizar status da petição
    await supabase
      .from("petitions")
      .update({ status: "gerado" })
      .eq("id", petitionId);

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl,
        documentId: docData.id,
        version: docData.version,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[petition-pdf] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao gerar PDF", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildPdfHtml(htmlContent: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Petição</title>
  <style>
    @page {
      size: A4;
      margin: 25mm 20mm 25mm 25mm;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.8;
      color: #000;
      margin: 0;
      padding: 0;
      text-align: justify;
    }
    
    h1 {
      font-size: 14pt;
      text-align: center;
      font-weight: bold;
      margin: 24pt 0 12pt 0;
      text-transform: uppercase;
    }
    
    h2 {
      font-size: 12pt;
      font-weight: bold;
      margin: 18pt 0 12pt 0;
      text-transform: uppercase;
    }
    
    h3 {
      font-size: 12pt;
      font-weight: bold;
      margin: 14pt 0 10pt 0;
    }
    
    p {
      margin: 0 0 12pt 0;
      text-indent: 50pt;
    }
    
    p:first-of-type {
      text-indent: 0;
    }
    
    ul, ol {
      margin: 12pt 0;
      padding-left: 40pt;
    }
    
    li {
      margin-bottom: 6pt;
    }
    
    strong {
      font-weight: bold;
    }
    
    .header {
      text-align: center;
      margin-bottom: 24pt;
      border-bottom: 1px solid #333;
      padding-bottom: 12pt;
    }
    
    .header img {
      max-width: 150px;
      height: auto;
      margin-bottom: 8pt;
    }
    
    .header-office {
      font-size: 14pt;
      font-weight: bold;
      margin: 8pt 0 4pt 0;
    }
    
    .header-info {
      font-size: 9pt;
      color: #333;
    }
    
    .signature {
      margin-top: 48pt;
      text-align: center;
    }
    
    .signature-line {
      width: 300px;
      border-top: 1px solid #000;
      margin: 24pt auto 8pt auto;
      padding-top: 8pt;
    }
    
    .signature-name {
      font-weight: bold;
    }
    
    .signature-oab {
      font-size: 10pt;
    }
    
    .date-location {
      text-align: right;
      margin-top: 24pt;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0;
    }
    
    th, td {
      border: 1px solid #333;
      padding: 8pt;
      text-align: left;
    }
    
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    
    blockquote {
      margin: 12pt 40pt;
      padding-left: 12pt;
      border-left: 3px solid #333;
      font-style: italic;
    }
    
    .center {
      text-align: center;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
`;
}
