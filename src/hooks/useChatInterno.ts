import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ChatMensagem {
  id: string;
  sender_id: string;
  conteudo: string;
  created_at: string;
  perfis: { nome: string; sobrenome: string | null } | null;
}

export function useChatInterno() {
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const lastSeenRef = useRef<string>(
    typeof window !== 'undefined' ? (localStorage.getItem('chat_last_seen') || '') : ''
  );
  const { user } = useAuth();

  const fetchMensagens = useCallback(async () => {
    const { data } = await supabase
      .from('chat_mensagens')
      .select('*, perfis(nome, sobrenome)')
      .order('created_at', { ascending: true })
      .limit(120);
    const msgs = (data || []) as ChatMensagem[];
    setMensagens(msgs);
    const unseen = msgs.filter(m => m.created_at > lastSeenRef.current && m.sender_id !== user?.id).length;
    setUnread(unseen);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchMensagens(); }, [fetchMensagens]);

  useEffect(() => {
    const ch = supabase.channel('chat-interno-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens' }, async (payload) => {
        const { data } = await supabase
          .from('chat_mensagens')
          .select('*, perfis(nome, sobrenome)')
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setMensagens(prev => [...prev, data as ChatMensagem]);
          if ((data as ChatMensagem).sender_id !== user?.id) setUnread(n => n + 1);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const enviar = async (conteudo: string) => {
    if (!user || !conteudo.trim()) return;
    await supabase.from('chat_mensagens').insert({ sender_id: user.id, conteudo: conteudo.trim() });
  };

  const marcarLido = () => {
    const now = new Date().toISOString();
    lastSeenRef.current = now;
    if (typeof window !== 'undefined') localStorage.setItem('chat_last_seen', now);
    setUnread(0);
  };

  return { mensagens, loading, unread, enviar, marcarLido };
}
