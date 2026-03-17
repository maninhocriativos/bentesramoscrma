import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileDown, RefreshCw, Eye } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: Record<string, unknown> | null;
  titulo?: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  enderecamento: 'ENDEREÇAMENTO',
  qualificacao_autor: 'QUALIFICAÇÃO DA PARTE AUTORA',
  qualificacao_reu: 'QUALIFICAÇÃO DA PARTE RÉ',
  sintese_fatica: 'DOS FATOS',
  fundamentos_juridicos: 'DO DIREITO',
  tutela_urgencia: 'DA TUTELA DE URGÊNCIA',
  pedidos: 'DOS PEDIDOS',
  provas: 'DAS PROVAS',
  valor_causa: 'DO VALOR DA CAUSA',
  fechamento: 'FECHAMENTO',
  texto_completo: 'PETIÇÃO',
};

export default function PetitionPreviewModal({ open, onOpenChange, content, titulo, onRegenerate, regenerating }: Props) {
  if (!content) return null;

  const sections = Object.entries(content).filter(([, v]) => v != null && v !== '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">{titulo || 'Preview da Petição'}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">Revise o conteúdo gerado pela IA</DialogDescription>
              </div>
            </div>
            <div className="flex gap-2">
              {onRegenerate && (
                <Button variant="outline" size="sm" onClick={onRegenerate} disabled={regenerating}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${regenerating ? 'animate-spin' : ''}`} />
                  Regenerar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-8 space-y-6">
            {/* Document simulation */}
            <div className="bg-white border rounded-lg shadow-sm p-10 max-w-[700px] mx-auto font-serif text-sm leading-relaxed space-y-6">
              {sections.map(([key, value]) => (
                <div key={key}>
                  {SECTION_LABELS[key] && (
                    <h3 className="font-bold text-center uppercase text-xs tracking-widest text-primary mb-3">
                      {SECTION_LABELS[key]}
                    </h3>
                  )}
                  <div className="whitespace-pre-wrap text-foreground/90">
                    {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                  </div>
                </div>
              ))}

              {sections.length === 0 && (
                <p className="text-center text-muted-foreground italic">Nenhum conteúdo gerado ainda.</p>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
