import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLICKSIGN_API_KEY = Deno.env.get("CLICKSIGN_API_KEY");
const CLICKSIGN_BASE_URL = "https://app.clicksign.com/api/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
      await new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
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

        // 1. Buscar documentos do Clicksign
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

        // 2. Buscar links corretos do banco (contract_reminders)
        // Muito mais eficiente que chamar a API do Clicksign 142 vezes
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const docKeys = allDocuments.map((d: any) => d.key).filter(Boolean);

        const linksByKey = new Map<string, string>();
        if (docKeys.length > 0) {
          const { data: reminders } = await supabase
            .from("contract_reminders")
            .select("document_key, contract_link")
            .in("document_key", docKeys)
            .like("contract_link", "%/sign/%"); // só links /sign/ válidos

          for (const r of reminders || []) {
            if (r.document_key && r.contract_link && !linksByKey.has(r.document_key)) {
              linksByKey.set(r.document_key, r.contract_link);
            }
          }
        }

        // 3. Para documentos sem link no banco, buscar na API do Clicksign
        // (só os que não têm — evita 142 chamadas desnecessárias)
        const docsWithoutLink = allDocuments.filter((d: any) => d.key && !linksByKey.has(d.key));
        console.log(`Docs sem link no banco: ${docsWithoutLink.length}`);

        // Buscar em lotes de 5 para não sobrecarregar a API
        for (let i = 0; i < docsWithoutLink.length; i += 5) {
          const batch = docsWithoutLink.slice(i, i + 5);
          await Promise.all(
            batch.map(async (doc: any) => {
              try {
                const listsRes = await fetchWithRetry(
                  `${CLICKSIGN_BASE_URL}/documents/${doc.key}/lists?access_token=${CLICKSIGN_API_KEY}`,
                  { method: "GET" },
                );
                if (listsRes.ok) {
                  const listsData = await listsRes.json();
                  const lists = listsData.lists || [];
                  const firstList = lists.find((l: any) => l.request_signature_key);
                  if (firstList?.request_signature_key) {
                    const signLink = `https://app.clicksign.com/sign/${firstList.request_signature_key}`;
                    linksByKey.set(doc.key, signLink);
                    // Salvar no banco para próximas vezes
                    await supabase
                      .from("contract_reminders")
                      .update({ contract_link: signLink })
                      .eq("document_key", doc.key);
                  }
                }
              } catch {
                // Ignora erro individual
              }
            }),
          );
        }

        // 4. Injetar sign_url em cada documento
        const documentsWithLinks = allDocuments.map((doc: any) => {
          const signLink = linksByKey.get(doc.key);
          if (signLink) {
            doc.sign_url = signLink;
          }
          return doc;
        });

        // 5. ENRIQUECER com os signatários de cada documento (igual ao ZapSign).
        // A listagem v1 não traz signatário → buscamos o detalhe de cada doc, que
        // traz signers (email/nome/CPF) e o status de assinatura. Em lotes, com
        // fallback seguro (se falhar, mantém o doc como está — sem regressão).
        const ENRICH_BATCH = 8;
        for (let i = 0; i < documentsWithLinks.length; i += ENRICH_BATCH) {
          const batch = documentsWithLinks.slice(i, i + ENRICH_BATCH);
          await Promise.all(batch.map(async (doc: any) => {
            if (!doc.key) return;
            try {
              const detRes = await fetchWithRetry(
                `${CLICKSIGN_BASE_URL}/documents/${doc.key}?access_token=${CLICKSIGN_API_KEY}`,
                { method: "GET" },
              );
              if (!detRes.ok) return;
              const detData = await detRes.json();
              const det = detData.document || detData;
              const rawSigners = det.signers || det.list?.signers || [];
              if (Array.isArray(rawSigners) && rawSigners.length) {
                doc.signers = rawSigners.map((s: any) => {
                  const sg = s.signer || s;
                  return {
                    name: sg.name || s.name || "",
                    email: sg.email || s.email || "",
                    phone_number: sg.phone_number || sg.phone || s.phone_number || "",
                    documentation: sg.documentation || s.documentation || "",
                    signed_at: s.signed_at || s.signature?.signed_at || s.signed || sg.signed_at || null,
                  };
                });
              }
              if (det.status && !doc.status) doc.status = det.status;
            } catch {
              // mantém o doc sem signatário (sem regressão)
            }
          }));
        }

        console.log(`Total documents: ${documentsWithLinks.length}, com link: ${linksByKey.size}`);
        result = { documents: documentsWithLinks };
        break;
      }

      case "cancel_document": {
        if (!body.document_key) throw new Error("document_key is required");
        const response = await fetchWithRetry(
          `${CLICKSIGN_BASE_URL}/documents/${body.document_key}/cancel?access_token=${CLICKSIGN_API_KEY}`,
          { method: "PATCH" },
        );
        // Clicksign retorna 200 ou 422 se já cancelado
        const cancelText = await response.text();
        console.log(`Cancel response ${response.status}: ${cancelText}`);
        if (!response.ok && response.status !== 422) {
          throw new Error(`Failed to cancel document: ${cancelText}`);
        }
        result = { success: true, status: response.status };
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
