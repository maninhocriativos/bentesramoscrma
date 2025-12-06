import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type AppRole = 'Administrador' | 'Advogado' | 'Secretaria';

export interface Perfil {
  id: string;
  email: string | null;
  nome: string | null;
  sobrenome: string | null;
  telefone: string | null;
  cargo: string | null;
}

export function usePerfil() {
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
      const validRoles: AppRole[] = ['Administrador', 'Advogado', 'Secretaria'];
      const cargoAsRole = perfilData.cargo as AppRole;
      if (validRoles.includes(cargoAsRole)) {
        userRoles = [cargoAsRole];
      }
    }
    
    console.log('usePerfil: perfilData =', perfilData);
    console.log('usePerfil: userRoles =', userRoles);
    console.log('usePerfil: isAdmin =', userRoles.includes('Administrador'));
    
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
  const isAdvogado = roles.includes('Advogado');
  const isSecretaria = roles.includes('Secretaria');
  
  // These are for UI hints only - actual enforcement is via RLS
  const canDelete = isAdmin;
  const canAccessSettings = isAdmin;
  
  // Legacy cargo field for compatibility
  const cargo = perfil?.cargo || (roles[0] as string) || 'Secretaria';
  
  // Full name helper
  const fullName = perfil?.nome 
    ? `${perfil.nome}${perfil.sobrenome ? ' ' + perfil.sobrenome : ''}`
    : null;

  return {
    perfil,
    loading,
    cargo,
    roles,
    isAdmin,
    isAdvogado,
    isSecretaria,
    canDelete,
    canAccessSettings,
    needsOnboarding,
    fullName,
    updatePerfil,
    refetch: fetchData,
  };
}
