const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── JWT para Google Service Account (RS256) ───────────────────────────────
async function signJWT(privateKeyPem: string, payload: Record<string, unknown>): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const signingInput = `${b64url(header)}.${b64url(payload)}`;

  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBuffer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );

  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${signingInput}.${sigB64}`;
}

async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJWT(privateKey, {
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`OAuth falhou: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ─── Upload multipart para Google Drive ───────────────────────────────────
async function uploadToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: string,
  mimeType = 'text/csv; charset=utf-8',
): Promise<string> {
  const boundary = '----FormBoundary7MA4YWxkTrZu0gW';
  const metaJson = JSON.stringify({ name: fileName, parents: [folderId] });

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metaJson}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  const result = await res.json();
  if (!res.ok) throw new Error(`Drive upload error: ${JSON.stringify(result)}`);
  return result.id as string;
}

// ─── Escapar campo CSV ─────────────────────────────────────────────────────
function csvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val).replace(/"/g, '""');
  return `"${s}"`;
}

// ─── Main ──────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const serviceEmail  = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey    = Deno.env.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    const folderId      = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID');

    if (!serviceEmail || !privateKey || !folderId) {
      return new Response(
        JSON.stringify({ error: 'Variáveis GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY e GOOGLE_DRIVE_FOLDER_ID são obrigatórias' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Janela: 24h atrás
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const hoje  = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const { data: mensagens, error } = await supabase
      .from('manychat_mensagens')
      .select('id, created_at, lead_id, subscriber_id, subscriber_nome, conteudo, direcao, tipo, canal')
      .gte('created_at', desde)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const total = mensagens?.length ?? 0;
    console.log(`[Backup] ${total} mensagens encontradas desde ${desde}`);

    // Montar CSV
    const cols = ['id', 'created_at', 'lead_id', 'subscriber_id', 'subscriber_nome', 'conteudo', 'direcao', 'tipo', 'canal'];
    const rows = [cols.join(',')];

    for (const msg of mensagens ?? []) {
      rows.push(cols.map(c => csvCell((msg as Record<string, unknown>)[c])).join(','));
    }

    const csv = rows.join('\r\n');

    // Upload para Drive
    const accessToken = await getAccessToken(serviceEmail, privateKey);
    const fileName    = `mensagens_${hoje}.csv`;
    const fileId      = await uploadToDrive(accessToken, folderId, fileName, csv);

    console.log(`[Backup] ✅ Arquivo criado: ${fileName} (id=${fileId})`);

    return new Response(
      JSON.stringify({ success: true, fileId, fileName, total }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Backup] ❌', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
