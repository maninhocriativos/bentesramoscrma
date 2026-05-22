import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus, DollarSign, TrendingUp, TrendingDown, Clock,
  Scale, AlertTriangle, Loader2,
} from 'lucide-react';
import { useHonorarios, useParcelas, useDespesas, useProcessosFinanceiro } from '@/hooks/useFinanceiro';
import { HonorarioModal } from '@/components/financeiro/HonorarioModal';
import { DespesaModal } from '@/components/financeiro/DespesaModal';
import { HonorariosTable } from '@/components/financeiro/HonorariosTable';
import { ParcelasTable } from '@/components/financeiro/ParcelasTable';
import { DespesasTable } from '@/components/financeiro/DespesasTable';
import { AppLayout } from '@/components/layouts/AppLayout';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const probConfig: Record<string, { cls: string }> = {
  'Alta':   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400' },
  'Média':  { cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400' },
  'Baixa':  { cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400' },
};

export default function FinanceiroPage() {
  const { honorarios, loading: loadingHonorarios } = useHonorarios();
  const { parcelas, loading: loadingParcelas, updateParcela } = useParcelas();
  const { despesas, loading: loadingDespesas } = useDespesas();
  const { processos: processosFinanceiros, loading: loadingProcessos, totalEmCausa, totalProvisionado } = useProcessosFinanceiro();

  const [honorarioModalOpen, setHonorarioModalOpen] = useState(false);
  const [despesaModalOpen, setDespesaModalOpen] = useState(false);

  const totalHonorarios    = honorarios.reduce((acc, h) => acc + Number(h.valor_total), 0);
  const totalRecebido      = parcelas.filter(p => p.status === 'Pago').reduce((acc, p) => acc + Number(p.valor), 0);
  const totalPendente      = parcelas.filter(p => p.status === 'Pendente').reduce((acc, p) => acc + Number(p.valor), 0);
  const totalDespesas      = despesas.reduce((acc, d) => acc + Number(d.valor), 0);
  const parcelasAtrasadas  = parcelas.filter(p => p.status === 'Pendente' && new Date(p.data_vencimento) < new Date());

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 page-enter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
            <p className="text-sm text-muted-foreground">Gestão de honorários, parcelas e despesas</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={() => setDespesaModalOpen(true)} variant="outline" size="sm" className="flex-1 sm:flex-none rounded-xl">
              <Plus className="h-4 w-4 mr-1" />
              Nova Despesa
            </Button>
            <Button onClick={() => setHonorarioModalOpen(true)} size="sm" className="flex-1 sm:flex-none rounded-xl">
              <Plus className="h-4 w-4 mr-1" />
              Novo Honorário
            </Button>
          </div>
        </div>

        {/* KPI row 1 — Processos (valor_causa) */}
        <div>
          <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Scale className="h-3.5 w-3.5" /> Carteira de Processos
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total em Causa</CardTitle>
                <Scale className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-primary">{fmt(totalEmCausa)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{processosFinanceiros.length} processo{processosFinanceiros.length !== 1 ? 's' : ''} ativos com valor</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Provisionado</CardTitle>
                <DollarSign className="h-4 w-4 text-violet-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-violet-600 dark:text-violet-400">{fmt(totalProvisionado)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">Valor estimado de recebimento</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* KPI row 2 — Honorários */}
        <div>
          <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3 flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5" /> Honorários & Caixa
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Honorários</CardTitle>
                <DollarSign className="h-4 w-4 text-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(totalHonorarios)}</div>
                <p className="text-xs text-muted-foreground">{honorarios.length} contratos</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Recebido</CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalRecebido)}</div>
                <p className="text-xs text-muted-foreground">{parcelas.filter(p => p.status === 'Pago').length} parcelas pagas</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">A Receber</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmt(totalPendente)}</div>
                <p className="text-xs text-muted-foreground">
                  {parcelasAtrasadas.length > 0
                    ? <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{parcelasAtrasadas.length} atrasadas</span>
                    : 'Nenhuma em atraso'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Despesas</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{fmt(totalDespesas)}</div>
                <p className="text-xs text-muted-foreground">{despesas.length} registros</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="processos" className="space-y-4">
          <TabsList className="rounded-xl">
            <TabsTrigger value="processos" className="rounded-lg gap-1.5">
              <Scale className="h-3.5 w-3.5" /> Processos
            </TabsTrigger>
            <TabsTrigger value="honorarios" className="rounded-lg">Honorários</TabsTrigger>
            <TabsTrigger value="parcelas" className="rounded-lg">Parcelas</TabsTrigger>
            <TabsTrigger value="despesas" className="rounded-lg">Despesas</TabsTrigger>
          </TabsList>

          {/* ── Aba Processos ── */}
          <TabsContent value="processos">
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Scale className="h-4 w-4 text-primary" />
                  Carteira de Processos — Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingProcessos ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : processosFinanceiros.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    Nenhum processo com valor de causa cadastrado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
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
                        {processosFinanceiros.map(p => (
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
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                p.status === 'Em Andamento' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300' :
                                p.status === 'Ganho'        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300' :
                                p.status === 'Suspenso'     ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300' :
                                'bg-muted text-muted-foreground border-border'
                              }`}>
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
                <DespesasTable despesas={despesas} loading={loadingDespesas} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <HonorarioModal open={honorarioModalOpen} onOpenChange={setHonorarioModalOpen} />
        <DespesaModal open={despesaModalOpen} onOpenChange={setDespesaModalOpen} />
      </div>
    </AppLayout>
  );
}
