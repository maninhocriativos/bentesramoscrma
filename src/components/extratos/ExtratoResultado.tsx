import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, UserPlus, RefreshCw, TrendingDown, AlertTriangle, Search, CalendarDays, Scale, FileSpreadsheet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";
import type { AnaliseConfig, AnaliseResultado } from "@/types/extratos";
import { gerarLaudoPdf } from "@/lib/extratoLaudoPdf";
import { gerarLaudoExcel } from "@/lib/extratoLaudoExcel";

interface Props {
  resultado: AnaliseResultado;
  config: AnaliseConfig;
  onNovaAnalise: () => void;
}

const statusBadge = (status: string) => {
  switch (status) {
    case "confirmado":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Confirmado</Badge>;
    case "indicio":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Indício</Badge>;
    default:
      return <Badge variant="outline">Verificar</Badge>;
  }
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export function ExtratoResultado({ resultado, config, onNovaAnalise }: Props) {
  const { resumo, cobrancas_indevidas, recomendacao } = resultado;

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
        score_ia: recomendacao.prioridade === "alta" ? 90 : 70,
        resumo_ia: `Análise de extrato ${config.banco}: ${resumo.irregularidades_encontradas} irregularidades, R$ ${resumo.valor_total_indevido?.toFixed(2)} em cobranças indevidas.`,
        estimativa_recuperacao: resumo.valor_total_indevido,
        viabilidade: true,
      };

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-hub/webhook/automation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Falha ao enviar");
      toast.success("Lead criado no CRM com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar para CRM");
    }
  };

  const handlePdf = () => {
    gerarLaudoPdf(resultado, config);
    toast.success("PDF gerado com sucesso!");
  };

  const handleExcel = async () => {
    try {
      await gerarLaudoExcel(resultado, config);
      toast.success("Excel gerado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao gerar Excel: " + err.message);
    }
  };

  // Agrupa por mês/ano. As datas vêm como "DD/MM/AAAA" (ou ISO "AAAA-MM-DD").
  // Chave ordenável "AAAA-MM"; rótulo exibido "MM/AAAA".
  const mesAnoKey = (data: string): string => {
    const s = (data || "").trim();
    const br = s.match(/(\d{2})\/(\d{2})\/(\d{2,4})/); // DD/MM/AAAA
    if (br) return `${br[3].length === 2 ? "20" + br[3] : br[3]}-${br[2]}`;
    const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    return iso ? `${iso[1]}-${iso[2]}` : "";
  };
  const chartData = (() => {
    const map = new Map<string, number>();
    (cobrancas_indevidas || []).forEach((c) => {
      const k = mesAnoKey(c.data);
      if (!k) return;
      map.set(k, (map.get(k) || 0) + (c.valor_total || c.valor_unitario || 0));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, valor]) => {
        const [y, m] = k.split("-");
        return { mes: `${m}/${y}`, valor };
      });
  })();

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Lançamentos Analisados", value: resumo.total_lancamentos, icon: Search },
          { label: "Irregularidades", value: resumo.irregularidades_encontradas, icon: AlertTriangle },
          {
            label: "Valor Total Indevido",
            value: `R$ ${fmt(resumo.valor_total_indevido || 0)}`,
            icon: TrendingDown,
            highlight: true,
          },
          {
            label: "Período",
            value: resumo.periodo_analisado || `${config.dataInicial} a ${config.dataFinal}`,
            icon: CalendarDays,
          },
        ].map((m, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className={`text-lg font-bold ${m.highlight ? "text-destructive" : "text-foreground"}`}>{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela detalhada — análise individual item a item */}
      {cobrancas_indevidas?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento Individual das Cobranças Indevidas</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[280px]">Análise Individual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobrancas_indevidas.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">{c.data}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{c.descricao}</TableCell>
                    <TableCell className="text-right whitespace-nowrap text-destructive font-bold">
                      R$ {fmt(c.valor_total || c.valor_unitario || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.categoria}</Badge>
                    </TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell className="text-xs align-top">
                      <p>{c.justificativa}</p>
                      <p className="text-muted-foreground mt-1 italic">{c.base_legal}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Gráfico */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Linha do Tempo de Cobranças Indevidas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`R$ ${fmt(v)}`, "Valor"]} />
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
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" /> Recomendação Jurídica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Tipo de Ação Recomendada</p>
                <p className="font-medium">{recomendacao.tipo_acao}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Estimativa de Recuperação</p>
                <p className="font-bold text-destructive">R$ {fmt(recomendacao.estimativa_recuperacao || 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Prazo Prescricional</p>
                <p className="font-medium">{recomendacao.prazo_prescricional}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Prioridade</p>
                <Badge
                  className={
                    recomendacao.prioridade === "alta"
                      ? "bg-destructive/10 text-destructive"
                      : recomendacao.prioridade === "media"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-muted text-muted-foreground"
                  }
                >
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
        <Button onClick={handleExcel} variant="outline" className="flex-1 border-green-600 text-green-700 hover:bg-green-50">
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Baixar em Excel
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
