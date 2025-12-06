import { useState } from 'react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const inviteSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255),
  role: z.enum(['Gerente', 'Advogado', 'Secretaria'] as const),
});

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InviteUserModal({ open, onOpenChange, onSuccess }: InviteUserModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Gerente' | 'Advogado' | 'Secretaria'>('Advogado');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setEmail('');
    setRole('Advogado');
    setErrors({});
    setInviteLink(null);
    setCopied(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = inviteSchema.safeParse({ email, role });
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    
    setErrors({});
    setSaving(true);
    
    // Check if email already has a pending invite
    const { data: existingInvite } = await supabase
      .from('pending_invites')
      .select('id')
      .eq('email', result.data.email)
      .is('accepted_at', null)
      .maybeSingle();
    
    if (existingInvite) {
      setErrors({ email: 'Este email já possui um convite pendente' });
      setSaving(false);
      return;
    }
    
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('perfis')
      .select('id')
      .eq('email', result.data.email)
      .maybeSingle();
    
    if (existingUser) {
      setErrors({ email: 'Este email já está cadastrado no sistema' });
      setSaving(false);
      return;
    }
    
    // Create pending invite
    const { error } = await supabase
      .from('pending_invites')
      .insert({
        email: result.data.email,
        role: result.data.role as AppRole,
        invited_by: user?.id,
      });
    
    if (error) {
      toast({
        title: 'Erro ao criar convite',
        description: error.message,
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }
    
    // Generate the signup link
    const signupLink = `${window.location.origin}/auth?email=${encodeURIComponent(result.data.email)}`;
    setInviteLink(signupLink);
    
    toast({
      title: 'Convite criado!',
      description: 'Envie o link de cadastro para o novo membro.',
    });
    
    setSaving(false);
    onSuccess();
  };

  const copyToClipboard = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Convidar Membro
          </DialogTitle>
          <DialogDescription>
            Envie um convite para um novo membro da equipe
          </DialogDescription>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-4 py-4">
            <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <AlertDescription className="text-green-800 dark:text-green-200">
                Convite criado com sucesso! Envie o link abaixo para <strong>{email}</strong>.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label>Link de Cadastro</Label>
              <div className="flex gap-2">
                <Input 
                  value={inviteLink} 
                  readOnly 
                  className="rounded-xl bg-muted/50 text-sm"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={copyToClipboard}
                  className="rounded-xl shrink-0"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O usuário será cadastrado com o cargo de <strong>{role}</strong> ao criar a conta.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={() => handleClose(false)} className="w-full rounded-xl">
                Fechar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="rounded-xl"
                autoFocus
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Cargo *</Label>
              <Select value={role} onValueChange={(value) => setRole(value as 'Gerente' | 'Advogado' | 'Secretaria')}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="Gerente">Gerente</SelectItem>
                  <SelectItem value="Advogado">Advogado</SelectItem>
                  <SelectItem value="Secretaria">Secretaria</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role}</p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleClose(false)} 
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="rounded-xl">
                {saving ? 'Criando...' : 'Criar Convite'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
