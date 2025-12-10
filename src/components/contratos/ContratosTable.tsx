import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSignature, Clock, CheckCircle2, XCircle, AlertCircle, ExternalLink, ChevronRight, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ContratoComStatus } from '@/pages/ContratosPage';

interface ContratosTableProps {
  contratos: ContratoComStatus[];
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'Documento Enviado': { label: 'Enviado', color: 'bg-blue-100 text-blue-700', icon: <FileSignature className="h-3.5 w-3.5" /> },
  'Aguardando Assinatura': { label: 'Aguardando', color: 'bg-amber-100 text-amber-700', icon: <Clock className="h-3.5 w-3.5" /> },
  'Assinatura Parcial': { label: 'Parcial', color: 'bg-orange-100 text-orange-700', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  'Assinado': { label: 'Assinado', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  'Finalizado': { label: 'Finalizado', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  'Prazo Expirado': { label: 'Expirado', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-3.5 w-3.5" /> },
  'Cancelado': { label: 'Cancelado', color: 'bg-gray-100 text-gray-700', icon: <XCircle className="h-3.5 w-3.5" /> },
  'Recusado': { label: 'Recusado', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-3.5 w-3.5" /> },
};

export function ContratosTable({ contratos }: ContratosTableProps) {
  const navigate = useNavigate();

  if (contratos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="text-lg font-medium text-muted-foreground">Nenhum contrato encontrado</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Seus documentos do Clicksign aparecerão aqui
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lista de Contratos ({contratos.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Documento</TableHead>
              <TableHead>Email do Signatário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Última Atualização</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contratos.map((contrato) => {
              const config = statusConfig[contrato.status] || statusConfig['Aguardando Assinatura'];
              
              return (
                <TableRow key={contrato.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileSignature className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{contrato.leadNome}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {contrato.leadEmail || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${config.color} flex items-center gap-1 w-fit`}>
                      {config.icon}
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {contrato.lastUpdate ? (
                      <span className="text-sm text-muted-foreground">
                        {new Date(contrato.lastUpdate).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {contrato.leadId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/leads/${contrato.leadId}`)}
                        >
                          Ver Lead
                        </Button>
                      )}
                      <a
                        href={contrato.linkContrato}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex"
                      >
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Clicksign
                        </Button>
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
