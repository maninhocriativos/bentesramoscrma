 import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
 import { LeadsTableView } from '@/components/leads/LeadsTableView';
import { supabase } from '@/integrations/supabase/client';

export default function LeadsPage() {
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  // Track realtime connection
  useEffect(() => {
    const channel = supabase
      .channel('leads-page-realtime-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads_juridicos' },
        () => setRealtimeStatus('connected')
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('disconnected');
        else setRealtimeStatus('connecting');
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
         <LeadsTableView />
      </div>
    </AppLayout>
  );
}
