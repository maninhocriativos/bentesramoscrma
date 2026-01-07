import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileSignature, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ExternalLink, 
  FileText,
  Mail,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ContratoComStatus } from '@/pages/ContratosPage';
import { cn } from '@/lib/utils';

interface ContratosTableProps {
  contratos: ContratoComStatus[];
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  'Documento Enviado': { 
    label: 'Enviado', 
    color: 'text-blue-700 dark:text-blue-400', 
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: <FileSignature className="h-3.5 w-3.5" /> 
  },
  'Aguardando Assinatura': { 
    label: 'Aguardando', 
    color: 'text-amber-700 dark:text-amber-400', 
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    icon: <Clock className="h-3.5 w-3.5" /> 
  },
  'Assinatura Parcial': { 
    label: 'Parcial', 
    color: 'text-orange-700 dark:text-orange-400', 
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    icon: <AlertCircle className="h-3.5 w-3.5" /> 
  },
  'Assinado': { 
    label: 'Assinado', 
    color: 'text-emerald-700 dark:text-emerald-400', 
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    icon: <CheckCircle2 className="h-3.5 w-3.5" /> 
  },
  'Finalizado': { 
    label: 'Finalizado', 
    color: 'text-green-700 dark:text-green-400', 
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: <CheckCircle2 className="h-3.5 w-3.5" /> 
  },
  'Prazo Expirado': { 
    label: 'Expirado', 
    color: 'text-red-700 dark:text-red-400', 
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: <XCircle className="h-3.5 w-3.5" /> 
  },
  'Cancelado': { 
    label: 'Cancelado', 
    color: 'text-gray-700 dark:text-gray-400', 
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    icon: <XCircle className="h-3.5 w-3.5" /> 
  },
  'Recusado': { 
    label: 'Recusado', 
    color: 'text-red-700 dark:text-red-400', 
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: <XCircle className="h-3.5 w-3.5" /> 
  },
};

export function ContratosTable({ contratos }: ContratosTableProps) {
  const navigate = useNavigate();

  if (contratos.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Nenhum contrato encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Seus documentos do Clicksign aparecerão aqui quando você enviar contratos para assinatura.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop Table */}
      <Card className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                  Documento
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                  Signatário
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                  Última Atualização
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contratos.map((contrato) => {
                const config = statusConfig[contrato.status] || statusConfig['Aguardando Assinatura'];
                
                return (
                  <tr 
                    key={contrato.id} 
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileSignature className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-sm truncate max-w-[200px]">
                          {contrato.leadNome}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {contrato.leadEmail ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[180px]">{contrato.leadEmail}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge 
                        variant="secondary"
                        className={cn(
                          "flex items-center gap-1.5 w-fit font-medium",
                          config.bgColor,
                          config.color
                        )}
                      >
                        {config.icon}
                        {config.label}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      {contrato.lastUpdate ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(contrato.lastUpdate).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {contrato.leadId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/leads/${contrato.leadId}`)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Ver Lead
                          </Button>
                        )}
                        <a
                          href={contrato.linkContrato}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Clicksign
                          </Button>
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {contratos.map((contrato) => {
          const config = statusConfig[contrato.status] || statusConfig['Aguardando Assinatura'];
          
          return (
            <Card 
              key={contrato.id} 
              className="overflow-hidden hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileSignature className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{contrato.leadNome}</p>
                      {contrato.leadEmail && (
                        <p className="text-xs text-muted-foreground truncate">{contrato.leadEmail}</p>
                      )}
                    </div>
                  </div>
                  <Badge 
                    variant="secondary"
                    className={cn(
                      "flex items-center gap-1 shrink-0 text-xs",
                      config.bgColor,
                      config.color
                    )}
                  >
                    {config.icon}
                    {config.label}
                  </Badge>
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  {contrato.lastUpdate && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(contrato.lastUpdate).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                  <a
                    href={contrato.linkContrato}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto"
                  >
                    <Button variant="ghost" size="sm" className="gap-1 h-8 text-xs">
                      Abrir
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
