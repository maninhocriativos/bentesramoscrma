import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OfficeSettings {
  office_name: string | null;
  logo_url: string | null;
  lawyer_name: string | null;
  oab_main: string | null;
  oab_secondary: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  address_main: string | null;
  address_secondary: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

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

    // Buscar configurações do escritório
    const { data: officeData } = await supabase
      .from("office_settings")
      .select("*")
      .limit(1)
      .single();

    const office: OfficeSettings = officeData || {};

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

    // Montar HTML completo com estilos do modelo Bentes Ramos
    const fullHtml = buildPdfHtml(docData.html_content, office);

    // Iniciar Puppeteer
    console.log("[petition-pdf] Iniciando Puppeteer...");
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });

    // Gerar PDF com header/footer customizado
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: {
        top: "20mm",
        bottom: "35mm",
        left: "25mm",
        right: "20mm",
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: buildHeaderTemplate(office),
      footerTemplate: buildFooterTemplate(office),
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

function buildHeaderTemplate(office: OfficeSettings): string {
  const officeName = office.office_name || "BENTES & RAMOS ADVOCACIA";
  const oabMain = office.oab_main || "";
  const oabSecondary = office.oab_secondary || "";
  const logoUrl = office.logo_url || "";

  return `
    <div style="width: 100%; font-family: Arial, sans-serif; position: relative; height: 80px; padding: 0 20mm;">
      <!-- Faixa decorativa superior -->
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #8B5CF6, #A78BFA, #C4B5FD);"></div>
      
      <!-- Logo à direita -->
      ${logoUrl ? `
        <div style="position: absolute; top: 10px; right: 20mm;">
          <img src="${logoUrl}" style="height: 50px; object-fit: contain;" />
        </div>
      ` : `
        <div style="position: absolute; top: 15px; right: 20mm; text-align: right;">
          <div style="font-size: 14px; font-weight: bold; color: #4C1D95; letter-spacing: 1px;">${officeName}</div>
          <div style="font-size: 8px; color: #6B7280; margin-top: 2px;">${oabMain}${oabSecondary ? ` | ${oabSecondary}` : ''}</div>
        </div>
      `}
    </div>
  `;
}

function buildFooterTemplate(office: OfficeSettings): string {
  const oabMain = office.oab_main || "";
  const oabSecondary = office.oab_secondary || "";
  const instagram = office.instagram || "";
  const email = office.email || "";
  const addressMain = office.address_main || "";
  const addressSecondary = office.address_secondary || "";
  const city = office.city || "Manaus";
  const state = office.state || "AM";
  const zipCode = office.zip_code || "";

  return `
    <div style="width: 100%; font-family: Arial, sans-serif; position: relative;">
      <!-- Faixa decorativa inferior -->
      <div style="position: absolute; bottom: 25px; left: 0; right: 0; height: 25px; background: linear-gradient(90deg, #8B5CF6, #A78BFA, #C4B5FD);"></div>
      
      <!-- Conteúdo do rodapé -->
      <div style="position: absolute; bottom: 28px; left: 20mm; right: 20mm; display: flex; justify-content: space-between; color: #fff; font-size: 7px; line-height: 1.4;">
        <div style="flex: 1;">
          <div style="font-weight: bold; font-size: 8px;">${oabMain}${oabSecondary ? ` | ${oabSecondary}` : ''}</div>
          <div style="margin-top: 2px;">${addressMain}</div>
          <div>${city.toUpperCase()} - ${state.toUpperCase()}${zipCode ? ` | CEP ${zipCode}` : ''}</div>
        </div>
        <div style="flex: 1; text-align: right;">
          <div>${instagram ? `@${instagram.replace('@', '')}` : ''} ${email ? `| ${email}` : ''}</div>
          ${addressSecondary ? `<div style="margin-top: 2px;">${addressSecondary}</div>` : ''}
        </div>
      </div>
      
      <!-- Numeração de página -->
      <div style="position: absolute; bottom: 8px; width: 100%; text-align: center; font-size: 8px; color: #6B7280;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    </div>
  `;
}

function buildPdfHtml(htmlContent: string, office: OfficeSettings): string {
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
      margin: 20mm 20mm 35mm 25mm;
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
    
    /* Título da ação - Estilo destaque com fundo */
    .titulo-acao {
      background: linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%);
      border: 2px solid #A78BFA;
      border-radius: 8px;
      padding: 16pt 24pt;
      margin: 24pt 0;
      text-align: center;
    }
    
    .titulo-acao h1 {
      font-size: 13pt;
      font-weight: bold;
      margin: 0;
      text-transform: uppercase;
      color: #4C1D95;
      letter-spacing: 0.5pt;
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
      color: #4C1D95;
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
    
    p:first-of-type,
    h2 + p,
    h3 + p {
      text-indent: 50pt;
    }
    
    ul, ol {
      margin: 12pt 0;
      padding-left: 40pt;
    }
    
    li {
      margin-bottom: 6pt;
    }
    
    strong, b {
      font-weight: bold;
    }
    
    /* Qualificação do cliente */
    .qualificacao {
      margin: 18pt 0;
      text-indent: 50pt;
    }
    
    .qualificacao strong {
      text-transform: uppercase;
    }
    
    /* Endereçamento */
    .enderecamento {
      text-align: center;
      font-weight: bold;
      font-size: 12pt;
      margin: 24pt 0;
      text-transform: uppercase;
    }
    
    /* Assinatura */
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
      text-transform: uppercase;
    }
    
    .signature-oab {
      font-size: 10pt;
      color: #333;
    }
    
    .date-location {
      text-align: right;
      margin-top: 24pt;
      font-style: italic;
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
      background-color: #EDE9FE;
      font-weight: bold;
      color: #4C1D95;
    }
    
    blockquote {
      margin: 12pt 40pt;
      padding: 12pt;
      background: #F9FAFB;
      border-left: 4px solid #A78BFA;
      font-style: italic;
    }
    
    .center {
      text-align: center;
    }
    
    /* Destaque para valores */
    .valor-destaque {
      font-weight: bold;
      color: #4C1D95;
    }
    
    /* Lista de documentos */
    .lista-documentos {
      background: #F9FAFB;
      padding: 12pt;
      border-radius: 4pt;
      margin: 12pt 0;
    }
    
    .lista-documentos li {
      margin-bottom: 4pt;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
`;
}
