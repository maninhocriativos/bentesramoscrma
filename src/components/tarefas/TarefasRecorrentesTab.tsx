import { useState, useMemo } from 'react';
import { useTarefasRecorrentes } from '@/hooks/useTarefasRecorrentes';
import { useMembrosEquipe, nomeMembro } from '@/components/shared/ResponsaveisSelect';
import { usePerfil } from '@/hooks/usePerfil';
import { TarefaRecorrente, descreverRecorrencia } from '@/types/tarefasRecorrentes';
import { TarefaRecorrenteModal } from './TarefaRecorrenteModal';
import { Repeat, Plus, Pause, Play, Pencil, Trash2, Loader2 } from 'lucide-react';

const BROWN = '#3d2b1f';
const GOLD  = '#c9a96e';

const PRIORIDADE_COLOR: Record<string, string> = {
  Baixa: '#9ca3af', Media: '#3b82f6', Alta: '#f59e0b', Urgente: '#dc2626',
};

export function TarefasRecorrentesTab() {
  const { recorrentes, loading, toggleAtiva, deleteRecorrente } = useTarefasRecorrentes();
  const membros = useMembrosEquipe();
  const { isAdmin } = usePerfil();
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<TarefaRecorrente | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const membroPorId = useMemo(() => new Map(membros.map(m => [m.id, m])), [membros]);

  const abrirNova = () => { setEditando(null); setModalOpen(true); };
  const abrirEdicao = (rec: TarefaRecorrente) => { setEditando(rec); setModalOpen(true); };

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir esta tarefa recorrente? As tarefas já geradas por ela continuam existindo — só a série é apagada.')) return;
    setExcluindoId(id);
    await deleteRecorrente(id);
    setExcluindoId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {recorrentes.length} recorrência{recorrentes.length !== 1 ? 's' : ''} cadastrada{recorrentes.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={abrirNova}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
          style={{ background: BROWN, color: GOLD }}>
          <Plus className="h-3.5 w-3.5" />
          Nova Recorrente
        </button>
      </div>

      {recorrentes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center" style={{ color: '#9ca3af' }}>
          <Repeat className="h-8 w-8" />
          <p className="text-sm">Nenhuma tarefa recorrente cadastrada ainda.</p>
          <p className="text-xs">Ex.: "toda segunda-feira, revisar processos novos" — cria sozinha, toda semana.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recorrentes.map(rec => (
            <div key={rec.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: '#fff', border: `1px solid ${GOLD}25`, opacity: rec.ativa ? 1 : 0.55 }}>
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${GOLD}18` }}>
                <Repeat className="h-4 w-4" style={{ color: BROWN }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate" style={{ color: BROWN }}>{rec.titulo}</p>
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: PRIORIDADE_COLOR[rec.prioridade] }} />
                  {!rec.ativa && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                      Pausada
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {descreverRecorrencia(rec)}
                  {rec.horario ? ` às ${rec.horario.slice(0, 5)}` : ''}
                  {' · '}
                  {rec.responsaveis_ids.map(id => nomeMembro(membroPorId.get(id))).join(', ') || 'sem responsável'}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleAtiva(rec.id, !rec.ativa)}
                  title={rec.ativa ? 'Pausar' : 'Retomar'}
                  className="h-8 w-8 rounded-lg flex items-center justify-center transition-all hover:opacity-70"
                  style={{ background: `${GOLD}12` }}>
                  {rec.ativa ? <Pause className="h-3.5 w-3.5" style={{ color: BROWN }} /> : <Play className="h-3.5 w-3.5" style={{ color: BROWN }} />}
                </button>
                <button
                  onClick={() => abrirEdicao(rec)}
                  title="Editar"
                  className="h-8 w-8 rounded-lg flex items-center justify-center transition-all hover:opacity-70"
                  style={{ background: `${GOLD}12` }}>
                  <Pencil className="h-3.5 w-3.5" style={{ color: BROWN }} />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleExcluir(rec.id)}
                    disabled={excluindoId === rec.id}
                    title="Excluir série"
                    className="h-8 w-8 rounded-lg flex items-center justify-center transition-all hover:opacity-70 disabled:opacity-40"
                    style={{ background: '#fef2f2' }}>
                    <Trash2 className="h-3.5 w-3.5" style={{ color: '#dc2626' }} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TarefaRecorrenteModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        recorrente={editando}
      />
    </div>
  );
}
