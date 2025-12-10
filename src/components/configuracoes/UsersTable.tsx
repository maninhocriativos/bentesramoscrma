import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, Loader2, UserPlus, RefreshCw, Clock, Copy, Check } from 'lucide-react';
import { UserWithRole, PendingInvite, useUsers } from '@/hooks/useUsers';
import { EditUserModal } from './EditUserModal';
import { InviteUserModal } from './InviteUserModal';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function UsersTable() {
  const { users, pendingInvites, loading, updateUserRole, deleteUser, deleteInvite, resendInvite, refetch } = useUsers();
  const { user: currentUser } = useAuth();
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserWithRole | null>(null);
  const [deletingInvite, setDeletingInvite] = useState<PendingInvite | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    await deleteUser(deletingUser.id);
    setIsDeleting(false);
    setDeletingUser(null);
  };

  const handleDeleteInvite = async () => {
    if (!deletingInvite) return;
    setIsDeleting(true);
    await deleteInvite(deletingInvite.id);
    setIsDeleting(false);
    setDeletingInvite(null);
  };

  const handleResendInvite = async (invite: PendingInvite) => {
    setResendingId(invite.id);
    const result = await resendInvite(invite);
    if (!result.success && result.link) {
      await navigator.clipboard.writeText(result.link);
      setCopiedLink(invite.id);
      setTimeout(() => setCopiedLink(null), 3000);
    }
    setResendingId(null);
  };

  const copyInviteLink = async (email: string, inviteId: string) => {
    const link = `${window.location.origin}/auth?email=${encodeURIComponent(email)}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(inviteId);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const getRoleBadgeStyles = (role: string | null, isPending?: boolean) => {
    if (isPending) {
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700';
    }
    switch (role) {
      case 'Administrador':
        return 'bg-primary text-primary-foreground border-primary';
      case 'Gerente':
        return 'bg-gold text-gold-foreground border-gold';
      case 'Advogado':
        return 'bg-secondary text-secondary-foreground border-secondary';
      case 'Secretaria':
        return 'bg-muted text-muted-foreground border-muted';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowInviteModal(true)} className="rounded-xl shadow-soft gap-2">
          <UserPlus className="h-4 w-4" />
          Convidar Membro
        </Button>
      </div>

      {/* Pending Invites Section */}
      {pendingInvites.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Convites Pendentes ({pendingInvites.length})</span>
          </div>
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden bg-amber-50/50 dark:bg-amber-950/20">
            <Table>
              <TableHeader>
                <TableRow className="bg-amber-100/50 dark:bg-amber-900/30 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
                  <TableHead className="font-semibold text-amber-900 dark:text-amber-100">Email</TableHead>
                  <TableHead className="font-semibold text-amber-900 dark:text-amber-100">Cargo</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-amber-900 dark:text-amber-100">Enviado em</TableHead>
                  <TableHead className="font-semibold text-amber-900 dark:text-amber-100">Status</TableHead>
                  <TableHead className="w-[140px] font-semibold text-amber-900 dark:text-amber-100">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((invite) => (
                  <TableRow key={invite.id} className="bg-white/50 dark:bg-card/50 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadgeStyles(invite.role)}`}>
                        {invite.role}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {invite.created_at 
                        ? format(new Date(invite.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : '—'
                      }
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadgeStyles(null, true)}`}>
                        <Clock className="h-3 w-3" />
                        Pendente
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleResendInvite(invite)}
                          disabled={resendingId === invite.id}
                          className="h-8 w-8 hover:bg-primary/10"
                          title="Reenviar convite"
                        >
                          {resendingId === invite.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyInviteLink(invite.email, invite.id)}
                          className="h-8 w-8 hover:bg-primary/10"
                          title="Copiar link"
                        >
                          {copiedLink === invite.id ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingInvite(invite)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Cancelar convite"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Active Users Section */}
      <div className="rounded-xl border-0 overflow-hidden shadow-soft">
        <Table className="table-professional">
          <TableHeader>
            <TableRow className="bg-primary hover:bg-primary border-0">
              <TableHead className="text-primary-foreground font-semibold">Nome</TableHead>
              <TableHead className="text-primary-foreground font-semibold">Email</TableHead>
              <TableHead className="hidden md:table-cell text-primary-foreground font-semibold">Telefone</TableHead>
              <TableHead className="text-primary-foreground font-semibold">Cargo</TableHead>
              <TableHead className="w-[100px] text-primary-foreground font-semibold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              users.map((user, index) => (
                <TableRow 
                  key={user.id}
                  className={index % 2 === 0 ? 'bg-card' : 'bg-muted/30'}
                >
                  <TableCell className="font-medium">
                    {user.nome 
                      ? `${user.nome}${user.sobrenome ? ' ' + user.sobrenome : ''}`
                      : 'Não informado'
                    }
                  </TableCell>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {user.telefone || '—'}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadgeStyles(user.role)}`}>
                      {user.role || user.cargo || 'Sem cargo'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingUser(user)}
                        className="h-8 w-8 hover:bg-primary/10"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingUser(user)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={user.id === currentUser?.id}
                        title={user.id === currentUser?.id ? 'Você não pode remover seu próprio acesso' : undefined}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <InviteUserModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        onSuccess={refetch}
      />

      <EditUserModal
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onSave={updateUserRole}
      />

      {/* Delete User Dialog */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Acesso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o acesso de{' '}
              <strong>{deletingUser?.nome || deletingUser?.email}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Invite Dialog */}
      <AlertDialog open={!!deletingInvite} onOpenChange={(open) => !open && setDeletingInvite(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Convite</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o convite para{' '}
              <strong>{deletingInvite?.email}</strong>?
              O link de cadastro deixará de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInvite}
              disabled={isDeleting}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Cancelando...' : 'Cancelar Convite'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
