import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, XCircle, CheckCircle2, FileSignature, RefreshCw, Loader2, Send } from 'lucide-react';

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
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          Documentos
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
          <Button size="sm" onClick={onSendContract}>
            <Send className="h-4 w-4 mr-2" />
            Enviar Contrato
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Neste momento */}
        <Card className="bg-amber-50/50 border-amber-200/50">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-3">Neste momento</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-3xl font-bold text-amber-700">{data.emProcesso}</p>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Em processo
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-red-600">{data.recusados}</p>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <XCircle className="h-4 w-4" />
                  Assinaturas recusadas
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-3">Resumo geral</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-3xl font-bold text-emerald-600">{data.finalizados}</p>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Finalizados
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-red-600">{data.cancelados}</p>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Cancelados
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
