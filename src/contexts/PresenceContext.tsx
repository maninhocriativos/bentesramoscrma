import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/contexts/PerfilContext';

interface TeamMember {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  cargo: string | null;
  email: string | null;
  last_seen_at: string | null;
}

interface PresenceEntry {
  online: boolean;
  currentChat?: string;
  userName: string;
}

export interface TeamMemberWithStatus extends TeamMember {
  online: boolean;
  currentChat?: string;
  fullName: string;
}

interface PresenceContextValue {
  setCurrentChat: (subscriberId: string | null) => Promise<void>;
  getTeamWithStatus: () => TeamMemberWithStatus[];
  getOnlineCount: () => number;
  isTeamMemberOnline: (userId: string) => boolean;
  getTeamMemberChat: (userId: string) => string | undefined;
}

const PresenceContext = createContext<PresenceContextValue>({
  setCurrentChat: async () => {},
  getTeamWithStatus: () => [],
  getOnlineCount: () => 0,
  isTeamMemberOnline: () => false,
  getTeamMemberChat: () => undefined,
});

export function usePresence() {
  return useContext(PresenceContext);
}

// Considera online se last_seen_at for há menos de 10 minutos
const ONLINE_THRESHOLD_MS = 10 * 60 * 1000;
function isRecentlySeen(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { fullName } = usePerfil();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [onlineTeam, setOnlineTeam] = useState<Record<string, PresenceEntry>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userNameRef = useRef<string>('Usuário');
  userNameRef.current = fullName || user?.email?.split('@')[0] || 'Usuário';

  // Carrega membros da equipe (inclui last_seen_at para presença por heartbeat)
  const fetchTeam = useCallback(() => {
    supabase
      .from('perfis')
      .select('id, nome, sobrenome, cargo, email, last_seen_at')
      .eq('aprovado', true)
      .then(({ data }) => { if (data) setTeamMembers(data as TeamMember[]); });
  }, []);

  useEffect(() => {
    fetchTeam();
    // Re-fetch da lista a cada 3 minutos para atualizar last_seen_at dos membros
    const interval = setInterval(fetchTeam, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTeam]);

  // Heartbeat: atualiza last_seen_at no banco a cada 3 minutos + imediatamente ao logar
  useEffect(() => {
    if (!user?.id) return;

    const updateLastSeen = () => {
      supabase
        .from('perfis')
        .update({ last_seen_at: new Date().toISOString() } as any)
        .eq('id', user.id)
        .then(() => {});
    };

    updateLastSeen(); // imediato ao montar
    const heartbeat = setInterval(updateLastSeen, 3 * 60 * 1000);
    return () => clearInterval(heartbeat);
  }, [user?.id]);

  // Canal de presença Realtime — para updates imediatos (join/leave)
  useEffect(() => {
    if (!user?.id) return;

    const ch = supabase.channel('team-presence', {
      config: { presence: { key: user.id } },
    });

    const applySync = () => {
      const state = ch.presenceState();
      const team: Record<string, PresenceEntry> = {};
      Object.entries(state).forEach(([key, presences]) => {
        if (presences?.length) {
          const p = presences[0] as any;
          team[key] = { online: true, currentChat: p.currentChat, userName: p.userName || 'Usuário' };
        }
      });
      setOnlineTeam(team);
    };

    ch
      .on('presence', { event: 'sync' }, applySync)
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const presArr = newPresences as any[];
        if (!presArr?.length) return;
        const p = presArr[0] as any;
        setOnlineTeam(prev => ({
          ...prev,
          [key]: { online: true, currentChat: p.currentChat, userName: p.userName || 'Usuário' },
        }));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        // Não marca offline imediatamente — deixa o heartbeat (last_seen_at) decidir
        setOnlineTeam(prev => {
          if (!prev[key]) return prev;
          return { ...prev, [key]: { ...prev[key], online: false } };
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({
            online_at: new Date().toISOString(),
            userName: userNameRef.current,
            currentChat: null,
          });
        }
      });

    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [user?.id]);

  const setCurrentChat = useCallback(async (subscriberId: string | null) => {
    if (!channelRef.current) return;
    await channelRef.current.track({
      online_at: new Date().toISOString(),
      userName: userNameRef.current,
      currentChat: subscriberId,
    });
  }, []);

  // Online = Realtime ativo OU last_seen_at nos últimos 10 minutos
  const isTeamMemberOnline = useCallback((id: string) => {
    if (onlineTeam[id]?.online) return true;
    const member = teamMembers.find(m => m.id === id);
    return isRecentlySeen(member?.last_seen_at ?? null);
  }, [onlineTeam, teamMembers]);

  const getTeamMemberChat = useCallback((id: string) =>
    onlineTeam[id]?.currentChat
  , [onlineTeam]);

  const getOnlineCount = useCallback(() =>
    teamMembers.filter(m => isTeamMemberOnline(m.id)).length
  , [teamMembers, isTeamMemberOnline]);

  const getTeamWithStatus = useCallback((): TeamMemberWithStatus[] =>
    teamMembers.map(m => ({
      ...m,
      online: isTeamMemberOnline(m.id),
      currentChat: onlineTeam[m.id]?.currentChat,
      fullName: [m.nome, m.sobrenome].filter(Boolean).join(' ') || m.email || 'Usuário',
    }))
  , [teamMembers, isTeamMemberOnline, onlineTeam]);

  return (
    <PresenceContext.Provider value={{ setCurrentChat, getTeamWithStatus, getOnlineCount, isTeamMemberOnline, getTeamMemberChat }}>
      {children}
    </PresenceContext.Provider>
  );
}
