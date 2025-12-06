import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lead } from '@/types/leads';

interface ChartsProps {
  leads: Lead[];
}

const ORIGEM_COLORS: Record<string, string> = {
  Instagram: '#E1306C',
  Google: '#4285F4',
  Site: '#34A853',
  Indicação: '#9B59B6',
  Outro: '#95A5A6',
};

const STATUS_ORDER = [
  'Lead Frio',
  'Em Atendimento',
  'Aguardando Contrato',
  'Contrato Assinado',
  'Ganho',
  'Perdido',
];

export function Charts({ leads }: ChartsProps) {
  // Dados para gráfico de pizza (origem)
  const origemData = leads.reduce((acc, lead) => {
    const origem = lead.origem || 'Outro';
    const existing = acc.find(item => item.name === origem);
    if (existing) {
      existing.value++;
    } else {
      acc.push({ name: origem, value: 1, color: ORIGEM_COLORS[origem] || ORIGEM_COLORS.Outro });
    }
    return acc;
  }, [] as { name: string; value: number; color: string }[]);

  // Dados para gráfico de barras (funil por status)
  const statusData = STATUS_ORDER.map(status => ({
    name: status.length > 12 ? status.substring(0, 12) + '...' : status,
    fullName: status,
    quantidade: leads.filter(l => l.status === status).length,
  })).filter(item => item.quantidade > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* Gráfico de Pizza - Origem */}
      <Card className="rounded-xl shadow-soft animate-fade-in">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Leads por Origem</CardTitle>
        </CardHeader>
        <CardContent>
          {origemData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={origemData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {origemData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Barras - Funil */}
      <Card className="rounded-xl shadow-soft animate-fade-in">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Funil de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statusData} layout="vertical">
                <XAxis type="number" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value, name, props) => [value, props.payload.fullName]}
                />
                <Bar 
                  dataKey="quantidade" 
                  fill="hsl(24, 21%, 21%)" 
                  radius={[0, 8, 8, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
