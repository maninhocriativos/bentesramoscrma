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

  return (
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
  );
}