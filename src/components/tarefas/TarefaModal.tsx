import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { useTarefas } from '@/hooks/useTarefas';
import { supabase } from '@/integrations/supabase/client';

interface TeamMember {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  email: string | null;
}

interface TarefaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TarefaModal({ open, onOpenChange }: TarefaModalProps) {
  const { createTarefa } = useTarefas();
  const [saving, setSaving] = useState(false);
  const [prioridade, setPrioridade] = useState<'Baixa' | 'Media' | 'Alta' | 'Urgente'>('Media');
  const [responsavelId, setResponsavelId] = useState<string>('none');
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('perfis')
        .select('id, nome, sobrenome, email')
        .eq('aprovado', true);
      if (data) setMembers(data);
    };
    if (open) fetchMembers();
  }, [open]);

  const getMemberName = (m: TeamMember) => {
    const name = [m.nome, m.sobrenome].filter(Boolean).join(' ');
    return name || m.email || 'Usuário';
  };

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
      responsavel_id: responsavelId !== 'none' ? responsavelId : null,
      processo_id: null,
      cliente_id: null,
    });
    
    setSaving(false);
    setPrioridade('Media');
    setResponsavelId('none');
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

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {getMemberName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  <SelectItem value="Urgente">🔴 Urgente</SelectItem>
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
