import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PresenceState {
  online: boolean;
  typing: boolean;
  lastSeen?: string;
  userId: string;
  userName?: string;
}

interface UserPresence {
  [subscriberId: string]: PresenceState;
}

export function useChatPresence(currentUserId?: string, currentUserName?: string) {
  const [onlineUsers, setOnlineUsers] = useState<UserPresence>({});
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
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
              typing: presence.typing || false,
              lastSeen: new Date().toISOString(),
              userId: key,
              userName: presence.userName,
            };
          }
        });
        
        setOnlineUsers(users);
        
        // Update typing users
        const typing = new Set<string>();
        Object.entries(users).forEach(([key, presence]) => {
          if (presence.typing) {
            typing.add(key);
          }
        });
        setTypingUsers(typing);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('🟢 Usuário entrou:', key, newPresences);
        if (newPresences && newPresences.length > 0) {
          const presence = newPresences[0] as any;
          setOnlineUsers(prev => ({
            ...prev,
            [key]: {
              online: true,
              typing: presence.typing || false,
              lastSeen: new Date().toISOString(),
              userId: key,
              userName: presence.userName,
            },
          }));
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        console.log('🔴 Usuário saiu:', key);
        setOnlineUsers(prev => {
          const updated = { ...prev };
          if (updated[key]) {
            updated[key] = {
              ...updated[key],
              online: false,
              lastSeen: new Date().toISOString(),
            };
          }
          return updated;
        });
        setTypingUsers(prev => {
          const updated = new Set(prev);
          updated.delete(key);
          return updated;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            typing: false,
            userName: currentUserName,
          });
        }
      });

    setChannel(presenceChannel);

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [currentUserId, currentUserName]);

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (channel) {
      await channel.track({
        online_at: new Date().toISOString(),
        typing: isTyping,
        userName: currentUserName,
      });
    }
  }, [channel, currentUserName]);

  const isOnline = useCallback((subscriberId: string) => {
    return onlineUsers[subscriberId]?.online || false;
  }, [onlineUsers]);

  const isTyping = useCallback((subscriberId: string) => {
    return typingUsers.has(subscriberId);
  }, [typingUsers]);

  const getLastSeen = useCallback((subscriberId: string) => {
    return onlineUsers[subscriberId]?.lastSeen;
  }, [onlineUsers]);

  return {
    onlineUsers,
    typingUsers,
    setTyping,
    isOnline,
    isTyping,
    getLastSeen,
  };
}
