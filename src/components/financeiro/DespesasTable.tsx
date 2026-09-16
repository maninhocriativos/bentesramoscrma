import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Despesa } from '@/types/financeiro';
import { Badge } from '@/components/ui/badge';
import { TrendingDown } from 'lucide-react';
import { MarcarPagamentoPopover } from './MarcarPagamentoPopover';
import { FinanceiroEmptyState } from './FinanceiroEmptyState';

interface DespesasTableProps {
  despesas: Despesa[];
  loading: boolean;
  onUpdateDespesa?: (id: string, updates: Partial<Despesa>) => Promise<boolean>;
}

export function DespesasTable({ despesas, loading, onUpdateDespesa }: DespesasTableProps) {
  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (despesas.length === 0) return <FinanceiroEmptyState icon={TrendingDown} title="Nenhuma despesa cadastrada" subtitle='Clique em "Nova Despesa" para começar' />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Status</TableHead>
          {onUpdateDespesa && <TableHead>Ações</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {despesas.map(d => (
          <TableRow key={d.id}>
            <TableCell>{d.tipo}</TableCell>
            <TableCell>{d.descricao}</TableCell>
            <TableCell>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.valor)}</TableCell>
            <TableCell><Badge variant={d.status === 'Pago' ? 'default' : 'secondary'}>{d.status}</Badge></TableCell>
            {onUpdateDespesa && (
              <TableCell>
                {d.status === 'Pendente' && (
                  <MarcarPagamentoPopover
                    onConfirm={async (dataPagamento, contaBancariaId) => {
                      await onUpdateDespesa(d.id, { status: 'Pago', data_pagamento: dataPagamento, conta_bancaria_id: contaBancariaId });
                    }}
                  />
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
