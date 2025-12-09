import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Timesheet } from '@/types/tarefas';
import { Badge } from '@/components/ui/badge';

export function TimesheetTable({ registros, loading }: { registros: Timesheet[]; loading: boolean }) {
  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (registros.length === 0) return <p className="text-center py-8 text-muted-foreground">Nenhum registro de horas</p>;

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Duração</TableHead>
          <TableHead>Faturável</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {registros.map(r => (
          <TableRow key={r.id}>
            <TableCell>{r.data_atividade}</TableCell>
            <TableCell>{r.descricao}</TableCell>
            <TableCell>{r.tipo_atividade || '-'}</TableCell>
            <TableCell>{formatDuration(r.duracao_minutos)}</TableCell>
            <TableCell><Badge variant={r.faturavel ? 'default' : 'secondary'}>{r.faturavel ? 'Sim' : 'Não'}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
