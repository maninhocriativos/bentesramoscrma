import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Plus, DollarSign, TrendingUp, TrendingDown, Clock,
  Scale, AlertTriangle, Loader2, Landmark,
} from 'lucide-react';
import { useHonorarios, useParcelas, useDespesas, useProcessosFinanceiro } from '@/hooks/useFinanceiro';
import { HonorarioModal } from '@/components/financeiro/HonorarioModal';
import { DespesaModal } from '@/components/financeiro/DespesaModal';
import { HonorariosTable } from '@/components/financeiro/HonorariosTable';
import { ParcelasTable } from '@/components/financeiro/ParcelasTable';
import { DespesasTable } from '@/components/financeiro/DespesasTable';
import { CategoriasFinanceirasManager } from '@/components/financeiro/CategoriasFinanceirasManager';
import { ContasBancariasManager } from '@/components/financeiro/ContasBancariasManager';
import { InadimplenciaPanel } from '@/components/financeiro/InadimplenciaPanel';
import { RelatorioDREPanel } from '@/components/financeiro/RelatorioDREPanel';
import { FinanceiroKpiCard } from '@/components/financeiro/FinanceiroKpiCard';
import { FinanceiroEmptyState } from '@/components/financeiro/FinanceiroEmptyState';
import { BarChart3 } from 'lucide-react';

const BROWN  = '#3d2b1f';
const GOLD   = '#c9a96e';
const GOLD_D = '#b8922a';

