import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const MOTIVOS_RAPIDOS = [
  'Não respondeu mais',
  'Não tem caso elegível',
  'Fora do prazo (prescrição)',
  'Escolheu outro escritório',
  'Desistiu do processo',
  'Valor não compensa',
  'Duplicado / spam',
];

interface LeadPerdidoDialogProps {
  open: boolean;
  leadNome: string | null;
  loading?: boolean;
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
}

// Motivo obrigatório ao marcar um lead como Perdido — sem isso, a mudança de
// etapa ficava sem nenhum rastro na aba Histórico do lead (só o drag-and-drop
// simples do Kanban rodava, sem registrar nada). Mesmas opções rápidas já
// usadas no botão "Lead Perdido" do ChatInbox, num componente reutilizável.
export function LeadPerdidoDialog({ open, leadNome, loading = false, onConfirm, onCancel }: LeadPerdidoDialogProps) {
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (open) setMotivo('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="text-lg">❌</span> Marcar como Perdido
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {leadNome && <p className="text-sm text-muted-foreground">{leadNome} será movido pra <span className="font-semibold text-destructive">Perdido</span>.</p>}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">Motivo da perda <span className="text-destructive">*</span></p>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS_RAPIDOS.map(opcao => (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => setMotivo(opcao)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    motivo === opcao
                      ? 'bg-destructive text-destructive-foreground border-destructive'
                      : 'bg-muted/50 text-muted-foreground border-border hover:border-destructive/40 hover:text-destructive'
                  }`}
                >
                  {opcao}
                </button>
              ))}
            </div>
            <Textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Descreva o motivo (obrigatório)..."
              className="text-sm rounded-lg min-h-[64px] resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onCancel} disabled={loading} className="rounded-xl">Cancelar</Button>
          <Button
            onClick={() => onConfirm(motivo.trim())}
            disabled={loading || !motivo.trim()}
            className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Confirmar Perdido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
