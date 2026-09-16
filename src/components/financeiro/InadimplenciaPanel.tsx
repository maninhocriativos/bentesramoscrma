import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Users, Clock, DollarSign, Loader2, CheckCircle2 } from 'lucide-react';
import { useInadimplencia, faixaAtraso } from '@/hooks/useInadimplencia';
import { useParcelas } from '@/hooks/useFinanceiro';
import { MarcarPagamentoPopover } from './MarcarPagamentoPopover';
import { FinanceiroKpiCard } from './FinanceiroKpiCard';
import { FinanceiroEmptyState } from './FinanceiroEmptyState';

const BROWN = '#3d2b1f';

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
        <FinanceiroKpiCard label="Total em Atraso" value={fmt(totalEmAtraso)} icon={DollarSign} accent="#dc2626" />
        <FinanceiroKpiCard label="Parcelas Atrasadas" value={String(parcelas.length)} icon={AlertTriangle} accent="#d97706" />
        <FinanceiroKpiCard label="Clientes Inadimplentes" value={String(clientesDistintos)} icon={Users} accent={BROWN} />
        <FinanceiroKpiCard label="Atraso Médio" value={`${atrasoMedio} dias`} icon={Clock} accent={BROWN} />
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader><CardTitle>Parcelas em Atraso</CardTitle></CardHeader>
        <CardContent>
          {parcelas.length === 0 ? (
            <FinanceiroEmptyState icon={CheckCircle2} title="Tudo em dia" subtitle="Nenhuma parcela em atraso no momento" />
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
