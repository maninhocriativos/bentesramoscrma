import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Copy, ListTodo, Activity, Gavel, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { enrichMovements, getCategoriaColor } from '@/lib/cnjMovimentosMap';
import type { Processo, ProcessoMovimento } from '@/types/processos';

interface Tarefa {
  id: string; titulo: string; status: string; prioridade: string;
  prazo_fatal: string | null; created_at: string;
}
interface IntimacaoLinked {
  id: string; tipo_intimacao: string | null; conteudo: string | null;
  data_disponibilizacao: string | null; fonte: string | null;
}
interface Despesa {
  id: string; tipo: string | null; descricao: string | null; valor: number | null;
  data_despesa: string | null; status: string | null;
}
interface Honorario {
  id: string; tipo: string | null; valor_total: number | null; valor_entrada: number | null;
  forma_pagamento: string | null; status: string | null; data_contrato: string | null;
}

const fmtMoney = (v: number | null | undefined) =>
  v == null ? null : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string | null | undefined) => {
  if (!d) return null;
  try { return new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('pt-BR'); } catch { return d; }
};

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); toast.success('Copiado!'); } catch { /* noop */ }
}

export function ProcessoSidePanel({ processo, open, onClose }: { processo: Processo | null; open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState('tarefas');
  const [loading, setLoading] = useState(false);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [intimacoes, setIntimacoes] = useState<IntimacaoLinked[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [honorarios, setHonorarios] = useState<Honorario[]>([]);

  const movimentos = enrichMovements(((processo as any)?.movimentos_json as ProcessoMovimento[]) || []);

  const fetchTab = useCallback(async (activeTab: string) => {
    if (!processo?.id) return;
    setLoading(true);
    try {
      if (activeTab === 'tarefas') {
        const { data } = await supabase.from('tarefas').select('id, titulo, status, prioridade, prazo_fatal, created_at')
          .eq('processo_id', processo.id).order('created_at', { ascending: false });
        setTarefas((data as Tarefa[]) || []);
      } else if (activeTab === 'intimacoes') {
        const { data } = await supabase.from('intimacoes').select('id, tipo_intimacao, conteudo, data_disponibilizacao, fonte')
          .eq('processo_id', processo.id).order('data_disponibilizacao', { ascending: false, nullsFirst: false }).limit(50);
        setIntimacoes((data as IntimacaoLinked[]) || []);
      } else if (activeTab === 'financeiro') {
        const [d, h] = await Promise.all([
          supabase.from('despesas').select('id, tipo, descricao, valor, data_despesa, status').eq('processo_id', processo.id).order('data_despesa', { ascending: false }),
          supabase.from('honorarios').select('id, tipo, valor_total, valor_entrada, forma_pagamento, status, data_contrato').eq('processo_id', processo.id).order('data_contrato', { ascending: false }),
        ]);
        setDespesas((d.data as Despesa[]) || []);
        setHonorarios((h.data as Honorario[]) || []);
      }
    } finally {
      setLoading(false);
    }
  }, [processo?.id]);

  useEffect(() => {
    if (open && processo?.id) { setTab('tarefas'); void fetchTab('tarefas'); }
  }, [open, processo?.id, fetchTab]);

  useEffect(() => { if (open) void fetchTab(tab); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!processo) return null;

  const titulo = processo.titulo_acao || (processo as any).nome_cliente || 'Processo';

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[420px] p-0 flex flex-col gap-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border/50 shrink-0">
          <h2 className="text-base font-bold text-foreground pr-6 leading-snug">{titulo}</h2>
          {processo.numero_processo && (
            <button onClick={() => copyText(processo.numero_processo!)} className="mt-1 inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
              {processo.numero_processo} <Copy className="h-3 w-3" />
            </button>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-3 pt-2 shrink-0 border-b border-border/40">
            <TabsList className="h-8 bg-transparent p-0 gap-1 w-full justify-start">
              <TabsTrigger value="tarefas" className="text-xs h-8 px-2 gap-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                <ListTodo className="h-3.5 w-3.5" /> Tarefas
              </TabsTrigger>
              <TabsTrigger value="andamentos" className="text-xs h-8 px-2 gap-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                <Activity className="h-3.5 w-3.5" /> Andamentos
              </TabsTrigger>
              <TabsTrigger value="intimacoes" className="text-xs h-8 px-2 gap-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                <Gavel className="h-3.5 w-3.5" /> Intimações
              </TabsTrigger>
              <TabsTrigger value="financeiro" className="text-xs h-8 px-2 gap-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                <DollarSign className="h-3.5 w-3.5" /> Financeiro
              </TabsTrigger>
            </TabsList>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-4 py-4 space-y-2.5">
                {/* TAREFAS */}
                <TabsContent value="tarefas" className="mt-0 space-y-2.5">
                  {tarefas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa para este processo.</p>
                  ) : tarefas.map(t => (
                    <div key={t.id} className="rounded-xl border border-border/40 bg-card p-3">
                      <p className="text-sm font-semibold text-foreground leading-snug">{t.titulo}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t.status}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">{t.prioridade}</span>
                        {t.prazo_fatal && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{fmtDate(t.prazo_fatal)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </TabsContent>

                {/* ANDAMENTOS */}
                <TabsContent value="andamentos" className="mt-0 space-y-2.5">
                  {movimentos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum andamento carregado. Atualize o CNJ no cadastro do processo.</p>
                  ) : movimentos.map((m, i) => (
                    <div key={i} className="rounded-xl border border-border/40 bg-card p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getCategoriaColor(m.categoria)}`}>{m.badge}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{m.dataHora}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground leading-snug">{m.titulo_humano}</p>
                      {m.descricao_humana && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.descricao_humana}</p>}
                    </div>
                  ))}
                </TabsContent>

                {/* INTIMAÇÕES */}
                <TabsContent value="intimacoes" className="mt-0 space-y-2.5">
                  {intimacoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma intimação vinculada a este processo.</p>
                  ) : intimacoes.map(i => (
                    <div key={i.id} className="rounded-xl border border-border/40 bg-card p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{i.tipo_intimacao || 'Publicação'}</span>
                        <span className="text-[10px] text-muted-foreground">{fmtDate(i.data_disponibilizacao) || '—'}</span>
                      </div>
                      <p className="text-xs text-foreground leading-relaxed line-clamp-3">{i.conteudo}</p>
                    </div>
                  ))}
                </TabsContent>

                {/* FINANCEIRO */}
                <TabsContent value="financeiro" className="mt-0 space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Honorários</p>
                    {honorarios.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum honorário cadastrado.</p>
                    ) : (
                      <div className="space-y-2">
                        {honorarios.map(h => (
                          <div key={h.id} className="rounded-xl border border-border/40 bg-card p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground">{h.tipo || 'Honorário'}</p>
                              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{fmtMoney(h.valor_total) ? `R$ ${fmtMoney(h.valor_total)}` : '—'}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{h.forma_pagamento || '—'}{h.status ? ` · ${h.status}` : ''}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Despesas</p>
                    {despesas.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa cadastrada.</p>
                    ) : (
                      <div className="space-y-2">
                        {despesas.map(d => (
                          <div key={d.id} className="rounded-xl border border-border/40 bg-card p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground">{d.tipo || 'Despesa'}</p>
                              <p className="text-sm font-bold text-amber-600 dark:text-amber-400 shrink-0">{fmtMoney(d.valor) ? `R$ ${fmtMoney(d.valor)}` : '—'}</p>
                            </div>
                            {d.descricao && <p className="text-xs text-muted-foreground mt-0.5">{d.descricao}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
