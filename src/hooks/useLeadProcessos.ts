import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Processo } from '@/types/processos';

/**
 * Fetch processes linked to a specific lead by cliente_id.
 * Also auto-links processes found by matching CPF/telefone/nome.
 */
export function useLeadProcessos(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-processos', leadId],
    queryFn: async (): Promise<{ processos: Processo[]; autoLinked: number }> => {
      if (!leadId) return { processos: [], autoLinked: 0 };

      // 1. Direct link via cliente_id
      const { data: direct, error } = await supabase
        .from('processos')
        .select('*')
        .eq('cliente_id', leadId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching lead processos:', error);
        return { processos: [], autoLinked: 0 };
      }

      const directIds = new Set((direct || []).map(p => p.id));

      // 2. Try auto-link by lead data (CPF, telefone, nome)
      const { data: leadData } = await supabase
        .from('leads_juridicos')
        .select('nome, telefone, cpf')
        .eq('id', leadId)
        .single();

      let autoLinked = 0;
      const autoProcessos: Processo[] = [];

      if (leadData) {
        // Search by matching partes in processo_partes table
        const conditions: string[] = [];
        if (leadData.cpf) {
          conditions.push(`documento.ilike.%${leadData.cpf.replace(/\D/g, '')}%`);
        }
        if (leadData.nome && leadData.nome.length > 5) {
          conditions.push(`nome.ilike.%${leadData.nome}%`);
        }

        if (conditions.length > 0) {
          const { data: partes } = await supabase
            .from('processo_partes')
            .select('processo_id')
            .or(conditions.join(','));

          if (partes && partes.length > 0) {
            const processoIds = [...new Set(partes.map(p => p.processo_id))].filter(id => !directIds.has(id));
            
            if (processoIds.length > 0) {
              const { data: found } = await supabase
                .from('processos')
                .select('*')
                .in('id', processoIds);

              if (found) {
                // Auto-link these processes to the lead
                for (const proc of found) {
                  if (!proc.cliente_id) {
                    await supabase
                      .from('processos')
                      .update({ cliente_id: leadId })
                      .eq('id', proc.id);
                    autoLinked++;
                  }
                  autoProcessos.push(proc as Processo);
                }
              }
            }
          }
        }
      }

      return {
        processos: [...(direct as Processo[] || []), ...autoProcessos],
        autoLinked,
      };
    },
    enabled: !!leadId,
    staleTime: 30000,
  });
}

/**
 * Batch fetch process counts for multiple leads (for card grid).
 */
export function useLeadsProcessoCounts(leadIds: string[]) {
  return useQuery({
    queryKey: ['leads-processo-counts', leadIds.sort().join(',')],
    queryFn: async () => {
      if (leadIds.length === 0) return {};

      const { data, error } = await supabase
        .from('processos')
        .select('cliente_id')
        .in('cliente_id', leadIds);

      if (error) {
        console.error('Error fetching processo counts:', error);
        return {};
      }

      const counts: Record<string, number> = {};
      for (const item of data || []) {
        if (item.cliente_id) {
          counts[item.cliente_id] = (counts[item.cliente_id] || 0) + 1;
        }
      }
      return counts;
    },
    enabled: leadIds.length > 0,
    staleTime: 60000,
  });
}
