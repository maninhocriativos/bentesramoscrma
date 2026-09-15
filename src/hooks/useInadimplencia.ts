import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ParcelaAtrasada {
  id: string;
  numero: number;
  valor: number;
  data_vencimento: string;
  status: string;
  honorario_id: string | null;
  clienteNome: string | null;
  numeroProcesso: string | null;
  diasAtraso: number;
}

// Faixas de atraso no estilo "aging report" (mesmo padrão que o AdvBox usa,
// e comum em qualquer relatório de inadimplência).
export function faixaAtraso(dias: number): '0-15' | '16-30' | '31-60' | '60+' {
  if (dias <= 15) return '0-15';
  if (dias <= 30) return '16-30';
  if (dias <= 60) return '31-60';
  return '60+';
}

export function useInadimplencia() {
  const [parcelas, setParcelas] = useState<ParcelaAtrasada[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchInadimplencia = useCallback(async () => {
    setLoading(true);
    // String ISO (não new Date() < new Date()) — nunca comparar timestamp
    // exato aqui, senão uma parcela vencendo HOJE conta como atrasada assim
    // que passa da meia-noite, mesmo genuinamente ainda dentro do dia.
    const hojeISO = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('parcelas')
      .select('id, numero, valor, data_vencimento, status, honorario_id, honorarios(cliente_id, processo_id, leads_juridicos(nome), processos(numero_processo))')
      .lt('data_vencimento', hojeISO)
      .not('status', 'in', '("Pago","Cancelado")')
      .order('data_vencimento', { ascending: true });

    if (error) {
      toast({ title: 'Erro ao carregar inadimplência', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const hoje = new Date(`${hojeISO}T00:00:00`);
    const enriquecidas: ParcelaAtrasada[] = (data || []).map((p: any) => {
      const venc = new Date(`${p.data_vencimento}T00:00:00`);
      const diasAtraso = Math.max(0, Math.round((hoje.getTime() - venc.getTime()) / 86_400_000));
      return {
        id: p.id,
        numero: p.numero,
        valor: Number(p.valor),
        data_vencimento: p.data_vencimento,
        status: p.status,
        honorario_id: p.honorario_id,
        clienteNome: p.honorarios?.leads_juridicos?.nome || null,
        numeroProcesso: p.honorarios?.processos?.numero_processo || null,
        diasAtraso,
      };
    });

    setParcelas(enriquecidas);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchInadimplencia(); }, [fetchInadimplencia]);

  const totalEmAtraso = parcelas.reduce((s, p) => s + p.valor, 0);
  const clientesDistintos = new Set(parcelas.map(p => p.clienteNome).filter(Boolean)).size;
  const atrasoMedio = parcelas.length > 0 ? Math.round(parcelas.reduce((s, p) => s + p.diasAtraso, 0) / parcelas.length) : 0;

  return { parcelas, loading, fetchInadimplencia, totalEmAtraso, clientesDistintos, atrasoMedio };
}
