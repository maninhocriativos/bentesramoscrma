import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PresenceState {
  online: boolean;
  typingSubscriberId: string | null;
  lastSeen?: string;
  userId: string;
  userName?: string;
}

interface UserPresence {
  [userId: string]: PresenceState;
}

export function useChatPresence(currentUserId?: string, currentUserName?: string) {
  const [onlineUsers, setOnlineUsers] = useState<UserPresence>({});
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // Usa ref para o nome — evita recriar o canal toda vez que o nome muda
  // (o nome pode ser carregado assincronamente pelo PerfilContext)
  const userNameRef = useRef(currentUserName);
  userNameRef.current = currentUserName;

  useEffect(() => {
    // Canal só depende do userId — se o userId não mudou, não recria
    if (!currentUserId) return;

    const presenceChannel = supabase.channel('chat-presence', {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users: UserPresence = {};

        Object.entries(state).forEach(([key, presences]) => {
          if (presences && presences.length > 0) {
            const presence = presences[0] as any;
            users[key] = {
              online: true,
              typingSubscriberId: presence.typingSubscriberId || null,
              lastSeen: new Date().toISOString(),
              userId: key,
              userName: presence.userName,
            };
          }
        });

        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (newPresences && newPresences.length > 0) {
          const presence = newPresences[0] as any;
          setOnlineUsers(prev => ({
            ...prev,
            [key]: {
              online: true,
              typingSubscriberId: presence.typingSubscriberId || null,
              lastSeen: new Date().toISOString(),
              userId: key,
              userName: presence.userName,
            },
          }));
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers(prev => {
          const updated = { ...prev };
          if (updated[key]) {
            updated[key] = { ...updated[key], online: false, typingSubscriberId: null, lastSeen: new Date().toISOString() };
          }
          return updated;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            typingSubscriberId: null,
            userName: userNameRef.current, // lê o nome mais recente via ref
          });
        }
      });

    setChannel(presenceChannel);

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [currentUserId]); // ✅ Só depende do ID — nome vai via ref

  // Marca (ou limpa) que o usuário atual está digitando numa conversa
  // específica — precisa do subscriberId porque um atendente pode ter
  // várias conversas abertas em abas diferentes do time.
  const setTyping = useCallback(async (isTyping: boolean, subscriberId?: string) => {
    if (channel) {
      await channel.track({
        online_at: new Date().toISOString(),
        typingSubscriberId: isTyping ? (subscriberId ?? null) : null,
        userName: userNameRef.current,
      });
    }
  }, [channel]);

  const isOnline = useCallback((subscriberId: string) => {
    return onlineUsers[subscriberId]?.online || false;
  }, [onlineUsers]);

  // Outro atendente (não eu) está digitando nesta conversa agora?
  const isTyping = useCallback((subscriberId: string) => {
    return Object.values(onlineUsers).some(
      p => p.online && p.userId !== currentUserId && p.typingSubscriberId === subscriberId
    );
  }, [onlineUsers, currentUserId]);

  // Nome de quem está digitando nesta conversa (pro indicador "Fulano está digitando...")
  const getTypingUserName = useCallback((subscriberId: string) => {
    const typer = Object.values(onlineUsers).find(
      p => p.online && p.userId !== currentUserId && p.typingSubscriberId === subscriberId
    );
    return typer?.userName;
  }, [onlineUsers, currentUserId]);

  const getLastSeen = useCallback((subscriberId: string) => {
    return onlineUsers[subscriberId]?.lastSeen;
  }, [onlineUsers]);

  return {
    onlineUsers,
    setTyping,
    isOnline,
    isTyping,
    getTypingUserName,
    getLastSeen,
  };
}
