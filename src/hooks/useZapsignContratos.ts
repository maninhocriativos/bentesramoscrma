import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { zapsignClient } from '@/integrations/zapsign/client';
import type { ZapsignDocument } from '@/integrations/zapsign/types';

export interface ContratoZapsignComStatus extends ZapsignDocument {
  leadId?: string;
  leadNome?: string;
  leadEmail?: string;
  tipoOrigem?: string | null; // 'trafego' | 'bentes_ramos'
  statusLocal?: string; // Status mapeado localmente
}

interface UseZapsignContratosOptions {
  refreshInterval?: number;
}

export function useZapsignContratos(
  options: UseZapsignContratosOptions = {}
) {
  const { refreshInterval = 5 * 60 * 1000 } = options; // 5 minutos default

  const fetchZapsignContratos = useCallback(async (): Promise<
    ContratoZapsignComStatus[]
  > => {
    // Buscar documentos da Zapsign
    const zapsignDocs = await zapsignClient.listDocuments(1, 100);
    const documents = zapsignDocs.documents || [];

    if (documents.length === 0) {
      return [];
    }

    const docIds = documents.map((d) => d.id).filter(Boolean);

    // Buscar registros locais
    const { data: localRecords } = await supabase
      .from('contract_reminders_zapsign')
      .select(
        'document_id, lead_id, signer_name, signer_email, status, background_check_status'
      )
      .in('document_id', docIds);

    const recordsByDocId = new Map(
      (localRecords || []).map((r) => [r.document_id, r])
    );

    // Buscar leads associados para obter origem
    const leadIds = (localRecords || [])
      .map((r) => r.lead_id)
      .filter(Boolean);
    const tipoOrigemByLeadId = new Map<string, string>();

    if (leadIds.length > 0) {
      const { data: leadsData } = await supabase
        .from('leads_juridicos')
        .select('id, tipo_origem, origem, nome, email')
        .in('id', leadIds);

      for (const lead of leadsData || []) {
        const isTraffic = lead.tipo_origem === 'trafego' ||
          (lead.origem || '').includes('Tráfego');
        tipoOrigemByLeadId.set(lead.id, isTraffic ? 'trafego' : 'bentes_ramos');
      }
    }

    // Mapear documentos com dados locais
    const contratos: ContratoZapsignComStatus[] = documents.map((doc) => {
      const localRecord = recordsByDocId.get(doc.id);
      const leadId = localRecord?.lead_id;
      const tipoOrigem = leadId ? tipoOrigemByLeadId.get(leadId) : undefined;

      return {
        ...doc,
        leadId,
        leadNome: localRecord?.signer_name,
        leadEmail: localRecord?.signer_email,
        tipoOrigem,
        statusLocal: mapZapsignStatus(doc.status, doc.signers),
      };
    });

    return contratos;
  }, []);

  // Query com React Query
  const {
    data: contratos = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['zapsign-contratos'],
    queryFn: fetchZapsignContratos,
    refetchInterval: refreshInterval,
    staleTime: 30 * 1000, // 30 segundos
  });

  // Realtime subscription para atualizações locais
  useEffect(() => {
    const subscription = supabase
      .from('contract_reminders_zapsign')
      .on('*', () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [refetch]);

  return {
    contratos,
    isLoading,
    error,
    refetch,
  };
}

// Função auxiliar para mapear status Zapsign
function mapZapsignStatus(status: string, signers: any[]): string {
  if (status === 'cancelled') return 'Cancelado';
  if (status === 'rejected') return 'Rejeitado';
  if (status === 'expired') return 'Expirado';
  if (status === 'signed') return 'Assinado';

  if (status === 'pending' && signers?.length) {
    const allSigned = signers.every((s) => s.status === 'signed');
    const anySigned = signers.some((s) => s.status === 'signed');
    const anyRejected = signers.some((s) => s.status === 'rejected');

    if (allSigned) return 'Assinado';
    if (anySigned) return 'Assinatura Parcial';
    if (anyRejected) return 'Com Rejeição';
    return 'Aguardando Assinatura';
  }

  return 'Pendente';
}

// Hook para buscar contrato específico
export function useZapsignContrato(documentId: string) {
  return useQuery({
    queryKey: ['zapsign-contrato', documentId],
    queryFn: () => zapsignClient.getDocumentDetails(documentId),
    enabled: !!documentId,
  });
}
