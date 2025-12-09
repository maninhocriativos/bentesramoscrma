import { useState, useEffect } from 'react';
import { Plus, DollarSign, Receipt, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HonorarioModal } from '@/components/financeiro/HonorarioModal';
import { DespesaModal } from '@/components/financeiro/DespesaModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Honorario {
  id: string;
  tipo: string;
  valor_total: number;
  status: string | null;
  data_contrato: string | null;
}

interface Despesa {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  status: string | null;
  data_despesa: string | null;
}

interface LeadFinanceiroTabProps {
  clienteId: string;
}

export function LeadFinanceiroTab({ clienteId }: LeadFinanceiroTabProps) {
  const [honorarios, setHonorarios] = useState<Honorario[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [honorarioModalOpen, setHonorarioModalOpen] = useState(false);
  const [despesaModalOpen, setDespesaModalOpen] = useState(false);

  const fetchData = async () => {
    const [honorariosRes, despesasRes] = await Promise.all([
      supabase.from('honorarios').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('despesas').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
    ]);

    if (honorariosRes.data) setHonorarios(honorariosRes.data);
    if (despesasRes.data) setDespesas(despesasRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [clienteId]);

  const totalHonorarios = honorarios.reduce((acc, h) => acc + (h.valor_total || 0), 0);
  const totalDespesas = despesas.reduce((acc, d) => acc + (d.valor || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Honorários</p>
                <p className="text-xl font-semibold text-green-600">{formatCurrency(totalHonorarios)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Despesas</p>
                <p className="text-xl font-semibold text-red-600">{formatCurrency(totalDespesas)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Honorarios and Despesas */}
      <Tabs defaultValue="honorarios">
        <TabsList>
          <TabsTrigger value="honorarios">Honorários ({honorarios.length})</TabsTrigger>
          <TabsTrigger value="despesas">Despesas ({despesas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="honorarios" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium">Contratos de Honorários</h4>
            <Button onClick={() => setHonorarioModalOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Honorário
            </Button>
          </div>
          {honorarios.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <DollarSign className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">Nenhum honorário cadastrado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {honorarios.map((h) => (
                <Card key={h.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{h.tipo}</span>
                        <Badge variant="outline">{h.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {h.data_contrato ? format(new Date(h.data_contrato), "dd/MM/yyyy", { locale: ptBR }) : '—'}
                      </p>
                    </div>
                    <span className="font-semibold text-green-600">{formatCurrency(h.valor_total)}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="despesas" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium">Despesas Processuais</h4>
            <Button onClick={() => setDespesaModalOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Despesa
            </Button>
          </div>
          {despesas.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Receipt className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">Nenhuma despesa cadastrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {despesas.map((d) => (
                <Card key={d.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <Receipt className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{d.tipo}</span>
                        <Badge variant="outline">{d.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{d.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.data_despesa ? format(new Date(d.data_despesa), "dd/MM/yyyy", { locale: ptBR }) : '—'}
                      </p>
                    </div>
                    <span className="font-semibold text-red-600">{formatCurrency(d.valor)}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <HonorarioModal
        open={honorarioModalOpen}
        onOpenChange={setHonorarioModalOpen}
        clienteId={clienteId}
        onSuccess={fetchData}
      />
      <DespesaModal
        open={despesaModalOpen}
        onOpenChange={setDespesaModalOpen}
        clienteId={clienteId}
        onSuccess={fetchData}
      />
    </div>
  );
}