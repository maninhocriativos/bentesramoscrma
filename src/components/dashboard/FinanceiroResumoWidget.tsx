import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface FinStats {
  recebidoMes: number;
  aReceber: number;
  atrasadoValor: number;
  atrasadoCount: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v);

export function FinanceiroResumoWidget() {
  const [stats, setStats] = useState<FinStats>({ recebidoMes: 0, aReceber: 0, atrasadoValor: 0, atrasadoCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const now = new Date();
      const mesInicio = startOfMonth(now).toISOString();
      const mesFim = endOfMonth(now).toISOString();
      const hoje = now.toISOString().split('T')[0];

      const [{ data: pagas }, { data: pendentes }, { data: atrasadas }] = await Promise.all([
        supabase.from('parcelas').select('valor').eq('status', 'Pago')
          .gte('data_pagamento', mesInicio).lte('data_pagamento', mesFim),
        supabase.from('parcelas').select('valor').eq('status', 'Pendente').gte('data_vencimento', hoje),
        supabase.from('parcelas').select('valor').eq('status', 'Pendente').lt('data_vencimento', hoje),
      ]);

      if (!active) return;
      setStats({
        recebidoMes:   (pagas     || []).reduce((s, p) => s + Number(p.valor), 0),
        aReceber:      (pendentes || []).reduce((s, p) => s + Number(p.valor), 0),
        atrasadoValor: (atrasadas || []).reduce((s, p) => s + Number(p.valor), 0),
        atrasadoCount: (atrasadas || []).length,
      });
      setLoading(false);
    };

    load();
    const interval = setInterval(load, 300_000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const items = [
    {
      label: 'Recebido este mês',
      value: fmt(stats.recebidoMes),
      icon: TrendingUp,
      accent: '#16a34a',
      iconBg: 'rgba(22,163,74,0.08)',
      highlight: false,
    },
    {
      label: 'A Receber',
      value: fmt(stats.aReceber),
      icon: DollarSign,
      accent: '#c9a96e',
      iconBg: 'rgba(201,169,110,0.1)',
      highlight: false,
    },
    {
      label: stats.atrasadoCount > 0 ? `Em Atraso (${stats.atrasadoCount})` : 'Em Atraso',
      value: fmt(stats.atrasadoValor),
      icon: stats.atrasadoCount > 0 ? AlertCircle : Clock,
      accent: stats.atrasadoCount > 0 ? '#dc2626' : '#9ca3af',
      iconBg: stats.atrasadoCount > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(156,163,175,0.1)',
      highlight: stats.atrasadoCount > 0,
    },
  ];

  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-[#c9a96e]/15 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="h-[3px] w-full bg-[#c9a96e]" />
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-7 w-7 rounded-lg bg-[#c9a96e]/12 flex items-center justify-center">
            <DollarSign style={{ width: 14, height: 14, color: '#c9a96e' }} />
          </div>
          <span className="text-sm font-semibold text-foreground">Financeiro</span>
          {loading && (
            <span className="ml-auto text-[11px] text-muted-foreground animate-pulse">carregando...</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={cn(
                  'rounded-xl p-3 space-y-1.5',
                  item.highlight ? 'bg-red-50 dark:bg-red-950/20' : 'bg-muted/30'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: item.iconBg }}>
                    <Icon style={{ width: 11, height: 11, color: item.accent }} />
                  </div>
                  <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {item.label}
                  </span>
                </div>
                <p style={{ fontSize: 16, fontWeight: 800, color: item.highlight ? '#dc2626' : 'inherit', letterSpacing: '-0.02em' }}>
                  {loading ? '—' : item.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
