import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, CheckCircle2, XCircle } from 'lucide-react';
import type { ContratoZapsignComStatus } from '@/hooks/useZapsignContratos';

interface ZapsignContratosKPIsProps {
  contratos: ContratoZapsignComStatus[];
  isLoading: boolean;
}

export function ZapsignContratosKPIs({
  contratos,
  isLoading,
}: ZapsignContratosKPIsProps) {
  const stats = useMemo(() => {
    const total = contratos.length;
    const emAssinatura = contratos.filter(
      (c) => c.statusLocal === 'Aguardando Assinatura'
    ).length;
    const assinados = contratos.filter(
      (c) => c.statusLocal === 'Assinado'
    ).length;
    const cancelados = contratos.filter(
      (c) =>
        c.statusLocal === 'Cancelado' ||
        c.statusLocal === 'Rejeitado' ||
        c.statusLocal === 'Expirado'
    ).length;

    // Separado por origem
    const trafegoTotal     = contratos.filter(c => c.tipoOrigem === 'trafego').length;
    const escritorioTotal  = contratos.filter(c => c.tipoOrigem === 'escritorio').length;
    const trafegoAssinados    = contratos.filter(c => c.tipoOrigem === 'trafego'    && c.statusLocal === 'Assinado').length;
    const escritorioAssinados = contratos.filter(c => c.tipoOrigem === 'escritorio' && c.statusLocal === 'Assinado').length;
    const trafegoTaxa    = trafegoTotal    > 0 ? ((trafegoAssinados    / trafegoTotal)    * 100).toFixed(1) : '0';
    const escritorioTaxa = escritorioTotal > 0 ? ((escritorioAssinados / escritorioTotal) * 100).toFixed(1) : '0';

    return {
      total, emAssinatura, assinados, cancelados,
      trafegoTotal, escritorioTotal,
      trafegoAssinados, escritorioAssinados,
      trafegoTaxa, escritorioTaxa,
    };
  }, [contratos]);

  const KPICard = ({
    title,
    value,
    icon: Icon,
    bgColor,
    iconColor,
    subtexto,
  }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    bgColor: string;
    iconColor: string;
    subtexto?: string;
  }) => (
    <Card className="border-border">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtexto && (
              <p className="text-xs text-muted-foreground mt-1">{subtexto}</p>
            )}
          </div>
          <div className={`${bgColor} p-3 rounded-lg`}>{Icon}</div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* KPIs principais */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total de Contratos"
          value={stats.total}
          icon={<FileText className="h-6 w-6 text-[#c9a96e]" />}
          bgColor="bg-[#c9a96e]/10"
          iconColor="text-[#c9a96e]"
          subtexto={`${stats.assinados} assinados`}
        />
        <KPICard
          title="Em Assinatura"
          value={stats.emAssinatura}
          icon={<Clock className="h-6 w-6 text-amber-500" />}
          bgColor="bg-amber-50"
          iconColor="text-amber-500"
          subtexto="Aguardando assinatura"
        />
        <KPICard
          title="Assinados"
          value={stats.assinados}
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
          bgColor="bg-emerald-50"
          iconColor="text-emerald-500"
          subtexto={`${((stats.assinados / Math.max(stats.total, 1)) * 100).toFixed(0)}% de conclusão`}
        />
        <KPICard
          title="Cancelados"
          value={stats.cancelados}
          icon={<XCircle className="h-6 w-6 text-red-500" />}
          bgColor="bg-red-50"
          iconColor="text-red-500"
          subtexto="Cancelados/Rejeitados"
        />
      </div>

      {/* Breakdown por origem */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Tráfego */}
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/60 to-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100">
                <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </span>
              Cliente de Tráfego
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{stats.trafegoTotal}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Assinados</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{stats.trafegoAssinados}</Badge>
              </div>
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="text-xs font-medium">Taxa de Conversão</span>
                <span className="text-xl font-bold text-blue-600">{stats.trafegoTaxa}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Escritório */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50/60 to-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100">
                <svg className="h-3.5 w-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </span>
              Cliente do Escritório
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total</span>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{stats.escritorioTotal}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Assinados</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{stats.escritorioAssinados}</Badge>
              </div>
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="text-xs font-medium">Taxa de Conversão</span>
                <span className="text-xl font-bold text-purple-600">{stats.escritorioTaxa}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
