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
import { Badge } from '@/components/ui/badge';
import { Edit2, Trash2, Loader2, UserPlus } from 'lucide-react';
import { UserWithRole, useUsers } from '@/hooks/useUsers';
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

export function UsersTable() {
  const { users, loading, updateUserRole, deleteUser, refetch } = useUsers();
  const { user: currentUser } = useAuth();
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserWithRole | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    await deleteUser(deletingUser.id);
    setIsDeleting(false);
    setDeletingUser(null);
  };

  const getRoleBadgeStyles = (role: string | null) => {
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowInviteModal(true)} className="rounded-xl shadow-soft gap-2">
          <UserPlus className="h-4 w-4" />
          Convidar Membro
        </Button>
      </div>
      
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
    </div>
  );
}
