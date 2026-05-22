import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';

interface TeamMember {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  cargo: string | null;
  email: string | null;
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

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { fullName } = usePerfil();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [onlineTeam, setOnlineTeam] = useState<Record<string, PresenceEntry>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userNameRef = useRef<string>('Usuário');
  userNameRef.current = fullName || user?.email?.split('@')[0] || 'Usuário';

  // Carrega membros da equipe uma vez
  useEffect(() => {
    supabase
      .from('perfis')
      .select('id, nome, sobrenome, cargo, email')
      .eq('aprovado', true)
      .then(({ data }) => { if (data) setTeamMembers(data as TeamMember[]); });
  }, []);

  // Canal de presença — vive enquanto o usuário estiver logado (AppLayout montado)
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
        if (!newPresences?.length) return;
        const p = newPresences[0] as any;
        setOnlineTeam(prev => ({
          ...prev,
          [key]: { online: true, currentChat: p.currentChat, userName: p.userName || 'Usuário' },
        }));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
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

  const isTeamMemberOnline = useCallback((id: string) =>
    onlineTeam[id]?.online || false
  , [onlineTeam]);

  const getTeamMemberChat = useCallback((id: string) =>
    onlineTeam[id]?.currentChat
  , [onlineTeam]);

  const getOnlineCount = useCallback(() =>
    Object.values(onlineTeam).filter(m => m.online).length
  , [onlineTeam]);

  const getTeamWithStatus = useCallback((): TeamMemberWithStatus[] =>
    teamMembers.map(m => ({
      ...m,
      online: onlineTeam[m.id]?.online || false,
      currentChat: onlineTeam[m.id]?.currentChat,
      fullName: [m.nome, m.sobrenome].filter(Boolean).join(' ') || m.email || 'Usuário',
    }))
  , [teamMembers, onlineTeam]);

  return (
    <PresenceContext.Provider value={{ setCurrentChat, getTeamWithStatus, getOnlineCount, isTeamMemberOnline, getTeamMemberChat }}>
      {children}
    </PresenceContext.Provider>
  );
}
