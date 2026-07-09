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

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 4, baseDelay = 800): Promise<Response> {
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Retry em rate limit (429) e erros transitórios de servidor (5xx),
      // respeitando o Retry-After do ClickSign quando presente. Sem isso, um
      // 429 momentâneo derruba a listagem inteira e "some" com os contratos.
      if (res.status === 429 || res.status >= 500) {
        lastResponse = res;
        if (attempt < maxRetries - 1) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const wait = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : baseDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 8000)));
          continue;
        }
      }
      return res;
    } catch (error: any) {
      lastError = error;
      const isRetryable =
        error.message?.includes("http2 error") ||
        error.message?.includes("connection error") ||
        error.message?.includes("SendRequest") ||
        error.message?.includes("ECONNRESET");
      if (!isRetryable || attempt === maxRetries - 1) {
        if (lastResponse) return lastResponse;
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError ?? new Error("fetchWithRetry: retries esgotadas");
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
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // 1. Buscar documentos do Clicksign
        let allDocuments: any[] = [];
        let page = 1;
        let hasMore = true;
        let listFailed = false;
        while (hasMore) {
          const response = await fetchWithRetry(
            `${CLICKSIGN_BASE_URL}/documents?access_token=${CLICKSIGN_API_KEY}&page=${page}`,
            { method: "GET" },
          );
          if (!response.ok) {
            // Não derruba a página: para de paginar e cai no fallback do banco.
            console.error(`Falha ao listar documentos (page ${page}, HTTP ${response.status}): ${await response.text()}`);
            listFailed = true;
            break;
          }
          const data = await response.json();
          const documents = data.documents || [];
          console.log(`Page ${page}: ${documents.length} documents`);
          allDocuments = [...allDocuments, ...documents];
          if (documents.length < 20) hasMore = false;
          else page++;
          if (page > 10) hasMore = false;
        }

        // FALLBACK: ClickSign indisponível/limitado (429/5xx) e nada veio da API →
        // devolve os contratos já conhecidos do banco (contract_reminders) para a
        // lista NUNCA sumir. Sem chamadas extras à API.
        if (allDocuments.length === 0 && listFailed) {
          const { data: rems } = await supabase
            .from("contract_reminders")
            .select("document_key, document_name, contract_link, signer_name, signer_email, status, created_at, updated_at")
            .order("created_at", { ascending: false })
            .limit(500);
          const fallbackDocs = (rems || [])
            .filter((r: any) => r.document_key)
            .map((r: any) => ({
              key: r.document_key,
              filename: r.document_name || "Contrato",
              status: r.status === "signed" ? "closed" : (r.status === "cancelled" || r.status === "canceled") ? "canceled" : "running",
              sign_url: r.contract_link && r.contract_link.includes("/sign/") ? r.contract_link : undefined,
              signers: r.signer_name ? [{ name: r.signer_name, email: r.signer_email || "", signed_at: r.status === "signed" ? (r.updated_at || null) : null }] : [],
              created_at: r.created_at,
              updated_at: r.updated_at || r.created_at,
            }));
          console.warn(`ClickSign indisponível — devolvendo ${fallbackDocs.length} contratos do banco (modo degradado).`);
          return new Response(JSON.stringify({ documents: fallbackDocs, degraded: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        // 2. Buscar links corretos do banco (contract_reminders)
        // Muito mais eficiente que chamar a API do Clicksign 142 vezes
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

        // Buscar em lotes de 5 para não sobrecarregar a API. Disjuntor: ao primeiro
        // 429 paramos de resolver links novos (o resto continua com o que já tem no
        // banco) para não estourar o rate limit e derrubar a listagem.
        let listsThrottled = false;
        for (let i = 0; i < docsWithoutLink.length && !listsThrottled; i += 5) {
          const batch = docsWithoutLink.slice(i, i + 5);
          await Promise.all(
            batch.map(async (doc: any) => {
              if (listsThrottled) return;
              try {
                const listsRes = await fetchWithRetry(
                  `${CLICKSIGN_BASE_URL}/documents/${doc.key}/lists?access_token=${CLICKSIGN_API_KEY}`,
                  { method: "GET" },
                );
                if (listsRes.status === 429) { listsThrottled = true; return; }
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
          if (!listsThrottled && i + 5 < docsWithoutLink.length) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
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
        // Enriquecemos só os documentos MAIS RECENTES (teto) e paramos ao primeiro
        // sinal de rate limit (disjuntor). Enriquecer todos, sempre, era o que
        // estourava o limite do ClickSign e derrubava a listagem. Sem enriquecer,
        // o contrato ainda aparece (só sem o detalhe de signatários) — bem melhor
        // que sumir a lista inteira.
        const ENRICH_BATCH = 5;
        const ENRICH_LIMIT = 60;
        const toEnrich = [...documentsWithLinks]
          .sort((a: any, b: any) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
          .slice(0, ENRICH_LIMIT);
        let apiThrottled = false;
        for (let i = 0; i < toEnrich.length && !apiThrottled; i += ENRICH_BATCH) {
          const batch = toEnrich.slice(i, i + ENRICH_BATCH);
          await Promise.all(batch.map(async (doc: any) => {
            if (!doc.key || apiThrottled) return;
            try {
              const detRes = await fetchWithRetry(
                `${CLICKSIGN_BASE_URL}/documents/${doc.key}?access_token=${CLICKSIGN_API_KEY}`,
                { method: "GET" },
              );
              if (detRes.status === 429) { apiThrottled = true; return; }
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
          // Respira entre lotes para não estourar o rate limit do ClickSign.
          if (!apiThrottled && i + ENRICH_BATCH < toEnrich.length) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
        if (apiThrottled) console.warn("Clicksign rate limit atingido — enriquecimento interrompido; lista devolvida assim mesmo.");

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
