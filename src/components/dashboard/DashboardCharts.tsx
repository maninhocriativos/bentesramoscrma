import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lead } from '@/types/leads';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowRight } from 'lucide-react';

interface DashboardChartsProps {
  leads: Lead[];
}

const ORIGEM_COLORS: Record<string, string> = {
  'Instagram': '#C9B89B',
  'Google': '#8B7355',
  'Site': '#3F362D',
  'Indicação': '#D4C4A8',
  'Outro': '#6B5B4F',
};

const STATUS_CONFIG = [
  { status: 'Lead Frio', color: '#94a3b8', label: 'Lead Frio' },
  { status: 'Em Atendimento', color: '#3b82f6', label: 'Em Atendimento' },
  { status: 'Aguardando Contrato', color: '#f59e0b', label: 'Aguardando Contrato' },
  { status: 'Contrato Assinado', color: '#10b981', label: 'Contrato Assinado' },
  { status: 'Ganho', color: '#059669', label: 'Ganho' },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-2.5 text-sm">
        <p className="font-medium text-foreground">{payload[0].name}</p>
        <p className="text-muted-foreground">
          {payload[0].value} leads ({((payload[0].value / payload[0].payload.total) * 100).toFixed(0)}%)
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
    color: ORIGEM_COLORS[name] || '#6B5B4F',
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

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Origem Donut Chart */}
      <Card className="rounded-xl shadow-soft border border-border/50 overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground py-3 px-4">
          <CardTitle className="text-sm font-semibold">Origem dos Leads</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {origemData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={origemData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {origemData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Legend - Compact */}
              <div className="flex-1 space-y-2">
                {origemData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full shrink-0" 
                      style={{ backgroundColor: entry.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.value} ({((entry.value / totalLeads) * 100).toFixed(0)}%)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* Funnel - Compact */}
      <Card className="rounded-xl shadow-soft border border-border/50 overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground py-3 px-4">
          <CardTitle className="text-sm font-semibold">Funil de Vendas</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {leads.length > 0 ? (
            <div className="space-y-2">
              {funnelData.map((stage, index) => {
                const maxCount = Math.max(...funnelData.map(s => s.count), 1);
                const widthPercent = Math.max((stage.count / maxCount) * 100, 20);
                const conversionRate = getConversionRate(index);
                
                return (
                  <div key={stage.status} className="relative">
                    {index > 0 && (
                      <div className="absolute -top-1.5 left-1/2 transform -translate-x-1/2 flex items-center gap-0.5 text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded-full z-10">
                        <ArrowRight className="h-2.5 w-2.5 rotate-90" />
                        <span>{conversionRate}%</span>
                      </div>
                    )}
                    
                    <div 
                      className="relative mx-auto rounded-md overflow-hidden transition-all duration-300 hover:scale-[1.01]"
                      style={{ 
                        width: `${widthPercent}%`,
                        backgroundColor: stage.color,
                      }}
                    >
                      <div className="py-2 px-3 flex items-center justify-between">
                        <span className="text-white text-xs font-medium truncate">
                          {stage.label}
                        </span>
                        <span className="text-white text-sm font-bold">
                          {stage.count}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-xs">Conversão Final:</span>
                <span className="font-bold text-foreground">
                  {totalLeads > 0 
                    ? `${Math.round((funnelData[funnelData.length - 1].count / totalLeads) * 100)}%`
                    : '0%'
                  }
                </span>
              </div>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
