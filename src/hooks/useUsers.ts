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

    if (invites) {
      setPendingInvites(invites);
    } else if (invitesError) {
      toast({ title: 'Erro ao carregar convites', description: invitesError.message, variant: 'destructive' });
    }

    // Merge profiles with roles and separate approved from pending.
    // Um usuário pode ter mais de uma linha em user_roles (ex: Administrador +
    // Advogado, para aparecer nas buscas por OAB) — prioriza a role que bate
    // com perfis.cargo (estável) em vez de pegar a primeira linha encontrada
    // (find() sem order by é não-determinístico e fazia o cargo exibido mudar
    // dependendo da ordem de retorno do banco).
    const allUsers: UserWithRole[] = (perfis || []).map(perfil => {
      const userRoles = roles?.filter(r => r.user_id === perfil.id) || [];
      const userRole = userRoles.find(r => r.role === perfil.cargo) || userRoles[0];
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
    // ⚠️ .update().eq(...) SEM .select()/.single() não retorna erro quando zero
    // linhas batem (comportamento do PostgREST) — o fallback de insert baseado em
    // roleError.code === 'PGRST116' nunca disparava na prática para usuários sem
    // linha prévia em user_roles: o toast dizia "sucesso" mas nada era salvo.
    //
    // Também: um usuário pode ter mais de uma linha em user_roles (ex: cargo
    // Administrador + uma linha extra Advogado, usada pelas buscas por OAB) —
    // um .update() cego sobrescreveria as duas pro mesmo valor, apagando o papel
    // extra sem querer. Por isso: remove só a linha que corresponde ao cargo
    // ANTERIOR (perfis.cargo, antes desta troca) e insere a nova, preservando
    // qualquer outra role que a pessoa já tivesse.
    const { data: perfilAtual } = await supabase
      .from('perfis')
      .select('cargo')
      .eq('id', userId)
      .maybeSingle();
    const cargoAnterior = perfilAtual?.cargo;

    const { data: rolesAtuais } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const jaTemNovaRole = (rolesAtuais || []).some(r => r.role === newRole);

    if (cargoAnterior && cargoAnterior !== newRole) {
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', cargoAnterior as AppRole);
      if (deleteError) {
        toast({ title: 'Erro ao atualizar cargo', description: deleteError.message, variant: 'destructive' });
        return false;
      }
    }

    if (!jaTemNovaRole) {
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });
      if (insertError) {
        toast({ title: 'Erro ao atualizar cargo', description: insertError.message, variant: 'destructive' });
        return false;
      }
    }

    // Also update the legacy cargo field in perfis for compatibility
    const { error: perfilError } = await supabase
      .from('perfis')
      .update({ cargo: newRole })
      .eq('id', userId);
    if (perfilError) {
      toast({ title: 'Erro ao atualizar cargo', description: perfilError.message, variant: 'destructive' });
      return false;
    }

    toast({
      title: 'Cargo atualizado',
      description: `O cargo foi alterado para ${newRole}.`,
    });

    await fetchUsers();
    return true;
  };

  const deleteUser = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { userId },
    });

    if (error || !data?.success) {
      toast({
        title: 'Erro ao remover usuário',
        description: error?.message || 'Não foi possível remover o usuário.',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Usuário removido',
      description: 'Conta removida completamente do sistema.',
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

  const forceApproveInvite = async (invite: PendingInvite) => {
    const { data, error } = await supabase.functions.invoke('admin-approve-invite', {
      body: { email: invite.email, role: invite.role },
    });

    if (error || !data?.success) {
      toast({
        title: 'Erro ao aprovar',
        description: error?.message || 'Não foi possível aprovar o usuário.',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Usuário aprovado!',
      description: data.action === 'approved'
        ? `${invite.email} aprovado e pode fazer login agora.`
        : `Conta criada para ${invite.email}. Um email foi enviado com o link de acesso.`,
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
    forceApproveInvite,
    approveUser,
    rejectUser,
    refetch: fetchUsers,
  };
}
