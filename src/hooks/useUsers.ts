import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface UserWithRole {
  id: string;
  email: string | null;
  nome: string | null;
  cargo: string | null;
  role: AppRole | null;
}

export function useUsers() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    
    // Fetch profiles
    const { data: perfis, error: perfisError } = await supabase
      .from('perfis')
      .select('*');
    
    if (perfisError) {
      toast({
        title: 'Erro ao carregar usuários',
        description: perfisError.message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Fetch roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');

    if (rolesError) {
      toast({
        title: 'Erro ao carregar cargos',
        description: rolesError.message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Merge profiles with roles
    const usersWithRoles: UserWithRole[] = (perfis || []).map(perfil => {
      const userRole = roles?.find(r => r.user_id === perfil.id);
      return {
        id: perfil.id,
        email: perfil.email,
        nome: perfil.nome,
        cargo: perfil.cargo,
        role: userRole?.role || null,
      };
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    // Update the role in user_roles table
    const { error: roleError } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (roleError) {
      // If no row exists, insert it
      if (roleError.code === 'PGRST116') {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });
        
        if (insertError) {
          toast({
            title: 'Erro ao atualizar cargo',
            description: insertError.message,
            variant: 'destructive',
          });
          return false;
        }
      } else {
        toast({
          title: 'Erro ao atualizar cargo',
          description: roleError.message,
          variant: 'destructive',
        });
        return false;
      }
    }

    // Also update the legacy cargo field in perfis for compatibility
    await supabase
      .from('perfis')
      .update({ cargo: newRole })
      .eq('id', userId);

    toast({
      title: 'Cargo atualizado',
      description: `O cargo foi alterado para ${newRole}.`,
    });

    await fetchUsers();
    return true;
  };

  const deleteUser = async (userId: string) => {
    // Delete from user_roles first
    const { error: roleError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (roleError) {
      toast({
        title: 'Erro ao remover cargo',
        description: roleError.message,
        variant: 'destructive',
      });
      return false;
    }

    // Delete from perfis
    const { error: perfilError } = await supabase
      .from('perfis')
      .delete()
      .eq('id', userId);

    if (perfilError) {
      toast({
        title: 'Erro ao remover usuário',
        description: perfilError.message,
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Usuário removido',
      description: 'O acesso do usuário foi revogado.',
    });

    await fetchUsers();
    return true;
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    updateUserRole,
    deleteUser,
    refetch: fetchUsers,
  };
}
