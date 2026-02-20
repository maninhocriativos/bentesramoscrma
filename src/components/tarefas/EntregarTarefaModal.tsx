import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useTarefas } from '@/hooks/useTarefas';
import { Tarefa } from '@/types/tarefas';
import { Send } from 'lucide-react';

interface EntregarTarefaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefa: Tarefa;
}

export function EntregarTarefaModal({ open, onOpenChange, tarefa }: EntregarTarefaModalProps) {
  const { updateTarefa } = useTarefas();
  const [entregaTexto, setEntregaTexto] = useState(tarefa.entrega_texto || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!entregaTexto.trim()) return;
    setSaving(true);
    await updateTarefa(tarefa.id, {
      entrega_texto: entregaTexto,
      entregue_em: new Date().toISOString(),
      aprovacao_status: 'aguardando_aprovacao',
      status: 'Concluída',
      data_conclusao: new Date().toISOString(),
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Entregar Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Tarefa</p>
            <p className="text-sm font-medium">{tarefa.titulo}</p>
            {tarefa.descricao && (
              <p className="text-xs text-muted-foreground mt-1">{tarefa.descricao}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="entrega">Descreva o que foi feito *</Label>
            <Textarea
              id="entrega"
              value={entregaTexto}
              onChange={(e) => setEntregaTexto(e.target.value)}
              placeholder="Descreva detalhadamente o que foi realizado nesta tarefa..."
              rows={5}
              className="resize-none"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={saving || !entregaTexto.trim()}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {saving ? 'Enviando...' : 'Enviar para Aprovação'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
