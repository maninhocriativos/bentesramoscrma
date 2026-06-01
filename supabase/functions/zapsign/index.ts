import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    // Obter token dos secrets
    const token = Deno.env.get('ZAPSIGN_API_TOKEN');
    if (!token) {
      throw new Error('ZAPSIGN_API_TOKEN não configurado nos secrets');
    }

    const apiUrl = 'https://api.zapsign.com.br';

    let result;

    switch (action) {
      case 'list_documents':
        result = await listDocuments(apiUrl, token, params);
        break;

      case 'get_document':
        result = await getDocument(apiUrl, token, params);
        break;

      case 'create_document':
        result = await createDocument(apiUrl, token, params);
        break;

      case 'send_document':
        result = await sendDocument(apiUrl, token, params);
        break;

      case 'cancel_document':
        result = await cancelDocument(apiUrl, token, params);
        break;

      case 'get_sign_url':
        result = await getSignUrl(apiUrl, token, params);
        break;

      case 'validate_signature':
        result = await validateSignature(apiUrl, token, params);
        break;

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        error: { code: 'ZAPSIGN_ERROR', message },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

// Implementações das ações

async function listDocuments(apiUrl: string, token: string, params: any) {
  const { page = 1, per_page = 20 } = params;

  const response = await fetch(`${apiUrl}/docs/?page=${page}&per_page=${per_page}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Zapsign API: ${error.message || 'Erro ao listar documentos'}`);
  }

  return response.json();
}

async function getDocument(apiUrl: string, token: string, params: any) {
  const { document_id } = params;
  if (!document_id) throw new Error('document_id é obrigatório');

  const response = await fetch(`${apiUrl}/docs/${document_id}/`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Zapsign API: ${error.message || 'Erro ao obter documento'}`);
  }

  return response.json();
}

async function createDocument(apiUrl: string, token: string, params: any) {
  const { name, signers, file_url, template_id, expires_in_days, metadata } =
    params;

  if (!name || !signers?.length) {
    throw new Error('name e signers são obrigatórios');
  }

  const body: any = {
    name,
    signers,
    expires_in_days: expires_in_days || 7,
  };

  if (file_url) body.file_url = file_url;
  if (template_id) body.template_id = template_id;
  if (metadata) body.metadata = metadata;

  const response = await fetch(`${apiUrl}/docs/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Zapsign API: ${error.message || 'Erro ao criar documento'}`
    );
  }

  return response.json();
}

async function sendDocument(apiUrl: string, token: string, params: any) {
  const { document_id } = params;
  if (!document_id) throw new Error('document_id é obrigatório');

  const response = await fetch(`${apiUrl}/docs/${document_id}/send/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Zapsign API: ${error.message || 'Erro ao enviar documento'}`);
  }

  return { success: true };
}

async function cancelDocument(apiUrl: string, token: string, params: any) {
  const { document_id } = params;
  if (!document_id) throw new Error('document_id é obrigatório');

  const response = await fetch(`${apiUrl}/docs/${document_id}/cancel/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Zapsign API: ${error.message || 'Erro ao cancelar documento'}`
    );
  }

  return { success: true };
}

async function getSignUrl(apiUrl: string, token: string, params: any) {
  const { document_id, signer_id } = params;
  if (!document_id || !signer_id) {
    throw new Error('document_id e signer_id são obrigatórios');
  }

  const response = await fetch(
    `${apiUrl}/docs/${document_id}/signers/${signer_id}/sign_url/`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Zapsign API: ${error.message || 'Erro ao obter URL de assinatura'}`);
  }

  return response.json();
}

async function validateSignature(apiUrl: string, token: string, params: any) {
  const { document_id, signer_id, cpf } = params;
  if (!document_id || !signer_id || !cpf) {
    throw new Error('document_id, signer_id e cpf são obrigatórios');
  }

  const response = await fetch(
    `${apiUrl}/docs/${document_id}/signers/${signer_id}/validate/`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cpf }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Zapsign API: ${error.message || 'Erro ao validar assinatura'}`
    );
  }

  return response.json();
}
