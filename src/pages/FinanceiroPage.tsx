import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, DollarSign, Receipt, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useHonorarios, useParcelas, useDespesas } from '@/hooks/useFinanceiro';
import { HonorarioModal } from '@/components/financeiro/HonorarioModal';
import { DespesaModal } from '@/components/financeiro/DespesaModal';
import { HonorariosTable } from '@/components/financeiro/HonorariosTable';
import { ParcelasTable } from '@/components/financeiro/ParcelasTable';
import { DespesasTable } from '@/components/financeiro/DespesasTable';
import { AppLayout } from '@/components/layouts/AppLayout';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function FinanceiroPage() {
  const { honorarios, loading: loadingHonorarios } = useHonorarios();
  const { parcelas, loading: loadingParcelas, updateParcela } = useParcelas();
  const { despesas, loading: loadingDespesas } = useDespesas();
  
  const [honorarioModalOpen, setHonorarioModalOpen] = useState(false);
  const [despesaModalOpen, setDespesaModalOpen] = useState(false);

  // Calculate KPIs
  const totalHonorarios = honorarios.reduce((acc, h) => acc + Number(h.valor_total), 0);
  const totalRecebido = parcelas.filter(p => p.status === 'Pago').reduce((acc, p) => acc + Number(p.valor), 0);
  const totalPendente = parcelas.filter(p => p.status === 'Pendente').reduce((acc, p) => acc + Number(p.valor), 0);
  const totalDespesas = despesas.reduce((acc, d) => acc + Number(d.valor), 0);
  
  const parcelasAtrasadas = parcelas.filter(p => {
    if (p.status !== 'Pendente') return false;
    return new Date(p.data_vencimento) < new Date();
  });

  return (
    <AppLayout>
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Gestão de honorários, parcelas e despesas</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={() => setDespesaModalOpen(true)} variant="outline" size="sm" className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden md:inline">Nova</span> Despesa
          </Button>
          <Button onClick={() => setHonorarioModalOpen(true)} size="sm" className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden md:inline">Novo</span> Honorário
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Honorários</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalHonorarios)}
            </div>
            <p className="text-xs text-muted-foreground">{honorarios.length} contratos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recebido</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRecebido)}
            </div>
            <p className="text-xs text-muted-foreground">{parcelas.filter(p => p.status === 'Pago').length} parcelas pagas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Receber</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendente)}
            </div>
            <p className="text-xs text-muted-foreground">
              {parcelasAtrasadas.length > 0 && (
                <span className="text-red-500">{parcelasAtrasadas.length} atrasadas</span>
              )}
              {parcelasAtrasadas.length === 0 && 'Nenhuma em atraso'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
            </div>
            <p className="text-xs text-muted-foreground">{despesas.length} registros</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="honorarios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="honorarios">Honorários</TabsTrigger>
          <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
        </TabsList>

        <TabsContent value="honorarios">
          <Card>
            <CardHeader>
              <CardTitle>Honorários e Contratos</CardTitle>
            </CardHeader>
            <CardContent>
              <HonorariosTable honorarios={honorarios} loading={loadingHonorarios} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parcelas">
          <Card>
            <CardHeader>
              <CardTitle>Controle de Parcelas</CardTitle>
            </CardHeader>
            <CardContent>
              <ParcelasTable parcelas={parcelas} loading={loadingParcelas} onUpdateParcela={updateParcela} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="despesas">
          <Card>
            <CardHeader>
              <CardTitle>Despesas Processuais</CardTitle>
            </CardHeader>
            <CardContent>
              <DespesasTable despesas={despesas} loading={loadingDespesas} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <HonorarioModal open={honorarioModalOpen} onOpenChange={setHonorarioModalOpen} />
      <DespesaModal open={despesaModalOpen} onOpenChange={setDespesaModalOpen} />
    </div>
    </AppLayout>
  );
}
