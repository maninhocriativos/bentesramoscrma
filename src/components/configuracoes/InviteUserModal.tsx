import { useState } from 'react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import {
  UserPlus, Copy, Check, Loader2, Shield, Briefcase, Scale,
  ClipboardList, GraduationCap, ChevronDown, ChevronUp, RefreshCw,
  Mail, User, PartyPopper,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type AppRole = Database['public']['Enums']['app_role'];

type RoleOption = {
  value: AppRole;
  label: string;
  description: string;
  icon: typeof Shield;
  color: string;
  bg: string;
  border: string;
};

const ROLES: RoleOption[] = [
  {
    value: 'Administrador',
    label: 'Administrador',
    description: 'Acesso total, gerencia usuários e configurações.',
    icon: Shield,
    color: 'text-[#3d2b1f]',
    bg: 'bg-[#c9a96e]/15',
    border: 'border-[#c9a96e]/40',
  },
  {
    value: 'Gerente',
    label: 'Gerente',
    description: 'Leads, dashboard e financeiro. Sem processos jurídicos.',
    icon: Briefcase,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  {
    value: 'Advogado',
    label: 'Advogado',
    description: 'Processos próprios, leads e documentos. Sem financeiro.',
    icon: Scale,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    value: 'Secretaria',
    label: 'Secretaria',
    description: 'Operacional: leads, agenda, tarefas. Sem excluir ou financeiro.',
    icon: ClipboardList,
    color: 'text-zinc-600',
    bg: 'bg-zinc-50',
    border: 'border-zinc-200',
  },
  {
    value: 'Estagiário',
    label: 'Estagiário',
    description: 'Acesso controlado por tela, configurado pelo administrador.',
    icon: GraduationCap,
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
];

const inviteSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255),
  nome: z.string().trim().max(80).optional(),
  role: z.enum(['Administrador', 'Gerente', 'Advogado', 'Secretaria', 'Estagiário'] as const),
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
  const [nome, setNome] = useState('');
  const [role, setRole] = useState<AppRole>('Advogado');
  const [showRoles, setShowRoles] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isResend, setIsResend] = useState(false);

  const resetForm = () => {
    setEmail('');
    setNome('');
    setRole('Advogado');
    setShowRoles(false);
    setErrors({});
    setInviteLink(null);
    setCopied(false);
    setIsResend(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) resetForm();
    onOpenChange(o);
  };

  const sendInviteEmail = async (targetEmail: string, targetRole: string, signupLink: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-invite-email', {
        body: { email: targetEmail, role: targetRole, inviteLink: signupLink },
      });
      return (!error && data?.success) ? { success: true } : { success: false };
    } catch {
      return { success: false };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = inviteSchema.safeParse({ email, nome: nome || undefined, role });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    const { data: existingUser } = await supabase
      .from('perfis').select('id').eq('email', result.data.email).maybeSingle();
    if (existingUser) {
      setErrors({ email: 'Este email já está cadastrado no sistema' });
      setSaving(false);
      return;
    }

    const { data: existingInvite } = await supabase
      .from('pending_invites').select('id, role')
      .eq('email', result.data.email).is('accepted_at', null).maybeSingle();

    const signupLink = `${window.location.origin}/auth?email=${encodeURIComponent(result.data.email)}`;

    if (existingInvite) {
      if (existingInvite.role !== result.data.role) {
        await supabase.from('pending_invites')
          .update({ role: result.data.role as AppRole }).eq('id', existingInvite.id);
      }
      setIsResend(true);
      setInviteLink(signupLink);
      const emailResult = await sendInviteEmail(result.data.email, result.data.role, signupLink);
      toast({
        title: emailResult.success ? 'Email reenviado!' : 'Link gerado',
        description: emailResult.success
          ? `Convite reenviado para ${result.data.email}`
          : 'Não foi possível enviar o email. Copie o link manualmente.',
      });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('pending_invites').insert({
      email: result.data.email,
      role: result.data.role as AppRole,
      invited_by: user?.id,
    });
    if (error) {
      toast({ title: 'Erro ao criar convite', description: error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    setInviteLink(signupLink);
    const emailResult = await sendInviteEmail(result.data.email, result.data.role, signupLink);
    toast({
      title: emailResult.success ? 'Convite enviado!' : 'Convite criado!',
      description: emailResult.success
        ? `Email enviado para ${result.data.email}`
        : 'Copie o link abaixo para compartilhar manualmente.',
    });
    setSaving(false);
    onSuccess();
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const selectedRole = ROLES.find(r => r.value === role)!;
  const RoleIcon = selectedRole.icon;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="bg-[#3d2b1f] px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-xl bg-[#c9a96e]/20 flex items-center justify-center shrink-0">
              <UserPlus className="h-4.5 w-4.5 text-[#c9a96e]" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#c9a96e]">Convidar Membro</h2>
              <p className="text-[11px] text-[#c9a96e]/50">Envie um convite para a equipe</p>
            </div>
          </div>
        </div>

        {/* ── Conteúdo (scrollável) ── */}
        <div className="flex-1 overflow-y-auto">
        {inviteLink ? (
          /* ── Estado de sucesso ── */
          <div className="px-5 py-5 space-y-4">
            <div className="flex flex-col items-center gap-2 py-3 text-center">
              <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <PartyPopper className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {isResend ? 'Convite reenviado!' : 'Convite criado!'}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {isResend ? 'Email reenviado para ' : 'Email enviado para '}
                <strong>{email}</strong>
                {' '}com o cargo de <strong>{role}</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">
                Link de cadastro (backup)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="rounded-xl bg-muted/40 text-xs h-9 font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyLink}
                  className="h-9 w-9 shrink-0 rounded-xl border-[#c9a96e]/30 hover:bg-[#c9a96e]/10"
                >
                  {copied
                    ? <Check className="h-4 w-4 text-emerald-600" />
                    : <Copy className="h-4 w-4 text-[#3d2b1f] dark:text-[#c9a96e]" />
                  }
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 rounded-xl gap-1.5 text-xs border-[#c9a96e]/30 text-[#3d2b1f] hover:bg-[#c9a96e]/10"
                onClick={() => { resetForm(); }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Novo convite
              </Button>
              <Button
                className="flex-1 rounded-xl text-xs bg-[#3d2b1f] text-[#c9a96e] hover:bg-[#5c3d2e]"
                onClick={() => handleClose(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          /* ── Formulário ── */
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-[#c9a96e]/60" />
                Email <span className="text-red-400">*</span>
              </Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="rounded-xl h-9 text-sm"
                autoFocus
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>

            {/* Nome (opcional) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[#c9a96e]/60" />
                Nome <span className="text-[10px] text-muted-foreground/50 font-normal">(opcional)</span>
              </Label>
              <Input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: João Silva"
                className="rounded-xl h-9 text-sm"
              />
            </div>

            {/* Cargo — picker visual */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Cargo <span className="text-red-400">*</span>
              </Label>

              {/* Selecionado atual */}
              <button
                type="button"
                onClick={() => setShowRoles(v => !v)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left',
                  selectedRole.bg, selectedRole.border,
                  'hover:opacity-90'
                )}
              >
                <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', selectedRole.bg, 'border', selectedRole.border)}>
                  <RoleIcon className={cn('h-3.5 w-3.5', selectedRole.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold leading-none', selectedRole.color)}>{selectedRole.label}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{selectedRole.description}</p>
                </div>
                {showRoles
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                }
              </button>

              {/* Lista expandida */}
              {showRoles && (
                <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/30 shadow-sm">
                  {ROLES.map(r => {
                    const Icon = r.icon;
                    const isSelected = r.value === role;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => { setRole(r.value); setShowRoles(false); }}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                          isSelected ? cn(r.bg) : 'bg-card hover:bg-muted/40'
                        )}
                      >
                        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', r.bg, 'border', r.border)}>
                          <Icon className={cn('h-3.5 w-3.5', r.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-medium leading-none', isSelected ? r.color : 'text-foreground')}>{r.label}</p>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{r.description}</p>
                        </div>
                        {isSelected && (
                          <Check className={cn('h-4 w-4 shrink-0', r.color)} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {errors.role && <p className="text-xs text-red-500">{errors.role}</p>}
            </div>

            {/* Aviso reenvio */}
            <p className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
              <RefreshCw className="h-3 w-3 shrink-0" />
              Email já convidado? O convite será reenviado automaticamente.
            </p>

            {/* Ações */}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                className="flex-1 rounded-xl text-xs border-[#c9a96e]/20 text-[#3d2b1f] hover:bg-[#c9a96e]/8"
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl text-xs bg-[#3d2b1f] text-[#c9a96e] border border-[#c9a96e]/20 hover:bg-[#5c3d2e]"
              >
                {saving
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Enviando...</>
                  : <><UserPlus className="h-3.5 w-3.5 mr-1" />Enviar Convite</>
                }
              </Button>
            </div>
          </form>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
