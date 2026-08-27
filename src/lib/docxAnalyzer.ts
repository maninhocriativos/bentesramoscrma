// Análise de um .docx recém-selecionado — roda 100% no navegador (pizzip lê o
// zip localmente, sem precisar de backend). Usado pela tela de admin de
// modelos: ao escolher o arquivo, já mostra quais {{marcadores}} o modelo
// pede e quais imagens existem no corpo do documento, pra nomear cada uma
// como um print slot antes de salvar.
import PizZip from 'pizzip';

export interface ImagemDetectada {
  mediaTarget: string;
  bytes: number;
}

export async function analisarArquivoModelo(file: File): Promise<{
  placeholders: string[];
  imagens: ImagemDetectada[];
}> {
  const buf = await file.arrayBuffer();
  const zip = new PizZip(buf);
  const xml = zip.file('word/document.xml')?.asText() || '';
  const texto = xml.replace(/<[^>]+>/g, '');
  const set = new Set<string>();
  for (const m of texto.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    set.add(m[1].trim().normalize('NFC'));
  }
  const imagens = listarImagensDoCorpo(zip);
  return { placeholders: [...set], imagens };
}

// Lista as imagens do CORPO do documento (não do cabeçalho/rodapé — a logo
// do timbre fica no header e nunca é tocada).
function listarImagensDoCorpo(zip: PizZip): ImagemDetectada[] {
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (!relsFile) return [];
  const rels = relsFile.asText();
  const alvos = [...rels.matchAll(/Target="(media\/image[^"]+\.(?:png|jpe?g|gif))"/gi)].map(m => m[1]);
  return alvos.map(t => ({
    mediaTarget: t,
    bytes: zip.file(`word/${t}`)?.asUint8Array().length ?? 0,
  }));
}
