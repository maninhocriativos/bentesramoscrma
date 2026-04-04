export async function extrairTextoPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);

    // Tenta importar pdf.js
    let pdfjsLib: any;
    try {
      pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    } catch (e) {
      console.error('pdfjs-dist não disponível:', e);
      return '';
    }

    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
    let textoCompleto = '';

    console.log(`PDF carregado: ${pdf.numPages} páginas`);

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

      const linhas = Array.from(linhasPorY.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([, itens]) =>
          itens.sort((a, b) => a.x - b.x).map(i => i.str).join(' ')
        );

      textoCompleto += `\n--- PÁGINA ${pageNum} ---\n${linhas.join('\n')}`;
    }

    console.log(`Texto extraído: ${textoCompleto.length} chars`);
    return textoCompleto;

  } catch (err) {
    console.error('Erro pdfExtractor:', err);
    return '';
  }
}
