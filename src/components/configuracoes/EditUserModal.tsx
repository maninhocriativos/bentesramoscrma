import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserWithRole } from '@/hooks/useUsers';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface EditUserModalProps {
  user: UserWithRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, role: AppRole) => Promise<boolean>;
}

export function EditUserModal({ user, open, onOpenChange, onSave }: EditUserModalProps) {
  const [selectedRole, setSelectedRole] = useState<AppRole>(user?.role || 'Secretaria');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const success = await onSave(user.id, selectedRole);
    setSaving(false);
    if (success) {
      onOpenChange(false);
    }
  };

  // Update selected role when user changes
  if (user && selectedRole !== user.role && user.role) {
    setSelectedRole(user.role);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Alterar o cargo de {user?.nome || user?.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <p className="text-sm text-muted-foreground">{user?.nome || 'Não informado'}</p>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Cargo</Label>
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as AppRole)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Selecione o cargo" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="Administrador">Administrador</SelectItem>
                <SelectItem value="Gerente">Gerente</SelectItem>
                <SelectItem value="Advogado">Advogado</SelectItem>
                <SelectItem value="Secretaria">Secretaria</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
