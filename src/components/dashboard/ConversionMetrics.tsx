import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lead } from '@/types/leads';
import { TrendingUp, TrendingDown, Minus, Calendar, Target, Users, DollarSign } from 'lucide-react';
import { 
  startOfWeek, startOfMonth, startOfQuarter, 
  subWeeks, subMonths, subQuarters, 
  isAfter, isBefore, format 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ConversionMetricsProps {
  leads: Lead[];
}

const STATUS_GANHO = 'Ganho';
const STATUS_PERDIDO = 'Perdido';
const CONVERSION_STATUSES = ['Contrato Assinado', 'Ganho'];

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function ConversionMetrics({ leads }: ConversionMetricsProps) {
  const now = new Date();

  // Calculate metrics for different periods
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
      const totalValue = periodLeads
        .filter(l => CONVERSION_STATUSES.includes(l.status))
        .reduce((sum, l) => sum + (l.valor_causa || 0), 0);

      return { total, converted, lost, conversionRate, lossRate, totalValue };
    };

    const currentWeek = getMetricsForPeriod(currentWeekStart, now);
    const lastWeek = getMetricsForPeriod(lastWeekStart, currentWeekStart);
    const currentMonth = getMetricsForPeriod(currentMonthStart, now);
    const lastMonth = getMetricsForPeriod(lastMonthStart, currentMonthStart);
    const currentQuarter = getMetricsForPeriod(currentQuarterStart, now);
    const lastQuarter = getMetricsForPeriod(lastQuarterStart, currentQuarterStart);

    return {
      week: { current: currentWeek, previous: lastWeek },
      month: { current: currentMonth, previous: lastMonth },
      quarter: { current: currentQuarter, previous: lastQuarter },
    };
  }, [leads, now]);

  // Calculate trend data for chart (last 6 months)
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
      const rate = total > 0 ? Math.round((converted / total) * 100) : 0;

      months.push({
        month: format(monthStart, 'MMM', { locale: ptBR }),
        leads: total,
        conversoes: converted,
        taxa: rate,
      });
    }

    return months;
  }, [leads, now]);

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-success" />;
    if (current < previous) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = (current: number, previous: number) => {
    if (current > previous) return 'text-success';
    if (current < previous) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const variation = ((current - previous) / previous) * 100;
    return `${variation > 0 ? '+' : ''}${variation.toFixed(0)}%`;
  };

  return (
    <div className="space-y-4">
      {/* Period Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
        {/* Weekly */}
        <Card className="group rounded-xl shadow-soft border border-border/50 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="pb-2 relative">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Calendar className="h-4 w-4 text-blue-500" />
              </div>
              Esta Semana
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold tracking-tight">{metrics.week.current.conversionRate.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                  {getTrendIcon(metrics.week.current.conversionRate, metrics.week.previous.conversionRate)}
                </div>
                <span className={`text-xs font-semibold ${getTrendColor(metrics.week.current.conversionRate, metrics.week.previous.conversionRate)}`}>
                  {getVariation(metrics.week.current.conversionRate, metrics.week.previous.conversionRate)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/30">
              <div className="text-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <p className="text-lg font-bold">{metrics.week.current.total}</p>
                <p className="text-xs text-muted-foreground">Novos</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-success/10 hover:bg-success/20 transition-colors">
                <p className="text-lg font-bold text-success">{metrics.week.current.converted}</p>
                <p className="text-xs text-muted-foreground">Ganhos</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors">
                <p className="text-lg font-bold text-destructive">{metrics.week.current.lost}</p>
                <p className="text-xs text-muted-foreground">Perdidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly */}
        <Card className="group rounded-xl shadow-soft border border-border/50 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="pb-2 relative">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                <Target className="h-4 w-4 text-gold" />
              </div>
              Este Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold tracking-tight">{metrics.month.current.conversionRate.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                  {getTrendIcon(metrics.month.current.conversionRate, metrics.month.previous.conversionRate)}
                </div>
                <span className={`text-xs font-semibold ${getTrendColor(metrics.month.current.conversionRate, metrics.month.previous.conversionRate)}`}>
                  {getVariation(metrics.month.current.conversionRate, metrics.month.previous.conversionRate)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/30">
              <div className="text-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <p className="text-lg font-bold">{metrics.month.current.total}</p>
                <p className="text-xs text-muted-foreground">Novos</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-success/10 hover:bg-success/20 transition-colors">
                <p className="text-lg font-bold text-success">{metrics.month.current.converted}</p>
                <p className="text-xs text-muted-foreground">Ganhos</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors">
                <p className="text-lg font-bold text-destructive">{metrics.month.current.lost}</p>
                <p className="text-xs text-muted-foreground">Perdidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quarterly */}
        <Card className="group rounded-xl shadow-soft border border-border/50 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-success/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="pb-2 relative">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
                <DollarSign className="h-4 w-4 text-success" />
              </div>
              Este Trimestre
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold tracking-tight">{formatCurrency(metrics.quarter.current.totalValue)}</p>
                <p className="text-xs text-muted-foreground">Valor Convertido</p>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                  {getTrendIcon(metrics.quarter.current.totalValue, metrics.quarter.previous.totalValue)}
                </div>
                <span className={`text-xs font-semibold ${getTrendColor(metrics.quarter.current.totalValue, metrics.quarter.previous.totalValue)}`}>
                  {getVariation(metrics.quarter.current.totalValue, metrics.quarter.previous.totalValue)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/30">
              <div className="text-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <p className="text-lg font-bold">{metrics.quarter.current.total}</p>
                <p className="text-xs text-muted-foreground">Novos</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-gold/10 hover:bg-gold/20 transition-colors">
                <p className="text-lg font-bold">{metrics.quarter.current.conversionRate.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Taxa</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors">
                <p className="text-lg font-bold text-destructive">{metrics.quarter.current.lossRate.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Perda</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card className="rounded-xl shadow-soft border border-border/50">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground py-3 px-4 rounded-t-xl">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Evolução de Conversão (Últimos 6 Meses)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                  }}
                />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="leads" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Novos Leads"
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="conversoes" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Conversões"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="taxa" 
                  stroke="#8B5CF6" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 4 }}
                  name="Taxa (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}