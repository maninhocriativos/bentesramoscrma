import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  lead_id: string | null;
  link: string | null;
  dados: any;
  created_at: string;
}

export function useNotificacoes() {
  const { user } = useAuth();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotificacoes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notificacoes_internas' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const items = (data || []) as unknown as Notificacao[];
    setNotificacoes(items);
    setNaoLidas(items.filter(n => !n.lida).length);
    setLoading(false);
  }, [user]);

  const marcarComoLida = useCallback(async (id: string) => {
    await supabase
      .from('notificacoes_internas' as any)
      .update({ lida: true } as any)
      .eq('id', id);
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    setNaoLidas(prev => Math.max(0, prev - 1));
  }, []);

  const marcarTodasComoLidas = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('notificacoes_internas' as any)
      .update({ lida: true } as any)
      .eq('user_id', user.id)
      .eq('lida', false);
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
    setNaoLidas(0);
  }, [user]);

  useEffect(() => {
    fetchNotificacoes();

    // Realtime subscription
    if (!user) return;
    const channel = supabase
      .channel('notificacoes-internas')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notificacoes_internas',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const nova = payload.new as unknown as Notificacao;
        setNotificacoes(prev => [nova, ...prev]);
        setNaoLidas(prev => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotificacoes]);

  return { notificacoes, naoLidas, loading, marcarComoLida, marcarTodasComoLidas, refetch: fetchNotificacoes };
}
