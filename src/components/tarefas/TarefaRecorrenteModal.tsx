import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTarefasRecorrentes } from '@/hooks/useTarefasRecorrentes';
import { Tarefa, TipoTarefa, TIPOS_TAREFA, inferirTipoTarefa } from '@/types/tarefas';
import { TarefaRecorrente, FrequenciaRecorrencia, DIAS_SEMANA_LABELS } from '@/types/tarefasRecorrentes';
import { ResponsaveisSelect } from '@/components/shared/ResponsaveisSelect';
import { TituloTarefaCombobox } from '@/components/shared/TituloTarefaCombobox';
import { Repeat, X, Plus, Save } from 'lucide-react';

const BROWN  = '#3d2b1f';
const GOLD   = '#c9a96e';
const GOLD_D = '#b8922a';

interface TarefaRecorrenteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recorrente?: TarefaRecorrente | null;
  onSuccess?: () => void;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

const inputStyle: { [key: string]: string | number } = {
  width: '100%', height: 38, borderRadius: 10,
  border: `1px solid ${GOLD}35`, padding: '0 12px',
  fontSize: 13, outline: 'none', background: '#faf9f7',
  color: '#1c1917', boxSizing: 'border-box',
};
const inputFocusClass = 'focus:border-[#c9a96e] focus:ring-0';

