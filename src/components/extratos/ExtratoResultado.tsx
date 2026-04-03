import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, UserPlus, RefreshCw, TrendingDown, AlertTriangle, Search, CalendarDays, Scale } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AnaliseConfig, AnaliseResultado } from '@/types/extratos';
import { gerarLaudoPdf } from '@/lib/extratoLaudoPdf';

interface Props {
  resultado: AnaliseResultado;
  config: AnaliseConfig;
  onNovaAnalise: () => void;
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'confirmado': return <Badge className="bg-green-100 text-green-800 border-green-200">Confirmado</Badge>;
    case 'indicio': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Indício</Badge>;
    default: return <Badge variant="outline">Verificar</Badge>;
  }
};

export function ExtratoResultado({ resultado, config, onNovaAnalise }: Props) {
  const { resumo, cobrancas_indevidas, por_categoria, recomendacao } = resultado;

  const handleEnviarCRM = async () => {
    try {
      const payload = {
        action: "create_lead",
        nome: config.nomeCliente || "Lead Conferência",
        telefone: "",
        email: "",
        tipo_origem: "trafego",
        tipo_acao: "Direito do Consumidor",
        origem: "Conferência de Extratos",
        fonte_trafego: "conferencia_extratos_crm",
        canal_origem: "crm_interno",
        empresa_tag: "bentes_ramos",
        banco: config.banco,
        score_ia: recomendacao.prioridade === 'alta' ? 90 : 70,
        resumo_ia: `Análise de extrato ${config.banco}: ${resumo.irregularidades_encontradas} irregularidades, R$ ${resumo.valor_total_indevido?.toFixed(2)} em cobranças indevidas.`,
        estimativa_recuperacao: resumo.valor_total_indevido,
        viabilidade: true,
      };

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-hub/webhook/automation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error('Falha ao enviar');
      toast.success('Lead criado no CRM com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar para CRM');
    }
  };

  const handlePdf = () => {
    gerarLaudoPdf(resultado, config);
    toast.success('PDF gerado com sucesso!');
  };

  // Build chart data from cobranças by month
  const chartData = (() => {
    const map = new Map<string, number>();
    (cobrancas_indevidas || []).forEach(c => {
      const month = c.data?.substring(0, 7) || 'N/D';
      map.set(month, (map.get(month) || 0) + (c.valor_total || c.valor_unitario || 0));
    });
    return Array.from(map.entries()).sort().map(([mes, valor]) => ({ mes, valor }));
  })();

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Lançamentos Analisados', value: resumo.total_lancamentos, icon: Search },
          { label: 'Irregularidades', value: resumo.irregularidades_encontradas, icon: AlertTriangle },
          { label: 'Valor Total Indevido', value: `R$ ${(resumo.valor_total_indevido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingDown, highlight: true },
          { label: 'Período', value: resumo.periodo_analisado || `${config.dataInicial} a ${config.dataFinal}`, icon: CalendarDays },
        ].map((m, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className={`text-lg font-bold ${m.highlight ? 'text-destructive' : 'text-foreground'}`}>{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela */}
      {cobrancas_indevidas?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Detalhamento das Cobranças Indevidas</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Base Legal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobrancas_indevidas.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{c.data}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{c.descricao}</TableCell>
                    <TableCell className="text-right whitespace-nowrap text-destructive font-medium">
                      R$ {(c.valor_total || c.valor_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell><Badge variant="outline">{c.categoria}</Badge></TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs">{c.base_legal}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Por Categoria */}
      {por_categoria?.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {por_categoria.map((cat, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground font-medium">{cat.categoria}</p>
                <p className="text-lg font-bold text-destructive">
                  R$ {(cat.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">{cat.ocorrencias} ocorrência(s)</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Linha do Tempo de Cobranças Indevidas</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']} />
                <Bar dataKey="valor" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recomendação */}
      {recomendacao && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> Recomendação Jurídica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Tipo de Ação Recomendada</p>
                <p className="font-medium">{recomendacao.tipo_acao}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Estimativa de Recuperação</p>
                <p className="font-bold text-destructive">
                  R$ {(recomendacao.estimativa_recuperacao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Prazo Prescricional</p>
                <p className="font-medium">{recomendacao.prazo_prescricional}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Prioridade</p>
                <Badge className={
                  recomendacao.prioridade === 'alta' ? 'bg-destructive/10 text-destructive' :
                  recomendacao.prioridade === 'media' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-muted text-muted-foreground'
                }>
                  {recomendacao.prioridade?.toUpperCase()}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Fundamentação Legal</p>
              <p className="text-sm">{recomendacao.fundamentacao}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handlePdf} className="flex-1">
          <Download className="h-4 w-4 mr-2" /> Baixar Laudo em PDF
        </Button>
        <Button variant="secondary" onClick={handleEnviarCRM} className="flex-1">
          <UserPlus className="h-4 w-4 mr-2" /> Enviar para CRM como Lead
        </Button>
        <Button variant="outline" onClick={onNovaAnalise} className="flex-1">
          <RefreshCw className="h-4 w-4 mr-2" /> Nova Análise
        </Button>
      </div>
    </div>
  );
}
