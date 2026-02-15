import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lead } from '@/types/leads';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { ArrowRight, DollarSign, PieChart as PieChartIcon, Layers } from 'lucide-react';

interface DashboardChartsProps {
  leads: Lead[];
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
};

// Harmonized with Bentes Ramos palette - warm tones + stage tokens
const ORIGEM_COLORS: Record<string, string> = {
  'Escritório': 'hsl(24, 16%, 37%)',      // stage-bentes
  'Tráfego Pago': 'hsl(38, 30%, 70%)',    // gold
  'Bentes Ramos': 'hsl(24, 21%, 21%)',    // primary
  'Site': 'hsl(142, 76%, 36%)',           // success
  'WhatsApp Z-API': 'hsl(24, 16%, 50%)',  // warm brown mid
  'Facebook': 'hsl(38, 30%, 55%)',        // darker gold
  'WhatsApp': 'hsl(24, 21%, 35%)',        // mid brown
  'Instagram': 'hsl(0, 84%, 60%)',        // destructive (accent)
  'Indicação': 'hsl(142, 50%, 50%)',      // success lighter
  'Google': 'hsl(38, 40%, 60%)',          // gold variation
  'Outro': 'hsl(24, 10%, 65%)',           // neutral warm
};

const STATUS_CONFIG = [
  { status: 'Lead Frio', color: 'hsl(24, 10%, 55%)', label: 'Lead Frio' },
  { status: 'Em Atendimento', color: 'hsl(38, 30%, 70%)', label: 'Em Atendimento' },
  { status: 'Em Negociação', color: 'hsl(24, 21%, 35%)', label: 'Em Negociação' },
  { status: 'Aguardando Contrato', color: 'hsl(38, 40%, 55%)', label: 'Aguardando Contrato' },
  { status: 'Contrato Assinado', color: 'hsl(24, 21%, 21%)', label: 'Contrato Assinado' },
  { status: 'Ganho', color: 'hsl(142, 76%, 36%)', label: 'Ganho' },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const percentage = payload[0].payload.total > 0 
      ? ((payload[0].value / payload[0].payload.total) * 100).toFixed(0) : 0;
    return (
      <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-sm">
        <p className="font-semibold text-foreground">{payload[0].name}</p>
        <p className="text-muted-foreground">{payload[0].value} leads ({percentage}%)</p>
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
    name, value, total: totalLeads, color: ORIGEM_COLORS[name] || 'hsl(24, 10%, 65%)',
  }));

  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const funnelData = STATUS_CONFIG.map(config => ({
    ...config, count: statusCounts[config.status] || 0,
  }));

  const getConversionRate = (currentIndex: number) => {
    if (currentIndex === 0) return 100;
    const currentCount = funnelData[currentIndex].count;
    const previousCount = funnelData[currentIndex - 1].count;
    if (previousCount === 0) return 0;
    return Math.round((currentCount / previousCount) * 100);
  };

  const valorPorStatus = STATUS_CONFIG.map(config => {
    const totalValor = leads.filter(lead => lead.status === config.status).reduce((sum, lead) => sum + (lead.valor_causa || 0), 0);
    return { status: config.label, valor: totalValor, color: config.color };
  }).filter(item => item.valor > 0);

  const totalValorCausa = leads.reduce((sum, lead) => sum + (lead.valor_causa || 0), 0);

  return (
    <div className="space-y-6">
      {/* Valor por Status */}
      <Card className="rounded-2xl border-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
        <div className="h-1 w-full bg-[hsl(var(--success))]" />
        <CardHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--success))]/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-[hsl(var(--success))]" />
              </div>
              Valor da Causa por Status
            </CardTitle>
            <div className="text-right">
              <span className="text-xl font-bold text-foreground">{formatCurrency(totalValorCausa)}</span>
              <p className="text-[10px] text-muted-foreground">Total em pipeline</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {valorPorStatus.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={valorPorStatus} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="status" width={130} tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Valor']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                  <Bar dataKey="valor" radius={[0, 8, 8, 0]}>
                    {valorPorStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum lead com valor da causa informado
            </div>
          )}
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-5 pt-4 border-t border-border/30">
            {STATUS_CONFIG.map((config) => {
              const valor = leads.filter(lead => lead.status === config.status).reduce((sum, lead) => sum + (lead.valor_causa || 0), 0);
              const count = statusCounts[config.status] || 0;
              return (
                <div key={config.status} className="p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                    <span className="text-[10px] text-muted-foreground truncate">{config.label}</span>
                  </div>
                  <p className="text-xs font-bold text-foreground">{formatCurrency(valor)}</p>
                  <p className="text-[10px] text-muted-foreground">{count} lead{count !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 items-start">
        {/* Origem */}
        <Card className="rounded-2xl border-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
          <div className="h-1 w-full bg-primary" />
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <PieChartIcon className="h-4 w-4 text-primary" />
              </div>
              Origem dos Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {origemData.length > 0 ? (
              <div className="flex flex-col">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={origemData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" stroke="none">
                        {origemData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} className="transition-all duration-300 hover:opacity-80" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-3 border-t border-border/30 mt-2">
                  {origemData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-xs font-medium text-foreground">{entry.name}</span>
                      <span className="text-[10px] text-muted-foreground">({entry.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Nenhum dado</div>
            )}
          </CardContent>
        </Card>

        {/* Funnel */}
        <Card className="rounded-2xl border-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
          <div className="h-1 w-full bg-[hsl(var(--gold))]" />
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--gold))]/10 flex items-center justify-center">
                <Layers className="h-4 w-4 text-[hsl(var(--gold))]" />
              </div>
              Funil de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex flex-col">
            {leads.length > 0 ? (
              <div className="flex flex-col gap-4">
                <div className="space-y-3">
                  {funnelData.map((stage, index) => {
                    const maxCount = Math.max(...funnelData.map(s => s.count), 1);
                    const widthPercent = Math.max((stage.count / maxCount) * 100, 45);
                    const conversionRate = getConversionRate(index);
                    
                    return (
                      <div key={stage.status} className="relative">
                        {index > 0 && (
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 flex items-center gap-0.5 text-[10px] text-muted-foreground bg-card px-2 py-0.5 rounded-full z-10 border border-border/40 shadow-sm">
                            <ArrowRight className="h-2.5 w-2.5 rotate-90" />
                            <span className="font-semibold">{conversionRate}%</span>
                          </div>
                        )}
                        
                        <div 
                          className="relative mx-auto rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                          style={{ width: `${widthPercent}%`, backgroundColor: stage.color }}
                        >
                          <div className="py-2.5 px-4 flex items-center justify-between min-w-0">
                            <span className="text-white text-xs font-medium whitespace-nowrap mr-2">{stage.label}</span>
                            <span className="text-white text-sm font-bold shrink-0">{stage.count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="pt-4 border-t border-border/30 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground text-xs">Conversão Final</span>
                  <span className="font-bold text-lg text-[hsl(var(--success))]">
                    {totalLeads > 0 ? `${Math.round((funnelData[funnelData.length - 1].count / totalLeads) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Nenhum dado</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
