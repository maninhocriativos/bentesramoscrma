import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Users, Clock, DollarSign, Loader2 } from 'lucide-react';
import { useInadimplencia, faixaAtraso } from '@/hooks/useInadimplencia';
import { useParcelas } from '@/hooks/useFinanceiro';
import { MarcarPagamentoPopover } from './MarcarPagamentoPopover';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const FAIXA_CFG: Record<string, { label: string; color: string; bg: string }> = {
  '0-15':  { label: '0-15 dias',  color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  '16-30': { label: '16-30 dias', color: '#ea580c', bg: 'rgba(234,88,12,0.1)' },
  '31-60': { label: '31-60 dias', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  '60+':   { label: '60+ dias',   color: '#991b1b', bg: 'rgba(153,27,27,0.12)' },
};

export function InadimplenciaPanel() {
  const { parcelas, loading, fetchInadimplencia, totalEmAtraso, clientesDistintos, atrasoMedio } = useInadimplencia();
  const { updateParcela } = useParcelas();

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-red-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total em Atraso</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{fmt(totalEmAtraso)}</div></CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Parcelas Atrasadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{parcelas.length}</div></CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clientes Inadimplentes</CardTitle>
            <Users className="h-4 w-4 text-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{clientesDistintos}</div></CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Atraso Médio</CardTitle>
            <Clock className="h-4 w-4 text-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{atrasoMedio} dias</div></CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader><CardTitle>Parcelas em Atraso</CardTitle></CardHeader>
        <CardContent>
          {parcelas.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhuma parcela em atraso — tudo em dia.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead>Nº</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Atraso</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelas.map(p => {
                  const faixa = FAIXA_CFG[faixaAtraso(p.diasAtraso)];
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.clienteNome || '—'}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.numeroProcesso || '—'}</TableCell>
                      <TableCell>{p.numero}</TableCell>
                      <TableCell className="font-semibold">{fmt(p.valor)}</TableCell>
                      <TableCell>{p.data_vencimento}</TableCell>
                      <TableCell>
                        <Badge style={{ background: faixa.bg, color: faixa.color, border: 'none' }}>
                          {p.diasAtraso} dia{p.diasAtraso !== 1 ? 's' : ''}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <MarcarPagamentoPopover
                          onConfirm={async (dataPagamento, contaBancariaId) => {
                            await updateParcela(p.id, { status: 'Pago', data_pagamento: dataPagamento, conta_bancaria_id: contaBancariaId });
                            await fetchInadimplencia();
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
