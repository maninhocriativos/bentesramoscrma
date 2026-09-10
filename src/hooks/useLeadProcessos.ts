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
        // Busca partes por CPF e por nome em duas queries separadas — evita
        // montar um filtro .or() por interpolação de string (nome/documento
        // com vírgula, parêntese etc. quebrava ou distorcia o filtro
        // silenciosamente, já que esses caracteres são separadores da sintaxe
        // .or() do PostgREST).
        const cpfDigits = leadData.cpf ? leadData.cpf.replace(/\D/g, '') : '';
        // Alguns nomes de lead chegam com um prefixo de organização interna
        // (ex.: "Cliente - Maria..."), herdado do nome de contato salvo no
        // WhatsApp Business (já sanitizado na origem em zapi-webhook, mas
        // esta é uma segunda camada) — sem remover, a busca por nome nunca
        // batia com o nome real da parte no processo, e o vínculo automático
        // silenciosamente não encontrava processos que já existiam.
        const nomeLimpo = (leadData.nome || '').replace(/^\s*(cliente|contato|lead|cli)\s*[-:–—]\s*/i, '').trim();
        const nomeBusca = nomeLimpo.length > 5 ? nomeLimpo : '';

        const processoIdsEncontrados = new Set<string>();

        // 2a. processo_partes — lista todas as partes citadas no processo
        // (autor, réu etc.), útil quando o processo veio de sincronização
        // automática (DJEN/DataJud) sem cadastro manual do cliente.
        if (cpfDigits) {
          const { data } = await supabase.from('processo_partes').select('processo_id').ilike('documento', `%${cpfDigits}%`);
          data?.forEach(p => processoIdsEncontrados.add(p.processo_id));
        }
        if (nomeBusca) {
          const { data } = await supabase.from('processo_partes').select('processo_id').ilike('nome', `%${nomeBusca}%`);
          data?.forEach(p => processoIdsEncontrados.add(p.processo_id));
        }

        // 2b. processos.cpf_cliente / nome_cliente — campo do CLIENTE
        // preenchido direto no cadastro do processo (não passa por
        // processo_partes). Achado ao vivo: 70 leads com "Contrato
        // Assinado"/"Ganho" tinham processo com CPF batendo exatamente
        // aqui e a aba "Processos" mostrava "Nenhum processo vinculado"
        // porque essa busca nunca checava essa tabela/coluna.
        if (cpfDigits) {
          const { data } = await supabase
            .from('processos')
            .select('id')
            .not('cpf_cliente', 'is', null)
            .ilike('cpf_cliente', `%${cpfDigits}%`);
          data?.forEach(p => processoIdsEncontrados.add(p.id));
        }
        if (nomeBusca) {
          const { data } = await supabase.from('processos').select('id').ilike('nome_cliente', `%${nomeBusca}%`);
          data?.forEach(p => processoIdsEncontrados.add(p.id));
        }

        const processoIds = [...processoIdsEncontrados].filter(id => !directIds.has(id));

        if (processoIds.length > 0) {
          const { data: found } = await supabase
            .from('processos')
            .select('*')
            .in('id', processoIds);

          if (found) {
            for (const proc of found) {
              // Só assume a posse (cliente_id) se o processo ainda não tem
              // dono — evita reatribuir processo de outro lead duplicado
              // (mesma pessoa cadastrada 2x) sem decisão explícita do
              // usuário sobre qual lead é o "principal".
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
// Tamanho seguro de lote pro filtro .in(...) — acima disso a URL da consulta
// fica grande demais e o navegador recusa a requisição (TypeError: Failed to
// fetch). O Board da Pipeline de Leads pode passar milhares de IDs de uma vez.
const PROCESSO_COUNTS_CHUNK = 150;

export function useLeadsProcessoCounts(leadIds: string[]) {
  return useQuery({
    queryKey: ['leads-processo-counts', leadIds.sort().join(',')],
    queryFn: async () => {
      if (leadIds.length === 0) return {};

      const batches: string[][] = [];
      for (let i = 0; i < leadIds.length; i += PROCESSO_COUNTS_CHUNK) {
        batches.push(leadIds.slice(i, i + PROCESSO_COUNTS_CHUNK));
      }

      const results = await Promise.all(batches.map(batch =>
        supabase.from('processos').select('cliente_id').in('cliente_id', batch)
      ));

      const counts: Record<string, number> = {};
      for (const r of results) {
        if (r.error) { console.error('Error fetching processo counts:', r.error); continue; }
        for (const item of r.data || []) {
          if (item.cliente_id) {
            counts[item.cliente_id] = (counts[item.cliente_id] || 0) + 1;
          }
        }
      }
      return counts;
    },
    enabled: leadIds.length > 0,
    staleTime: 60000,
  });
}
