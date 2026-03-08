import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lead } from '@/types/leads';
import { TrendingUp, TrendingDown, Minus, Calendar, Target, DollarSign, Megaphone, FileSignature } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  startOfWeek, startOfMonth, startOfQuarter, 
  subWeeks, subMonths, subQuarters, 
  isAfter, isBefore, format 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from 'recharts';

interface ConversionMetricsProps {
  leads: Lead[];
}

// Conversão = contrato assinado (lead_state inclui CONTRACT_SIGNED, DOCS_PENDING, READY_FOR_LAWYER)
const CONVERTED_STATES = ['CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER'];

const isTrafficLead = (lead: Lead): boolean => lead.tipo_origem === 'trafego';

const isConverted = (lead: Lead): boolean => {
  return CONVERTED_STATES.includes(lead.lead_state || '') || lead.status === 'Contrato Assinado' || lead.status === 'Ganho';
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
};

export function ConversionMetrics({ leads }: ConversionMetricsProps) {
  const now = new Date();

  // Somente leads de tráfego
  const trafficLeads = useMemo(() => leads.filter(isTrafficLead), [leads]);

  const metrics = useMemo(() => {
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const lastWeekStart = subWeeks(currentWeekStart, 1);
    const currentMonthStart = startOfMonth(now);
    const lastMonthStart = subMonths(currentMonthStart, 1);
    const currentQuarterStart = startOfQuarter(now);
    const lastQuarterStart = subQuarters(currentQuarterStart, 1);

    const getMetricsForPeriod = (start: Date, end: Date) => {
      const periodLeads = trafficLeads.filter(lead => {
        const date = new Date(lead.created_at);
        return isAfter(date, start) && isBefore(date, end);
      });
      const total = periodLeads.length;
      // Contar contratos reais: 1 por lead convertido + contratos_adicionais de qualquer lead
      const contracts = periodLeads.reduce((sum, l) => {
        const base = isConverted(l) ? 1 : 0;
        return sum + base + (l.contratos_adicionais || 0);
      }, 0);
      const lost = periodLeads.filter(l => l.is_lost === true || l.status === 'Perdido').length;
      const conversionRate = total > 0 ? (contracts / total) * 100 : 0;
      const lossRate = total > 0 ? (lost / total) * 100 : 0;
      const totalValue = periodLeads.filter(isConverted).reduce((sum, l) => sum + (l.valor_causa || 0), 0);
      return { total, converted: contracts, lost, conversionRate, lossRate, totalValue };
    };

    return {
      week: { current: getMetricsForPeriod(currentWeekStart, now), previous: getMetricsForPeriod(lastWeekStart, currentWeekStart) },
      month: { current: getMetricsForPeriod(currentMonthStart, now), previous: getMetricsForPeriod(lastMonthStart, currentMonthStart) },
      quarter: { current: getMetricsForPeriod(currentQuarterStart, now), previous: getMetricsForPeriod(lastQuarterStart, currentQuarterStart) },
    };
  }, [trafficLeads, now]);

  // Monthly bar chart data (últimos 6 meses) — contratos assinados de tráfego
  const monthlyData = useMemo(() => {
    const months: { month: string; leads_trafego: number; contratos: number; taxa: number; valor: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = subMonths(startOfMonth(now), i);
      const monthEnd = i === 0 ? now : subMonths(startOfMonth(now), i - 1);
      
      // Leads de tráfego criados neste mês
      const monthLeads = trafficLeads.filter(lead => {
        const date = new Date(lead.created_at);
        return isAfter(date, monthStart) && isBefore(date, monthEnd);
      });
      const total = monthLeads.length;
      
      // Contratos assinados neste mês (baseado em contract_signed_at, não created_at)
      const monthContracts = trafficLeads.filter(lead => {
        if (!isConverted(lead)) return false;
        const signedAt = lead.contract_signed_at;
        if (signedAt) {
          const signedDate = new Date(signedAt);
          return isAfter(signedDate, monthStart) && isBefore(signedDate, monthEnd);
        }
        // Fallback: se não tem contract_signed_at mas é convertido, usar created_at
        const date = new Date(lead.created_at);
        return isAfter(date, monthStart) && isBefore(date, monthEnd);
      });
      
      const converted = monthContracts.reduce((sum, l) => {
        return sum + 1 + (l.contratos_adicionais || 0);
      }, 0);
      
      const valor = monthContracts.reduce((sum, l) => sum + (l.valor_causa || 0), 0);
      
      months.push({
        month: format(monthStart, 'MMM/yy', { locale: ptBR }),
        leads_trafego: total,
        contratos: converted,
        taxa: total > 0 ? Math.round((converted / total) * 100) : 0,
        valor,
      });
    }
    return months;
  }, [trafficLeads, now]);

  // Totais globais de tráfego
  const globalTraffic = useMemo(() => {
    const total = trafficLeads.length;
    const converted = trafficLeads.reduce((sum, l) => {
      const base = isConverted(l) ? 1 : 0;
      return sum + base + (l.contratos_adicionais || 0);
    }, 0);
    const valor = trafficLeads.filter(isConverted).reduce((sum, l) => sum + (l.valor_causa || 0), 0);
    return { total, converted, taxa: total > 0 ? Math.round((converted / total) * 100) : 0, valor };
  }, [trafficLeads]);

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
      {/* Header badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1.5 text-xs font-medium">
          <Megaphone className="h-3.5 w-3.5" />
          Métricas de Tráfego Pago
        </Badge>
        <Badge variant="secondary" className="gap-1 text-xs">
          <FileSignature className="h-3 w-3" />
          {globalTraffic.converted} contratos assinados de {globalTraffic.total} leads
        </Badge>
        <Badge variant="secondary" className="text-xs">
          Taxa: {globalTraffic.taxa}%
        </Badge>
      </div>

      {/* Period cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {periodCards.map((period) => (
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
                    {period.showValue ? 'Valor Convertido (Tráfego)' : 'Taxa Conversão (Tráfego)'}
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
                  <p className="text-[10px] text-muted-foreground">Leads</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-[hsl(var(--success))]/8">
                  <p className="text-base font-bold text-[hsl(var(--success))]">{period.data.current.converted}</p>
                  <p className="text-[10px] text-muted-foreground">Assinados</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-destructive/8">
                  <p className="text-base font-bold text-destructive">{period.data.current.lost}</p>
                  <p className="text-[10px] text-muted-foreground">Perdidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Bar Chart - Contratos de Tráfego */}
      <Card className="rounded-2xl border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="h-1 w-full bg-[hsl(var(--gold))]" />
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--gold))]/10 flex items-center justify-center">
              <FileSignature className="h-4 w-4 text-[hsl(var(--gold))]" />
            </div>
            Contratos Assinados por Mês (Tráfego Pago)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-2">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ left: 0, right: 20, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }} 
                  formatter={(value: number, name: string) => {
                    if (name === 'Valor') return [formatCurrency(value), name];
                    if (name === 'Taxa (%)') return [`${value}%`, name];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="leads_trafego" fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[4, 4, 0, 0]} name="Leads Tráfego" />
                <Bar yAxisId="left" dataKey="contratos" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="Contratos Assinados" />
                <Line yAxisId="right" type="monotone" dataKey="taxa" stroke="hsl(38, 30%, 70%)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, strokeWidth: 2 }} name="Taxa (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
