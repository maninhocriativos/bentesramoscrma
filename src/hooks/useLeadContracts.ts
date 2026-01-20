import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContractReminder {
  id: string;
  document_key: string;
  document_name: string | null;
  contract_link: string | null;
  status: string;
  reminder_stage: number;
  next_reminder_at: string | null;
  last_reminder_at: string | null;
  contract_created_at: string;
  signed_at: string | null;
  signer_name: string | null;
}

export function useLeadContracts(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-contracts', leadId],
    queryFn: async () => {
      if (!leadId) return [];

      // Get contracts from contract_reminders table
      const { data: reminders, error: remindersError } = await supabase
        .from('contract_reminders')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (remindersError) {
        console.error('Error fetching contract reminders:', remindersError);
      }

      // Also check if lead has link_contrato directly
      const { data: lead } = await supabase
        .from('leads_juridicos')
        .select('link_contrato, contract_key, contract_sent_at, contract_signed_at')
        .eq('id', leadId)
        .single();

      const contracts: ContractReminder[] = reminders || [];

      // If lead has a contract link but no matching reminder, create a virtual one
      if (lead?.link_contrato && contracts.length === 0) {
        const contractKey = lead.contract_key || lead.link_contrato.split('/').pop() || '';
        contracts.push({
          id: 'lead-direct',
          document_key: contractKey,
          document_name: 'Contrato',
          contract_link: lead.link_contrato,
          status: lead.contract_signed_at ? 'signed' : 'pending',
          reminder_stage: 0,
          next_reminder_at: null,
          last_reminder_at: null,
          contract_created_at: lead.contract_sent_at || new Date().toISOString(),
          signed_at: lead.contract_signed_at,
          signer_name: null,
        });
      }

      return contracts;
    },
    enabled: !!leadId,
    staleTime: 30000, // 30 seconds
  });
}

// Hook to get contract pending count for multiple leads
export function useLeadsContractStatus(leadIds: string[]) {
  return useQuery({
    queryKey: ['leads-contract-status', leadIds.sort().join(',')],
    queryFn: async () => {
      if (leadIds.length === 0) return {};

      const { data, error } = await supabase
        .from('contract_reminders')
        .select('lead_id, status')
        .in('lead_id', leadIds);

      if (error) {
        console.error('Error fetching contract status:', error);
        return {};
      }

      // Group by lead_id and determine if any are pending
      const statusMap: Record<string, { hasPending: boolean; count: number }> = {};
      
      for (const item of data || []) {
        if (item.lead_id) {
          if (!statusMap[item.lead_id]) {
            statusMap[item.lead_id] = { hasPending: false, count: 0 };
          }
          statusMap[item.lead_id].count++;
          if (item.status === 'pending') {
            statusMap[item.lead_id].hasPending = true;
          }
        }
      }

      return statusMap;
    },
    enabled: leadIds.length > 0,
    staleTime: 60000, // 1 minute
  });
}