export function TarefaRecorrenteModal({ open, onOpenChange, recorrente, onSuccess }: TarefaRecorrenteModalProps) {
  const { user } = useAuth();
  const { createRecorrente, updateRecorrente } = useTarefasRecorrentes();
  const isEditing = !!recorrente;

  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo]         = useState(recorrente?.titulo || '');
  const [tipo, setTipo]             = useState<TipoTarefa>(recorrente?.tipo || 'Tarefa');
  const [descricao, setDescricao]   = useState(recorrente?.descricao || '');
  const [prioridade, setPrioridade] = useState<Tarefa['prioridade']>(recorrente?.prioridade || 'Media');
  const [responsaveisIds, setResponsaveisIds] = useState<string[]>(recorrente?.responsaveis_ids || []);
  const [frequencia, setFrequencia] = useState<FrequenciaRecorrencia>(recorrente?.frequencia || 'semanal');
  const [diasSemana, setDiasSemana] = useState<number[]>(recorrente?.dias_semana || []);
  const [diaMes, setDiaMes]         = useState<number>(recorrente?.dia_mes || 1);
  const [horario, setHorario]       = useState(recorrente?.horario || '');

  const escolherTitulo = (t: string) => {
    setTitulo(t);
    setTipo(inferirTipoTarefa(t, tipo));
  };

  const toggleDiaSemana = (d: number) => {
    setDiasSemana(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b));
  };

  const podeSalvar = titulo.trim() && responsaveisIds.length > 0
    && (frequencia !== 'semanal' || diasSemana.length > 0)
    && (frequencia !== 'mensal' || (diaMes >= 1 && diaMes <= 31));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeSalvar) return;
    setSaving(true);

    const payload = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      tipo,
      prioridade,
      responsaveis_ids: responsaveisIds,
      processo_id: null,
      cliente_id: null,
      frequencia,
      dias_semana: frequencia === 'semanal' ? diasSemana : null,
      dia_mes: frequencia === 'mensal' ? diaMes : null,
      horario: horario || null,
      ativa: recorrente?.ativa ?? true,
      created_by: recorrente?.created_by ?? (user?.id || null),
    };

    if (isEditing && recorrente) {
      await updateRecorrente(recorrente.id, payload);
    } else {
      await createRecorrente(payload);
    }
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
          maxWidth: 500,
          width: 'calc(100vw - 32px)',
          border: `1px solid ${GOLD}40`,
          borderRadius: 20,
          boxShadow: `0 24px 64px rgba(0,0,0,0.18), 0 4px 16px ${GOLD}15`,
        }}
      >
        <div style={{ height: 4, background: `linear-gradient(90deg, ${BROWN}, ${GOLD})` }} />

        <div className="flex items-center gap-3 px-5 pt-4 pb-3" style={{ borderBottom: `0.5px solid ${GOLD}20` }}>
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${GOLD}18` }}>
            {isEditing ? <Save style={{ width: 14, height: 14, color: GOLD_D }} /> : <Repeat style={{ width: 14, height: 14, color: GOLD_D }} />}
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: BROWN, flex: 1 }}>
            {isEditing ? 'Editar Tarefa Recorrente' : 'Nova Tarefa Recorrente'}
          </h2>
          <button type="button" onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:opacity-70"
            style={{ background: `${BROWN}08` }}>
            <X style={{ width: 14, height: 14, color: '#6b7280' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

            <div className="grid grid-cols-3 gap-3">
              <Field label="Tipo">
                <Select value={tipo} onValueChange={v => setTipo(v as TipoTarefa)}>
                  <SelectTrigger style={{ height: 38, borderRadius: 10, borderColor: `${GOLD}35`, background: '#faf9f7', fontSize: 13 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_TAREFA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="col-span-2">
                <Field label="Título *">
                  <TituloTarefaCombobox value={titulo} onChange={escolherTitulo} variant="brown" />
                </Field>
              </div>
            </div>

            <Field label="Descrição">
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Descreva a tarefa..."
                rows={3}
                className={inputFocusClass}
                style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }}
              />
            </Field>

            <Field label="Responsáveis *" hint="Pode marcar mais de uma pessoa. O primeiro é o responsável principal.">
              <ResponsaveisSelect value={responsaveisIds} onChange={setResponsaveisIds} variant="brown" />
            </Field>

            <Field label="Prioridade">
              <Select value={prioridade} onValueChange={v => setPrioridade(v as Tarefa['prioridade'])}>
                <SelectTrigger style={{ height: 38, borderRadius: 10, borderColor: `${GOLD}35`, background: '#faf9f7', fontSize: 13 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Media">Média</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Urgente">🔴 Urgente</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {/* Frequência */}
            <Field label="Repetir">
              <div className="flex gap-2">
                {([['diaria', 'Diária'], ['semanal', 'Semanal'], ['mensal', 'Mensal']] as [FrequenciaRecorrencia, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFrequencia(val)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: frequencia === val ? BROWN : '#faf9f7',
                      color: frequencia === val ? GOLD : BROWN,
                      border: `1px solid ${frequencia === val ? BROWN : `${GOLD}35`}`,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </Field>

            {frequencia === 'semanal' && (
              <Field label="Dia(s) da semana *">
                <div className="flex gap-1.5 flex-wrap">
                  {DIAS_SEMANA_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDiaSemana(i)}
                      className="h-9 w-9 rounded-full text-[11px] font-bold transition-all"
                      style={{
                        background: diasSemana.includes(i) ? BROWN : '#faf9f7',
                        color: diasSemana.includes(i) ? GOLD : BROWN,
                        border: `1px solid ${diasSemana.includes(i) ? BROWN : `${GOLD}35`}`,
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {frequencia === 'mensal' && (
              <Field label="Dia do mês *" hint="Se o mês não tiver esse dia (ex.: 31 em fevereiro), gera no último dia do mês.">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaMes}
                  onChange={e => setDiaMes(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className={inputFocusClass}
                  style={{ ...inputStyle, width: 100 }}
                />
              </Field>
            )}

            <Field label="Horário (opcional)">
              <input
                type="time"
                value={horario}
                onChange={e => setHorario(e.target.value)}
                className={inputFocusClass}
                style={inputStyle}
              />
            </Field>
          </div>

          <div className="px-5 pb-5 pt-3 flex gap-2" style={{ borderTop: `0.5px solid ${GOLD}20` }}>
            <button
              type="submit"
              disabled={saving || !podeSalvar}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: BROWN, color: GOLD, fontSize: 13 }}>
              <Plus style={{ width: 14, height: 14 }} />
              {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Recorrência'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
