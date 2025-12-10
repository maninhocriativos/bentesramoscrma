import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface UserWithRole {
  id: string;
  email: string | null;
  nome: string | null;
  sobrenome: string | null;
  telefone: string | null;
  cargo: string | null;
  role: AppRole | null;
  isPending?: boolean;
  aprovado?: boolean;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: AppRole;
  created_at: string | null;
  invited_by: string | null;
}

export function useUsers() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<UserWithRole[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
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

    // Fetch pending invites
    const { data: invites, error: invitesError } = await supabase
      .from('pending_invites')
      .select('*')
      .is('accepted_at', null)
      .order('created_at', { ascending: false });

    if (!invitesError && invites) {
      setPendingInvites(invites);
    }

    // Merge profiles with roles and separate approved from pending
    const allUsers: UserWithRole[] = (perfis || []).map(perfil => {
      const userRole = roles?.find(r => r.user_id === perfil.id);
      return {
        id: perfil.id,
        email: perfil.email,
        nome: perfil.nome,
        sobrenome: perfil.sobrenome,
        telefone: perfil.telefone,
        cargo: perfil.cargo,
        role: userRole?.role || (perfil.cargo as AppRole) || null,
        isPending: false,
        aprovado: (perfil as any).aprovado ?? true,
      };
    });

    // Separate approved users from pending approvals
    setUsers(allUsers.filter(u => u.aprovado === true));
    setPendingApprovals(allUsers.filter(u => u.aprovado === false));
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

  const deleteInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from('pending_invites')
      .delete()
      .eq('id', inviteId);

    if (error) {
      toast({
        title: 'Erro ao cancelar convite',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Convite cancelado',
      description: 'O convite foi removido.',
    });

    await fetchUsers();
    return true;
  };

  const resendInvite = async (invite: PendingInvite) => {
    const signupLink = `${window.location.origin}/auth?email=${encodeURIComponent(invite.email)}`;
    
    try {
      const { data: emailData, error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          email: invite.email,
          role: invite.role,
          inviteLink: signupLink,
        },
      });
      
      if (emailError || !emailData?.success) {
        toast({
          title: 'Erro ao reenviar',
          description: 'Não foi possível enviar o email. Copie o link manualmente.',
          variant: 'destructive',
        });
        return { success: false, link: signupLink };
      }
      
      toast({
        title: 'Email reenviado!',
        description: `Convite reenviado para ${invite.email}`,
      });
      
      return { success: true, link: signupLink };
    } catch (err: any) {
      toast({
        title: 'Erro ao reenviar',
        description: err.message,
        variant: 'destructive',
      });
      return { success: false, link: signupLink };
    }
  };

  const approveUser = async (userId: string) => {
    const { error } = await supabase
      .from('perfis')
      .update({ aprovado: true })
      .eq('id', userId);

    if (error) {
      toast({
        title: 'Erro ao aprovar usuário',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Usuário aprovado!',
      description: 'O usuário agora pode acessar o sistema.',
    });

    await fetchUsers();
    return true;
  };

  const rejectUser = async (userId: string) => {
    // Delete from user_roles first
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    // Delete from perfis
    const { error } = await supabase
      .from('perfis')
      .delete()
      .eq('id', userId);

    if (error) {
      toast({
        title: 'Erro ao rejeitar usuário',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Solicitação rejeitada',
      description: 'O cadastro foi removido.',
    });

    await fetchUsers();
    return true;
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    pendingApprovals,
    pendingInvites,
    loading,
    updateUserRole,
    deleteUser,
    deleteInvite,
    resendInvite,
    approveUser,
    rejectUser,
    refetch: fetchUsers,
  };
}
