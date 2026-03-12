import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type AppRole = 'Administrador' | 'Gerente' | 'Advogado' | 'Secretaria';

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
  updatePerfil: (data: Partial<Perfil>) => Promise<{ error: Error | null }>;
  refetch: () => Promise<void>;
}

const PerfilContext = createContext<PerfilContextValue | null>(null);

export function PerfilProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setPerfil(null);
      setRoles([]);
      setLoading(false);
      setNeedsOnboarding(false);
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    
    // Fetch profile and roles in parallel
    const [perfilResult, rolesResult] = await Promise.all([
      supabase
        .from('perfis')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
    ]);

    let perfilData: Perfil | null = null;
    let userRoles: AppRole[] = [];

    if (!perfilResult.error && perfilResult.data) {
      perfilData = perfilResult.data as Perfil;
      setPerfil(perfilData);
      // Check if user needs onboarding (nome is empty)
      setNeedsOnboarding(!perfilData.nome || perfilData.nome.trim() === '');
    }
    
    if (!rolesResult.error && rolesResult.data && rolesResult.data.length > 0) {
      userRoles = rolesResult.data.map(r => r.role as AppRole);
    } else if (perfilData?.cargo) {
      // Fallback: use cargo from perfis table if user_roles is empty
      const validRoles: AppRole[] = ['Administrador', 'Gerente', 'Advogado', 'Secretaria'];
      const cargoAsRole = perfilData.cargo as AppRole;
      if (validRoles.includes(cargoAsRole)) {
        userRoles = [cargoAsRole];
      }
    }
    
    setRoles(userRoles);
    setLoading(false);
  };

  const updatePerfil = async (data: Partial<Perfil>) => {
    if (!user) return { error: new Error('User not authenticated') };
    
    const { error } = await supabase
      .from('perfis')
      .update(data)
      .eq('id', user.id);
    
    if (!error) {
      await fetchData();
    }
    
    return { error };
  };

  // Permission helpers based on user_roles table (server-side enforced)
  const isAdmin = roles.includes('Administrador');
  const isGerente = roles.includes('Gerente');
  const isAdvogado = roles.includes('Advogado');
  const isSecretaria = roles.includes('Secretaria');
  
  // These are for UI hints only - actual enforcement is via RLS
  const canDelete = isAdmin || isGerente;
  const canAccessSettings = isAdmin;
  
  // Permissões por módulo:
  // - Processos: Admin, Gerente, Advogado, Secretaria
  const canAccessProcessos = isAdmin || isGerente || isAdvogado || isSecretaria;
  // - Leads/CRM: Admin, Gerente, Advogado, Secretaria
  const canAccessLeads = isAdmin || isGerente || isAdvogado || isSecretaria;
  // - Dashboard: Admin, Gerente, Advogado, Secretaria
  const canAccessDashboard = isAdmin || isGerente || isAdvogado || isSecretaria;
  // - Agenda: Todos
  const canAccessAgenda = true;
  // - Tarefas: Todos
  const canAccessTarefas = true;
  // - Financeiro: Admin, Gerente
  const canAccessFinanceiro = isAdmin || isGerente;
  
  // Legacy cargo field for compatibility
  const cargo = perfil?.cargo || (roles[0] as string) || 'Secretaria';
  
  // Full name helper
  const fullName = perfil?.nome 
    ? `${perfil.nome}${perfil.sobrenome ? ' ' + perfil.sobrenome : ''}`
    : null;

  return (
    <PerfilContext.Provider value={{
      perfil,
      loading,
      cargo,
      roles,
      isAdmin,
      isGerente,
      isAdvogado,
      isSecretaria,
      canDelete,
      canAccessSettings,
      canAccessProcessos,
      canAccessLeads,
      canAccessDashboard,
      canAccessAgenda,
      canAccessTarefas,
      canAccessFinanceiro,
      needsOnboarding,
      fullName,
      updatePerfil,
      refetch: fetchData,
    }}>
      {children}
    </PerfilContext.Provider>
  );
}

export function usePerfil(): PerfilContextValue {
  const context = useContext(PerfilContext);
  if (!context) {
    // Return a safe default state when used outside provider (e.g., during initial render)
    return {
      perfil: null,
      loading: true,
      cargo: 'Secretaria',
      roles: [],
      isAdmin: false,
      isGerente: false,
      isAdvogado: false,
      isSecretaria: false,
      canDelete: false,
      canAccessSettings: false,
      canAccessProcessos: false,
      canAccessLeads: false,
      canAccessDashboard: false,
      canAccessAgenda: true,
      canAccessTarefas: true,
      canAccessFinanceiro: false,
      needsOnboarding: false,
      fullName: null,
      updatePerfil: async () => ({ error: new Error('PerfilProvider not mounted') }),
      refetch: async () => {},
    };
  }
  return context;
}
