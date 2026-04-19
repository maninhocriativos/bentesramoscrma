import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, FileText, Info, Hash, Code, Scale } from 'lucide-react';
import { enrichMovements, MovimentoEnriquecido, getCategoriaColor } from '@/lib/cnjMovimentosMap';
import { useMemo } from 'react';

interface MovimentoBruto {
  dataHora: string;
  dataHoraRaw?: string;
  nome: string;
  complemento?: string;
  codigo?: number;
  tipo?: string;
}

interface MovimentoDetailModalProps {
  movimento: MovimentoBruto | MovimentoEnriquecido | null;
  isOpen: boolean;
  onClose: () => void;
}

function isEnriquecido(mov: MovimentoBruto | MovimentoEnriquecido): mov is MovimentoEnriquecido {
  return 'titulo_humano' in mov && 'descricao_humana' in mov;
}

export function MovimentoDetailModal({ movimento, isOpen, onClose }: MovimentoDetailModalProps) {
  const mov = useMemo<MovimentoEnriquecido | null>(() => {
    if (!movimento) return null;
    if (isEnriquecido(movimento)) return movimento;
    const enriched = enrichMovements([movimento]);
    return enriched[0] || null;
  }, [movimento]);

  if (!mov) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 gap-0 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Detalhes da Movimentação</DialogTitle>
        </DialogHeader>

        {/* Header gradient */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/85 to-primary/60" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(255,255,255,0.10),transparent_55%)]" />
          <div className="relative px-6 py-5">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={`inline-flex items-center text-[10px] font-black px-2.5 py-1 rounded-lg bg-white/20 text-white border border-white/20 backdrop-blur-sm uppercase tracking-wider ${getCategoriaColor(mov.categoria)}`}>
                {mov.badge}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-white/80">
                <Calendar className="h-3 w-3" />
                {mov.dataHora}
              </span>
            </div>
            <h2 className="text-lg font-black text-white leading-snug">
              {mov.titulo_humano}
            </h2>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Descrição humana */}
          <div className="p-4 rounded-xl bg-muted/20 border border-border/40">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-5 w-5 rounded-lg bg-primary/10 flex items-center justify-center">
                <Info className="h-3 w-3 text-primary" />
              </div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">O que significa</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{mov.descricao_humana}</p>
          </div>

          {/* Complemento original */}
          {mov.complemento && (
            <div className="p-4 rounded-xl bg-muted/10 border border-border/40">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="h-5 w-5 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                </div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Complemento do Tribunal</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{mov.complemento}</p>
            </div>
          )}

          {/* Código CNJ */}
          {mov.codigo && (
            <div className="p-4 rounded-xl bg-primary/[0.03] border border-primary/15">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 w-5 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Hash className="h-3 w-3 text-primary" />
                </div>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Código CNJ {mov.codigo}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O código <span className="font-bold text-foreground">{mov.codigo}</span> identifica este tipo de movimentação no sistema unificado do Conselho Nacional de Justiça.
              </p>
            </div>
          )}

          {/* Detalhe técnico */}
          {(mov.nome && mov.nome !== mov.titulo_humano || mov.tipo || mov.codigo) && (
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <Code className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Detalhe técnico</p>
              </div>
              <div className="space-y-1">
                {mov.codigo && (
                  <p className="text-[10px] font-mono text-muted-foreground">
                    <span className="text-muted-foreground/50">codigo_cnj:</span> {mov.codigo}
                  </p>
                )}
                {mov.tipo && (
                  <p className="text-[10px] font-mono text-muted-foreground">
                    <span className="text-muted-foreground/50">tipo:</span> {mov.tipo}
                  </p>
                )}
                {mov.nome && mov.nome !== mov.titulo_humano && (
                  <p className="text-[10px] font-mono text-muted-foreground">
                    <span className="text-muted-foreground/50">nome_original:</span> {mov.nome}
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
