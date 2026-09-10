import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LeadExtra {
  leadId: string;
  ultimaInteracao: {
    resumo: string;
    data: string;
  } | null;
  temAgendamento: boolean;
  proximoAgendamento: {
    titulo: string;
    data: string;
  } | null;
}

// Tamanho seguro de lote pro filtro .in(...) — acima disso a URL da consulta
// fica grande demais e o navegador recusa a requisição (TypeError: Failed to
// fetch). O Board da Pipeline de Leads pode passar milhares de IDs de uma vez
// (precisa ver todos os leads filtrados pra classificar nas colunas).
const CHUNK_SIZE = 150;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchInChunks<T>(
  ids: string[],
  run: (batch: string[]) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const batches = chunk(ids, CHUNK_SIZE);
  const results = await Promise.all(batches.map(run));
  const rows: T[] = [];
  for (const r of results) {
    if (r.error) { console.error('[useLeadExtras] erro num lote:', r.error); continue; }
    rows.push(...(r.data || []));
  }
  return rows;
}

export function useLeadExtras(leadIds: string[]) {
  const [extras, setExtras] = useState<Record<string, LeadExtra>>({});
  const [loading, setLoading] = useState(true);

  const stableLeadIds = useMemo(() => leadIds.sort().join(','), [leadIds]);

  const fetchExtras = useCallback(async () => {
    if (leadIds.length === 0) {
      setExtras({});
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Nota: a criação/resolução automática de alertas "agendar_atendimento"
      // pra Isa já é feita pela Edge Function isa-check-appointments (cron a
      // cada 2h, todo o universo certo de leads Em Atendimento/Negociação) —
      // esse hook só LÊ dados pra exibir no card, não duplica esse trabalho.
      const interacoes = await fetchInChunks(leadIds, batch =>
        supabase.from('interacoes').select('cliente_id, resumo, data_interacao')
          .in('cliente_id', batch).order('data_interacao', { ascending: false })
      );

      const now = new Date().toISOString();
      const compromissos = await fetchInChunks(leadIds, batch =>
        supabase.from('compromissos').select('lead_id, titulo, data_inicio')
          .in('lead_id', batch).gte('data_inicio', now).order('data_inicio', { ascending: true })
      );

      const extrasMap: Record<string, LeadExtra> = {};
      for (const leadId of leadIds) {
        const ultimaInteracao = interacoes.find((i: any) => i.cliente_id === leadId);
        const agendamentosLead = compromissos.filter((c: any) => c.lead_id === leadId);
        const proximoAgendamento = agendamentosLead[0] as any;

        extrasMap[leadId] = {
          leadId,
          ultimaInteracao: ultimaInteracao ? {
            resumo: (ultimaInteracao as any).resumo,
            data: (ultimaInteracao as any).data_interacao,
          } : null,
          temAgendamento: agendamentosLead.length > 0,
          proximoAgendamento: proximoAgendamento ? {
            titulo: proximoAgendamento.titulo,
            data: proximoAgendamento.data_inicio,
          } : null,
        };
      }

      setExtras(extrasMap);
    } catch (error) {
      console.error('Erro ao buscar extras dos leads:', error);
    } finally {
      setLoading(false);
    }
  }, [leadIds]);

  useEffect(() => {
    fetchExtras();
  }, [stableLeadIds, fetchExtras]);

  // Atualizações em tempo real de compromissos — só recarrega se o
  // compromisso alterado for de um lead que está na lista atual.
  useEffect(() => {
    if (leadIds.length === 0) return;
    const leadIdSet = new Set(leadIds);

    const channel = supabase
      .channel('compromissos-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'compromissos' },
        (payload) => {
          const leadId = (payload.new as any)?.lead_id || (payload.old as any)?.lead_id;
          if (leadId && leadIdSet.has(leadId)) fetchExtras();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [stableLeadIds, fetchExtras]);

  return { extras, loading, refetch: fetchExtras };
}
