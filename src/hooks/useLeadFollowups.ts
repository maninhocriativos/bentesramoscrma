import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LeadFollowupInfo {
  leadId: string;
  status: string | null;
  followupStageFast: number | null;
  followupStageSlow: number | null;
  nextFollowupAt: string | null;
  nextFollowupType: string | null;
  followupLockReason: string | null;
  waitingReply: boolean;
}

export function useLeadFollowups(leadIds: string[]) {
  const [followups, setFollowups] = useState<Record<string, LeadFollowupInfo>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadIds.length) {
      setFollowups({});
      return;
    }

    async function fetchFollowups() {
      setLoading(true);
      const { data, error } = await supabase
        .from('lead_followups')
        .select('lead_id, status, followup_stage_fast, followup_stage_slow, next_followup_at, next_followup_type, followup_lock_reason, waiting_reply')
        .in('lead_id', leadIds);

      if (!error && data) {
        const map: Record<string, LeadFollowupInfo> = {};
        data.forEach((f) => {
          map[f.lead_id] = {
            leadId: f.lead_id,
            status: f.status,
            followupStageFast: f.followup_stage_fast,
            followupStageSlow: f.followup_stage_slow,
            nextFollowupAt: f.next_followup_at,
            nextFollowupType: f.next_followup_type,
            followupLockReason: f.followup_lock_reason,
            waitingReply: f.waiting_reply ?? false,
          };
        });
        setFollowups(map);
      }
      setLoading(false);
    }

    fetchFollowups();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('lead_followups_kanban')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lead_followups'
      }, () => {
        fetchFollowups();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadIds.join(',')]);

  return { followups, loading };
}
