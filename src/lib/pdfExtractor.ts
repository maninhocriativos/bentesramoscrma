import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export async function extrairTextoPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let textoCompleto = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    const linhasPorY = new Map<number, Array<{ x: number; str: string }>>();

    for (const item of items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);
      if (!linhasPorY.has(y)) linhasPorY.set(y, []);
      linhasPorY.get(y)!.push({ x, str: item.str });
    }

    const linhasOrdenadas = Array.from(linhasPorY.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, itens]) =>
        itens.sort((a, b) => a.x - b.x).map(i => i.str).join(' ')
      );

    textoCompleto += `\n--- PÁGINA ${pageNum} ---\n`;
    textoCompleto += linhasOrdenadas.join('\n');
  }

  return textoCompleto;
}
