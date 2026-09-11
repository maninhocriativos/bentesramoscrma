const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

// Sincroniza "Relação de Processos 2013 à 2026.xlsx" (Drive do escritório)
// pra base da página de Dados — pedido do usuário 2026-09-11: gráficos com
// dado real dessa planilha, atualizando sozinho quando ela mudar. Cada aba
// é um ano; cabeçalhos variam de aba pra aba (13 anos de manutenção manual
// diferente), então a leitura é por nome de coluna normalizado, não por
// posição fixa.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DRIVE_FILE_ID = "1PjUJjATB3p-7vg2P5xhB6AeB53LcGi93";

async function getOfficeAccessToken(): Promise<string | null> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/google-drive`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ action: "get_office_token" }),
  });
  const data = await resp.json();
  return data?.connected ? data.access_token : null;
}

function normHeader(s: unknown): string {
  return String(s ?? "")
    .trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Mapa: nome normalizado da coluna -> campo estruturado. Cobre as variações
// reais encontradas nas 14 abas (2013-2026) — "qntd."/"quantidade"/"qntd",
// "nome " com espaço sobrando, "andamento processual" vs "andamento", etc.
const HEADER_MAP: Record<string, string> = {
  "nome": "nome_cliente",
  "reclamada/requerido": "reclamada_requerido",
  "materia": "materia",
  "qualificacao cliente": "qualificacao_cliente",
  "justica": "justica",
  "vara": "vara",
  "processo": "numero_processo",
  "andamento processual": "andamento",
  "andamento": "andamento",
  "comarca": "comarca",
  "tribunal": "tribunal",
  "contato": "contato",
  "origem": "origem",
  "mes de entrada": "mes_entrada",
  "resultado": "resultado",
};

interface LinhaProcesso {
  ano: number; linha_planilha: number;
  nome_cliente: string | null; reclamada_requerido: string | null; materia: string | null;
  qualificacao_cliente: string | null; justica: string | null; vara: string | null;
  comarca: string | null; tribunal: string | null; numero_processo: string | null;
  andamento: string | null; resultado: string | null; contato: string | null;
  origem: string | null; mes_entrada: string | null; raw_json: Record<string, unknown>;
}

function parseAba(ws: XLSX.WorkSheet, ano: number): LinhaProcesso[] {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  if (rows.length < 2) return [];

  // Acha a linha de cabeçalho real — algumas abas (ex: "2013") têm uma
  // linha de título mesclada antes do cabeçalho de verdade.
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 3); i++) {
    const norm = rows[i].map(normHeader);
    if (norm.some((h) => HEADER_MAP[h])) { headerRowIdx = i; break; }
  }
  const headers = rows[headerRowIdx].map(normHeader);
  const colIndex: Record<string, number> = {};
  headers.forEach((h, i) => { const campo = HEADER_MAP[h]; if (campo && colIndex[campo] === undefined) colIndex[campo] = i; });

  const out: LinhaProcesso[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === null || c === "")) continue;
    const get = (campo: string): string | null => {
      const idx = colIndex[campo];
      if (idx === undefined) return null;
      const v = row[idx];
      return v === null || v === undefined || v === "" ? null : String(v).trim();
    };
    const rawObj: Record<string, unknown> = {};
    headers.forEach((h, idx) => { if (h) rawObj[h] = row[idx] ?? null; });

    // Linha sem nome de cliente E sem número de processo não carrega
    // informação útil (planilha tem linhas vazias/formatação sobrando).
    const nome = get("nome_cliente");
    const processo = get("numero_processo");
    if (!nome && !processo) continue;

    out.push({
      ano, linha_planilha: i + 1,
      nome_cliente: nome, reclamada_requerido: get("reclamada_requerido"), materia: get("materia"),
      qualificacao_cliente: get("qualificacao_cliente"), justica: get("justica"), vara: get("vara"),
      comarca: get("comarca"), tribunal: get("tribunal"), numero_processo: processo,
      andamento: get("andamento"), resultado: get("resultado"), contato: get("contato"),
      origem: get("origem"), mes_entrada: get("mes_entrada"), raw_json: rawObj,
    });
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const force = body?.force === true;

    const accessToken = await getOfficeAccessToken();
    if (!accessToken) {
      return new Response(JSON.stringify({ success: false, error: "Drive não conectado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Checa se a planilha mudou desde a última sincronização — evita
    // baixar/parsear ~300KB toda vez que o cron roda à toa.
    const metaResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${DRIVE_FILE_ID}?fields=modifiedTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const meta = await metaResp.json();
    if (!metaResp.ok) throw new Error(meta.error?.message || "Erro ao checar planilha no Drive");

    const { data: estadoAtual } = await supabase
      .from("planilha_processos_sync_estado").select("drive_modified_time").eq("id", 1).maybeSingle();

    if (!force && estadoAtual?.drive_modified_time && new Date(estadoAtual.drive_modified_time).getTime() === new Date(meta.modifiedTime).getTime()) {
      return new Response(JSON.stringify({ success: true, mudou: false, motivo: "planilha sem alteração desde a última sincronização" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${DRIVE_FILE_ID}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!fileResp.ok) throw new Error(`Erro ao baixar planilha: HTTP ${fileResp.status}`);
    const buf = new Uint8Array(await fileResp.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array" });

    let totalLinhas = 0;
    const porAno: Record<number, number> = {};
    for (const sheetName of wb.SheetNames) {
      const ano = parseInt(sheetName, 10);
      if (isNaN(ano)) continue; // ignora abas que não são um ano (ex: resumo/instrução, se houver)
      const linhas = parseAba(wb.Sheets[sheetName], ano);

      // Full-refresh por ano: mais simples e robusto que diff linha a linha
      // pra planilha editada manualmente por gente (linhas inseridas/
      // removidas/reordenadas a qualquer momento).
      await supabase.from("planilha_processos_historico").delete().eq("ano", ano);
      if (linhas.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < linhas.length; i += CHUNK) {
          const chunk = linhas.slice(i, i + CHUNK).map((l) => ({ ...l, updated_at: new Date().toISOString() }));
          const { error } = await supabase.from("planilha_processos_historico").insert(chunk);
          if (error) throw new Error(`Erro ao inserir ano ${ano}: ${error.message}`);
        }
      }
      porAno[ano] = linhas.length;
      totalLinhas += linhas.length;
    }

    await supabase.from("planilha_processos_sync_estado").upsert({
      id: 1, drive_file_id: DRIVE_FILE_ID, drive_modified_time: meta.modifiedTime,
      ultima_sincronizacao: new Date().toISOString(), total_linhas: totalLinhas, status: "ok", erro: null,
    });

    return new Response(JSON.stringify({ success: true, mudou: true, total_linhas: totalLinhas, por_ano: porAno }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("[sync-planilha-processos] Erro:", msg);
    await supabase.from("planilha_processos_sync_estado").upsert({
      id: 1, drive_file_id: DRIVE_FILE_ID, status: "erro", erro: msg,
    });
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
