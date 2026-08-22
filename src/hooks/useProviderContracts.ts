import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhone } from '@/lib/chatUtils';
import { fetchZapsignContratosData } from '@/hooks/useZapsignContratos';

// Extraído de ChatContractReminder.tsx — era a única implementação de busca de
// contratos ClickSign/ZapSign casados por lead; agora reusado também por
// useContratosFechados.ts (cruzamento com o registro manual do chat) para não
// duplicar essa lógica pela 3ª vez.

export type Provider = 'clicksign' | 'zapsign';

export interface ProviderContract {
  provider: Provider;
  id: string;
  docId: string;              // document_key (ClickSign) | document_id (ZapSign)
  name: string;
  status: string;             // normalizado: pending | signed | cancelled | rejected | expired
  signerName?: string | null;
  signerPhone?: string | null;
  link?: string | null;       // sign_url do provedor
  leadId?: string | null;
  phoneCore: string;          // últimos 8 dígitos do telefone (p/ casar)
  nameHay: string;            // nome do doc + signatário, normalizado (p/ casar/buscar)
}

export const sanitize = (t: string) => t.replace(/[,()%*]/g, ' ').replace(/\s+/g, ' ').trim();
export const normName = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const stripPrefix = (s: string) => (s || '').replace(/^\s*cliente\s*[-–—:]\s*/i, '').trim();
export const nameKey = (s: string) => {
  const p = normName(s).split(' ').filter(Boolean);
  return p.length < 2 ? '' : `${p[0]} ${p[p.length - 1]}`;
};
export const phoneCore = (p?: string | null) => {
  const d = normalizePhone(p || '');
  return d.length >= 8 ? d.slice(-8) : '';
};

// ClickSign: contratos vêm da API (função list_documents), não da tabela local —
// assim enxerga TODOS os contratos, não só os que passaram pelo CRM.
export function useClickSignContracts(enabled: boolean) {
  return useQuery({
    queryKey: ['chat-cs-contracts'],
    enabled,
    staleTime: 3 * 60_000,
    queryFn: async (): Promise<ProviderContract[]> => {
      const { data, error } = await supabase.functions.invoke('clicksign', { body: { action: 'list_documents', page: 1 } });
      if (error) throw error;
      const docs = (data?.documents || []) as any[];
      return docs
        .filter((d) => d?.key)
        .map((d) => {
          const s = d.signers?.[0] || {};
          const name = (d.filename || '').replace(/\.[^/.]+$/, '') || 'Contrato';
          const status = d.status === 'closed' ? 'signed' : d.status === 'canceled' ? 'cancelled' : 'pending';
          return {
            provider: 'clicksign' as const,
            id: `cs-${d.key}`, docId: d.key, name, status,
            signerName: s.name || null,
            signerPhone: s.phone_number || s.phone || null,
            link: d.sign_url || null,
            leadId: null,
            phoneCore: phoneCore(s.phone_number || s.phone),
            nameHay: normName(`${d.filename || ''} ${s.name || ''}`),
          };
        });
    },
  });
}

// ZapSign: reusa fetchZapsignContratosData (já casa lead por id/telefone/email/
// nome). Compartilha o cache da página de Contratos (mesma queryKey).
export function useZapSignContracts(enabled: boolean) {
  return useQuery({
    queryKey: ['zapsign-contratos'],
    enabled,
    staleTime: 30_000,
    queryFn: fetchZapsignContratosData,
    select: (list: any[]): ProviderContract[] =>
      (list || []).filter((c) => c?.id).map((c) => ({
        provider: 'zapsign' as const,
        id: `zs-${c.id}`, docId: c.id,
        name: c.name || 'Contrato',
        status: c.status || 'pending',
        signerName: c.leadNome || c.signers?.[0]?.name || null,
        signerPhone: c.leadPhone || c.signers?.[0]?.phone || null,
        link: c.signers?.[0]?.sign_url || null,
        leadId: c.leadId || null,
        phoneCore: phoneCore(c.leadPhone || c.signers?.[0]?.phone),
        nameHay: normName(`${c.name || ''} ${c.leadNome || c.signers?.[0]?.name || ''}`),
      })),
  });
}
