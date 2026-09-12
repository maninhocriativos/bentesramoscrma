import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMemo, useState } from 'react';
import { useTimesheet } from '@/hooks/useTarefas';
import { useAuth } from '@/hooks/useAuth';
import { Tarefa, ehResponsavel } from '@/types/tarefas';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefas: Tarefa[];
}

// Vincula o registro a uma tarefa de verdade (pedido do usuário
// 2026-09-12: "quanto tempo as pessoas estão gastando" — antes o
// formulário só tinha um campo de texto livre, sem ligação nenhuma com
// as tarefas reais, então nada aparecia em nenhum relatório por tarefa).
export function TimesheetModal({ open, onOpenChange, tarefas }: Props) {
  const { createRegistro } = useTimesheet();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [tarefaId, setTarefaId] = useState<string>('avulso');

  const minhasTarefas = useMemo(
    () => tarefas
      .filter(t => ehResponsavel(t, user?.id) && t.status !== 'Cancelada')
      .sort((a, b) => (a.status === 'Concluída' ? 1 : 0) - (b.status === 'Concluída' ? 1 : 0)),
    [tarefas, user?.id]
  );

  const tarefaSelecionada = tarefaId !== 'avulso' ? tarefas.find(t => t.id === tarefaId) : null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    await createRegistro({
      usuario_id: user?.id || '',
      descricao: (formData.get('descricao') as string) || tarefaSelecionada?.titulo || '',
      data_atividade: formData.get('data') as string,
      duracao_minutos: Number(formData.get('duracao')) || 0,
      tipo_atividade: formData.get('tipo') as string || null,
      faturavel: true,
      hora_inicio: null,
      hora_fim: null,
      processo_id: tarefaSelecionada?.processo_id || null,
      tarefa_id: tarefaSelecionada?.id || null,
      cliente_id: tarefaSelecionada?.cliente_id || null,
    });
    setSaving(false);
    setTarefaId('avulso');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar Horas</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Tarefa</Label>
            <Select value={tarefaId} onValueChange={setTarefaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="avulso">Atividade avulsa (sem tarefa vinculada)</SelectItem>
                {minhasTarefas.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.titulo}{t.status === 'Concluída' ? ' (concluída)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição {tarefaSelecionada && <span className="text-muted-foreground font-normal">(opcional — usa o título da tarefa se vazio)</span>}</Label>
            <Input name="descricao" required={!tarefaSelecionada} placeholder={tarefaSelecionada?.titulo || undefined} />
          </div>
          <div><Label>Data</Label><Input name="data" type="date" defaultValue={new Date().toISOString().split('T')[0]} required /></div>
          <div><Label>Duração (minutos)</Label><Input name="duracao" type="number" required /></div>
          <div><Label>Tipo de Atividade</Label><Input name="tipo" placeholder="Reunião, Pesquisa..." /></div>
          <Button type="submit" disabled={saving} className="w-full">{saving ? 'Salvando...' : 'Salvar'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
