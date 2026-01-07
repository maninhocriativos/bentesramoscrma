import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useTarefas } from '@/hooks/useTarefas';

interface TarefaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TarefaModal({ open, onOpenChange }: TarefaModalProps) {
  const { createTarefa } = useTarefas();
  const [saving, setSaving] = useState(false);
  const [prioridade, setPrioridade] = useState<'Baixa' | 'Media' | 'Alta' | 'Urgente'>('Media');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    
    await createTarefa({
      titulo: formData.get('titulo') as string,
      descricao: formData.get('descricao') as string || null,
      prioridade,
      status: 'Pendente',
      data_limite: formData.get('data_limite') as string || null,
      data_conclusao: null,
      responsavel_id: null,
      processo_id: null,
      cliente_id: null,
    });
    
    setSaving(false);
    setPrioridade('Media');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" name="titulo" required placeholder="Digite o título da tarefa" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" name="descricao" placeholder="Descreva a tarefa..." rows={3} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as typeof prioridade)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Media">Média</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="data_limite">Data Limite</Label>
              <Input id="data_limite" name="data_limite" type="date" />
            </div>
          </div>
          
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Criar Tarefa'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
