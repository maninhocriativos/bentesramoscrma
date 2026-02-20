import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useTarefas } from '@/hooks/useTarefas';
import { useAuth } from '@/hooks/useAuth';
import { Tarefa } from '@/types/tarefas';
import { CheckCircle2, RotateCcw, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AprovarTarefaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefa: Tarefa;
}

export function AprovarTarefaModal({ open, onOpenChange, tarefa }: AprovarTarefaModalProps) {
  const { updateTarefa } = useTarefas();
  const { user } = useAuth();
  const [nota, setNota] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAprovar = async () => {
    if (nota === 0) return;
    setSaving(true);
    await updateTarefa(tarefa.id, {
      aprovacao_status: 'aprovada',
      aprovacao_nota: nota,
      aprovacao_feedback: feedback || null,
      aprovado_por: user?.id || null,
      aprovado_em: new Date().toISOString(),
    });
    setSaving(false);
    onOpenChange(false);
  };

  const handleDevolver = async () => {
    if (!feedback.trim()) return;
    setSaving(true);
    await updateTarefa(tarefa.id, {
      aprovacao_status: 'devolvida',
      aprovacao_nota: nota || null,
      aprovacao_feedback: feedback,
      aprovado_por: user?.id || null,
      aprovado_em: new Date().toISOString(),
      status: 'Em Andamento',
      data_conclusao: null,
      entregue_em: null,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Revisar Entrega</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Tarefa</p>
            <p className="text-sm font-medium">{tarefa.titulo}</p>
          </div>

          {tarefa.entrega_texto && (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Entrega do Responsável</p>
              <p className="text-sm whitespace-pre-wrap">{tarefa.entrega_texto}</p>
              {tarefa.entregue_em && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Entregue em {new Date(tarefa.entregue_em).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Pontuação *</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setNota(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      "h-7 w-7 transition-colors",
                      star <= nota
                        ? 'fill-[hsl(var(--gold))] text-[hsl(var(--gold))]'
                        : 'text-muted-foreground/30'
                    )}
                  />
                </button>
              ))}
              {nota > 0 && (
                <span className="ml-2 text-sm text-muted-foreground self-center">
                  {nota}/5
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback {nota > 0 ? '' : ''}</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Deixe um comentário sobre a entrega..."
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDevolver}
              disabled={saving || !feedback.trim()}
              className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Devolver
            </Button>
            <Button
              onClick={handleAprovar}
              disabled={saving || nota === 0}
              className="flex-1"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Aprovar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
