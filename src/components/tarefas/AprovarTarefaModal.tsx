import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useState } from 'react';
import { useTarefas } from '@/hooks/useTarefas';
import { useAuth } from '@/hooks/useAuth';
import { Tarefa } from '@/types/tarefas';
import { CheckCircle2, RotateCcw, Star, X } from 'lucide-react';

const BROWN  = '#3d2b1f';
const GOLD   = '#c9a96e';
const GOLD_D = '#b8922a';

interface AprovarTarefaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefa: Tarefa;
  onSuccess?: () => void;
}

export function AprovarTarefaModal({ open, onOpenChange, tarefa, onSuccess }: AprovarTarefaModalProps) {
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
    onSuccess?.();
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
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="p-0 overflow-hidden"
        style={{
          maxWidth: 480,
          width: 'calc(100vw - 32px)',
          border: `1px solid ${GOLD}40`,
          borderRadius: 20,
          boxShadow: `0 24px 64px rgba(0,0,0,0.18), 0 4px 16px ${GOLD}15`,
        }}
      >
        {/* Barra dourada no topo */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${BROWN}, ${GOLD})` }} />

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3"
          style={{ borderBottom: `0.5px solid ${GOLD}20` }}>
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${GOLD}18` }}>
            <CheckCircle2 style={{ width: 14, height: 14, color: GOLD_D }} />
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: BROWN, flex: 1 }}>Revisar Entrega</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:opacity-70"
            style={{ background: `${BROWN}08` }}>
            <X style={{ width: 14, height: 14, color: '#6b7280' }} />
          </button>
        </div>

        {/* Corpo */}
        <div className="px-5 py-4 space-y-4">

          {/* Tarefa */}
          <div className="rounded-xl p-3" style={{ background: `${BROWN}05`, border: `0.5px solid ${GOLD}20` }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
              Tarefa
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1c1917' }}>{tarefa.titulo}</p>
          </div>

          {/* Entrega */}
          {tarefa.entrega_texto && (
            <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: `0.5px solid ${GOLD}25` }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                Entrega do Responsável
              </p>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {tarefa.entrega_texto}
              </p>
              {tarefa.entregue_em && (
                <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>
                  Entregue em {new Date(tarefa.entregue_em).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          )}

          {/* Pontuação */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Pontuação *
            </p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setNota(star)}
                  className="transition-transform hover:scale-110 p-0.5"
                >
                  <Star style={{
                    width: 28, height: 28,
                    color: star <= nota ? GOLD : '#d1d5db',
                    fill: star <= nota ? GOLD : 'transparent',
                    transition: 'all 0.15s',
                  }} />
                </button>
              ))}
              {nota > 0 && (
                <span style={{ fontSize: 12, color: GOLD_D, fontWeight: 700, marginLeft: 8 }}>{nota}/5</span>
              )}
            </div>
          </div>

          {/* Feedback */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Feedback
            </p>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Deixe um comentário sobre a entrega..."
              rows={3}
              style={{
                width: '100%', borderRadius: 10, border: `1px solid ${GOLD}35`,
                padding: '10px 12px', fontSize: 13, outline: 'none',
                background: '#faf9f7', color: '#1c1917', resize: 'vertical',
                lineHeight: 1.5, boxSizing: 'border-box' as const,
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={handleDevolver}
            disabled={saving || !feedback.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all hover:opacity-80 disabled:opacity-40"
            style={{ background: '#fef2f2', color: '#dc2626', fontSize: 13, border: '0.5px solid rgba(220,38,38,0.25)' }}>
            <RotateCcw style={{ width: 13, height: 13 }} />
            Devolver
          </button>
          <button
            onClick={handleAprovar}
            disabled={saving || nota === 0}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: BROWN, color: GOLD, fontSize: 13 }}>
            <CheckCircle2 style={{ width: 13, height: 13 }} />
            {saving ? 'Salvando...' : 'Aprovar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
