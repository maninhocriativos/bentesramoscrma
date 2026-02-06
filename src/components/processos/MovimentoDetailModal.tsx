import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, Info, Hash, Code } from 'lucide-react';
import { enrichMovements, MovimentoEnriquecido, getCategoriaColor } from '@/lib/cnjMovimentosMap';
import { useMemo } from 'react';

// Movimento bruto do DataJud/banco
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

// Type guard para verificar se já está enriquecido
function isEnriquecido(mov: MovimentoBruto | MovimentoEnriquecido): mov is MovimentoEnriquecido {
  return 'titulo_humano' in mov && 'descricao_humana' in mov;
}

export function MovimentoDetailModal({ movimento, isOpen, onClose }: MovimentoDetailModalProps) {
  // Enriquecer movimento se necessário
  const movimentoEnriquecido = useMemo<MovimentoEnriquecido | null>(() => {
    if (!movimento) return null;
    if (isEnriquecido(movimento)) return movimento;
    
    // Enriquecer movimento bruto
    const enriched = enrichMovements([movimento]);
    return enriched[0] || null;
  }, [movimento]);
  
  if (!movimentoEnriquecido) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Detalhes da Movimentação
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Título humano (grande) */}
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <p className="font-semibold text-lg">{movimentoEnriquecido.titulo_humano}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge 
                variant="outline" 
                className={`text-xs ${getCategoriaColor(movimentoEnriquecido.categoria)}`}
              >
                {movimentoEnriquecido.badge}
              </Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {movimentoEnriquecido.dataHora}
              </span>
            </div>
          </div>

          {/* Descrição humana (principal) */}
          <div className="p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Descrição</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {movimentoEnriquecido.descricao_humana}
            </p>
          </div>

          {/* Complemento original (se existir) */}
          {movimentoEnriquecido.complemento && (
            <div className="p-4 bg-muted/20 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Complemento do Tribunal</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {movimentoEnriquecido.complemento}
              </p>
            </div>
          )}

          {/* Detalhe técnico (rodapé) */}
          <div className="p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-start gap-2">
              <Code className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">Detalhe técnico</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  {movimentoEnriquecido.codigo && (
                    <span className="text-xs text-muted-foreground font-mono">
                      código_cnj: {movimentoEnriquecido.codigo}
                    </span>
                  )}
                  {movimentoEnriquecido.tipo && (
                    <span className="text-xs text-muted-foreground font-mono">
                      tipo: {movimentoEnriquecido.tipo}
                    </span>
                  )}
                  {movimentoEnriquecido.nome && movimentoEnriquecido.nome !== movimentoEnriquecido.titulo_humano && (
                    <span className="text-xs text-muted-foreground font-mono">
                      nome_original: {movimentoEnriquecido.nome}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Informação sobre código CNJ */}
          {movimentoEnriquecido.codigo && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-start gap-2">
                <Hash className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-primary">Sobre o Código CNJ</p>
                  <p className="text-xs text-primary/80">
                    O código {movimentoEnriquecido.codigo} identifica este tipo de movimentação no sistema 
                    unificado do CNJ (Conselho Nacional de Justiça).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
