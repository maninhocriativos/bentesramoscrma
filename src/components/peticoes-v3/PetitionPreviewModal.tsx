import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Eye, FileDown, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';

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
  'texto_completo', // fallback for unstructured
];

const SECTION_STYLES: Record<string, { title?: string; centered?: boolean; bold?: boolean; uppercase?: boolean; className?: string }> = {
  enderecamento: { centered: true, bold: true, uppercase: true, className: 'text-sm' },
  tramitacao_preferencial: { centered: true, bold: true, uppercase: true, className: 'text-sm' },
  qualificacao_autor: { className: 'text-sm indent-8' },
  nome_acao: { centered: true, bold: true, uppercase: true, className: 'text-base' },
  qualificacao_reu: { className: 'text-sm indent-8' },
  requerimentos_previos: { title: '1 – DOS REQUERIMENTOS PRÉVIOS', className: 'text-sm' },
  fatos: { title: '2 – DOS FATOS', className: 'text-sm' },
  direito: { title: '3 – DO DIREITO', className: 'text-sm' },
  tutela_urgencia: { className: 'text-sm' },
  inversao_onus: { className: 'text-sm' },
  pedidos: { className: 'text-sm' },
  provas: { className: 'text-sm' },
  valor_causa: { className: 'text-sm indent-8' },
  fechamento: { className: 'text-sm text-center' },
  documentos_anexos: { title: 'Documentos Anexos:', className: 'text-sm' },
  texto_completo: { className: 'text-sm' },
};

export default function PetitionPreviewModal({ open, onOpenChange, content, titulo, onRegenerate, regenerating }: Props) {
  const [copied, setCopied] = useState(false);

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
            <div className="bg-white border border-border/40 rounded-lg shadow-sm mx-auto max-w-[720px] overflow-hidden">
              {/* Letterhead */}
              <div className="border-b-2 border-primary/20 px-10 py-5 bg-gradient-to-r from-primary/[0.02] to-transparent">
                <div className="text-center">
                  <h2 className="font-serif text-lg font-bold tracking-wide text-foreground">Bentes Ramos</h2>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70 mt-0.5">Advocacia e Consultoria Jurídica</p>
                </div>
              </div>

              {/* Content */}
              <div className="px-10 py-8 space-y-5 font-serif text-foreground/90 leading-relaxed">
                {orderedSections.map(({ key, value }) => {
                  const style = SECTION_STYLES[key] || {};
                  const textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);

                  return (
                    <div key={key}>
                      {style.title && (
                        <h3 className="font-bold text-sm uppercase tracking-wide text-foreground mb-3">{style.title}</h3>
                      )}
                      <div
                        className={`whitespace-pre-wrap ${style.className || 'text-sm'} ${style.centered ? 'text-center' : ''} ${style.bold ? 'font-bold' : ''} ${style.uppercase ? 'uppercase' : ''}`}
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

              {/* Footer */}
              <div className="border-t border-border/30 px-10 py-4 bg-muted/20">
                <div className="text-center text-[10px] text-muted-foreground leading-relaxed">
                  <p className="font-semibold uppercase tracking-wider">Bentes Ramos Advocacia e Consultoria Jurídica</p>
                  <p className="mt-1">📍 Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040</p>
                  <p>📞 (92) 3343-6173 | 📱 (92) 98223-7330 / (92) 99160-4348 / 98588-8190</p>
                  <p>juridico@bentesramos.adv.br | 🌐 www.bentesramos.com.br</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
