import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Processo } from '@/types/processos';
import { Lead } from '@/types/leads';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProcessosTableProps {
  processos: Processo[];
  onProcessoClick: (processo: Processo) => void;
  leads: Lead[];
}

const statusColors: Record<string, string> = {
  'Em Andamento': 'bg-blue-100 text-blue-800',
  'Suspenso': 'bg-yellow-100 text-yellow-800',
  'Arquivado': 'bg-gray-100 text-gray-800',
  'Ganho': 'bg-green-100 text-green-800',
  'Perdido': 'bg-red-100 text-red-800',
};

export function ProcessosTable({ processos, onProcessoClick, leads }: ProcessosTableProps) {
  const getClienteName = (clienteId: string | null) => {
    if (!clienteId) return '-';
    const lead = leads.find(l => l.id === clienteId);
    return lead?.nome || '-';
  };

  if (processos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhum processo encontrado.</p>
        <p className="text-sm mt-1">Clique em "Novo Processo" para adicionar.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-soft overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Número</TableHead>
            <TableHead className="font-semibold">Título da Ação</TableHead>
            <TableHead className="font-semibold">Cliente</TableHead>
            <TableHead className="font-semibold">Advogado</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {processos.map((processo) => (
            <TableRow 
              key={processo.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onProcessoClick(processo)}
            >
              <TableCell className="font-mono text-sm">
                {processo.numero_processo || '-'}
              </TableCell>
              <TableCell className="font-medium">
                {processo.titulo_acao || '-'}
              </TableCell>
              <TableCell>
                {getClienteName(processo.cliente_id)}
              </TableCell>
              <TableCell>
                {processo.advogado_responsavel || '-'}
              </TableCell>
              <TableCell>
                <Badge className={`rounded-lg ${statusColors[processo.status || ''] || 'bg-muted'}`}>
                  {processo.status || 'Indefinido'}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {processo.created_at 
                  ? format(new Date(processo.created_at), 'dd/MM/yyyy', { locale: ptBR })
                  : '-'
                }
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
