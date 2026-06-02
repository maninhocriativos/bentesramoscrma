// DOU API Integration - Busca publicações no Diário Oficial da União
// Sem autenticação, histórico completo, sem limite de 90 dias

const DOU_API = "https://api.in.gov.br/api/v1/diarios";

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
  advogadoNome?: string | null
): Promise<any[]> {
  const intimacoes: any[] = [];
  let found = 0;

  try {
    console.log(`🔍 [DOU] Buscando por OAB/${oab_uf} ${oab_numero}`);

    // Estratégia 1: Buscar por OAB formatado
    const queries = [
      `OAB ${oab_numero}/${oab_uf}`,
      `OAB ${oab_numero} ${oab_uf}`,
      oab_numero,
    ];

    if (advogadoNome) {
      queries.push(advogadoNome);
    }

    for (const query of queries) {
      try {
        const url = `${DOU_API}?q=${encodeURIComponent(query)}&limit=100&offset=0`;
        console.log(`🔎 [DOU] Query: "${query}"`);

        const resp = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(15000),
        });

        if (!resp.ok) {
          console.warn(`⚠️ [DOU] HTTP ${resp.status} para query "${query}"`);
          continue;
        }

        const data = await resp.json();
        const items = data?.diarios || data?.results || data?.data || [];

        if (!Array.isArray(items)) {
          console.warn(`⚠️ [DOU] Resposta inválida para "${query}"`);
          continue;
        }

        console.log(`📄 [DOU] ${items.length} resultados para "${query}"`);

        for (const item of items) {
          const conteudo = item.descricao || item.conteudo || item.texto || "";
          const titulo = item.titulo || "Publicação DOU";
          const dataDisp = item.data_publicacao || item.data || "";

          // Extrai CNJ se existir no conteúdo
          const cnjMatch = conteudo.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);

          const tipo = classifyMovimento(conteudo, titulo);

          intimacoes.push(makeItem({
            cnj: cnjMatch ? cnjMatch[1] : "",
            titulo,
            tribunal: "DOU",
            tipo,
            conteudo,
            dataDisp: dataDisp || null,
            oab_numero,
            oab_uf,
            advogado_id: _advogado_id,
            raw: item,
          }));

          found++;
        }
      } catch (err) {
        console.error(`❌ [DOU] Erro na query "${query}":`, err);
      }
    }

    console.log(`📋 [DOU] ${found} publicações encontradas`);
  } catch (e) {
    console.error("❌ [DOU] Erro geral:", e);
  }

  return intimacoes;
}
