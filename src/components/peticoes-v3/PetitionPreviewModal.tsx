import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Eye, FileDown, Copy, CheckCircle, FileText } from 'lucide-react';
import { useState, useRef } from 'react';
import logoBR from '@/assets/logo-bentes-ramos-gold.png';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: Record<string, unknown> | null;
  titulo?: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

// Ordered sections matching the firm's exact structure
const SECTION_ORDER = [
  'enderecamento',
  'tramitacao_preferencial',
  'qualificacao_autor',
  'nome_acao',
  'qualificacao_reu',
  'requerimentos_previos',
  'fatos',
  'direito',
  'tutela_urgencia',
  'inversao_onus',
  'pedidos',
  'provas',
  'valor_causa',
  'fechamento',
  'documentos_anexos',
  'texto_completo',
];

// No more duplicate 'title' fields — Claude already includes them in the content
const SECTION_STYLES: Record<string, { centered?: boolean; bold?: boolean; uppercase?: boolean; className?: string }> = {
  enderecamento: { centered: true, bold: true, uppercase: true, className: 'text-sm' },
  tramitacao_preferencial: { centered: true, bold: true, uppercase: true, className: 'text-sm' },
  qualificacao_autor: { className: 'text-sm indent-8' },
  nome_acao: { centered: true, bold: true, uppercase: true, className: 'text-base' },
  qualificacao_reu: { className: 'text-sm indent-8' },
  requerimentos_previos: { className: 'text-sm' },
  fatos: { className: 'text-sm' },
  direito: { className: 'text-sm' },
  tutela_urgencia: { className: 'text-sm' },
  inversao_onus: { className: 'text-sm' },
  pedidos: { className: 'text-sm' },
  provas: { className: 'text-sm' },
  valor_causa: { className: 'text-sm indent-8' },
  fechamento: { className: 'text-sm text-center' },
  documentos_anexos: { className: 'text-sm' },
  texto_completo: { className: 'text-sm' },
};

