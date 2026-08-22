import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { classifyOrigemLead, type TipoOrigemLead } from '@/lib/leadOrigem';
import {
  useClickSignContracts, useZapSignContracts,
  phoneCore, normName, nameKey, type ProviderContract,
} from '@/hooks/useProviderContracts';

export interface ContratoFechadoComStatus {
  id: string;
  lead_id: string | null;
  tipo_contrato: string;
  quantidade_contratos: number;
  modalidade_assinatura: string;
  observacoes: string | null;
  fonte: string | null;
  meta_conversion_sent: boolean | null;
  valor_contrato: number | null;
  processo_id: string | null;
  created_at: string | null;
  leadNome: string | null;
  leadTipoOrigem: string | null;
  tipoOrigem: TipoOrigemLead;
  // null = não aplicável (modalidade presencial, não se espera documento digital)
  confirmadoDigitalmente: boolean | null;
  confirmadoProvider?: 'zapsign' | 'clicksign';
}

const LEADS_SELECT = 'id, nome, email, telefone, tipo_origem, origem, linha_whatsapp, empresa_tag, fonte_trafego, canal_origem, facebook_lead_id';

async function fetchContratosFechadosData(
  zsContracts: ProviderContract[],
  csContracts: ProviderContract[],
): Promise<ContratoFechadoComStatus[]> {
  // Paginado por precaução — a tabela tem ~125 linhas hoje, mas já vimos nesta
  // mesma base o custo de um select sem .range() virar um bug real quando a
  // tabela cresce (useZapsignContratos.ts tinha exatamente esse problema).
  const PAGE = 1000;
  const rows: any[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('contratos_fechados')
      .select('id, lead_id, tipo_contrato, quantidade_contratos, modalidade_assinatura, observacoes, fonte, meta_conversion_sent, valor_contrato, processo_id, created_at')
      .order('created_at', { ascending: false })
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  if (rows.length === 0) return [];

  const leadIds = [...new Set(rows.map(r => r.lead_id).filter(Boolean))];
  const leadById = new Map<string, any>();
  if (leadIds.length > 0) {
    const { data: leads, error } = await supabase.from('leads_juridicos').select(LEADS_SELECT).in('id', leadIds);
    if (error) throw error;
    for (const l of leads || []) leadById.set(l.id, l);
  }

  return rows.map(row => {
    const lead = row.lead_id ? leadById.get(row.lead_id) : null;
    const tipoOrigem = classifyOrigemLead(lead);

    let confirmadoDigitalmente: boolean | null = null;
    let confirmadoProvider: 'zapsign' | 'clicksign' | undefined;

    if (row.modalidade_assinatura === 'online') {
      // ZapSign: casa direto por lead_id (mais confiável).
      const zs = row.lead_id ? zsContracts.find(c => c.leadId === row.lead_id && c.status === 'signed') : null;
      if (zs) {
        confirmadoDigitalmente = true;
        confirmadoProvider = 'zapsign';
      } else {
        // ClickSign não guarda lead_id de forma confiável — casa pelo telefone/
        // nome do PRÓPRIO lead (mesma técnica já usada em ChatContractReminder.tsx).
        const core = phoneCore(lead?.telefone);
        const nome = normName(lead?.nome || '');
        const nk = nameKey(lead?.nome || '');
        const cs = csContracts.find(c => c.status === 'signed' && (
          (core && c.phoneCore === core) ||
          (nome && nome.length >= 5 && c.nameHay.includes(nome)) ||
          (nk && nk.length >= 7 && c.nameHay.includes(nk))
        ));
        if (cs) {
          confirmadoDigitalmente = true;
          confirmadoProvider = 'clicksign';
        } else {
          confirmadoDigitalmente = false;
        }
      }
    }
    // modalidade 'presencial' (ou qualquer outra) fica null — N/A, não se espera
    // documento digital.

    return {
      id: row.id,
      lead_id: row.lead_id,
      tipo_contrato: row.tipo_contrato,
      quantidade_contratos: row.quantidade_contratos,
      modalidade_assinatura: row.modalidade_assinatura,
      observacoes: row.observacoes,
      fonte: row.fonte,
      meta_conversion_sent: row.meta_conversion_sent,
      valor_contrato: row.valor_contrato,
      processo_id: row.processo_id,
      created_at: row.created_at,
      leadNome: lead?.nome || null,
      leadTipoOrigem: lead?.tipo_origem || null,
      tipoOrigem,
      confirmadoDigitalmente,
      confirmadoProvider,
    };
  });
}

export function useContratosFechados() {
  const zsQ = useZapSignContracts(true);
  const csQ = useClickSignContracts(true);
  const zsContracts = (zsQ.data as ProviderContract[]) || [];
  const csContracts = (csQ.data as ProviderContract[]) || [];

  const { data: contratos = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['contratos-fechados-manual', zsContracts.length, csContracts.length],
    queryFn: () => fetchContratosFechadosData(zsContracts, csContracts),
    enabled: !zsQ.isLoading && !csQ.isLoading,
    staleTime: 30 * 1000,
  });

  const resumo = useMemo(() => ({
    total: contratos.length,
    trafego: contratos.filter(c => c.tipoOrigem === 'trafego').length,
    escritorio: contratos.filter(c => c.tipoOrigem === 'escritorio').length,
    indefinido: contratos.filter(c => c.tipoOrigem === 'indefinido').length,
    confirmados: contratos.filter(c => c.confirmadoDigitalmente === true).length,
    naoConfirmados: contratos.filter(c => c.confirmadoDigitalmente === false).length,
    metaPendente: contratos.filter(c => c.tipoOrigem === 'trafego' && !c.meta_conversion_sent).length,
  }), [contratos]);

  return {
    contratos,
    resumo,
    isLoading: isLoading || zsQ.isLoading || csQ.isLoading,
    isFetching,
    error,
    refetch,
  };
}
