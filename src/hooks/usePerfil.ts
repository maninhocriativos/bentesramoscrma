import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Perfil, UserCargo } from '@/types/perfil';
import { useAuth } from './useAuth';

export function usePerfil() {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPerfil();
    } else {
      setPerfil(null);
      setLoading(false);
    }
  }, [user]);

  const fetchPerfil = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!error && data) {
      setPerfil(data as Perfil);
    }
    setLoading(false);
  };

  const cargo = perfil?.cargo || 'Secretaria';

  // Permission helpers
  const isAdmin = cargo === 'Administrador';
  const isAdvogado = cargo === 'Advogado';
  const isSecretaria = cargo === 'Secretaria';
  
  const canDelete = isAdmin; // Only admin can delete
  const canAccessSettings = isAdmin; // Only admin can access settings

  return {
    perfil,
    loading,
    cargo,
    isAdmin,
    isAdvogado,
    isSecretaria,
    canDelete,
    canAccessSettings,
    refetch: fetchPerfil,
  };
}
