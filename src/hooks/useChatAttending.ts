import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AttendingUser {
  userId: string;
  nome: string;
}

// subscriber_id → usuários que estão com aquela conversa aberta agora (excluindo self)
export type AttendingMap = Map<string, AttendingUser[]>;

export function useChatAttending(userId: string | undefined, userNome: string) {
  const [attendingMap, setAttendingMap] = useState<AttendingMap>(new Map());
  const channelRef = useRef<any>(null);
  const readyRef   = useRef(false);

  useEffect(() => {
    if (!userId) return;

    const ch = supabase.channel('chat-attending-v1', {
      config: { presence: { key: userId } },
    });

    const buildMap = () => {
      const state = ch.presenceState();
      const map = new Map<string, AttendingUser[]>();
      for (const [key, presences] of Object.entries(state)) {
        if (key === userId) continue;
        const p = (presences as any[])[0];
        if (!p?.subscriberId) continue;
        const sid: string = p.subscriberId;
        const list = map.get(sid) ?? [];
        list.push({ userId: p.userId, nome: p.nome ?? 'Usuário' });
        map.set(sid, list);
      }
      setAttendingMap(map);
    };

    ch
      .on('presence', { event: 'sync' }, buildMap)
      .on('presence', { event: 'join' }, buildMap)
      .on('presence', { event: 'leave' }, buildMap)
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          readyRef.current  = true;
          channelRef.current = ch;
        }
      });

    return () => {
      readyRef.current   = false;
      channelRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [userId]);

  const setAttending = useCallback(async (subscriberId: string | null) => {
    const ch = channelRef.current;
    if (!ch || !userId || !readyRef.current) return;
    if (subscriberId) {
      await ch.track({ userId, nome: userNome, subscriberId });
    } else {
      await ch.untrack();
    }
  }, [userId, userNome]);

  return { attendingMap, setAttending };
}
