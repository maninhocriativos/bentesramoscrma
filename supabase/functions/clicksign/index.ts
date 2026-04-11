import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLICKSIGN_API_KEY = Deno.env.get("CLICKSIGN_API_KEY");
const CLICKSIGN_BASE_URL = "https://app.clicksign.com/api/v1";

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, baseDelay = 1000): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error: any) {
      lastError = error;
      const isRetryable =
        error.message?.includes("http2 error") ||
        error.message?.includes("connection error") ||
        error.message?.includes("SendRequest") ||
        error.message?.includes("ECONNRESET");
      if (!isRetryable || attempt === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!CLICKSIGN_API_KEY) throw new Error("CLICKSIGN_API_KEY not configured");

    const body = await req.json();
    console.log("Clicksign action:", body.action);

    let result;

    switch (body.action) {
      case "create_document": {
        if (!body.file_content || !body.file_name) throw new Error("file_content and file_name are required");
        const response = await fetchWithRetry(`${CLICKSIGN_BASE_URL}/documents?access_token=${CLICKSIGN_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: {
              path: `/${body.file_name}`,
              content_base64: `data:application/pdf;base64,${body.file_content}`,
            },
          }),
        });
        if (!response.ok) throw new Error(`Failed to create document: ${await response.text()}`);
        result = await response.json();
        break;
      }

      case "add_signer": {
        if (!body.signer) throw new Error("signer data is required");
        const response = await fetchWithRetry(`${CLICKSIGN_BASE_URL}/signers?access_token=${CLICKSIGN_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signer: {
              email: body.signer.email,
              name: body.signer.name,
              phone_number: body.signer.phone,
              documentation: body.signer.documentation,
              birthday: body.signer.birthday,
              auths: [body.signer.auth_type || "email"],
            },
          }),
        });
        if (!response.ok) throw new Error(`Failed to add signer: ${await response.text()}`);
        result = await response.json();
        break;
      }

      case "create_list": {
        if (!body.document_key || !body.signer_key) throw new Error("document_key and signer_key are required");
        const response = await fetchWithRetry(`${CLICKSIGN_BASE_URL}/lists?access_token=${CLICKSIGN_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            list: {
              document_key: body.document_key,
              signer_key: body.signer_key,
              sign_as: "sign",
              message: body.message || "Por favor, assine o documento.",
            },
          }),
        });
        if (!response.ok) throw new Error(`Failed to create signature list: ${await response.text()}`);
        result = await response.json();
        break;
      }

      case "get_document": {
        if (!body.document_key) throw new Error("document_key is required");
        const response = await fetchWithRetry(
          `${CLICKSIGN_BASE_URL}/documents/${body.document_key}?access_token=${CLICKSIGN_API_KEY}`,
          { method: "GET" },
        );
        if (!response.ok) throw new Error(`Failed to get document: ${await response.text()}`);
        result = await response.json();
        break;
      }

      case "list_documents": {
        console.log("Listing all documents...");
        let allDocuments: any[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const response = await fetchWithRetry(
            `${CLICKSIGN_BASE_URL}/documents?access_token=${CLICKSIGN_API_KEY}&page=${page}`,
            { method: "GET" },
          );
          if (!response.ok) throw new Error(`Failed to list documents: ${await response.text()}`);
          const data = await response.json();
          const documents = data.documents || [];
          console.log(`Page ${page}: ${documents.length} documents`);
          allDocuments = [...allDocuments, ...documents];
          if (documents.length < 20) hasMore = false;
          else page++;
          if (page > 10) hasMore = false;
        }

        // ── Buscar request_signature_key para cada documento ──────────────
        // Isso resolve o problema do link 404: buscamos as listas de assinatura
        // de cada documento para pegar o link correto /sign/{request_signature_key}
        const documentsWithLinks = await Promise.all(
          allDocuments.map(async (doc: any) => {
            try {
              const listsRes = await fetchWithRetry(
                `${CLICKSIGN_BASE_URL}/documents/${doc.key}/lists?access_token=${CLICKSIGN_API_KEY}`,
                { method: "GET" },
              );
              if (listsRes.ok) {
                const listsData = await listsRes.json();
                const lists = listsData.lists || [];
                // Pegar o primeiro request_signature_key disponível
                const firstList = lists.find((l: any) => l.request_signature_key);
                if (firstList?.request_signature_key) {
                  doc.request_signature_key = firstList.request_signature_key;
                  doc.sign_url = `https://app.clicksign.com/sign/${firstList.request_signature_key}`;
                }
              }
            } catch {
              // Ignora erro individual — não bloqueia a listagem
            }
            return doc;
          }),
        );

        console.log(`Total documents: ${documentsWithLinks.length}`);
        result = { documents: documentsWithLinks };
        break;
      }

      case "cancel_document": {
        if (!body.document_key) throw new Error("document_key is required");
        const response = await fetchWithRetry(
          `${CLICKSIGN_BASE_URL}/documents/${body.document_key}/cancel?access_token=${CLICKSIGN_API_KEY}`,
          { method: "PATCH" },
        );
        if (!response.ok) throw new Error(`Failed to cancel document: ${await response.text()}`);
        result = await response.json();
        break;
      }

      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in clicksign function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
