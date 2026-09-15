import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRangePicker, DateRange, defaultDateRange } from '@/components/shared/DateRangePicker';

const BROWN  = '#3d2b1f';
const GOLD   = '#c9a96e';
const GOLD_D = '#b8922a';
const CORES_FALLBACK = [BROWN, GOLD, '#16a34a', '#dc2626', '#2563eb', '#9333ea', '#ea580c', '#0891b2'];

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface LinhaReceita { valor: number; data_pagamento: string; categoriaNome: string | null; categoriaCor: string | null; }
interface LinhaDespesa { valor: number; data_pagamento: string; categoriaNome: string | null; categoriaCor: string | null; }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'white', border: `0.5px solid ${GOLD}40`, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: BROWN, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ fontSize: 11, color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
}

export function RelatorioDREPanel() {
  const [range, setRange] = useState<DateRange>(defaultDateRange());
  const [loading, setLoading] = useState(true);
  const [receitas, setReceitas] = useState<LinhaReceita[]>([]);
  const [despesas, setDespesas] = useState<LinhaDespesa[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const fromStr = format(range.from, 'yyyy-MM-dd');
      const toStr = format(range.to, 'yyyy-MM-dd');

      const [{ data: parcelasPagas }, { data: despesasPagas }] = await Promise.all([
        supabase.from('parcelas')
          .select('valor, data_pagamento, honorarios(categoria_id, categorias_financeiras(nome, cor))')
          .eq('status', 'Pago').gte('data_pagamento', fromStr).lte('data_pagamento', toStr),
        supabase.from('despesas')
          .select('valor, data_pagamento, categorias_financeiras(nome, cor)')
          .eq('status', 'Pago').gte('data_pagamento', fromStr).lte('data_pagamento', toStr),
      ]);

      if (cancelled) return;
      setReceitas((parcelasPagas || []).map((p: any) => ({
        valor: Number(p.valor), data_pagamento: p.data_pagamento,
        categoriaNome: p.honorarios?.categorias_financeiras?.nome || null,
        categoriaCor: p.honorarios?.categorias_financeiras?.cor || null,
      })));
      setDespesas((despesasPagas || []).map((d: any) => ({
        valor: Number(d.valor), data_pagamento: d.data_pagamento,
        categoriaNome: d.categorias_financeiras?.nome || null,
        categoriaCor: d.categorias_financeiras?.cor || null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [range]);

  const receitaTotal = receitas.reduce((s, r) => s + r.valor, 0);
  const despesaTotal = despesas.reduce((s, d) => s + d.valor, 0);
  const resultado = receitaTotal - despesaTotal;

  const porMes = useMemo(() => {
    const map: Record<string, { mes: string; receita: number; despesa: number }> = {};
    const add = (data: string, campo: 'receita' | 'despesa', valor: number) => {
      const mesKey = data.slice(0, 7);
      if (!map[mesKey]) map[mesKey] = { mes: format(new Date(`${mesKey}-01T12:00:00`), 'MMM/yy', { locale: ptBR }), receita: 0, despesa: 0 };
      map[mesKey][campo] += valor;
    };
    receitas.forEach(r => add(r.data_pagamento, 'receita', r.valor));
    despesas.forEach(d => add(d.data_pagamento, 'despesa', d.valor));
    return Object.keys(map).sort().map(k => map[k]);
  }, [receitas, despesas]);

  const fluxoAcumulado = useMemo(() => {
    let acumulado = 0;
    return porMes.map(m => { acumulado += m.receita - m.despesa; return { mes: m.mes, acumulado }; });
  }, [porMes]);

  const porCategoria = (linhas: (LinhaReceita | LinhaDespesa)[]) => {
    const map: Record<string, { nome: string; valor: number; cor: string | null }> = {};
    linhas.forEach(l => {
      const key = l.categoriaNome || 'Sem categoria';
      if (!map[key]) map[key] = { nome: key, valor: 0, cor: l.categoriaCor };
      map[key].valor += l.valor;
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor);
  };

  const receitaPorCategoria = useMemo(() => porCategoria(receitas), [receitas]);
  const despesaPorCategoria = useMemo(() => porCategoria(despesas), [despesas]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Receita Realizada</CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-emerald-600">{fmt(receitaTotal)}</div></CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Despesa Realizada</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-red-600">{fmt(despesaTotal)}</div></CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resultado</CardTitle>
                <Scale className="h-4 w-4" style={{ color: resultado >= 0 ? '#16a34a' : '#dc2626' }} />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold" style={{ color: resultado >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(resultado)}</div></CardContent>
            </Card>
          </div>

          {porMes.length === 0 ? (
            <Card className="border-border/60 shadow-sm"><CardContent className="py-12 text-center text-muted-foreground">Nenhuma receita ou despesa paga nesse período.</CardContent></Card>
          ) : (
            <>
              <Card className="border-border/60 shadow-sm">
                <CardHeader><CardTitle className="text-base">Receita × Despesa por Mês</CardTitle></CardHeader>
                <CardContent>
                  <div style={{ width: '100%', height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={porMes} margin={{ left: 0, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`${GOLD}20`} vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: BROWN, fontWeight: 700 }} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => fmt(v).replace(',00', '')} width={80} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="receita" name="Receita" fill="#16a34a" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="despesa" name="Despesa" fill="#dc2626" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-border/60 shadow-sm">
                  <CardHeader><CardTitle className="text-base">Receita por Categoria</CardTitle></CardHeader>
                  <CardContent>
                    <div style={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={receitaPorCategoria} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={75}>
                            {receitaPorCategoria.map((c, i) => <Cell key={i} fill={c.cor || CORES_FALLBACK[i % CORES_FALLBACK.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmt(v)} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm">
                  <CardHeader><CardTitle className="text-base">Despesa por Categoria</CardTitle></CardHeader>
                  <CardContent>
                    <div style={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={despesaPorCategoria} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={75}>
                            {despesaPorCategoria.map((c, i) => <Cell key={i} fill={c.cor || CORES_FALLBACK[i % CORES_FALLBACK.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmt(v)} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/60 shadow-sm">
                <CardHeader><CardTitle className="text-base">Fluxo de Caixa Acumulado</CardTitle></CardHeader>
                <CardContent>
                  <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={fluxoAcumulado} margin={{ left: 0, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`${GOLD}20`} vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: BROWN, fontWeight: 700 }} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => fmt(v).replace(',00', '')} width={80} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="acumulado" name="Saldo Acumulado" stroke={GOLD_D} strokeWidth={2.5} dot={{ fill: GOLD_D, r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
