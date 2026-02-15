import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lead } from '@/types/leads';
import { TrendingUp, TrendingDown, Minus, Calendar, Target, DollarSign } from 'lucide-react';
import { 
  startOfWeek, startOfMonth, startOfQuarter, 
  subWeeks, subMonths, subQuarters, 
  isAfter, isBefore, format 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface ConversionMetricsProps {
  leads: Lead[];
}

const CONVERSION_STATUSES = ['Contrato Assinado', 'Ganho'];
const STATUS_PERDIDO = 'Perdido';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
};

export function ConversionMetrics({ leads }: ConversionMetricsProps) {
  const now = new Date();

  const metrics = useMemo(() => {
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const lastWeekStart = subWeeks(currentWeekStart, 1);
    const currentMonthStart = startOfMonth(now);
    const lastMonthStart = subMonths(currentMonthStart, 1);
    const currentQuarterStart = startOfQuarter(now);
    const lastQuarterStart = subQuarters(currentQuarterStart, 1);

    const getMetricsForPeriod = (start: Date, end: Date) => {
      const periodLeads = leads.filter(lead => {
        const date = new Date(lead.created_at);
        return isAfter(date, start) && isBefore(date, end);
      });
      const total = periodLeads.length;
      const converted = periodLeads.filter(l => CONVERSION_STATUSES.includes(l.status)).length;
      const lost = periodLeads.filter(l => l.status === STATUS_PERDIDO).length;
      const conversionRate = total > 0 ? (converted / total) * 100 : 0;
      const lossRate = total > 0 ? (lost / total) * 100 : 0;
      const totalValue = periodLeads.filter(l => CONVERSION_STATUSES.includes(l.status)).reduce((sum, l) => sum + (l.valor_causa || 0), 0);
      return { total, converted, lost, conversionRate, lossRate, totalValue };
    };

    return {
      week: { current: getMetricsForPeriod(currentWeekStart, now), previous: getMetricsForPeriod(lastWeekStart, currentWeekStart) },
      month: { current: getMetricsForPeriod(currentMonthStart, now), previous: getMetricsForPeriod(lastMonthStart, currentMonthStart) },
      quarter: { current: getMetricsForPeriod(currentQuarterStart, now), previous: getMetricsForPeriod(lastQuarterStart, currentQuarterStart) },
    };
  }, [leads, now]);

  const trendData = useMemo(() => {
    const months: { month: string; leads: number; conversoes: number; taxa: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = subMonths(startOfMonth(now), i);
      const monthEnd = i === 0 ? now : subMonths(startOfMonth(now), i - 1);
      const monthLeads = leads.filter(lead => {
        const date = new Date(lead.created_at);
        return isAfter(date, monthStart) && isBefore(date, monthEnd);
      });
      const total = monthLeads.length;
      const converted = monthLeads.filter(l => CONVERSION_STATUSES.includes(l.status)).length;
      months.push({
        month: format(monthStart, 'MMM', { locale: ptBR }),
        leads: total,
        conversoes: converted,
        taxa: total > 0 ? Math.round((converted / total) * 100) : 0,
      });
    }
    return months;
  }, [leads, now]);

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-[hsl(var(--success))]" />;
    if (current < previous) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = (current: number, previous: number) => {
    if (current > previous) return 'text-[hsl(var(--success))]';
    if (current < previous) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const variation = ((current - previous) / previous) * 100;
    return `${variation > 0 ? '+' : ''}${variation.toFixed(0)}%`;
  };

  const periodCards = [
    { label: 'Esta Semana', data: metrics.week, icon: Calendar, accentColor: 'bg-primary', iconBg: 'bg-primary/10', iconColor: 'text-primary' },
    { label: 'Este Mês', data: metrics.month, icon: Target, accentColor: 'bg-[hsl(var(--gold))]', iconBg: 'bg-[hsl(var(--gold))]/10', iconColor: 'text-[hsl(var(--gold))]' },
    { label: 'Este Trimestre', data: metrics.quarter, icon: DollarSign, accentColor: 'bg-[hsl(var(--success))]', iconBg: 'bg-[hsl(var(--success))]/10', iconColor: 'text-[hsl(var(--success))]', showValue: true },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {periodCards.map((period, index) => (
          <Card key={period.label} className="group rounded-2xl border-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300">
            <div className={`h-1 w-full ${period.accentColor}`} />
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${period.iconBg} flex items-center justify-center`}>
                  <period.icon className={`h-4 w-4 ${period.iconColor}`} />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{period.label}</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold tracking-tight">
                    {period.showValue ? formatCurrency(period.data.current.totalValue) : `${period.data.current.conversionRate.toFixed(0)}%`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {period.showValue ? 'Valor Convertido' : 'Taxa de Conversão'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                    {period.showValue 
                      ? getTrendIcon(period.data.current.totalValue, period.data.previous.totalValue)
                      : getTrendIcon(period.data.current.conversionRate, period.data.previous.conversionRate)
                    }
                  </div>
                  <span className={`text-[10px] font-semibold ${period.showValue ? getTrendColor(period.data.current.totalValue, period.data.previous.totalValue) : getTrendColor(period.data.current.conversionRate, period.data.previous.conversionRate)}`}>
                    {period.showValue ? getVariation(period.data.current.totalValue, period.data.previous.totalValue) : getVariation(period.data.current.conversionRate, period.data.previous.conversionRate)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/30">
                <div className="text-center p-2 rounded-xl bg-muted/30">
                  <p className="text-base font-bold">{period.data.current.total}</p>
                  <p className="text-[10px] text-muted-foreground">Novos</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-[hsl(var(--success))]/8">
                  <p className="text-base font-bold text-[hsl(var(--success))]">{period.showValue ? `${period.data.current.conversionRate.toFixed(0)}%` : period.data.current.converted}</p>
                  <p className="text-[10px] text-muted-foreground">{period.showValue ? 'Taxa' : 'Ganhos'}</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-destructive/8">
                  <p className="text-base font-bold text-destructive">{period.showValue ? `${period.data.current.lossRate.toFixed(0)}%` : period.data.current.lost}</p>
                  <p className="text-[10px] text-muted-foreground">{period.showValue ? 'Perda' : 'Perdidos'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend Chart */}
      <Card className="rounded-2xl border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="h-1 w-full bg-primary" />
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            Evolução (Últimos 6 Meses)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-2">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ left: 0, right: 20, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line yAxisId="left" type="monotone" dataKey="leads" stroke="hsl(24, 21%, 21%)" strokeWidth={2} dot={{ r: 3, strokeWidth: 2 }} name="Novos Leads" />
                <Line yAxisId="left" type="monotone" dataKey="conversoes" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={{ r: 3, strokeWidth: 2 }} name="Conversões" />
                <Line yAxisId="right" type="monotone" dataKey="taxa" stroke="hsl(38, 30%, 70%)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, strokeWidth: 2 }} name="Taxa (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
