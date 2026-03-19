import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2, FileText } from 'lucide-react';

interface DocxPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docxBuffer: ArrayBuffer | Blob | null;
  title?: string;
}

export default function DocxPreviewModal({ open, onOpenChange, docxBuffer, title }: DocxPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !docxBuffer || !containerRef.current) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { renderAsync } = await import('docx-preview');
        if (cancelled || !containerRef.current) return;
        
        containerRef.current.innerHTML = '';
        const blob = docxBuffer instanceof Blob
          ? docxBuffer
          : new Blob([new Uint8Array(docxBuffer)]);
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
      } catch (err) {
        console.error('Erro ao renderizar DOCX:', err);
        if (containerRef.current) {
          containerRef.current.innerHTML = '<p class="text-sm text-muted-foreground p-8 text-center">Erro ao renderizar o documento. Tente baixar o .docx.</p>';
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, docxBuffer]);

  const handleDownload = () => {
    if (!docxBuffer) return;
    const blob = docxBuffer instanceof Blob ? docxBuffer : new Blob([docxBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
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
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || 'Petição'}</title>
          ${styles}
          <style>
            body { margin: 0; padding: 0; }
            .docx-wrapper { box-shadow: none !important; padding: 0 !important; }
            @media print {
              .docx-wrapper { box-shadow: none !important; }
            }
          </style>
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
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {title || 'Visualizar Documento'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Imprimir / PDF
              </Button>
              <Button size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Baixar .docx
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto bg-muted/30 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Renderizando documento...</p>
              </div>
            </div>
          )}
          <div ref={containerRef} className="min-h-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
