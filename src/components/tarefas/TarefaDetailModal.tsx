import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tarefa } from '@/types/tarefas';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { useTarefas } from '@/hooks/useTarefas';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Calendar, User, Clock, CheckCircle2, RotateCcw, Star, Send, Play, Pencil } from 'lucide-react';
import { EntregarTarefaModal } from './EntregarTarefaModal';
import { AprovarTarefaModal } from './AprovarTarefaModal';
import { supabase } from '@/integrations/supabase/client';

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Urgente: { label: '🔴 Urgente', color: 'text-destructive', bg: 'bg-destructive/10' },
  Alta: { label: 'Alta', color: 'text-primary', bg: 'bg-primary/10' },
  Media: { label: 'Média', color: 'text-[hsl(var(--gold))]', bg: 'bg-[hsl(var(--gold))]/10' },
  Baixa: { label: 'Baixa', color: 'text-muted-foreground', bg: 'bg-muted' },
};

interface TarefaDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefa: Tarefa | null;
  onEdit?: (tarefa: Tarefa) => void;
}

export function TarefaDetailModal({ open, onOpenChange, tarefa, onEdit }: TarefaDetailModalProps) {
  const { user } = useAuth();
  const { canAccessSettings: isManager } = usePerfil();
  const { updateTarefa } = useTarefas();
  const [entregarModal, setEntregarModal] = useState<Tarefa | null>(null);
  const [aprovarModal, setAprovarModal] = useState<Tarefa | null>(null);
  const [responsavelNome, setResponsavelNome] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!tarefa?.responsavel_id) { setResponsavelNome(null); return; }
    supabase.from('perfis').select('nome, sobrenome').eq('id', tarefa.responsavel_id).single()
      .then(({ data }) => {
        if (data) setResponsavelNome([data.nome, data.sobrenome].filter(Boolean).join(' ') || 'Usuário');
      });
  }, [tarefa?.responsavel_id]);

  if (!tarefa) return null;

  const config = PRIORIDADE_CONFIG[tarefa.prioridade] || PRIORIDADE_CONFIG.Media;
  const isMyTask = user?.id === tarefa.responsavel_id;
  const canStart = isMyTask && tarefa.status === 'Pendente';
  const canDeliver = isMyTask && tarefa.status === 'Em Andamento' && !tarefa.aprovacao_status;
  const canResubmit = isMyTask && tarefa.aprovacao_status === 'devolvida';
  const canApprove = isManager && tarefa.aprovacao_status === 'aguardando_aprovacao';

  const handleStart = async () => {
    setStarting(true);
    await updateTarefa(tarefa.id, { status: 'Em Andamento' });
    setStarting(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open && !entregarModal && !aprovarModal} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className={cn(
                "w-2.5 h-2.5 rounded-full shrink-0",
                tarefa.prioridade === 'Urgente' && 'bg-destructive',
                tarefa.prioridade === 'Alta' && 'bg-primary',
                tarefa.prioridade === 'Media' && 'bg-[hsl(var(--gold))]',
                tarefa.prioridade === 'Baixa' && 'bg-muted-foreground',
              )} />
              {tarefa.titulo}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Status</p>
                <Badge variant="secondary" className="text-xs">{tarefa.status}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Prioridade</p>
                <Badge className={cn("text-xs", config.bg, config.color)}>{config.label}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Responsável</p>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{responsavelNome || 'Não atribuído'}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Prazo Segurança</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">
                    {tarefa.prazo_seguranca
                      ? new Date(tarefa.prazo_seguranca).toLocaleDateString('pt-BR')
                      : 'Sem prazo'}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Prazo Fatal</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">
                    {(tarefa.prazo_fatal || tarefa.data_limite)
                      ? new Date(tarefa.prazo_fatal || tarefa.data_limite!).toLocaleDateString('pt-BR')
                      : 'Sem prazo'}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Horário</p>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{tarefa.horario ? tarefa.horario.slice(0, 5) : 'Sem horário'}</span>
                </div>
              </div>
            </div>

            {tarefa.descricao && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Descrição</p>
                <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3">{tarefa.descricao}</p>
              </div>
            )}

            {/* Approval status */}
            {tarefa.aprovacao_status && (
              <div className={cn(
                "rounded-lg p-3 border",
                tarefa.aprovacao_status === 'aguardando_aprovacao' && 'bg-[hsl(var(--gold))]/10 border-[hsl(var(--gold))]/30',
                tarefa.aprovacao_status === 'aprovada' && 'bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30',
                tarefa.aprovacao_status === 'devolvida' && 'bg-destructive/10 border-destructive/30',
              )}>
                <div className="flex items-center gap-2 mb-1">
                  {tarefa.aprovacao_status === 'aguardando_aprovacao' && <Clock className="h-3.5 w-3.5 text-[hsl(var(--gold))]" />}
                  {tarefa.aprovacao_status === 'aprovada' && <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))]" />}
                  {tarefa.aprovacao_status === 'devolvida' && <RotateCcw className="h-3.5 w-3.5 text-destructive" />}
                  <span className="text-xs font-medium">
                    {tarefa.aprovacao_status === 'aguardando_aprovacao' && 'Aguardando Aprovação'}
                    {tarefa.aprovacao_status === 'aprovada' && 'Aprovada'}
                    {tarefa.aprovacao_status === 'devolvida' && 'Devolvida para Correção'}
                  </span>
                  {tarefa.aprovacao_nota && (
                    <div className="flex items-center gap-0.5 ml-auto">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={cn("h-3 w-3", s <= tarefa.aprovacao_nota! ? 'fill-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'text-muted-foreground/20')} />
                      ))}
                    </div>
                  )}
                </div>
                {tarefa.aprovacao_feedback && (
                  <p className="text-xs text-muted-foreground mt-1">{tarefa.aprovacao_feedback}</p>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              {canStart && (
                <Button className="flex-1" onClick={handleStart} disabled={starting}>
                  <Play className="h-4 w-4 mr-2" />
                  {starting ? 'Iniciando...' : 'Iniciar Tarefa'}
                </Button>
              )}
              {(canDeliver || canResubmit) && (
                <Button className="flex-1" onClick={() => { onOpenChange(false); setEntregarModal(tarefa); }}>
                  <Send className="h-4 w-4 mr-2" />
                  {canResubmit ? 'Reenviar Entrega' : 'Entregar Tarefa'}
                </Button>
              )}
              {canApprove && (
                <Button className="flex-1" variant="outline" onClick={() => { onOpenChange(false); setAprovarModal(tarefa); }}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Revisar Entrega
                </Button>
              )}
              {isManager && onEdit && (
                <Button variant="ghost" size="icon" onClick={() => { onOpenChange(false); onEdit(tarefa); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {entregarModal && (
        <EntregarTarefaModal open={!!entregarModal} onOpenChange={(o) => !o && setEntregarModal(null)} tarefa={entregarModal} />
      )}
      {aprovarModal && (
        <AprovarTarefaModal open={!!aprovarModal} onOpenChange={(o) => !o && setAprovarModal(null)} tarefa={aprovarModal} />
      )}
    </>
  );
}
