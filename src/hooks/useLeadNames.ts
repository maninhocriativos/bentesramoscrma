import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LeadName {
  id: string;
  nome: string | null;
  telefone: string | null;
}

/**
 * Lightweight hook that fetches only id, nome, telefone from leads_juridicos.
 * Use this instead of useLeads() when you only need client name lookups.
 */
export function useLeadNames() {
  const [leadNames, setLeadNames] = useState<LeadName[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('leads_juridicos')
      .select('id, nome, telefone')
      .order('nome', { ascending: true });

    if (data) setLeadNames(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { leadNames, loading, refetch: fetch };
}
