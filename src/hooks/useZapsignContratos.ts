import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { zapsignClient } from '@/integrations/zapsign/client';
import type { ZapsignDocument } from '@/integrations/zapsign/types';

export type TipoOrigemZapsign = 'trafego' | 'escritorio' | 'indefinido';

export interface ContratoZapsignComStatus extends ZapsignDocument {
  leadId?: string;
  leadNome?: string;
  leadEmail?: string;
  leadPhone?: string;
  tipoOrigem: TipoOrigemZapsign;
  statusLocal: string;
}

function normalizePhone(p: string): string {
  return (p || '').replace(/\D/g, '').slice(-11);
}

function classifyOrigem(lead: any): TipoOrigemZapsign {
  if (!lead) return 'indefinido';
  if (
    lead.tipo_origem === 'trafego' ||
    lead.linha_whatsapp === 'trafego_isa' ||
    (lead.origem || '').toLowerCase().includes('tráfego') ||
    (lead.origem || '').toLowerCase().includes('trafego')
  ) return 'trafego';
  if (
    lead.linha_whatsapp === 'bentes_ramos_antigo' ||
    lead.empresa_tag === 'BENTES_RAMOS' ||
    lead.tipo_origem === 'whatsapp_direto'
  ) return 'escritorio';
  return 'indefinido';
}

function mapZapsignStatus(status: string, signers: any[] = []): string {
  if (status === 'cancelled') return 'Cancelado';
  if (status === 'rejected')  return 'Rejeitado';
  if (status === 'expired')   return 'Expirado';
  if (status === 'signed')    return 'Assinado';
  if (status === 'pending') {
    const allSigned = signers.length > 0 && signers.every(s => s.status === 'signed');
    const anySigned = signers.some(s => s.status === 'signed');
    if (allSigned) return 'Assinado';
    if (anySigned) return 'Assinatura Parcial';
    return 'Aguardando Assinatura';
  }
  return 'Pendente';
}

export async function fetchZapsignContratosData(): Promise<ContratoZapsignComStatus[]> {
  // 1. Buscar documentos da Zapsign
  const zapsignDocs = await zapsignClient.listDocuments(1, 100);
  const documents: ZapsignDocument[] = zapsignDocs.documents || [];
  if (documents.length === 0) return [];

  const docIds = documents.map(d => d.id).filter(Boolean);

  // 2. Buscar registros locais
  const { data: localRecords } = await supabase
    .from('contract_reminders_zapsign')
    .select('document_id, lead_id, signer_name, signer_email, signer_phone, status, background_check_status')
    .in('document_id', docIds);

  const recordsByDocId = new Map((localRecords || []).map(r => [r.document_id, r]));
  const leadIds = [...new Set((localRecords || []).map(r => r.lead_id).filter(Boolean))];

  // 3. Buscar leads para classificação por campos diretos
  const leadById = new Map<string, any>();
  if (leadIds.length > 0) {
    const { data: leadsData } = await supabase
      .from('leads_juridicos')
      .select('id, nome, email, telefone, tipo_origem, origem, linha_whatsapp, empresa_tag')
      .in('id', leadIds);
    for (const l of leadsData || []) leadById.set(l.id, l);
  }

  // 4. Buscar TODOS os leads de tráfego para matching por telefone
  const { data: trafegoLeads } = await supabase
    .from('leads_juridicos')
    .select('id, nome, email, telefone, tipo_origem, origem, linha_whatsapp, empresa_tag')
    .or('tipo_origem.eq.trafego,linha_whatsapp.eq.trafego_isa,origem.ilike.*ráfego*');

  const trafegoPhoneSet = new Set<string>();
  const trafegoEmailSet = new Set<string>();
  const trafegoLeadByPhone = new Map<string, any>();
  const trafegoLeadByEmail = new Map<string, any>();

  for (const l of trafegoLeads || []) {
    if (l.telefone) {
      const n = normalizePhone(l.telefone);
      if (n.length >= 10) {
        trafegoPhoneSet.add(n);
        trafegoLeadByPhone.set(n, l);
      }
    }
    if (l.email) {
      trafegoEmailSet.add(l.email.toLowerCase().trim());
      trafegoLeadByEmail.set(l.email.toLowerCase().trim(), l);
    }
  }

  // 5. Buscar instâncias ZAPI para saber qual é tráfego vs escritório
  const { data: zapiInstances } = await supabase
    .from('zapi_instances')
    .select('instance_id, name, is_default');

  // A instância de tráfego normalmente tem "isa" ou "trafego" no nome
  const trafegoInstanceIds = new Set<string>(
    (zapiInstances || [])
      .filter(i => /isa|trafego|tráfego/i.test(i.name || ''))
      .map(i => i.instance_id)
  );

  // 6. Mapear contratos com origem identificada
  return documents.map(doc => {
    const local = recordsByDocId.get(doc.id);
    const leadId = local?.lead_id;

    // Tenta identificar pelo lead_id primeiro
    let tipoOrigem: TipoOrigemZapsign = 'indefinido';
    let resolvedLead: any = null;

    if (leadId && leadById.has(leadId)) {
      resolvedLead = leadById.get(leadId);
      tipoOrigem = classifyOrigem(resolvedLead);
    }

    // Fallback: matching por telefone do signatário
    if (tipoOrigem === 'indefinido') {
      const signerPhone = local?.signer_phone || doc.signers?.[0]?.phone || '';
      const normalizedPhone = normalizePhone(signerPhone);
      if (normalizedPhone.length >= 10 && trafegoPhoneSet.has(normalizedPhone)) {
        resolvedLead = trafegoLeadByPhone.get(normalizedPhone);
        tipoOrigem = 'trafego';
      }
    }

    // Fallback: matching por email do signatário
    if (tipoOrigem === 'indefinido') {
      const signerEmail = (local?.signer_email || doc.signers?.[0]?.email || '').toLowerCase().trim();
      if (signerEmail && trafegoEmailSet.has(signerEmail)) {
        resolvedLead = trafegoLeadByEmail.get(signerEmail);
        tipoOrigem = 'trafego';
      }
    }

    return {
      ...doc,
      leadId: leadId || resolvedLead?.id,
      leadNome: local?.signer_name || resolvedLead?.nome || doc.signers?.[0]?.name,
      leadEmail: local?.signer_email || resolvedLead?.email || doc.signers?.[0]?.email,
      leadPhone: local?.signer_phone || resolvedLead?.telefone || doc.signers?.[0]?.phone,
      tipoOrigem,
      statusLocal: mapZapsignStatus(doc.status, doc.signers),
    };
  });
}

export function useZapsignContratos(options: { refreshInterval?: number } = {}) {
  const { refreshInterval = 5 * 60 * 1000 } = options;

  const { data: contratos = [], isLoading, error, refetch } = useQuery({
    queryKey: ['zapsign-contratos'],
    queryFn: fetchZapsignContratosData,
    refetchInterval: refreshInterval,
    staleTime: 30 * 1000,
  });

  // Realtime: re-fetch quando banco local mudar
  useEffect(() => {
    const channel = supabase
      .channel('zapsign-contracts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_reminders_zapsign' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  return { contratos, isLoading, error, refetch };
}

export function mapZapsignStatusExport(status: string, signers: any[]): string {
  return mapZapsignStatus(status, signers);
}
