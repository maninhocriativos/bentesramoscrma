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

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  'Em Andamento': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Suspenso': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Arquivado': { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
  'Ganho': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Perdido': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

export function ProcessosTable({ processos, onProcessoClick, leads }: ProcessosTableProps) {
  const getClienteName = (clienteId: string | null) => {
    if (!clienteId) return '-';
    const lead = leads.find(l => l.id === clienteId);
    return lead?.nome || '-';
  };

  if (processos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground bg-card rounded-xl shadow-soft">
        <p>Nenhum processo encontrado.</p>
        <p className="text-sm mt-1">Clique em "Novo Processo" para adicionar.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-0 bg-card shadow-enterprise overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-primary hover:bg-primary border-0">
            <TableHead className="font-semibold text-primary-foreground">Número</TableHead>
            <TableHead className="font-semibold text-primary-foreground">Título da Ação</TableHead>
            <TableHead className="font-semibold text-primary-foreground">Cliente</TableHead>
            <TableHead className="font-semibold text-primary-foreground">Advogado</TableHead>
            <TableHead className="font-semibold text-primary-foreground">Status</TableHead>
            <TableHead className="font-semibold text-primary-foreground">Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {processos.map((processo, index) => (
            <TableRow 
              key={processo.id}
              className={`cursor-pointer hover:bg-muted/50 transition-colors ${index % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}
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
                {(() => {
                  const style = statusColors[processo.status || ''] || { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' };
                  return (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}>
                      {processo.status || 'Indefinido'}
                    </span>
                  );
                })()}
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
