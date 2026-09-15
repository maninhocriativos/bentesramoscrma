import { useState, Fragment } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Honorario } from '@/types/financeiro';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { useParcelas } from '@/hooks/useFinanceiro';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function ParcelasExpandidas({ honorarioId }: { honorarioId: string }) {
  const { parcelas, loading } = useParcelas(honorarioId);
  if (loading) return <div className="py-3 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (parcelas.length === 0) return <p className="py-3 text-center text-xs text-muted-foreground">Nenhuma parcela gerada.</p>;
  return (
    <div className="py-2 px-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left font-semibold py-1 px-2">Nº</th>
            <th className="text-left font-semibold py-1 px-2">Valor</th>
            <th className="text-left font-semibold py-1 px-2">Vencimento</th>
            <th className="text-left font-semibold py-1 px-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {parcelas.map(p => (
            <tr key={p.id} className="border-t border-border/30">
              <td className="py-1.5 px-2">{p.numero}</td>
              <td className="py-1.5 px-2 font-medium">{fmt(p.valor)}</td>
              <td className="py-1.5 px-2">{p.data_vencimento}</td>
              <td className="py-1.5 px-2"><Badge variant={p.status === 'Pago' ? 'default' : 'secondary'} className="text-[10px]">{p.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HonorariosTable({ honorarios, loading }: { honorarios: Honorario[]; loading: boolean }) {
  const [expandido, setExpandido] = useState<string | null>(null);

  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (honorarios.length === 0) return <p className="text-center py-8 text-muted-foreground">Nenhum honorário cadastrado</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead style={{ width: 32 }} />
          <TableHead>Tipo</TableHead>
          <TableHead>Valor Total</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {honorarios.map(h => {
          const isOpen = expandido === h.id;
          return (
            <Fragment key={h.id}>
              <TableRow className="cursor-pointer hover:bg-muted/30" onClick={() => setExpandido(isOpen ? null : h.id)}>
                <TableCell>{isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}</TableCell>
                <TableCell>{h.tipo}</TableCell>
                <TableCell>{fmt(h.valor_total)}</TableCell>
                <TableCell><Badge variant={h.status === 'Ativo' ? 'default' : 'secondary'}>{h.status}</Badge></TableCell>
                <TableCell>{h.data_contrato}</TableCell>
              </TableRow>
              {isOpen && (
                <TableRow>
                  <TableCell colSpan={5} className="bg-muted/10 p-0">
                    <ParcelasExpandidas honorarioId={h.id} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
