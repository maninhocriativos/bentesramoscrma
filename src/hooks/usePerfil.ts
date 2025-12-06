import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Perfil, UserCargo } from '@/types/perfil';
import { useAuth } from './useAuth';

type AppRole = 'Administrador' | 'Advogado' | 'Secretaria';

export function usePerfil() {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setPerfil(null);
      setRoles([]);
      setLoading(false);
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

    if (!perfilResult.error && perfilResult.data) {
      setPerfil(perfilResult.data as Perfil);
    }
    
    if (!rolesResult.error && rolesResult.data) {
      setRoles(rolesResult.data.map(r => r.role as AppRole));
    }
    
    setLoading(false);
  };

  // Permission helpers based on user_roles table (server-side enforced)
  const isAdmin = roles.includes('Administrador');
  const isAdvogado = roles.includes('Advogado');
  const isSecretaria = roles.includes('Secretaria');
  
  // These are for UI hints only - actual enforcement is via RLS
  const canDelete = isAdmin;
  const canAccessSettings = isAdmin;
  
  // Legacy cargo field for compatibility
  const cargo = perfil?.cargo || (roles[0] as UserCargo) || 'Secretaria';

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
    refetch: fetchData,
  };
}
