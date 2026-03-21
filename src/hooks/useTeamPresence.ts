import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface TeamMember {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  cargo: string | null;
  email: string | null;
}

interface PresenceState {
  online: boolean;
  currentChat?: string; // subscriber_id being attended
  lastSeen: string;
  userId: string;
  userName: string;
}

interface TeamPresence {
  [userId: string]: PresenceState;
}

export function useTeamPresence(currentUserId?: string, currentUserName?: string) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [onlineTeam, setOnlineTeam] = useState<TeamPresence>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [currentChat, setCurrentChatState] = useState<string | null>(null);

  // Fetch team members from perfis
  useEffect(() => {
    const fetchTeam = async () => {
      const { data } = await supabase
        .from('perfis')
        .select('id, nome, sobrenome, cargo, email')
        .eq('aprovado', true);
      
      if (data) {
        setTeamMembers(data);
      }
    };
    fetchTeam();
  }, []);

  // Setup presence channel
  useEffect(() => {
    if (!currentUserId) return;

    const presenceChannel = supabase.channel('team-presence', {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const team: TeamPresence = {};
        
        Object.entries(state).forEach(([key, presences]) => {
          if (presences && presences.length > 0) {
            const presence = presences[0] as any;
            team[key] = {
              online: true,
              currentChat: presence.currentChat,
              lastSeen: new Date().toISOString(),
              userId: key,
              userName: presence.userName || 'Usuário',
            };
          }
        });
        
        setOnlineTeam(team);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (newPresences && newPresences.length > 0) {
          const presence = newPresences[0] as any;
          setOnlineTeam(prev => ({
            ...prev,
            [key]: {
              online: true,
              currentChat: presence.currentChat,
              lastSeen: new Date().toISOString(),
              userId: key,
              userName: presence.userName || 'Usuário',
            },
          }));
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineTeam(prev => {
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
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            userName: currentUserName,
            currentChat: null,
          });
        }
      });

    channelRef.current = presenceChannel;

    return () => {
      if (channelRef.current === presenceChannel) {
        channelRef.current = null;
      }
      supabase.removeChannel(presenceChannel);
    };
  }, [currentUserId, currentUserName]);

  // Update current chat being attended
  const setCurrentChat = useCallback(async (subscriberId: string | null) => {
    setCurrentChatState(subscriberId);
    if (channelRef.current) {
      await channelRef.current.track({
        online_at: new Date().toISOString(),
        userName: currentUserName,
        currentChat: subscriberId,
      });
    }
  }, [currentUserName]);

  const isTeamMemberOnline = useCallback((userId: string) => {
    return onlineTeam[userId]?.online || false;
  }, [onlineTeam]);

  const getTeamMemberChat = useCallback((userId: string) => {
    return onlineTeam[userId]?.currentChat;
  }, [onlineTeam]);

  const getOnlineCount = useCallback(() => {
    return Object.values(onlineTeam).filter(m => m.online).length;
  }, [onlineTeam]);

  // Get team member with their online status
  const getTeamWithStatus = useCallback(() => {
    return teamMembers.map(member => ({
      ...member,
      online: isTeamMemberOnline(member.id),
      currentChat: getTeamMemberChat(member.id),
      fullName: [member.nome, member.sobrenome].filter(Boolean).join(' ') || member.email || 'Usuário',
    }));
  }, [teamMembers, isTeamMemberOnline, getTeamMemberChat]);

  return {
    teamMembers,
    onlineTeam,
    currentChat,
    setCurrentChat,
    isTeamMemberOnline,
    getTeamMemberChat,
    getOnlineCount,
    getTeamWithStatus,
  };
}
