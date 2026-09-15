import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ContaBancaria } from '@/types/financeiro';
import { useToast } from '@/hooks/use-toast';

export interface SaldoConta {
  contaId: string;
  saldoAtual: number;
  entradasMes: number;
  saidasMes: number;
}

export function useContasBancarias() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saldos, setSaldos] = useState<Record<string, SaldoConta>>({});
  const { toast } = useToast();

  const fetchContas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contas_bancarias' as any)
      .select('*')
      .order('ativa', { ascending: false })
      .order('nome', { ascending: true });

    if (error) {
      toast({ title: 'Erro ao carregar contas bancárias', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setContas(data as unknown as ContaBancaria[]);
    setLoading(false);
  }, [toast]);

  // Saldo por conta: saldo_inicial + parcelas pagas vinculadas - despesas
  // pagas vinculadas. Tudo calculado em memória (mesmo padrão já usado no
  // resto do Financeiro — sem RPC/view no banco).
  const fetchSaldos = useCallback(async (contasAtuais: ContaBancaria[]) => {
    if (contasAtuais.length === 0) { setSaldos({}); return; }
    const inicioMes = new Date();
    inicioMes.setDate(1);
    const inicioMesStr = inicioMes.toISOString().slice(0, 10);

    const [{ data: parcelasPagas }, { data: despesasPagas }] = await Promise.all([
      supabase.from('parcelas').select('conta_bancaria_id, valor, data_pagamento').eq('status', 'Pago').not('conta_bancaria_id', 'is', null),
      supabase.from('despesas').select('conta_bancaria_id, valor, data_pagamento').eq('status', 'Pago').not('conta_bancaria_id', 'is', null),
    ]);

    const map: Record<string, SaldoConta> = {};
    contasAtuais.forEach(c => { map[c.id] = { contaId: c.id, saldoAtual: Number(c.saldo_inicial), entradasMes: 0, saidasMes: 0 }; });

    (parcelasPagas || []).forEach((p: any) => {
      const entry = map[p.conta_bancaria_id];
      if (!entry) return;
      entry.saldoAtual += Number(p.valor);
      if (p.data_pagamento && p.data_pagamento >= inicioMesStr) entry.entradasMes += Number(p.valor);
    });

    (despesasPagas || []).forEach((d: any) => {
      const entry = map[d.conta_bancaria_id];
      if (!entry) return;
      entry.saldoAtual -= Number(d.valor);
      if (d.data_pagamento && d.data_pagamento >= inicioMesStr) entry.saidasMes += Number(d.valor);
    });

    setSaldos(map);
  }, []);

  useEffect(() => { fetchContas(); }, [fetchContas]);
  useEffect(() => { fetchSaldos(contas); }, [contas, fetchSaldos]);

  const createConta = async (conta: Omit<ContaBancaria, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('contas_bancarias' as any)
      .insert(conta as any)
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar conta bancária', description: error.message, variant: 'destructive' });
      return null;
    }

    toast({ title: 'Conta bancária criada!' });
    await fetchContas();
    return data;
  };

  const updateConta = async (id: string, updates: Partial<ContaBancaria>) => {
    const { error } = await supabase
      .from('contas_bancarias' as any)
      .update(updates as any)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao atualizar conta bancária', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Conta bancária atualizada!' });
    await fetchContas();
    return true;
  };

  const desativarConta = async (id: string) => updateConta(id, { ativa: false });

  const contasAtivas = contas.filter(c => c.ativa);

  return { contas, contasAtivas, loading, saldos, fetchContas, createConta, updateConta, desativarConta };
}
