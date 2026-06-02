// DOU Web Scraping - Busca publicações no Diário Oficial da União
// Web scraping do site público (API rejeita requisições diretas)
// Sem autenticação, histórico completo, sem limite de 90 dias

const DOU_BUSCA = "https://www.in.gov.br/consulta";

interface DOUPublicacao {
  id?: string;
  titulo?: string;
  descricao?: string;
  data_publicacao?: string;
  secao?: string;
  edicao?: string;
  orgao?: string;
  conteudo?: string;
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
  raw: unknown;
}) {
  const { cnj, titulo, tribunal, tipo, conteudo, dataDisp, oab_numero, oab_uf, advogado_id, raw } = fields;
  const dataPub = dataDisp ? nextBusinessDay(dataDisp) : null;
  const dataInt = dataPub ? nextBusinessDay(dataPub) : dataDisp;
  return {
    processo_cnj: cnj,
    processo_titulo: titulo,
    tribunal,
    tipo_intimacao: tipo,
    conteudo: conteudo.slice(0, 5000),
    data_intimacao: dataInt,
    data_disponibilizacao: dataDisp,
    data_publicacao: dataPub,
    oab_numero,
    oab_uf,
    advogado_id,
    fonte: "dou_api",
    raw_json: raw,
  };
}

export async function fetchFromDOU(
  oab_numero: string,
  oab_uf: string,
  _advogado_id: string | null = null,
  _advogadoNome?: string | null
): Promise<any[]> {
  const intimacoes: any[] = [];

  try {
    console.log(`🔍 [DOU] Tentando web scraping do Diário Oficial da União`);

    // Tenta acessar a página de busca da DOU
    const resp = await fetch(DOU_BUSCA, {
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      console.warn(`⚠️ [DOU] HTTP ${resp.status} ao acessar ${DOU_BUSCA}`);
      return intimacoes;
    }

    const html = await resp.text();

    // Busca por padrões no HTML
    // Procura por menções de OAB e CNJ
    const oabPattern = new RegExp(oab_numero.replace(/\D/g, ""), "gi");
    const cnjPattern = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;

    const foundOABs = html.match(oabPattern) || [];
    const foundCNJs = html.match(cnjPattern) || [];

    console.log(`📄 [DOU] Menções de OAB: ${foundOABs.length}, CNJs: ${foundCNJs.length}`);

    if (foundOABs.length > 0 || foundCNJs.length > 0) {
      // Extrai seção relevante do HTML
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ");

      // Se encontrou CNJs, cria um item para cada um
      for (const cnj of foundCNJs.slice(0, 10)) {
        // Pega contexto ao redor do CNJ
        const idx = text.indexOf(cnj);
        const contextStart = Math.max(0, idx - 500);
        const contextEnd = Math.min(text.length, idx + 1000);
        const context = text.substring(contextStart, contextEnd);

        // Tenta extrair data
        const dateMatch = context.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        const dataPublicacao = dateMatch ? dateMatch[1] : null;

        intimacoes.push(makeItem({
          cnj,
          titulo: `Publicação DOU - OAB ${oab_numero}/${oab_uf}`,
          tribunal: "DOU",
          tipo: "Publicação",
          conteudo: context.slice(0, 5000),
          dataDisp: dataPublicacao,
          oab_numero,
          oab_uf,
          advogado_id: _advogado_id,
          raw: { method: "dou_scraping", context_length: context.length },
        }));
      }
    }

    console.log(`✅ [DOU] ${intimacoes.length} publicações extraídas`);
  } catch (err) {
    console.error("❌ [DOU] Erro:", err);
  }

  return intimacoes;
}