const ITEMS_PER_PAGE = 30;

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const probConfig: Record<string, { cls: string }> = {
  'Alta':   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400' },
  'Média':  { cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400' },
  'Baixa':  { cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400' },
};

const statusBarColor: Record<string, string> = {
  'Em Andamento': '#3b82f6',
  'Ganho': '#16a34a',
  'Suspenso': '#d97706',
};

const statusBadgeCls = (status: string | null) => {
  if (status === 'Em Andamento') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300';
  if (status === 'Ganho') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300';
  if (status === 'Suspenso') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300';
  return 'bg-muted text-muted-foreground border-border';
};

export default function FinanceiroPage() {
  const { honorarios, loading: loadingHonorarios } = useHonorarios();
  const { parcelas, loading: loadingParcelas, updateParcela, fetchParcelas } = useParcelas();
  const { despesas, loading: loadingDespesas, updateDespesa } = useDespesas();
  const { processos: processosFinanceiros, loading: loadingProcessos, totalEmCausa, totalProvisionado } = useProcessosFinanceiro();

  const [honorarioModalOpen, setHonorarioModalOpen] = useState(false);
  const [despesaModalOpen, setDespesaModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('processos');
  const [currentPage, setCurrentPage] = useState(1);

  const totalHonorarios    = honorarios.reduce((acc, h) => acc + Number(h.valor_total), 0);
  const totalRecebido      = parcelas.filter(p => p.status === 'Pago').reduce((acc, p) => acc + Number(p.valor), 0);
  const totalPendente      = parcelas.filter(p => p.status === 'Pendente').reduce((acc, p) => acc + Number(p.valor), 0);
  const totalDespesas      = despesas.reduce((acc, d) => acc + Number(d.valor), 0);
  // Comparação por DIA (string ISO), nunca por timestamp — senão uma
  // parcela vencendo HOJE já contava como atrasada assim que passava da
  // meia-noite, mesmo sendo do dia corrente (mesma classe de bug já
  // corrigida em Intimações/Agenda).
  const hojeISO = new Date().toISOString().slice(0, 10);
  const parcelasAtrasadas  = parcelas.filter(p => p.status === 'Pendente' && p.data_vencimento < hojeISO);

  const totalPagesProcessos = Math.max(1, Math.ceil(processosFinanceiros.length / ITEMS_PER_PAGE));
  const safePageProcessos = Math.min(currentPage, totalPagesProcessos);
  const paginatedProcessos = useMemo(
    () => processosFinanceiros.slice((safePageProcessos - 1) * ITEMS_PER_PAGE, safePageProcessos * ITEMS_PER_PAGE),
    [processosFinanceiros, safePageProcessos]
  );

  const showCarteiraKpis = activeTab === 'processos';
  const showHonorariosKpis = ['honorarios', 'parcelas', 'despesas'].includes(activeTab);

  return (
    <>
      <div className="p-4 md:p-8 space-y-6 page-enter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: BROWN, letterSpacing: '-0.02em' }}>Financeiro</h1>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Gestão de honorários, parcelas e despesas</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              onClick={() => setDespesaModalOpen(true)}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none rounded-xl"
              style={{ borderColor: `${GOLD}60`, color: BROWN, fontSize: 12, fontWeight: 600 }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova Despesa
            </Button>
            <Button
              onClick={() => setHonorarioModalOpen(true)}
              size="sm"
              className="flex-1 sm:flex-none rounded-xl"
              style={{ background: BROWN, color: GOLD, fontSize: 12, fontWeight: 700 }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Novo Honorário
            </Button>
          </div>
        </div>

        {/* KPI row — Carteira de Processos (só na aba Processos) */}
        {showCarteiraKpis && (
          <div>
            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Scale className="h-3.5 w-3.5" /> Carteira de Processos
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FinanceiroKpiCard
                label="Total em Causa"
                value={fmt(totalEmCausa)}
                icon={Scale}
                accent={GOLD_D}
                hint={`${processosFinanceiros.length} processo${processosFinanceiros.length !== 1 ? 's' : ''} ativos com valor`}
              />
              <FinanceiroKpiCard
                label="Total Provisionado"
                value={fmt(totalProvisionado)}
                icon={DollarSign}
                accent="#7c3aed"
                hint="Valor estimado de recebimento"
              />
            </div>
          </div>
        )}

        {/* KPI row — Honorários & Caixa (nas abas Honorários/Parcelas/Despesas) */}
        {showHonorariosKpis && (
          <div>
            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3 flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5" /> Honorários & Caixa
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FinanceiroKpiCard
                label="Total Honorários"
                value={fmt(totalHonorarios)}
                icon={DollarSign}
                accent={BROWN}
                hint={`${honorarios.length} contratos`}
              />
              <FinanceiroKpiCard
                label="Recebido"
                value={fmt(totalRecebido)}
                icon={TrendingUp}
                accent="#16a34a"
                hint={`${parcelas.filter(p => p.status === 'Pago').length} parcelas pagas`}
              />
              <FinanceiroKpiCard
                label="A Receber"
                value={fmt(totalPendente)}
                icon={Clock}
                accent="#d97706"
                hint={
                  parcelasAtrasadas.length > 0
                    ? <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{parcelasAtrasadas.length} atrasadas</span>
                    : 'Nenhuma em atraso'
                }
              />
              <FinanceiroKpiCard
                label="Total Despesas"
                value={fmt(totalDespesas)}
                icon={TrendingDown}
                accent="#dc2626"
                hint={`${despesas.length} registros`}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList
            className="rounded-xl flex-wrap h-auto"
            style={{ background: `${GOLD}12`, border: `0.5px solid ${GOLD}30` }}
          >
            <TabsTrigger value="processos" className="rounded-lg gap-1.5">
              <Scale className="h-3.5 w-3.5" /> Processos
            </TabsTrigger>
            <TabsTrigger value="honorarios" className="rounded-lg">Honorários</TabsTrigger>
            <TabsTrigger value="parcelas" className="rounded-lg">Parcelas</TabsTrigger>
            <TabsTrigger value="despesas" className="rounded-lg">Despesas</TabsTrigger>
            <TabsTrigger value="inadimplencia" className="rounded-lg gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Inadimplência
            </TabsTrigger>
            <TabsTrigger value="dre" className="rounded-lg gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> DRE / Fluxo de Caixa
            </TabsTrigger>
            <TabsTrigger value="contas" className="rounded-lg gap-1.5">
              <Landmark className="h-3.5 w-3.5" /> Contas & Categorias
            </TabsTrigger>
          </TabsList>

          {/* ── Aba Processos ── */}
          <TabsContent value="processos">
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Scale className="h-4 w-4" style={{ color: GOLD_D }} />
                  Carteira de Processos — Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingProcessos ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : processosFinanceiros.length === 0 ? (
                  <FinanceiroEmptyState
                    icon={Scale}
                    title="Nenhum processo com valor cadastrado"
                    subtitle="Processos com valor de causa ou provisionado aparecem aqui"
                  />
                ) : (
                  <>
                    {/* Desktop */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/50 bg-muted/30">
                            <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[30%]">Cliente</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[22%]">Processo</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[12%]">Status</th>
                            <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[16%]">Valor em Causa</th>
                            <th className="text-right px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[16%]">Provisionado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/25">
                          {paginatedProcessos.map(p => (
                            <tr key={p.id} className="hover:bg-accent/20 transition-colors">
                              <td className="px-5 py-3 align-middle">
                                <p className="font-semibold text-foreground truncate max-w-[220px]">{p.nome_cliente || '—'}</p>
                                {p.advogado_responsavel && (
                                  <p className="text-[10px] text-muted-foreground/50 truncate">{p.advogado_responsavel.replace(/\s*\(OAB.*\)/i, '')}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <p className="font-mono text-xs text-muted-foreground truncate max-w-[160px]">{p.numero_processo || '—'}</p>
                              </td>
                              <td className="px-3 py-3 align-middle">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeCls(p.status)}`}>
                                  {p.status || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-middle text-right">
                                {p.valor_causa
                                  ? <span className="font-bold text-foreground">{fmt(p.valor_causa)}</span>
                                  : <span className="text-muted-foreground/30 text-xs">—</span>}
                                {p.probabilidade && (
                                  <div className="mt-0.5 flex justify-end">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${probConfig[p.probabilidade]?.cls || 'bg-muted text-muted-foreground border-border'}`}>
                                      {p.probabilidade}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-5 py-3 align-middle text-right">
                                {p.valor_provisionado
                                  ? <span className="font-bold text-violet-600 dark:text-violet-400">{fmt(p.valor_provisionado)}</span>
                                  : <span className="text-muted-foreground/30 text-xs">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-border/60 bg-muted/20">
                            <td colSpan={3} className="px-5 py-3 text-xs font-bold text-muted-foreground">
                              Total ({processosFinanceiros.length} processos)
                            </td>
                            <td className="px-4 py-3 text-right font-black text-foreground">{fmt(totalEmCausa)}</td>
                            <td className="px-5 py-3 text-right font-black text-violet-600 dark:text-violet-400">{fmt(totalProvisionado)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Mobile */}
                    <div className="md:hidden space-y-2 p-3">
                      {paginatedProcessos.map(p => (
                        <div
                          key={p.id}
                          className="rounded-2xl border border-border/50 bg-white dark:bg-card p-3"
                          style={{ borderLeftWidth: 3, borderLeftColor: statusBarColor[p.status || ''] || '#9ca3af' }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">{p.nome_cliente || '—'}</p>
                              <p className="font-mono text-[11px] text-muted-foreground truncate">{p.numero_processo || '—'}</p>
                            </div>
                            <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeCls(p.status)}`}>
                              {p.status || '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                            <div>
                              <p className="text-[9px] uppercase tracking-wide text-muted-foreground/60">Valor em Causa</p>
                              <p className="text-sm font-bold text-foreground">{p.valor_causa ? fmt(p.valor_causa) : '—'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] uppercase tracking-wide text-muted-foreground/60">Provisionado</p>
                              <p className="text-sm font-bold text-violet-600 dark:text-violet-400">{p.valor_provisionado ? fmt(p.valor_provisionado) : '—'}</p>
                            </div>
                          </div>
                          {p.probabilidade && (
                            <div className="mt-2 flex justify-end">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${probConfig[p.probabilidade]?.cls || 'bg-muted text-muted-foreground border-border'}`}>
                                {p.probabilidade}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 flex items-center justify-between text-xs font-bold text-muted-foreground">
                        <span>Total ({processosFinanceiros.length})</span>
                        <span className="text-foreground">{fmt(totalEmCausa)}</span>
                      </div>
                    </div>

                    {/* Paginação */}
                    {totalPagesProcessos > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-[#c9a96e]/10 bg-[#faf8f5]/60 dark:bg-[#2a1f14]/30">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {((safePageProcessos - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(safePageProcessos * ITEMS_PER_PAGE, processosFinanceiros.length)} de {processosFinanceiros.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 px-2 text-xs hover:bg-[#c9a96e]/10"
                            disabled={safePageProcessos <= 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          >
                            ← Anterior
                          </Button>
                          {Array.from({ length: totalPagesProcessos }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPagesProcessos || Math.abs(p - safePageProcessos) <= 1)
                            .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                              acc.push(p);
                              return acc;
                            }, [])
                            .map((p, i) =>
                              p === 'ellipsis'
                                ? <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                                : (
                                  <Button
                                    key={p}
                                    variant={p === safePageProcessos ? 'default' : 'ghost'}
                                    size="sm"
                                    className={cn(
                                      'h-7 w-7 p-0 text-xs',
                                      p === safePageProcessos
                                        ? 'bg-[#3d2b1f] text-[#c9a96e] hover:bg-[#3d2b1f]/90'
                                        : 'hover:bg-[#c9a96e]/10'
                                    )}
                                    onClick={() => setCurrentPage(p as number)}
                                  >
                                    {p}
                                  </Button>
                                )
                            )}
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 px-2 text-xs hover:bg-[#c9a96e]/10"
                            disabled={safePageProcessos >= totalPagesProcessos}
                            onClick={() => setCurrentPage(p => Math.min(totalPagesProcessos, p + 1))}
                          >
                            Próxima →
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="honorarios">
            <Card className="border-border/60 shadow-sm">
              <CardHeader><CardTitle>Honorários e Contratos</CardTitle></CardHeader>
              <CardContent>
                <HonorariosTable honorarios={honorarios} loading={loadingHonorarios} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parcelas">
            <Card className="border-border/60 shadow-sm">
              <CardHeader><CardTitle>Controle de Parcelas</CardTitle></CardHeader>
              <CardContent>
                <ParcelasTable parcelas={parcelas} loading={loadingParcelas} onUpdateParcela={updateParcela} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="despesas">
            <Card className="border-border/60 shadow-sm">
              <CardHeader><CardTitle>Despesas Processuais</CardTitle></CardHeader>
              <CardContent>
                <DespesasTable despesas={despesas} loading={loadingDespesas} onUpdateDespesa={updateDespesa} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inadimplencia">
            <InadimplenciaPanel />
          </TabsContent>

          <TabsContent value="dre">
            <RelatorioDREPanel />
          </TabsContent>

          <TabsContent value="contas" className="space-y-4">
            <ContasBancariasManager />
            <CategoriasFinanceirasManager />
          </TabsContent>
        </Tabs>

        <HonorarioModal open={honorarioModalOpen} onOpenChange={setHonorarioModalOpen} onSuccess={fetchParcelas} />
        <DespesaModal open={despesaModalOpen} onOpenChange={setDespesaModalOpen} />
      </div>
    </>
  );
}
