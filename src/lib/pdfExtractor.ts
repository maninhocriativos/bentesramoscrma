export async function extrairTextoPdf(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);

        // Importa pdf.js dinamicamente
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.mjs',
          import.meta.url
        ).toString();

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

          const linhasOrdenadas = Array.from(linhasPorY.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([, itens]) =>
              itens.sort((a, b) => a.x - b.x).map(i => i.str).join(' ')
            );

          textoCompleto += `\n--- PÁGINA ${pageNum} ---\n`;
          textoCompleto += linhasOrdenadas.join('\n');
        }

        console.log(`Texto extraído: ${textoCompleto.length} chars`);
        console.log('Primeiros 500 chars:', textoCompleto.substring(0, 500));

        resolve(textoCompleto);
      } catch (err) {
        console.error('Erro ao processar PDF:', err);
        reject(err);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
