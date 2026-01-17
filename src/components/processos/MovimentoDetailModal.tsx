import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, Info, Hash, Clock } from 'lucide-react';

interface Movimento {
  dataHora: string;
  nome: string;
  complemento?: string;
  codigo?: number;
}

interface MovimentoDetailModalProps {
  movimento: Movimento | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MovimentoDetailModal({ movimento, isOpen, onClose }: MovimentoDetailModalProps) {
  if (!movimento) return null;

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
          {/* Nome da movimentação */}
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Movimentação</p>
            <p className="font-semibold text-lg">{movimento.nome}</p>
          </div>

          {/* Grid de informações */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Data/Hora</p>
              </div>
              <p className="font-medium text-sm">{movimento.dataHora}</p>
            </div>

            {movimento.codigo && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Código CNJ</p>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {movimento.codigo}
                </Badge>
              </div>
            )}
          </div>

          {/* Complemento/Descrição */}
          {movimento.complemento && (
            <div className="p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Complemento / Descrição</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {movimento.complemento}
              </p>
            </div>
          )}

          {/* Informação sobre código CNJ */}
          {movimento.codigo && (
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-blue-700">Sobre o Código CNJ</p>
                  <p className="text-xs text-blue-600/80">
                    O código {movimento.codigo} identifica este tipo de movimentação no sistema 
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
