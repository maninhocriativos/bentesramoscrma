import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Parcela } from '@/types/financeiro';
import { Badge } from '@/components/ui/badge';
import { MarcarPagamentoPopover } from './MarcarPagamentoPopover';

export function ParcelasTable({ parcelas, loading, onUpdateParcela }: { parcelas: Parcela[]; loading: boolean; onUpdateParcela: (id: string, updates: Partial<Parcela>) => Promise<boolean> }) {
  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (parcelas.length === 0) return <p className="text-center py-8 text-muted-foreground">Nenhuma parcela cadastrada</p>;

  const statusColor = (status: string) => {
    if (status === 'Pago') return 'bg-green-100 text-green-800';
    if (status === 'Atrasado') return 'bg-red-100 text-red-800';
    return 'bg-amber-100 text-amber-800';
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nº</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {parcelas.map(p => (
          <TableRow key={p.id}>
            <TableCell>{p.numero}</TableCell>
            <TableCell>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.valor)}</TableCell>
            <TableCell>{p.data_vencimento}</TableCell>
            <TableCell><Badge className={statusColor(p.status)}>{p.status}</Badge></TableCell>
            <TableCell>
              {p.status === 'Pendente' && (
                <MarcarPagamentoPopover
                  onConfirm={async (dataPagamento, contaBancariaId) => {
                    await onUpdateParcela(p.id, { status: 'Pago', data_pagamento: dataPagamento, conta_bancaria_id: contaBancariaId });
                  }}
                />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
