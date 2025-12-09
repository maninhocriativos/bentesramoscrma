import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useTimesheet } from '@/hooks/useTarefas';
import { useAuth } from '@/hooks/useAuth';

export function TimesheetModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { createRegistro } = useTimesheet();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    await createRegistro({
      usuario_id: user?.id || '',
      descricao: formData.get('descricao') as string,
      data_atividade: formData.get('data') as string,
      duracao_minutos: Number(formData.get('duracao')) || 0,
      tipo_atividade: formData.get('tipo') as string || null,
      faturavel: true,
      hora_inicio: null,
      hora_fim: null,
      processo_id: null,
      tarefa_id: null,
      cliente_id: null,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar Horas</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Descrição</Label><Input name="descricao" required /></div>
          <div><Label>Data</Label><Input name="data" type="date" defaultValue={new Date().toISOString().split('T')[0]} required /></div>
          <div><Label>Duração (minutos)</Label><Input name="duracao" type="number" required /></div>
          <div><Label>Tipo de Atividade</Label><Input name="tipo" placeholder="Reunião, Pesquisa..." /></div>
          <Button type="submit" disabled={saving} className="w-full">{saving ? 'Salvando...' : 'Salvar'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
