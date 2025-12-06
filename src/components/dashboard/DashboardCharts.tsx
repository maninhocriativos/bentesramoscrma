import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lead } from '@/types/leads';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DashboardChartsProps {
  leads: Lead[];
}

const ORIGEM_COLORS: Record<string, string> = {
  'Instagram': '#E4405F',
  'Google': '#4285F4',
  'Site': '#3F362D',
  'Indicação': '#C9B89B',
  'Outro': '#9CA3AF',
};

const STATUS_ORDER = [
  'Lead Frio',
  'Em Atendimento',
  'Aguardando Contrato',
  'Contrato Assinado',
  'Ganho',
  'Perdido',
];

export function DashboardCharts({ leads }: DashboardChartsProps) {
  // Origem pie chart data
  const origemCounts = leads.reduce((acc, lead) => {
    const origem = lead.origem || 'Outro';
    acc[origem] = (acc[origem] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const origemData = Object.entries(origemCounts).map(([name, value]) => ({
    name,
    value,
    color: ORIGEM_COLORS[name] || '#9CA3AF',
  }));

  // Status funnel data
  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = STATUS_ORDER.map(status => ({
    name: status,
    value: statusCounts[status] || 0,
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Origem Chart */}
      <Card className="rounded-xl shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Origem dos Leads</CardTitle>
        </CardHeader>
        <CardContent>
          {origemData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={origemData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => 
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                >
                  {origemData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* Funnel Chart */}
      <Card className="rounded-xl shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Funil de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={statusData} layout="vertical">
                <XAxis type="number" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar 
                  dataKey="value" 
                  fill="hsl(24, 21%, 21%)" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
