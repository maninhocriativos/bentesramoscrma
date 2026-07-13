// Entidades HTML nomeadas mais comuns em conteúdo de tribunais em pt-BR.
const HTML_NAMED_ENTITIES: Record<string, string> = {
  aacute: "á", Aacute: "Á", agrave: "à", Agrave: "À", acirc: "â", Acirc: "Â", atilde: "ã", Atilde: "Ã",
  eacute: "é", Eacute: "É", egrave: "è", Egrave: "È", ecirc: "ê", Ecirc: "Ê",
  iacute: "í", Iacute: "Í", icirc: "î", Icirc: "Î",
  oacute: "ó", Oacute: "Ó", ograve: "ò", Ograve: "Ò", ocirc: "ô", Ocirc: "Ô", otilde: "õ", Otilde: "Õ",
  uacute: "ú", Uacute: "Ú", ucirc: "û", Ucirc: "Û", uuml: "ü", Uuml: "Ü",
  ccedil: "ç", Ccedil: "Ç", ntilde: "ñ", Ntilde: "Ñ",
  ordm: "º", ordf: "ª", deg: "°",
  quot: '"', apos: "'", lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"',
  ndash: "–", mdash: "—", hellip: "…",
  nbsp: " ", amp: "&", lt: "<", gt: ">",
  sect: "§", para: "¶", raquo: "»", laquo: "«", middot: "·", copy: "©", reg: "®", trade: "™",
};

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => HTML_NAMED_ENTITIES[name] ?? m);
}

export function stripHtml(html: string): string {
  const hasTags = /<[a-z][\s\S]*>/i.test(html);
  let out = html;
  if (hasTags) {
    out = out
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
  }
  return decodeHtmlEntities(out).replace(/\s+/g, " ").trim();
}

export function classifyMovimento(conteudo: string, tipo: string): string {
  const c = (conteudo + " " + tipo).toLowerCase();
  if (c.includes("intimação") || c.includes("intimacao")) return "Intimação";
  if (c.includes("citação") || c.includes("citacao")) return "Citação";
  if (c.includes("notificação") || c.includes("notificacao")) return "Notificação";
  if (c.includes("publicação") || c.includes("publicacao")) return "Publicação";
  if (c.includes("despacho")) return "Despacho";
  if (c.includes("sentença") || c.includes("sentenca")) return "Sentença";
  if (c.includes("decisão") || c.includes("decisao")) return "Decisão";
  if (c.includes("audiência") || c.includes("audiencia")) return "Audiência";
  if (c.includes("petição") || c.includes("peticao")) return "Petição";
  if (c.includes("recurso")) return "Recurso";
  return "Movimentação";
}

export const TIPOS_INTIMACAO = new Set(["Intimação", "Citação", "Notificação", "Publicação"]);
