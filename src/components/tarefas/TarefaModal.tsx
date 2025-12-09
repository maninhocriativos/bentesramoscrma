import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useTarefas } from '@/hooks/useTarefas';

export function TarefaModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { createTarefa } = useTarefas();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    await createTarefa({
      titulo: formData.get('titulo') as string,
      descricao: formData.get('descricao') as string || null,
      prioridade: 'Media',
      status: 'Pendente',
      data_limite: formData.get('data_limite') as string || null,
      data_conclusao: null,
      responsavel_id: null,
      processo_id: null,
      cliente_id: null,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Título</Label><Input name="titulo" required /></div>
          <div><Label>Descrição</Label><Input name="descricao" /></div>
          <div><Label>Data Limite</Label><Input name="data_limite" type="date" /></div>
          <Button type="submit" disabled={saving} className="w-full">{saving ? 'Salvando...' : 'Salvar'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
