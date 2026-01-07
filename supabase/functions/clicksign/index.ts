import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLICKSIGN_API_KEY = Deno.env.get("CLICKSIGN_API_KEY");
const CLICKSIGN_BASE_URL = "https://app.clicksign.com/api/v1";

interface CreateDocumentRequest {
  action: "create_document" | "add_signer" | "create_list" | "get_document" | "cancel_document" | "list_documents";
  document_key?: string;
  file_path?: string;
  file_content?: string; // base64
  file_name?: string;
  page?: number;
  signer?: {
    email: string;
    name: string;
    phone?: string;
    documentation?: string;
    birthday?: string;
    auth_type?: "email" | "sms" | "whatsapp";
  };
  signer_key?: string;
  message?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!CLICKSIGN_API_KEY) {
      throw new Error("CLICKSIGN_API_KEY not configured");
    }

    const body: CreateDocumentRequest = await req.json();
    console.log("Clicksign action:", body.action);

    let result;

    switch (body.action) {
      case "create_document": {
        if (!body.file_content || !body.file_name) {
          throw new Error("file_content and file_name are required");
        }

        const formData = new FormData();
        const blob = new Blob([Uint8Array.from(atob(body.file_content), c => c.charCodeAt(0))]);
        formData.append("document[archive][name]", body.file_name);
        formData.append("document[archive][content]", body.file_content);
        
        const response = await fetch(`${CLICKSIGN_BASE_URL}/documents?access_token=${CLICKSIGN_API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            document: {
              path: `/${body.file_name}`,
              content_base64: `data:application/pdf;base64,${body.file_content}`,
            }
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Clicksign create document error:", errorText);
          throw new Error(`Failed to create document: ${errorText}`);
        }

        result = await response.json();
        console.log("Document created:", result);
        break;
      }

      case "add_signer": {
        if (!body.signer) {
          throw new Error("signer data is required");
        }

        const response = await fetch(`${CLICKSIGN_BASE_URL}/signers?access_token=${CLICKSIGN_API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signer: {
              email: body.signer.email,
              name: body.signer.name,
              phone_number: body.signer.phone,
              documentation: body.signer.documentation,
              birthday: body.signer.birthday,
              auths: [body.signer.auth_type || "email"],
            }
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Clicksign add signer error:", errorText);
          throw new Error(`Failed to add signer: ${errorText}`);
        }

        result = await response.json();
        console.log("Signer added:", result);
        break;
      }

      case "create_list": {
        if (!body.document_key || !body.signer_key) {
          throw new Error("document_key and signer_key are required");
        }

        const response = await fetch(`${CLICKSIGN_BASE_URL}/lists?access_token=${CLICKSIGN_API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            list: {
              document_key: body.document_key,
              signer_key: body.signer_key,
              sign_as: "sign",
              message: body.message || "Por favor, assine o documento.",
            }
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Clicksign create list error:", errorText);
          throw new Error(`Failed to create signature list: ${errorText}`);
        }

        result = await response.json();
        console.log("Signature list created:", result);
        break;
      }

      case "get_document": {
        if (!body.document_key) {
          throw new Error("document_key is required");
        }

        const response = await fetch(`${CLICKSIGN_BASE_URL}/documents/${body.document_key}?access_token=${CLICKSIGN_API_KEY}`, {
          method: "GET",
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Clicksign get document error:", errorText);
          throw new Error(`Failed to get document: ${errorText}`);
        }

        result = await response.json();
        console.log("Document retrieved:", result);
        break;
      }

      case "list_documents": {
        console.log("Listing all documents...");
        
        let allDocuments: any[] = [];
        let page = 1;
        let hasMore = true;
        
        // Buscar todas as páginas
        while (hasMore) {
          const response = await fetch(`${CLICKSIGN_BASE_URL}/documents?access_token=${CLICKSIGN_API_KEY}&page=${page}`, {
            method: "GET",
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Clicksign list documents error:", errorText);
            throw new Error(`Failed to list documents: ${errorText}`);
          }

          const data = await response.json();
          const documents = data.documents || [];
          
          console.log(`Page ${page}: ${documents.length} documents`);
          allDocuments = [...allDocuments, ...documents];
          
          // Verifica se há mais páginas (se retornou menos de 20, provavelmente é a última)
          if (documents.length < 20) {
            hasMore = false;
          } else {
            page++;
            // Limitar a 10 páginas para evitar loops infinitos
            if (page > 10) hasMore = false;
          }
        }
        
        console.log(`Total documents: ${allDocuments.length}`);
        result = { documents: allDocuments };
        break;
      }

      case "cancel_document": {
        if (!body.document_key) {
          throw new Error("document_key is required");
        }

        const response = await fetch(`${CLICKSIGN_BASE_URL}/documents/${body.document_key}/cancel?access_token=${CLICKSIGN_API_KEY}`, {
          method: "PATCH",
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Clicksign cancel document error:", errorText);
          throw new Error(`Failed to cancel document: ${errorText}`);
        }

        result = await response.json();
        console.log("Document cancelled:", result);
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
