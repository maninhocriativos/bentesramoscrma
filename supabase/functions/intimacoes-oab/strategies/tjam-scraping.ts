// TJAM Web Scraping - Busca publicações no site do Tribunal de Justiça do Amazonas
// Sem autenticação, scraping do portal público

const TJAM_BASE = "https://www.tjam.jus.br";
const TJAM_DIARIO = "https://www.tjam.jus.br/publicacoes/diario-da-justica/";

interface TJAMPublicacao {
  titulo?: string;
  conteudo?: string;
  data?: string;
  url?: string;
  raw?: unknown;
}

function classifyMovimento(conteudo: string, titulo: string): string {
  const c = (conteudo + " " + titulo).toLowerCase();
  if (c.includes("intimação") || c.includes("intimacao")) return "Intimação";
  if (c.includes("citação") || c.includes("citacao")) return "Citação";
  if (c.includes("notificação") || c.includes("notificacao")) return "Notificação";
  if (c.includes("despacho")) return "Despacho";
  if (c.includes("sentença") || c.includes("sentenca")) return "Sentença";
  if (c.includes("decisão") || c.includes("decisao")) return "Decisão";
  if (c.includes("edital")) return "Edital";
  return "Publicação";
}

function nextBusinessDay(dateStr: string): string {
  const base = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00Z`;
  let d = new Date(base);
  if (Number.isNaN(d.getTime())) d = new Date(`${dateStr.split("T")[0]}T12:00:00Z`);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function makeItem(fields: {
  cnj: string; titulo: string; tribunal: string; tipo: string;
  conteudo: string; dataDisp: string | null;
  oab_numero: string; oab_uf: string; advogado_id: string | null;
  url?: string;
  raw: unknown;
}) {
  const { cnj, titulo, tribunal, tipo, conteudo, dataDisp, oab_numero, oab_uf, advogado_id, url, raw } = fields;
  const dataPub = dataDisp ? nextBusinessDay(dataDisp) : null;
  const dataInt = dataPub ? nextBusinessDay(dataPub) : dataDisp;
  return {
    processo_cnj: cnj,
    processo_titulo: titulo || url || "Publicação TJAM",
    tribunal,
    tipo_intimacao: tipo,
    conteudo: conteudo.slice(0, 5000),
    data_intimacao: dataInt,
    data_disponibilizacao: dataDisp,
    data_publicacao: dataPub,
    oab_numero,
    oab_uf,
    advogado_id,
    fonte: "tjam_scraping",
    raw_json: raw,
  };
}

// Função auxiliar para tentar fazer scraping (fallback se Cheerio não estiver disponível)
async function attemptScraping(
  oab_numero: string,
  oab_uf: string,
  advogado_id: string | null
): Promise<any[]> {
  const intimacoes: any[] = [];

  try {
    console.log(`🔍 [TJAM] Tentando scraping do portal`);

    // Tenta acessar a página principal
    const resp = await fetch(TJAM_DIARIO, {
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      console.warn(`⚠️ [TJAM] HTTP ${resp.status}`);
      return intimacoes;
    }

    const html = await resp.text();

    // Busca simples por padrões no HTML (sem dependências externas)
    // Procura por datas e números de OAB
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})/g;
    const oabPattern = /OAB\s*[\s\/]*(\d+)\s*[\s\/]*(AM|ap)/gi;

    const foundDates = html.match(datePattern) || [];
    const foundOABs = html.match(oabPattern) || [];

    if (foundOABs.some(o => o.includes(oab_numero))) {
      console.log(`✅ [TJAM] OAB ${oab_numero}/${oab_uf} encontrada no HTML`);

      // Extrai seção contendo a OAB
      const oabIndex = html.search(new RegExp(oab_numero, "i"));
      const contextStart = Math.max(0, oabIndex - 500);
      const contextEnd = Math.min(html.length, oabIndex + 2000);
      const context = html.substring(contextStart, contextEnd);

      // Tenta extrair data mais próxima
      const dateMatch = context.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      const dataPublicacao = dateMatch ? dateMatch[1] : null;

      intimacoes.push(makeItem({
        cnj: "",
        titulo: `Publicação TJAM - OAB ${oab_numero}/${oab_uf}`,
        tribunal: "TJAM",
        tipo: "Publicação",
        conteudo: context.replace(/<[^>]*>/g, "").slice(0, 5000),
        dataDisp: dataPublicacao,
        oab_numero,
        oab_uf,
        advogado_id,
        url: TJAM_DIARIO,
        raw: { method: "regex_scraping", context_length: context.length },
      }));
    }

    console.log(`📋 [TJAM] ${intimacoes.length} publicações extraídas`);
  } catch (err) {
    console.error("❌ [TJAM] Erro no scraping:", err);
  }

  return intimacoes;
}

export async function fetchFromTJAM(
  oab_numero: string,
  oab_uf: string,
  advogado_id: string | null = null,
  _advogadoNome?: string | null
): Promise<any[]> {
  const intimacoes: any[] = [];

  try {
    console.log(`🔍 [TJAM] Iniciando busca por OAB/${oab_uf} ${oab_numero}`);

    // Tenta scraping do portal
    const scrapedItems = await attemptScraping(oab_numero, oab_uf, advogado_id);
    intimacoes.push(...scrapedItems);

    // Nota: Em produção, você pode integrar aqui com:
    // - API específica do TJAM (se disponível)
    // - WebService SOAP/REST (se tiver certificado)
    // - Busca avançada no portal
    // Por enquanto, mantemos simples com scraping básico

    console.log(`✅ [TJAM] ${intimacoes.length} publicações encontradas`);
  } catch (e) {
    console.error("❌ [TJAM] Erro geral:", e);
  }

  return intimacoes;
}
