import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { useTarefas } from '@/hooks/useTarefas';
import { Tarefa } from '@/types/tarefas';
import { supabase } from '@/integrations/supabase/client';
import { Trash2 } from 'lucide-react';

interface TeamMember {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  email: string | null;
}

interface TarefaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefa?: Tarefa | null;
  onDelete?: (id: string) => Promise<boolean>;
}

export function TarefaModal({ open, onOpenChange, tarefa, onDelete }: TarefaModalProps) {
  const { createTarefa, updateTarefa } = useTarefas();
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<'Baixa' | 'Media' | 'Alta' | 'Urgente'>('Media');
  const [status, setStatus] = useState<'Pendente' | 'Em Andamento' | 'Concluída' | 'Cancelada'>('Pendente');
  const [responsavelId, setResponsavelId] = useState<string>('none');
  const [dataLimite, setDataLimite] = useState('');
  const [prazoSeguranca, setPrazoSeguranca] = useState('');
  const [prazoFatal, setPrazoFatal] = useState('');
  const [horario, setHorario] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);

  const isEditing = !!tarefa;

  useEffect(() => {
    if (open && tarefa) {
      setTitulo(tarefa.titulo);
      setDescricao(tarefa.descricao || '');
      setPrioridade(tarefa.prioridade);
      setStatus(tarefa.status);
      setResponsavelId(tarefa.responsavel_id || 'none');
      setDataLimite(tarefa.data_limite || '');
      setPrazoSeguranca(tarefa.prazo_seguranca || '');
      setPrazoFatal(tarefa.prazo_fatal || '');
      setHorario(tarefa.horario?.slice(0, 5) || '');
    } else if (open && !tarefa) {
      setTitulo('');
      setDescricao('');
      setPrioridade('Media');
      setStatus('Pendente');
      setResponsavelId('none');
      setDataLimite('');
      setPrazoSeguranca('');
      setPrazoFatal('');
      setHorario('');
    }
  }, [open, tarefa]);

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

    const payload = {
      titulo,
      descricao: descricao || null,
      prioridade,
      status,
      data_limite: prazoFatal || dataLimite || null,
      prazo_seguranca: prazoSeguranca || null,
      prazo_fatal: prazoFatal || dataLimite || null,
      horario: horario || null,
      responsavel_id: responsavelId !== 'none' ? responsavelId : null,
    };

    if (isEditing && tarefa) {
      await updateTarefa(tarefa.id, {
        ...payload,
        data_conclusao: status === 'Concluída' ? new Date().toISOString() : null,
      });
    } else {
      await createTarefa({
        ...payload,
        data_conclusao: null,
        processo_id: null,
        cliente_id: null,
        entrega_texto: null,
        entrega_anexo_url: null,
        entregue_em: null,
        aprovacao_status: null,
        aprovacao_nota: null,
        aprovacao_feedback: null,
        aprovado_por: null,
        aprovado_em: null,
      });
    }

    setSaving(false);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!tarefa || !onDelete) return;
    setSaving(true);
    await onDelete(tarefa.id);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" value={titulo} onChange={e => setTitulo(e.target.value)} required placeholder="Digite o título da tarefa" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva a tarefa..." rows={3} />
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
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Concluída">Concluída</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prazo_seguranca">Prazo de Segurança</Label>
              <Input id="prazo_seguranca" type="date" value={prazoSeguranca} onChange={e => setPrazoSeguranca(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prazo_fatal">Prazo Fatal</Label>
              <Input id="prazo_fatal" type="date" value={prazoFatal} onChange={e => { setPrazoFatal(e.target.value); setDataLimite(e.target.value); }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horario">Horário</Label>
              <Input id="horario" type="time" value={horario} onChange={e => setHorario(e.target.value)} />
            </div>
          </div>
          
          <div className="flex gap-2">
            {isEditing && onDelete && (
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            )}
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Tarefa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
