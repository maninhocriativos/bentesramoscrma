// Worker do pdf.js EMPACOTADO pelo Vite — garante que a versão do worker é
// idêntica à da lib instalada (evita "API version does not match Worker version")
// e funciona offline, sem depender de CDN.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Renderiza cada página de um PDF (tipicamente escaneado, sem texto) como imagem
// PNG em base64 — para que a IA de visão (OpenAI) consiga ler. Retorna o base64
// PURO (sem o prefixo "data:image/png;base64,").
export async function renderizarPdfComoImagens(file: File, escala = 2): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const typedArray = new Uint8Array(arrayBuffer);

  const pdfjsLib: any = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
  const imagens: string[] = [];

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: escala });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    imagens.push(canvas.toDataURL('image/png').split(',')[1]);
  }

  console.log(`PDF renderizado como ${imagens.length} imagem(ns)`);
  return imagens;
}

export async function extrairTextoPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);

    // Tenta importar pdf.js
    let pdfjsLib: any;
    try {
      pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
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
