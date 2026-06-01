import { useMemo } from 'react';
import { useZapsignContratos } from '@/hooks/useZapsignContratos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Clock, CheckCircle2, XCircle, Zap, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ContratosZapsignWidget() {
  const { contratos, isLoading } = useZapsignContratos();
  const navigate = useNavigate();

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

    const trafegoAssinados = contratos.filter(
      (c) => c.tipoOrigem === 'trafego' && c.statusLocal === 'Assinado'
    ).length;
    const bentesRamosAssinados = contratos.filter(
      (c) => c.tipoOrigem === 'escritorio' && c.statusLocal === 'Assinado'
    ).length;

    const taxaConversao =
      total > 0 ? ((assinados / total) * 100).toFixed(0) : '0';

    return {
      total,
      emAssinatura,
      assinados,
      cancelados,
      trafegoAssinados,
      bentesRamosAssinados,
      taxaConversao,
    };
  }, [contratos]);

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardContent className="pt-6 flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">Carregando contratos...</p>
        </CardContent>
      </Card>
    );
  }

  if (stats.total === 0) {
    return null; // Não mostrar widget se não houver contratos
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-cyan-600" />
          <h3 className="font-semibold text-foreground">Contratos Zapsign</h3>
          <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">
            Novo
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/contratos?provider=zapsign')}
          className="text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
        >
          Ver todos →
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">documentos</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Em Assinatura</p>
            <p className="text-2xl font-bold text-amber-600">{stats.emAssinatura}</p>
            <p className="text-xs text-muted-foreground mt-1">aguardando</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Assinados</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.assinados}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.taxaConversao}% conclusão
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Cancelados</p>
            <p className="text-2xl font-bold text-red-600">{stats.cancelados}</p>
            <p className="text-xs text-muted-foreground mt-1">rejeitados/expirados</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown por origem */}
      <div className="grid grid-cols-2 gap-3">
        {/* Tráfego */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-blue-700">TRÁFEGO</span>
              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                {stats.trafegoAssinados}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Assinados</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Leads originários de campanhas pagas
            </p>
          </CardContent>
        </Card>

        {/* Bentes Ramos */}
        <Card className="border-purple-200 bg-purple-50/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-purple-700">BENTES RAMOS</span>
              <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                {stats.bentesRamosAssinados}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">Assinados</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Leads diretos do escritório
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Últimos contratos */}
      {stats.total > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Últimos Contratos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {contratos.slice(0, 3).map((contrato) => (
                <div
                  key={contrato.id}
                  className="flex items-center justify-between py-2 px-2 rounded-lg bg-muted/20 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs truncate">
                      {contrato.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {contrato.leadNome || contrato.signers?.[0]?.name}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 ml-2 text-xs ${
                      contrato.statusLocal === 'Assinado'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : contrato.statusLocal === 'Aguardando Assinatura'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {contrato.statusLocal}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