function buildFullHtml(sections: { key: string; value: string }[], logoUrl: string): string {
  const body = sections.map(({ key, value }) => {
    const style = SECTION_STYLES[key] || {};
    const textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const classes: string[] = [];
    if (style.centered) classes.push('text-align:center;');
    if (style.bold) classes.push('font-weight:bold;');
    if (style.uppercase) classes.push('text-transform:uppercase;');
    if (key === 'qualificacao_autor' || key === 'qualificacao_reu' || key === 'valor_causa') {
      classes.push('text-indent:3em;');
    }
    return `<div style="margin-bottom:18px;${classes.join('')}white-space:pre-wrap;font-size:12pt;line-height:1.7;text-align:${style.centered ? 'center' : 'justify'};">${textContent.replace(/\n/g, '<br/>')}</div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@page { margin: 2cm 2.5cm; size: A4; }
body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.7; color: #1a1a1a; max-width: 18cm; margin: 0 auto; }
.header { text-align: center; padding-bottom: 15px; border-bottom: 2px solid #9B7B3C; margin-bottom: 25px; }
.header img { height: 70px; }
.footer { margin-top: 35px; padding: 12px 20px; background: #2D2D2D; text-align: center; }
.footer .name { color: #C4A95B; font-weight: bold; font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; }
.footer .info { color: #B0B0B0; font-size: 9pt; margin-top: 3px; }
.footer a { color: #7BA4D4; }
</style></head><body>
<div class="header"><img src="${logoUrl}" alt="Bentes Ramos"/></div>
${body}
<div class="footer">
<div class="name">Bentes Ramos Advocacia e Consultoria Jurídica</div>
<div class="info">End.: Rua Salvador, n° 120, sala 708, 7° andar – Edifício Vieiralves Business Center – bairro: Adrianópolis – Manaus/AM – Cep: 69.057-040</div>
<div class="info">Tel.: (92) 3343-6173 – Cel.: (92) 98223-7330 / 98160-4348 · E-mail: <a href="mailto:juridico@bentesramos.adv.br">juridico@bentesramos.adv.br</a></div>
</div>
</body></html>`;
}

export default function PetitionPreviewModal({ open, onOpenChange, content, titulo, onRegenerate, regenerating }: Props) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  if (!content) return null;

  // Render sections in fixed order
  const orderedSections = SECTION_ORDER
    .filter(key => content[key] != null && content[key] !== '')
    .map(key => ({ key, value: content[key] as string }));

  // Add any extra sections not in order
  const knownKeys = new Set(SECTION_ORDER);
  Object.entries(content).forEach(([key, value]) => {
    if (!knownKeys.has(key) && value != null && value !== '') {
      orderedSections.push({ key, value: value as string });
    }
  });

  const copyFullText = () => {
    const text = orderedSections
      .map(s => typeof s.value === 'string' ? s.value : JSON.stringify(s.value))
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportAsDocx = async () => {
    setExporting('docx');
    try {
      const html = buildFullHtml(orderedSections, window.location.origin + '/images/logo-bentes-ramos-header.jpg');
      const blob = new Blob(
        [
          `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
          <head><meta charset="utf-8"><style>@page { margin: 2cm 2.5cm; size: A4; } body { font-family: 'Times New Roman'; font-size: 12pt; }</style></head><body>${html}</body></html>`,
        ],
        { type: 'application/msword' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${titulo || 'peticao'}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  const exportAsPdf = async () => {
    setExporting('pdf');
    try {
      const { jsPDF } = await import('jspdf');
      const el = docRef.current;
      if (!el) return;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      const usableWidth = pageWidth - margin * 2;

      // Use html method for proper rendering
      await new Promise<void>((resolve) => {
        pdf.html(el, {
          callback: (doc) => {
            doc.save(`${titulo || 'peticao'}.pdf`);
            resolve();
          },
          x: margin,
          y: margin,
          width: usableWidth,
          windowWidth: el.scrollWidth,
          html2canvas: {
            scale: 0.264, // mm/px conversion
            useCORS: true,
            logging: false,
          },
        });
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 bg-gradient-to-r from-primary/[0.04] to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">{titulo || 'Preview da Petição'}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">Revise o conteúdo gerado antes da exportação</DialogDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyFullText} className="h-8">
                {copied ? <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
              <Button variant="outline" size="sm" onClick={exportAsDocx} disabled={!!exporting} className="h-8">
                <FileText className={`h-3.5 w-3.5 mr-1.5 ${exporting === 'docx' ? 'animate-pulse' : ''}`} />
                Word
              </Button>
              <Button variant="outline" size="sm" onClick={exportAsPdf} disabled={!!exporting} className="h-8">
                <FileDown className={`h-3.5 w-3.5 mr-1.5 ${exporting === 'pdf' ? 'animate-pulse' : ''}`} />
                PDF
              </Button>
              {onRegenerate && (
                <Button variant="outline" size="sm" onClick={onRegenerate} disabled={regenerating} className="h-8">
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${regenerating ? 'animate-spin' : ''}`} />
                  Regenerar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[78vh]">
          <div className="p-6">
            {/* Document simulation - A4-like paper */}
            <div ref={docRef} className="bg-white border border-border/40 rounded-lg shadow-sm mx-auto max-w-[720px] overflow-hidden">
              {/* Letterhead — only the gold logo */}
              <div className="px-10 pt-8 pb-5 flex flex-col items-center">
                <img src={logoBR} alt="Bentes Ramos - Advocacia e Consultoria Jurídica" className="h-28 object-contain" />
              </div>
              <div className="mx-10 border-b" style={{ borderColor: '#9B7B3C' }} />

              {/* Content */}
              <div className="px-10 py-8 space-y-5 font-serif text-foreground/90 leading-relaxed">
                {orderedSections.map(({ key, value }) => {
                  const style = SECTION_STYLES[key] || {};
                  const textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);

                  return (
                    <div key={key}>
                      <div
                        className={`whitespace-pre-wrap ${style.className || 'text-sm'} ${style.centered ? 'text-center' : 'text-justify'} ${style.bold ? 'font-bold' : ''} ${style.uppercase ? 'uppercase' : ''}`}
                      >
                        {/* Highlight [PENDENTE] markers */}
                        {textContent.split(/(\[PENDENTE:[^\]]*\])/).map((part, i) =>
                          part.startsWith('[PENDENTE') ? (
                            <span key={i} className="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-xs font-sans font-medium">{part}</span>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}

                {orderedSections.length === 0 && (
                  <p className="text-center text-muted-foreground italic py-8">Nenhum conteúdo gerado ainda.</p>
                )}
              </div>

              {/* Footer — dark bg, gold text */}
              <div className="px-10 py-4" style={{ backgroundColor: '#2D2D2D' }}>
                <div className="text-center leading-relaxed">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: '#C4A95B' }}>
                    Bentes Ramos Advocacia e Consultoria Jurídica
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: '#B0B0B0' }}>
                    End.: Rua Salvador, n° 120, sala 708, 7° andar – Edifício Vieiralves Business Center – bairro: Adrianópolis – Manaus/AM – Cep: 69.057-040
                  </p>
                  <p className="text-[10px]" style={{ color: '#B0B0B0' }}>
                    Tel.: (92) 3343-6173 – Cel.: (92) 98223-7330 / 98160-4348 · E-mail: <span style={{ color: '#7BA4D4' }}>juridico@bentesramos.adv.br</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
