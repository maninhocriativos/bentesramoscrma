import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Honorario } from '@/types/financeiro';
import { Badge } from '@/components/ui/badge';

export function HonorariosTable({ honorarios, loading }: { honorarios: Honorario[]; loading: boolean }) {
  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (honorarios.length === 0) return <p className="text-center py-8 text-muted-foreground">Nenhum honorário cadastrado</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo</TableHead>
          <TableHead>Valor Total</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {honorarios.map(h => (
          <TableRow key={h.id}>
            <TableCell>{h.tipo}</TableCell>
            <TableCell>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(h.valor_total)}</TableCell>
            <TableCell><Badge variant={h.status === 'Ativo' ? 'default' : 'secondary'}>{h.status}</Badge></TableCell>
            <TableCell>{h.data_contrato}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
