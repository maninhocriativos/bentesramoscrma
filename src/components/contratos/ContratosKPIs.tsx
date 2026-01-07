import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, XCircle, CheckCircle2, FileSignature, RefreshCw, Loader2, Send, TrendingUp, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContratosKPIsProps {
  data: {
    emProcesso: number;
    recusados: number;
    finalizados: number;
    cancelados: number;
    total: number;
  };
  onRefresh: () => void;
  onSendContract: () => void;
  refreshing?: boolean;
}

export function ContratosKPIs({ data, onRefresh, onSendContract, refreshing = false }: ContratosKPIsProps) {
  const taxaSucesso = data.total > 0 
    ? Math.round((data.finalizados / data.total) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-4 md:p-6 text-primary-foreground">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAzMHYySDI0di0yaDEyek0zNiAyNnYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <FileSignature className="h-6 w-6 md:h-7 md:w-7" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Gestão de Contratos</h1>
              <p className="text-sm md:text-base text-primary-foreground/80">
                {data.total} documentos • {taxaSucesso}% taxa de sucesso
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={onRefresh} 
              disabled={refreshing}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            <Button 
              size="sm" 
              onClick={onSendContract}
              className="bg-white text-primary hover:bg-white/90"
            >
              <Send className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Enviar Contrato</span>
              <span className="sm:hidden">Enviar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Em Processo */}
        <Card className={cn(
          "relative overflow-hidden border-0 shadow-md",
          "bg-gradient-to-br from-amber-500/10 to-orange-500/5"
        )}>
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="h-9 w-9 md:h-10 md:w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-4 w-4 md:h-5 md:w-5 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-amber-700 dark:text-amber-500">{data.emProcesso}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">Em processo</p>
          </CardContent>
        </Card>

        {/* Finalizados */}
        <Card className={cn(
          "relative overflow-hidden border-0 shadow-md",
          "bg-gradient-to-br from-emerald-500/10 to-green-500/5"
        )}>
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="h-9 w-9 md:h-10 md:w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-emerald-700 dark:text-emerald-500">{data.finalizados}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">Finalizados</p>
          </CardContent>
        </Card>

        {/* Recusados */}
        <Card className={cn(
          "relative overflow-hidden border-0 shadow-md",
          "bg-gradient-to-br from-red-500/10 to-rose-500/5"
        )}>
          <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="h-9 w-9 md:h-10 md:w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <XCircle className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-red-700 dark:text-red-500">{data.cancelados}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">Cancelados</p>
          </CardContent>
        </Card>

        {/* Taxa de Sucesso */}
        <Card className={cn(
          "relative overflow-hidden border-0 shadow-md",
          "bg-gradient-to-br from-primary/10 to-primary/5"
        )}>
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="h-9 w-9 md:h-10 md:w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-primary">{taxaSucesso}%</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">Taxa sucesso</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
