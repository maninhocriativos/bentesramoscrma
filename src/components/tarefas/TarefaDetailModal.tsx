import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tarefa } from '@/types/tarefas';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { useTarefas } from '@/hooks/useTarefas';
import { useState, useEffect } from 'react';
import {
  Calendar, User, Clock, CheckCircle2, RotateCcw,
  Star, Send, Play, Pencil, X, AlertTriangle,
} from 'lucide-react';
import { EntregarTarefaModal } from './EntregarTarefaModal';
import { AprovarTarefaModal } from './AprovarTarefaModal';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BROWN  = '#3d2b1f';
const GOLD   = '#c9a96e';
const GOLD_D = '#b8922a';

const PRIO_CFG: Record<string, { label: string; dot: string; bg: string; text: string; bar: string }> = {
  Urgente: { label: 'Urgente',  dot: '#dc2626', bg: '#fef2f2', text: '#dc2626', bar: '#dc2626' },
  Alta:    { label: 'Alta',     dot: GOLD,      bg: `${GOLD}15`, text: GOLD_D,   bar: GOLD },
  Media:   { label: 'Média',    dot: BROWN,     bg: `${BROWN}10`, text: BROWN,   bar: BROWN },
  Baixa:   { label: 'Baixa',   dot: '#94a3b8', bg: '#f1f5f9', text: '#64748b', bar: '#94a3b8' },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  'Pendente':     { label: 'Pendente',     color: '#d97706', bg: 'rgba(245,158,11,0.1)' },
  'Em Andamento': { label: 'Em Andamento', color: '#2563eb', bg: 'rgba(59,130,246,0.1)' },
  'Concluída':    { label: 'Concluída',    color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  'Cancelada':    { label: 'Cancelada',    color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

const APROV_CFG: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  aguardando_aprovacao: { label: 'Aguardando Aprovação', icon: Clock,        color: GOLD_D,    bg: `${GOLD}12`,           border: `${GOLD}30` },
  aprovada:             { label: 'Aprovada',             icon: CheckCircle2, color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.25)' },
  devolvida:            { label: 'Devolvida para Correção', icon: RotateCcw, color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.25)' },
};

function fmtDate(iso: string | null) {
  if (!iso) return 'Sem prazo';
  try { return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return iso; }
}

interface TarefaDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefa: Tarefa | null;
  onEdit?: (tarefa: Tarefa) => void;
  onSuccess?: () => void;
}

export function TarefaDetailModal({ open, onOpenChange, tarefa, onEdit, onSuccess }: TarefaDetailModalProps) {
  const { user } = useAuth();
  const { canAccessSettings: isManager } = usePerfil();
  const { updateTarefa } = useTarefas();
  const [entregarModal, setEntregarModal] = useState<Tarefa | null>(null);
  const [aprovarModal, setAprovarModal]   = useState<Tarefa | null>(null);
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

  const prio     = PRIO_CFG[tarefa.prioridade] || PRIO_CFG.Baixa;
  const statusCfg = STATUS_CFG[tarefa.status] || STATUS_CFG['Pendente'];
  const aprov    = tarefa.aprovacao_status ? APROV_CFG[tarefa.aprovacao_status] : null;

  const isMyTask    = user?.id === tarefa.responsavel_id;
  const canStart    = (isMyTask || isManager) && tarefa.status === 'Pendente';
  const canDeliver  = (isMyTask || isManager) && tarefa.status === 'Em Andamento' && !tarefa.aprovacao_status;
  const canResubmit = (isMyTask || isManager) && tarefa.aprovacao_status === 'devolvida';
  const canApprove  = isManager && tarefa.aprovacao_status === 'aguardando_aprovacao';

  const handleStart = async () => {
    setStarting(true);
    await updateTarefa(tarefa.id, { status: 'Em Andamento' });
    setStarting(false);
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <>
      <Dialog open={open && !entregarModal && !aprovarModal} onOpenChange={onOpenChange}>
        <DialogContent
          hideCloseButton
          className="p-0 overflow-hidden"
          style={{
            maxWidth: 520,
            width: 'calc(100vw - 32px)',
            border: `1px solid ${GOLD}40`,
            borderRadius: 20,
            boxShadow: `0 24px 64px rgba(0,0,0,0.18), 0 4px 16px ${GOLD}15`,
          }}
        >
          {/* ── Barra de prioridade ── */}
          <div style={{ height: 4, background: prio.bar }} />

          {/* ── Header ── */}
          <div className="flex items-start gap-3 px-5 pt-4 pb-3"
            style={{ borderBottom: `0.5px solid ${GOLD}20` }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                  background: prio.bg, color: prio.text, border: `0.5px solid ${prio.dot}30`,
                  flexShrink: 0,
                }}>
                  {prio.label}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                  background: statusCfg.bg, color: statusCfg.color,
                  flexShrink: 0,
                }}>
                  {statusCfg.label}
                </span>
              </div>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1c1917', lineHeight: 1.35 }}>
                {tarefa.titulo}
              </h2>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isManager && onEdit && (
                <button
                  onClick={() => { onOpenChange(false); onEdit(tarefa); }}
                  className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:opacity-70"
                  style={{ background: `${GOLD}15` }}>
                  <Pencil style={{ width: 13, height: 13, color: GOLD_D }} />
                </button>
              )}
              <button
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:opacity-70"
                style={{ background: `${BROWN}08` }}>
                <X style={{ width: 14, height: 14, color: '#6b7280' }} />
              </button>
            </div>
          </div>

          {/* ── Corpo ── */}
          <div className="px-5 py-4 space-y-4">

            {/* Grid de info */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <InfoRow icon={User} label="Responsável" value={responsavelNome || 'Não atribuído'} />
              <InfoRow icon={AlertTriangle} label="Prioridade" value={prio.label} accent={prio.dot} />
              <InfoRow icon={Calendar} label="Prazo Fatal"
                value={fmtDate(tarefa.prazo_fatal || tarefa.data_limite)}
                alert={!!(tarefa.prazo_fatal || tarefa.data_limite)} />
              <InfoRow icon={Calendar} label="Prazo Segurança"
                value={fmtDate(tarefa.prazo_seguranca)} />
              <InfoRow icon={Clock} label="Horário"
                value={tarefa.horario ? tarefa.horario.slice(0, 5) : 'Sem horário'} />
              {tarefa.data_conclusao && (
                <InfoRow icon={CheckCircle2} label="Concluída em"
                  value={fmtDate(tarefa.data_conclusao)} accent="#16a34a" />
              )}
            </div>

            {/* Descrição */}
            {tarefa.descricao && (
              <div className="rounded-xl p-3" style={{ background: `${BROWN}05`, border: `0.5px solid ${GOLD}20` }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Descrição
                </p>
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.55 }}>{tarefa.descricao}</p>
              </div>
            )}

            {/* Status de aprovação */}
            {aprov && (
              <div className="rounded-xl p-3"
                style={{ background: aprov.bg, border: `0.5px solid ${aprov.border}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <aprov.icon style={{ width: 13, height: 13, color: aprov.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: aprov.color }}>{aprov.label}</span>
                  {tarefa.aprovacao_nota && (
                    <div className="flex items-center gap-0.5 ml-auto">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} style={{
                          width: 11, height: 11,
                          color: s <= tarefa.aprovacao_nota! ? GOLD : '#e5e7eb',
                          fill: s <= tarefa.aprovacao_nota! ? GOLD : 'transparent',
                        }} />
                      ))}
                    </div>
                  )}
                </div>
                {tarefa.aprovacao_feedback && (
                  <p style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{tarefa.aprovacao_feedback}</p>
                )}
              </div>
            )}
          </div>

          {/* ── Botões ── */}
          {(canStart || canDeliver || canResubmit || canApprove) && (
            <div className="px-5 pb-5">
              <div className="flex gap-2">
                {canStart && (
                  <button
                    onClick={handleStart}
                    disabled={starting}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: BROWN, color: GOLD, fontSize: 13 }}>
                    <Play style={{ width: 14, height: 14 }} />
                    {starting ? 'Iniciando...' : 'Iniciar Tarefa'}
                  </button>
                )}
                {(canDeliver || canResubmit) && (
                  <button
                    onClick={() => { onOpenChange(false); setEntregarModal(tarefa); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all hover:opacity-90"
                    style={{ background: BROWN, color: GOLD, fontSize: 13 }}>
                    <Send style={{ width: 14, height: 14 }} />
                    {canResubmit ? 'Reenviar Entrega' : 'Entregar Tarefa'}
                  </button>
                )}
                {canApprove && (
                  <button
                    onClick={() => { onOpenChange(false); setAprovarModal(tarefa); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all hover:opacity-90"
                    style={{ background: `${GOLD}20`, color: GOLD_D, border: `1px solid ${GOLD}40`, fontSize: 13 }}>
                    <CheckCircle2 style={{ width: 14, height: 14 }} />
                    Revisar Entrega
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {entregarModal && (
        <EntregarTarefaModal
          open={!!entregarModal}
          onOpenChange={(o) => !o && setEntregarModal(null)}
          tarefa={entregarModal}
        />
      )}
      {aprovarModal && (
        <AprovarTarefaModal
          open={!!aprovarModal}
          onOpenChange={(o) => !o && setAprovarModal(null)}
          tarefa={aprovarModal}
        />
      )}
    </>
  );
}

// ── Componente auxiliar de linha de info ─────────────────────────────────────
function InfoRow({ icon: Icon, label, value, accent, alert }: {
  icon: any; label: string; value: string; accent?: string; alert?: boolean;
}) {
  return (
    <div>
      <p style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
        {label}
      </p>
      <div className="flex items-center gap-1.5">
        <Icon style={{ width: 12, height: 12, color: accent || (alert ? '#dc2626' : '#9ca3af'), flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: accent || (alert ? '#dc2626' : '#374151') }}>
          {value}
        </span>
      </div>
    </div>
  );
}
