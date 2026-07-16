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

// Normaliza nome para matching: sem acentos, minúsculas, espaços colapsados.
function normalizeName(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// Chave tolerante: primeiro + último nome (ignora nomes do meio).
// Ex.: "Benedito Isaney Nascimento da Silva" → "benedito silva".
function nameKey(s: string): string {
  const parts = normalizeName(s).split(' ').filter(Boolean);
  if (parts.length < 2) return '';
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function documentNameCandidates(s: string): string[] {
  const base = (s || '')
    .replace(/\.[^/.]+$/, '')
    .replace(/^Kit\s*[-–—]\s*/i, '')
    .replace(/\s*[-–—]\s*contrato.*$/i, '')
    .replace(/\s*[-–—]\s*\d+\s*$/, '')
    .replace(/\s+\d+\s*docx.*$/i, '')
    .replace(/\d+\s*$/g, '');

  return Array.from(new Set([s, base].map(normalizeName).filter((n) => n.length > 3)));
}

function classifyOrigem(lead: any): TipoOrigemZapsign {
  if (!lead) return 'indefinido';

  // A instância de WhatsApp por onde o lead foi atendido é a fonte da
  // verdade: linha de tráfego → tráfego, linha do escritório → escritório,
  // sempre, mesmo que o campo `origem` (texto livre, editável, pode ficar
  // desatualizado) diga outra coisa. Confirmado com dados reais: leads
  // atendidos pela linha do escritório mas com origem="Tráfego Pago" (e
  // vice-versa) inflavam a contagem errada no dashboard.
  if (lead.linha_whatsapp === 'trafego_isa') return 'trafego';
  if (lead.linha_whatsapp === 'bentes_ramos_antigo') return 'escritorio';

  // Sem instância definida (linha_whatsapp = 'indefinido' ou ausente):
  // cai para os sinais textuais como fallback.
  const origemText = normalizeName([
    lead.origem,
    lead.fonte_trafego,
    lead.canal_origem,
    lead.empresa_tag,
  ].filter(Boolean).join(' '));

  if (
    lead.tipo_origem === 'trafego' ||
    Boolean(lead.fonte_trafego) ||
    Boolean(lead.facebook_lead_id) ||
    origemText.includes('trafego') ||
    origemText.includes('meta') ||
    origemText.includes('facebook') ||
    origemText.includes('instagram') ||
    origemText.includes('google') ||
    origemText.includes('anuncio') ||
    origemText.includes('ads')
  ) return 'trafego';
  // Qualquer lead vinculado que NÃO é de tráfego é cliente do escritório
  // (direto/orgânico). Antes exigia campos específicos e quase tudo virava
  // "indefinido" — agora todo contrato ligado a um lead recebe origem.
  return 'escritorio';
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
  const leadsSelect = 'id, nome, email, telefone, tipo_origem, origem, linha_whatsapp, empresa_tag, fonte_trafego, canal_origem, facebook_lead_id';

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
      .select(leadsSelect)
      .in('id', leadIds);
    for (const l of leadsData || []) leadById.set(l.id, l);
  }

  // 4. Buscar TODOS os leads para matching amplo (telefone, email e NOME do
  //    signatário), cobrindo tráfego E escritório. Antes só buscava leads de
  //    tráfego e só casava por telefone/email → contratos criados direto no
  //    ZapSign (sem lead_id) ficavam todos "indefinido".
  const { data: allLeads } = await supabase
    .from('leads_juridicos')
    .select(leadsSelect);

  const leadByPhone   = new Map<string, any>();
  const leadByEmail   = new Map<string, any>();
  const leadByName    = new Map<string, any>();
  const leadByNameKey = new Map<string, any>();

  for (const l of allLeads || []) {
    leadById.set(l.id, l); // garante que todos estejam disponíveis por id
    if (l.telefone) {
      const n = normalizePhone(l.telefone);
      if (n.length >= 10 && !leadByPhone.has(n)) leadByPhone.set(n, l);
    }
    if (l.email) {
      const e = l.email.toLowerCase().trim();
      if (e && !leadByEmail.has(e)) leadByEmail.set(e, l);
    }
    if (l.nome) {
      const nm = normalizeName(l.nome);
      if (nm && !leadByName.has(nm)) leadByName.set(nm, l);
      const nk = nameKey(l.nome);
      if (nk && !leadByNameKey.has(nk)) leadByNameKey.set(nk, l);
    }
  }

  // 5. Mapear contratos resolvendo o lead por lead_id → telefone → email → nome
  const mapped = documents.map(doc => {
    const local = recordsByDocId.get(doc.id);
    let resolvedLead: any = null;

    // 1) lead_id explícito (contratos criados pelo CRM)
    if (local?.lead_id && leadById.has(local.lead_id)) {
      resolvedLead = leadById.get(local.lead_id);
    }
    // 2) telefone do signatário
    if (!resolvedLead) {
      const phone = normalizePhone(local?.signer_phone || doc.signers?.[0]?.phone || '');
      if (phone.length >= 10 && leadByPhone.has(phone)) resolvedLead = leadByPhone.get(phone);
    }
    // 3) email do signatário
    if (!resolvedLead) {
      const email = (local?.signer_email || doc.signers?.[0]?.email || '').toLowerCase().trim();
      if (email && leadByEmail.has(email)) resolvedLead = leadByEmail.get(email);
    }
    // 4) NOME do signatário (cobre contratos criados direto no painel ZapSign)
    const signerNm = local?.signer_name || doc.signers?.[0]?.name || '';
    const nameCandidates = Array.from(new Set([
      normalizeName(signerNm),
      nameKey(signerNm),
      ...documentNameCandidates(doc.name || ''),
      ...documentNameCandidates((doc.metadata as any)?.name || ''),
    ].filter(Boolean)));

    if (!resolvedLead) {
      for (const candidate of nameCandidates) {
        if (leadByName.has(candidate)) {
          resolvedLead = leadByName.get(candidate);
          break;
        }
      }
    }
    // 5) NOME tolerante: primeiro + último nome (variações de nome do meio)
    if (!resolvedLead) {
      for (const candidate of nameCandidates) {
        const key = nameKey(candidate);
        const matchedKey = leadByNameKey.has(candidate) ? candidate : key;
        if (matchedKey && leadByNameKey.has(matchedKey)) {
          resolvedLead = leadByNameKey.get(matchedKey);
          break;
        }
      }
    }

    return {
      ...doc,
      leadId: local?.lead_id || resolvedLead?.id,
      leadNome: local?.signer_name || resolvedLead?.nome || doc.signers?.[0]?.name,
      leadEmail: local?.signer_email || resolvedLead?.email || doc.signers?.[0]?.email,
      leadPhone: local?.signer_phone || resolvedLead?.telefone || doc.signers?.[0]?.phone,
      tipoOrigem: classifyOrigem(resolvedLead),
      statusLocal: mapZapsignStatus(doc.status, doc.signers),
    };
  });

  // Ordena por data de criação decrescente (contratos novos primeiro)
  return mapped.sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });
}

export function useZapsignContratos(options: { refreshInterval?: number } = {}) {
  const { refreshInterval = 5 * 60 * 1000 } = options;

  const { data: contratos = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['zapsign-contratos'],
    queryFn: fetchZapsignContratosData,
    refetchInterval: refreshInterval,
    staleTime: 30 * 1000,
  });

  // Realtime: re-fetch quando banco local mudar
  useEffect(() => {
    const channel = supabase
      .channel(`zapsign-contracts-changes-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_reminders_zapsign' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  return { contratos, isLoading, isFetching, error, refetch };
}

export function mapZapsignStatusExport(status: string, signers: any[]): string {
  return mapZapsignStatus(status, signers);
}
