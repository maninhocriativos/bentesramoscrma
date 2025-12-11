import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lead } from '@/types/leads';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { ArrowRight, DollarSign } from 'lucide-react';

interface DashboardChartsProps {
  leads: Lead[];
}

// Formatar valor em moeda
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Cores vibrantes e distintas para origens
const ORIGEM_COLORS: Record<string, string> = {
  'Instagram': '#E1306C',
  'Google': '#4285F4',
  'Site': '#10B981',
  'Indicação': '#8B5CF6',
  'Outro': '#6B7280',
};

// Cores vibrantes para o funil
const STATUS_CONFIG = [
  { status: 'Lead Frio', color: '#64748B', label: 'Lead Frio' },
  { status: 'Em Atendimento', color: '#3B82F6', label: 'Em Atendimento' },
  { status: 'Aguardando Contrato', color: '#F59E0B', label: 'Aguardando Contrato' },
  { status: 'Contrato Assinado', color: '#8B5CF6', label: 'Contrato Assinado' },
  { status: 'Ganho', color: '#10B981', label: 'Ganho' },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const percentage = payload[0].payload.total > 0 
      ? ((payload[0].value / payload[0].payload.total) * 100).toFixed(0)
      : 0;
    return (
      <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-sm">
        <p className="font-semibold text-foreground">{payload[0].name}</p>
        <p className="text-muted-foreground">
          {payload[0].value} leads ({percentage}%)
        </p>
      </div>
    );
  }
  return null;
};

export function DashboardCharts({ leads }: DashboardChartsProps) {
  const origemCounts = leads.reduce((acc, lead) => {
    const origem = lead.origem || 'Outro';
    acc[origem] = (acc[origem] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalLeads = leads.length;
  const origemData = Object.entries(origemCounts).map(([name, value]) => ({
    name,
    value,
    total: totalLeads,
    color: ORIGEM_COLORS[name] || '#6B7280',
  }));

  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const funnelData = STATUS_CONFIG.map(config => ({
    ...config,
    count: statusCounts[config.status] || 0,
  }));

  const getConversionRate = (currentIndex: number) => {
    if (currentIndex === 0) return 100;
    const currentCount = funnelData[currentIndex].count;
    const previousCount = funnelData[currentIndex - 1].count;
    if (previousCount === 0) return 0;
    return Math.round((currentCount / previousCount) * 100);
  };

  // Soma de valor_causa por status
  const valorPorStatus = STATUS_CONFIG.map(config => {
    const totalValor = leads
      .filter(lead => lead.status === config.status)
      .reduce((sum, lead) => sum + (lead.valor_causa || 0), 0);
    return {
      status: config.label,
      valor: totalValor,
      color: config.color,
    };
  }).filter(item => item.valor > 0);

  const totalValorCausa = leads.reduce((sum, lead) => sum + (lead.valor_causa || 0), 0);

  return (
    <div className="space-y-4">
      {/* Relatório de Valor por Status */}
      <Card className="group rounded-xl shadow-soft border border-border/50 overflow-hidden bg-card hover:shadow-card-hover transition-all duration-300">
        <CardHeader className="bg-gradient-to-r from-success via-success/95 to-success/90 text-white py-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <DollarSign className="h-5 w-5" />
              </div>
              <span>Valor da Causa por Status</span>
            </CardTitle>
            <div className="text-right">
              <span className="text-2xl font-bold">{formatCurrency(totalValorCausa)}</span>
              <p className="text-xs text-white/70">Total em pipeline</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {valorPorStatus.length > 0 ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={valorPorStatus} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    type="number" 
                    tickFormatter={(value) => formatCurrency(value)}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="status" 
                    width={130}
                    tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Valor']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px hsla(0,0%,0%,0.1)',
                    }}
                    cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                  />
                  <Bar 
                    dataKey="valor" 
                    radius={[0, 8, 8, 0]}
                    className="transition-all duration-300"
                  >
                    {valorPorStatus.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                        className="hover:opacity-80 transition-opacity"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum lead com valor da causa informado
            </div>
          )}
          
          {/* Summary cards with hover effects */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5 pt-5 border-t border-border/30">
            {STATUS_CONFIG.map((config, index) => {
              const valor = leads
                .filter(lead => lead.status === config.status)
                .reduce((sum, lead) => sum + (lead.valor_causa || 0), 0);
              const count = statusCounts[config.status] || 0;
              
              return (
                <div 
                  key={config.status}
                  className="group/card p-3.5 rounded-xl bg-muted/30 border border-border/30 hover:border-border hover:bg-muted/50 hover:shadow-soft transition-all duration-300 hover:-translate-y-0.5"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className="w-3 h-3 rounded-full shrink-0 transition-transform duration-200 group-hover/card:scale-125"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-xs text-muted-foreground truncate">{config.label}</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(valor)}</p>
                  <p className="text-xs text-muted-foreground">{count} lead{count !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      {/* Origem Donut Chart */}
      <Card className="rounded-xl shadow-soft border border-border/50 overflow-hidden min-h-[400px] bg-card">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground py-3 px-4">
          <CardTitle className="text-sm font-semibold">Origem dos Leads</CardTitle>
        </CardHeader>
        <CardContent className="p-6 h-[340px]">
          {origemData.length > 0 ? (
            <div className="flex flex-col h-full">
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={origemData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {origemData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          className="transition-all duration-300 hover:opacity-80"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* Legend - Below chart */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-4 border-t border-border/30 mt-4">
                {origemData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full shrink-0 shadow-sm" 
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm font-medium text-foreground whitespace-nowrap">{entry.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({entry.value})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* Funnel - Better spacing */}
      <Card className="rounded-xl shadow-soft border border-border/50 overflow-hidden min-h-[400px] bg-card">
        <CardHeader className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground py-3 px-4">
          <CardTitle className="text-sm font-semibold">Funil de Vendas</CardTitle>
        </CardHeader>
        <CardContent className="p-6 h-[340px] flex flex-col">
          {leads.length > 0 ? (
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                {funnelData.map((stage, index) => {
                  const maxCount = Math.max(...funnelData.map(s => s.count), 1);
                  const widthPercent = Math.max((stage.count / maxCount) * 100, 30);
                  const conversionRate = getConversionRate(index);
                  
                  return (
                    <div key={stage.status} className="relative">
                      {index > 0 && (
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 flex items-center gap-0.5 text-xs text-muted-foreground bg-card px-2 py-0.5 rounded-full z-10 border border-border/50 shadow-sm">
                          <ArrowRight className="h-3 w-3 rotate-90" />
                          <span className="font-medium">{conversionRate}%</span>
                        </div>
                      )}
                      
                      <div 
                        className="relative mx-auto rounded-lg overflow-hidden transition-all duration-300 hover:scale-[1.02] shadow-md hover:shadow-lg cursor-default"
                        style={{ 
                          width: `${widthPercent}%`,
                          backgroundColor: stage.color,
                        }}
                      >
                        <div className="py-2.5 px-4 flex items-center justify-between min-w-0">
                          <span className="text-white text-sm font-medium truncate mr-2">
                            {stage.label}
                          </span>
                          <span className="text-white text-base font-bold shrink-0">
                            {stage.count}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="pt-4 border-t border-border/30 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Conversão Final:</span>
                <span className="font-bold text-lg text-success">
                  {totalLeads > 0 
                    ? `${Math.round((funnelData[funnelData.length - 1].count / totalLeads) * 100)}%`
                    : '0%'
                  }
                </span>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  </div>
  );
}