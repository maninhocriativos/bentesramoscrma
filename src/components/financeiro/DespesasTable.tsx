import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Despesa } from '@/types/financeiro';
import { Badge } from '@/components/ui/badge';

export function DespesasTable({ despesas, loading }: { despesas: Despesa[]; loading: boolean }) {
  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (despesas.length === 0) return <p className="text-center py-8 text-muted-foreground">Nenhuma despesa cadastrada</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {despesas.map(d => (
          <TableRow key={d.id}>
            <TableCell>{d.tipo}</TableCell>
            <TableCell>{d.descricao}</TableCell>
            <TableCell>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.valor)}</TableCell>
            <TableCell><Badge variant={d.status === 'Pago' ? 'default' : 'secondary'}>{d.status}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
