import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Conversão genérica .docx → PDF via CloudConvert, com fidelidade total ao
// layout (cabeçalho/rodapé/logo/fontes). Usada pelo gerador de petições para
// exibir/baixar o documento exatamente como ficará impresso.
// Recebe { base64_docx } e devolve { base64_pdf }.

async function convertDocxToPdf(base64Docx: string): Promise<string> {
  const ccToken = Deno.env.get('CLOUDCONVERT_API_KEY');
  if (!ccToken) {
    throw new Error('CLOUDCONVERT_API_KEY não configurado');
  }

  const ccHeaders = {
    'Authorization': `Bearer ${ccToken}`,
    'Content-Type': 'application/json',
  };

  // 1) Cria job: import(base64) → convert(pdf) → export(url)
  const jobResp = await fetch('https://api.cloudconvert.com/v2/jobs', {
    method: 'POST',
    headers: ccHeaders,
    body: JSON.stringify({
      tasks: {
        'import-doc': { operation: 'import/base64', file: base64Docx, filename: 'documento.docx' },
        'convert-doc': { operation: 'convert', input: 'import-doc', input_format: 'docx', output_format: 'pdf' },
        'export-doc': { operation: 'export/url', input: 'convert-doc' },
      },
    }),
  });
  const jobData = await jobResp.json();
  if (!jobResp.ok) {
    throw new Error(`CloudConvert job: ${JSON.stringify(jobData).slice(0, 300)}`);
  }
  const jobId = jobData?.data?.id;
  if (!jobId) throw new Error('CloudConvert: job sem id');

  // 2) Aguarda concluir (endpoint síncrono /wait)
  const waitResp = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}/wait`, {
    headers: ccHeaders,
    signal: AbortSignal.timeout(90000),
  });
  const waitData = await waitResp.json();
  if (!waitResp.ok || waitData?.data?.status !== 'finished') {
    throw new Error(`CloudConvert wait: ${JSON.stringify(waitData).slice(0, 300)}`);
  }

  // 3) URL do PDF exportado
  const exportTask = (waitData.data.tasks || []).find(
    (t: any) => t.operation === 'export/url' && t.status === 'finished',
  );
  const fileUrl = exportTask?.result?.files?.[0]?.url;
  if (!fileUrl) throw new Error('CloudConvert: PDF não disponível no export');

  // 4) Baixa o PDF e converte para base64
  const pdfResp = await fetch(fileUrl, { signal: AbortSignal.timeout(60000) });
  const pdfBuffer = new Uint8Array(await pdfResp.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < pdfBuffer.length; i += chunk) {
    binary += String.fromCharCode(...pdfBuffer.subarray(i, i + chunk));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { base64_docx } = await req.json();
    if (!base64_docx) {
      throw new Error('base64_docx é obrigatório');
    }

    const base64_pdf = await convertDocxToPdf(base64_docx);

    return new Response(JSON.stringify({ base64_pdf }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[docx-to-pdf]', message);
    return new Response(JSON.stringify({ error: { message } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
