import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useTarefas } from '@/hooks/useTarefas';
import { Tarefa } from '@/types/tarefas';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, X, Plus, Save, Search, Scale } from 'lucide-react';

const BROWN  = '#3d2b1f';
const GOLD   = '#c9a96e';
const GOLD_D = '#b8922a';

interface TeamMember { id: string; nome: string | null; sobrenome: string | null; email: string | null; }

interface TarefaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefa?: Tarefa | null;
  onDelete?: (id: string) => Promise<boolean>;
  onSuccess?: () => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
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

export function TarefaModal({ open, onOpenChange, tarefa, onDelete, onSuccess }: TarefaModalProps) {
  const { createTarefa, updateTarefa } = useTarefas();
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo]           = useState('');
  const [descricao, setDescricao]     = useState('');
  const [prioridade, setPrioridade]   = useState<Tarefa['prioridade']>('Media');
  const [status, setStatus]           = useState<Tarefa['status']>('Pendente');
  const [responsavelId, setResponsavelId] = useState('none');
  const [prazoSeguranca, setPrazoSeguranca] = useState('');
  const [prazoFatal, setPrazoFatal]   = useState('');
  const [horario, setHorario]         = useState('');
  const [linkAudiencia, setLinkAudiencia] = useState('');
  const [members, setMembers]         = useState<TeamMember[]>([]);

  // Vínculo com processo — sem isso, a tarefa nunca aparece na aba "Tarefas
  // do Processo" (ProcessoModalExpanded), mesmo mencionando o caso no título.
  interface ProcessoLite { id: string; nome_cliente: string | null; numero_processo: string | null; cliente_id: string | null; }
  const [procId, setProcId]         = useState('');
  const [procLabel, setProcLabel]   = useState('');
  const [procClienteId, setProcClienteId] = useState<string | null>(null);
  const [procQuery, setProcQuery]   = useState('');
  const [procResults, setProcResults] = useState<ProcessoLite[]>([]);
  const [procOpen, setProcOpen]     = useState(false);
  const procTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEditing = !!tarefa;
  const ehAudiencia = /audi[eê]nc/i.test(titulo);

  const buscarProcesso = (q: string) => {
    setProcQuery(q);
    if (procTimer.current) clearTimeout(procTimer.current);
    if (q.trim().length < 2) { setProcResults([]); setProcOpen(false); return; }
    procTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('processos')
        .select('id,nome_cliente,numero_processo,cliente_id')
        .or(`nome_cliente.ilike.%${q}%,numero_processo.ilike.%${q}%`)
        .limit(8);
      setProcResults((data as ProcessoLite[]) || []);
      setProcOpen(true);
    }, 250);
  };

  const selecionarProcesso = (p: ProcessoLite) => {
    setProcId(p.id);
    setProcLabel(`${p.nome_cliente || 'Sem nome'}${p.numero_processo ? ' · ' + p.numero_processo : ''}`);
    setProcClienteId(p.cliente_id || null);
    setProcOpen(false);
    setProcQuery('');
  };

  const limparProcesso = () => { setProcId(''); setProcLabel(''); setProcClienteId(null); };

  useEffect(() => {
    if (!open) return;
    if (tarefa) {
      setTitulo(tarefa.titulo);
      setDescricao(tarefa.descricao || '');
      setPrioridade(tarefa.prioridade);
      setStatus(tarefa.status);
      setResponsavelId(tarefa.responsavel_id || 'none');
      setPrazoSeguranca(tarefa.prazo_seguranca || '');
      setPrazoFatal(tarefa.prazo_fatal || tarefa.data_limite || '');
      setHorario(tarefa.horario?.slice(0, 5) || '');
      setLinkAudiencia(tarefa.link_audiencia || '');
      if (tarefa.processo_id) {
        supabase.from('processos').select('id,nome_cliente,numero_processo,cliente_id').eq('id', tarefa.processo_id).maybeSingle()
          .then(({ data }) => { if (data) selecionarProcesso(data as ProcessoLite); else limparProcesso(); });
      } else {
        limparProcesso();
      }
    } else {
      setTitulo(''); setDescricao(''); setPrioridade('Media'); setStatus('Pendente');
      setResponsavelId('none'); setPrazoSeguranca(''); setPrazoFatal(''); setHorario('');
      setLinkAudiencia(''); limparProcesso();
    }
  }, [open, tarefa]);

  useEffect(() => {
    if (!open) return;
    supabase.from('perfis').select('id, nome, sobrenome, email').eq('aprovado', true)
      .then(({ data }) => { if (data) setMembers(data); });
  }, [open]);

  const getMemberName = (m: TeamMember) =>
    [m.nome, m.sobrenome].filter(Boolean).join(' ') || m.email || 'Usuário';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSaving(true);
    const payload = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      prioridade,
      status,
      data_limite:     prazoFatal || null,
      prazo_seguranca: prazoSeguranca || null,
      prazo_fatal:     prazoFatal || null,
      horario:         horario || null,
      link_audiencia:  ehAudiencia ? (linkAudiencia.trim() || null) : (tarefa?.link_audiencia ?? null),
      responsavel_id:  responsavelId !== 'none' ? responsavelId : null,
      processo_id:     procId || null,
      cliente_id:      procClienteId,
    };
    if (isEditing && tarefa) {
      await updateTarefa(tarefa.id, {
        ...payload,
        data_conclusao: status === 'Concluída' ? new Date().toISOString().slice(0, 10) : null,
      });
    } else {
      await createTarefa({
        ...payload,
        data_conclusao: null,
        started_at: null,
        entrega_texto: null, entrega_anexo_url: null, entregue_em: null,
        aprovacao_status: null, aprovacao_nota: null, aprovacao_feedback: null,
        aprovado_por: null, aprovado_em: null,
      });
    }
    setSaving(false);
    onOpenChange(false);
    onSuccess?.();
  };

  const handleDelete = async () => {
    if (!tarefa || !onDelete) return;
    setSaving(true);
    await onDelete(tarefa.id);
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
        {/* Barra dourada no topo */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${BROWN}, ${GOLD})` }} />

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3"
          style={{ borderBottom: `0.5px solid ${GOLD}20` }}>
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${GOLD}18` }}>
            {isEditing
              ? <Save style={{ width: 14, height: 14, color: GOLD_D }} />
              : <Plus style={{ width: 14, height: 14, color: GOLD_D }} />}
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: BROWN, flex: 1 }}>
            {isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:opacity-70"
            style={{ background: `${BROWN}08` }}>
            <X style={{ width: 14, height: 14, color: '#6b7280' }} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4">

            {/* Título */}
            <Field label="Título *">
              <input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                required
                placeholder="Digite o título da tarefa"
                className={inputFocusClass}
                style={inputStyle}
              />
            </Field>

            {/* Processo vinculado — sem isso a tarefa não aparece na aba
                "Tarefas do Processo" dentro do modal do processo. */}
            <Field label="Processo vinculado (opcional)">
              {procId ? (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ border: `1px solid ${GOLD}40`, background: `${GOLD}0f` }}>
                  <Scale style={{ width: 14, height: 14, color: GOLD_D }} className="shrink-0" />
                  <p className="text-xs font-medium flex-1 truncate" style={{ color: BROWN }}>{procLabel || 'Processo selecionado'}</p>
                  <button type="button" onClick={limparProcesso} className="p-1 rounded-lg hover:opacity-70" title="Desvincular">
                    <X style={{ width: 12, height: 12, color: '#6b7280' }} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ width: 14, height: 14, color: '#9ca3af' }} />
                  <input
                    value={procQuery}
                    onChange={e => buscarProcesso(e.target.value)}
                    placeholder="Buscar por cliente ou nº do processo..."
                    className={inputFocusClass}
                    style={{ ...inputStyle, paddingLeft: 34 }}
                  />
                  {procOpen && procResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl shadow-xl max-h-56 overflow-y-auto" style={{ border: `1px solid ${GOLD}40`, background: '#fff' }}>
                      {procResults.map(p => (
                        <button key={p.id} type="button" onClick={() => selecionarProcesso(p)}
                          className="w-full text-left px-3 py-2 hover:opacity-80 transition-opacity"
                          style={{ borderBottom: `0.5px solid ${GOLD}20` }}>
                          <p className="text-xs font-semibold truncate" style={{ color: BROWN }}>{p.nome_cliente || 'Sem nome'}</p>
                          <p className="text-[11px] text-muted-foreground">{p.numero_processo || 'sem número'}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>

            {/* Descrição */}
            <Field label="Descrição">
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Descreva a tarefa..."
                rows={3}
                className={inputFocusClass}
                style={{
                  ...inputStyle, height: 'auto', padding: '10px 12px',
                  resize: 'vertical', lineHeight: 1.5,
                }}
              />
            </Field>

            {/* Responsável */}
            <Field label="Responsável">
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger style={{ height: 38, borderRadius: 10, borderColor: `${GOLD}35`, background: '#faf9f7', fontSize: 13 }}>
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>{getMemberName(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Prioridade + Status */}
            <div className="grid grid-cols-2 gap-3">
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
              <Field label="Status">
                <Select value={status} onValueChange={v => setStatus(v as Tarefa['status'])}>
                  <SelectTrigger style={{ height: 38, borderRadius: 10, borderColor: `${GOLD}35`, background: '#faf9f7', fontSize: 13 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                    <SelectItem value="Concluída">Concluída</SelectItem>
                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Prazos + Horário — 2 colunas em vez de 3 para não cortar */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prazo de Segurança">
                <input
                  type="date"
                  value={prazoSeguranca}
                  onChange={e => setPrazoSeguranca(e.target.value)}
                  className={inputFocusClass}
                  style={inputStyle}
                />
              </Field>
              <Field label="Prazo Fatal">
                <input
                  type="date"
                  value={prazoFatal}
                  onChange={e => setPrazoFatal(e.target.value)}
                  className={inputFocusClass}
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="Horário (opcional)">
              <input
                type="time"
                value={horario}
                onChange={e => setHorario(e.target.value)}
                className={inputFocusClass}
                style={{ ...inputStyle, maxWidth: 160 }}
              />
            </Field>

            {ehAudiencia && (
              <Field label="Link da audiência (virtual)">
                <input
                  type="url"
                  value={linkAudiencia}
                  onChange={e => setLinkAudiencia(e.target.value)}
                  placeholder="https://..."
                  className={inputFocusClass}
                  style={inputStyle}
                />
              </Field>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex gap-2">
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold transition-all hover:opacity-80 disabled:opacity-40"
                style={{ background: '#fef2f2', color: '#dc2626', fontSize: 12, border: '0.5px solid rgba(220,38,38,0.25)' }}>
                <Trash2 style={{ width: 13, height: 13 }} />
                Excluir
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !titulo.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: BROWN, color: GOLD, fontSize: 13 }}>
              {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Tarefa'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
