import { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type AppRole = 'Administrador' | 'Gerente' | 'Advogado' | 'Secretaria' | 'Estagiário';

export interface Perfil {
  id: string;
  email: string | null;
  nome: string | null;
  sobrenome: string | null;
  telefone: string | null;
  cargo: string | null;
  oab_numero: string | null;
  oab_uf: string | null;
}

interface PerfilContextValue {
  perfil: Perfil | null;
  loading: boolean;
  cargo: string;
  roles: AppRole[];
  isAdmin: boolean;
  isGerente: boolean;
  isAdvogado: boolean;
  isSecretaria: boolean;
  isEstagiario: boolean;
  canDelete: boolean;
  canAccessSettings: boolean;
  canAccessProcessos: boolean;
  canAccessLeads: boolean;
  canAccessDashboard: boolean;
  canAccessAgenda: boolean;
  canAccessTarefas: boolean;
  canAccessFinanceiro: boolean;
  needsOnboarding: boolean;
  fullName: string | null;
  pagePermissions: Record<string, boolean>;
  canAccessPage: (pageId: string) => boolean;
  updatePerfil: (data: Partial<Perfil>) => Promise<{ error: Error | null }>;
  refetch: () => Promise<void>;
}

const PerfilContext = createContext<PerfilContextValue | null>(null);

export function PerfilProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [perfil, setPerfil]               = useState<Perfil | null>(null);
  const [roles, setRoles]                 = useState<AppRole[]>([]);
  const [loading, setLoading]             = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [pagePermissions, setPagePermissions] = useState<Record<string, boolean>>({});

  // Controla se já houve carga inicial — após isso loading nunca mais vira true
  const initialLoadDone = useRef(false);
  // Guarda o último userId carregado para não recarregar desnecessariamente
  const lastUserIdRef = useRef<string | null>(null);

  const fetchData = async (userId: string) => {
    // Só mostra loading na primeira carga
    if (!initialLoadDone.current) {
      setLoading(true);
    }

    const [perfilResult, rolesResult, permsResult] = await Promise.all([
      supabase.from('perfis').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase.from('user_page_permissions' as any).select('page_id, enabled').eq('user_id', userId),
    ]);

    let perfilData: Perfil | null = null;
    let userRoles: AppRole[] = [];

    if (!perfilResult.error && perfilResult.data) {
      perfilData = perfilResult.data as Perfil;
      setPerfil(perfilData);
      setNeedsOnboarding(!perfilData.nome || perfilData.nome.trim() === '');
    }

    if (!rolesResult.error && rolesResult.data && rolesResult.data.length > 0) {
      userRoles = rolesResult.data.map(r => r.role as AppRole);
    } else if (perfilData?.cargo) {
      const validRoles: AppRole[] = ['Administrador', 'Gerente', 'Advogado', 'Secretaria', 'Estagiário'];
      const cargoAsRole = perfilData.cargo as AppRole;
      if (validRoles.includes(cargoAsRole)) {
        userRoles = [cargoAsRole];
      }
    }

    setRoles(userRoles);

    // Page permissions
    const permsMap: Record<string, boolean> = {};
    for (const p of (permsResult as any)?.data || []) {
      permsMap[p.page_id] = p.enabled;
    }
    setPagePermissions(permsMap);

    initialLoadDone.current = true;
    setLoading(false);
  };

  useEffect(() => {
    const userId = user?.id ?? null;

    if (!userId) {
      // Logout real — limpa estado
      setPerfil(null);
      setRoles([]);
      setNeedsOnboarding(false);
      initialLoadDone.current = false;
      lastUserIdRef.current = null;
      setLoading(false);
      return;
    }

    // ✅ Só busca se for um usuário diferente do último carregado
    // Isso evita recarregar ao trocar de aba (quando o user object muda
    // mas o ID é o mesmo)
    if (userId === lastUserIdRef.current) return;

    lastUserIdRef.current = userId;
    fetchData(userId);
  }, [user?.id]); // ✅ Depende do ID, não do objeto inteiro

  // Escuta mudanças em user_page_permissions para este usuário em tempo real.
  // Quando o admin alterar permissões, o efeito é imediato sem precisar relogar.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    const ch = supabase
      .channel(`user-perms-${uid}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'user_page_permissions', filter: `user_id=eq.${uid}` },
        () => {
          supabase
            .from('user_page_permissions' as any)
            .select('page_id, enabled')
            .eq('user_id', uid)
            .then(({ data: rows }) => {
              const map: Record<string, boolean> = {};
              for (const p of (rows as any[]) || []) map[p.page_id] = p.enabled;
              setPagePermissions(map);
            });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const updatePerfil = async (data: Partial<Perfil>) => {
    if (!user) return { error: new Error('User not authenticated') };
    const { error } = await supabase.from('perfis').update(data).eq('id', user.id);
    if (!error && user.id) await fetchData(user.id);
    return { error };
  };

  const refetch = async () => {
    if (user?.id) await fetchData(user.id);
  };

  const isAdmin      = roles.includes('Administrador');
  const isGerente    = roles.includes('Gerente');
  const isAdvogado   = roles.includes('Advogado');
  const isSecretaria = roles.includes('Secretaria');
  const isEstagiario = roles.includes('Estagiário');

  const canDelete           = isAdmin || isGerente;
  const canAccessSettings   = isAdmin;
  const canAccessProcessos  = isAdmin || isGerente || isAdvogado || isSecretaria || isEstagiario;
  const canAccessLeads      = isAdmin || isGerente || isAdvogado || isSecretaria || isEstagiario;
  const canAccessDashboard  = isAdmin || isGerente || isAdvogado; // Secretaria e Estagiários: padrão sem dashboard
  const canAccessAgenda     = true;
  const canAccessTarefas    = true;
  const canAccessFinanceiro = isAdmin || isGerente;

  // Admins always bypass per-page restrictions.
  // Durante loading, retorna true para não bloquear prematuramente.
  // Após loading: se não há entrada na tabela para a página, permite acesso (opt-out).
  const canAccessPage = (pageId: string): boolean => {
    if (loading) return true;
    if (isAdmin) return true;
    return pagePermissions[pageId] ?? true;
  };

  const cargo    = perfil?.cargo || (roles[0] as string) || 'Secretaria';
  const fullName = perfil?.nome ? `${perfil.nome}${perfil.sobrenome ? ' ' + perfil.sobrenome : ''}` : null;

  // Memoiza o value para evitar re-renders em cascata em todos os consumers
  // quando qualquer estado do PerfilProvider muda
  const value = useMemo<PerfilContextValue>(() => ({
    perfil, loading, cargo, roles,
    isAdmin, isGerente, isAdvogado, isSecretaria, isEstagiario,
    canDelete, canAccessSettings, canAccessProcessos, canAccessLeads,
    canAccessDashboard, canAccessAgenda, canAccessTarefas, canAccessFinanceiro,
    needsOnboarding, fullName, pagePermissions, canAccessPage, updatePerfil, refetch,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    perfil, loading, cargo, roles,
    isAdmin, isGerente, isAdvogado, isSecretaria, isEstagiario,
    canDelete, canAccessSettings, canAccessProcessos, canAccessLeads,
    canAccessDashboard, canAccessAgenda, canAccessTarefas, canAccessFinanceiro,
    needsOnboarding, fullName, pagePermissions,
  ]);

  return (
    <PerfilContext.Provider value={value}>
      {children}
    </PerfilContext.Provider>
  );
}

export function usePerfil(): PerfilContextValue {
  const context = useContext(PerfilContext);
  if (!context) {
    return {
      perfil: null, loading: true, cargo: 'Secretaria', roles: [],
      isAdmin: false, isGerente: false, isAdvogado: false, isSecretaria: false, isEstagiario: false,
      canDelete: false, canAccessSettings: false, canAccessProcessos: false,
      canAccessLeads: false, canAccessDashboard: false, canAccessAgenda: true,
      canAccessTarefas: true, canAccessFinanceiro: false, needsOnboarding: false,
      fullName: null, pagePermissions: {}, canAccessPage: () => true,
      updatePerfil: async () => ({ error: new Error('PerfilProvider not mounted') }),
      refetch: async () => {},
    };
  }
  return context;
}
