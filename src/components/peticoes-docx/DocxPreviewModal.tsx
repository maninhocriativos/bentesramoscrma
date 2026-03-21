import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2, FileText } from 'lucide-react';

interface DocxPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docxBuffer: ArrayBuffer | Blob | null;
  title?: string;
}

const MIN_PREVIEW_TEXT_LENGTH = 80;

export default function DocxPreviewModal({ open, onOpenChange, docxBuffer, title }: DocxPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<'docx' | 'html'>('docx');

  useEffect(() => {
    if (!open || !docxBuffer || !containerRef.current) return;

    let cancelled = false;
    setLoading(true);
    setPreviewMode('docx');

    const getArrayBuffer = async () => {
      if (docxBuffer instanceof Blob) return await docxBuffer.arrayBuffer();
      return docxBuffer;
    };

    const hasVisibleContent = (container: HTMLDivElement) => {
      const text = container.textContent?.replace(/\s+/g, ' ').trim() || '';
      return text.length >= MIN_PREVIEW_TEXT_LENGTH;
    };

    const renderHtmlFallback = async (arrayBuffer: ArrayBuffer) => {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            'b => strong',
            'i => em',
            'u => u',
          ],
          convertImage: mammoth.images.imgElement((image: { contentType: string; read: (format: string) => Promise<string> }) => {
            return image.read('base64').then((imageBuffer: string) => ({
              src: `data:${image.contentType};base64,${imageBuffer}`,
              style: 'max-width:100%;height:auto;',
            }));
          }),
        }
      );

      if (cancelled || !containerRef.current) return;

      containerRef.current.innerHTML = result.value || '<p>Não foi possível exibir a pré-visualização deste documento.</p>';
      setPreviewMode('html');
    };

    (async () => {
      const arrayBuffer = await getArrayBuffer();

      try {
        const { renderAsync } = await import('docx-preview');
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = '';
        const blob = new Blob([new Uint8Array(arrayBuffer)], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        await renderAsync(blob, containerRef.current, undefined, {
          className: 'docx-preview-container',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true,
        });

        if (cancelled || !containerRef.current) return;

        if (!hasVisibleContent(containerRef.current)) {
          await renderHtmlFallback(arrayBuffer);
        }
      } catch (err) {
        console.error('Erro ao renderizar DOCX, usando fallback HTML:', err);
        try {
          await renderHtmlFallback(arrayBuffer);
        } catch (fallbackErr) {
          console.error('Erro ao renderizar fallback HTML:', fallbackErr);
          if (containerRef.current) {
            containerRef.current.innerHTML = '<p class="p-8 text-center text-sm text-muted-foreground">Erro ao renderizar o documento. Tente baixar o .docx.</p>';
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, docxBuffer]);

  const handleDownload = () => {
    if (!docxBuffer) return;
    const blob = docxBuffer instanceof Blob
      ? docxBuffer
      : new Blob([new Uint8Array(docxBuffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'peticao'}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!containerRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');

    const extraStyles = previewMode === 'html'
      ? `
        body { margin: 0; padding: 32px; color: hsl(var(--foreground)); background: white; }
        img { max-width: 100%; height: auto; }
        p, li { line-height: 1.7; }
        table { width: 100%; border-collapse: collapse; }
      `
      : `
        body { margin: 0; padding: 0; }
        .docx-wrapper { box-shadow: none !important; padding: 0 !important; }
        @media print {
          .docx-wrapper { box-shadow: none !important; }
        }
      `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || 'Petição'}</title>
          ${styles}
          <style>${extraStyles}</style>
        </head>
        <body>${containerRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col p-0">
        <DialogHeader className="shrink-0 border-b px-6 pt-5 pb-3">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {title || 'Visualizar Documento'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Imprimir / PDF
              </Button>
              <Button size="sm" onClick={handleDownload}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Baixar .docx
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="relative flex-1 overflow-auto bg-muted/30">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Renderizando documento...</p>
              </div>
            </div>
          )}

          <div className="min-h-full px-4 py-5 sm:px-6">
            <div
              ref={containerRef}
              className={previewMode === 'html'
                ? 'prose prose-sm max-w-none rounded-2xl border bg-card px-6 py-8 text-foreground shadow-soft sm:px-10 [&_h1]:mb-4 [&_h1]:text-2xl [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-lg [&_img]:rounded-lg [&_img]:border [&_p]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted [&_th]:p-2'
                : 'min-h-full'
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
