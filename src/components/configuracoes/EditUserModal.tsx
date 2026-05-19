import { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserWithRole } from '@/hooks/useUsers';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck } from 'lucide-react';

type AppRole = Database['public']['Enums']['app_role'];

// Páginas controladas por permissão
const PAGE_GROUPS = [
  {
    label: 'Principal',
    pages: [
      { id: 'bem-vindo',   label: 'Bem-Vindo' },
      { id: 'dashboard',   label: 'Dashboard' },
      { id: 'leads',       label: 'CRM de Leads' },
      { id: 'meta-leads',  label: 'Leads API (Meta)' },
      { id: 'processos',   label: 'Processos' },
      { id: 'intimacoes',  label: 'Intimações' },
    ],
  },
  {
    label: 'Gestão',
    pages: [
      { id: 'tarefas',    label: 'Tarefas' },
      { id: 'agenda',     label: 'Agenda' },
      { id: 'financeiro', label: 'Financeiro' },
      { id: 'documentos', label: 'Documentos' },
      { id: 'contratos',  label: 'Contratos' },
      { id: 'peticoes',   label: 'Petições Iniciais' },
    ],
  },
  {
    label: 'Inteligência',
    pages: [
      { id: 'assistente',           label: 'Assistentes IA' },
      { id: 'isa-autonoma',         label: 'Isa Autônoma' },
      { id: 'followup',             label: 'Follow-up' },
      { id: 'conferencia-extratos', label: 'Conferência de Extratos' },
      { id: 'chat',                 label: 'Chat' },
    ],
  },
];

interface EditUserModalProps {
  user: UserWithRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, role: AppRole) => Promise<boolean>;
}

export function EditUserModal({ user, open, onOpenChange, onSave }: EditUserModalProps) {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<AppRole>('Secretaria');
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync role when user changes
  useEffect(() => {
    if (user?.role) setSelectedRole(user.role);
  }, [user?.id, user?.role]);

  // Load page permissions when modal opens
  useEffect(() => {
    if (!user || !open) return;
    setLoadingPerms(true);
    supabase
      .from('user_page_permissions' as any)
      .select('page_id, enabled')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const map: Record<string, boolean> = {};
        for (const p of (data as any[]) || []) map[p.page_id] = p.enabled;
        setPermissions(map);
        setLoadingPerms(false);
      });
  }, [user?.id, open]);

  const isTargetAdmin = selectedRole === 'Administrador';

  const togglePage = (pageId: string, value: boolean) => {
    setPermissions(prev => ({ ...prev, [pageId]: value }));
  };

  const enableAll = () => {
    const all: Record<string, boolean> = {};
    PAGE_GROUPS.flatMap(g => g.pages).forEach(p => { all[p.id] = true; });
    setPermissions(all);
  };

  const disableAll = () => {
    const all: Record<string, boolean> = {};
    PAGE_GROUPS.flatMap(g => g.pages).forEach(p => { all[p.id] = false; });
    setPermissions(all);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Save role
      const roleOk = await onSave(user.id, selectedRole);
      if (!roleOk) { setSaving(false); return; }

      // Save page permissions (upsert all pages)
      if (!isTargetAdmin) {
        const rows = PAGE_GROUPS.flatMap(g =>
          g.pages.map(p => ({
            user_id: user.id,
            page_id: p.id,
            enabled: permissions[p.id] ?? true,
            updated_at: new Date().toISOString(),
          }))
        );
        const { error } = await (supabase as any)
          .from('user_page_permissions')
          .upsert(rows, { onConflict: 'user_id,page_id' });
        if (error) throw error;
      }

      toast({ title: 'Usuário atualizado', description: 'Cargo e permissões salvos com sucesso.' });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const userName = user?.nome
    ? `${user.nome}${user.sobrenome ? ' ' + user.sobrenome : ''}`
    : user?.email || 'usuário';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Cargo e acesso às telas de <strong>{userName}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-5">

          {/* Cargo */}
          <div className="space-y-2">
            <Label htmlFor="role">Cargo</Label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
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

          {/* Permissões por tela */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Acesso às Telas</Label>
              {!isTargetAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={enableAll}
                    className="text-[11px] text-emerald-600 hover:underline"
                  >
                    Liberar todas
                  </button>
                  <span className="text-muted-foreground/40 text-xs">·</span>
                  <button
                    type="button"
                    onClick={disableAll}
                    className="text-[11px] text-red-500 hover:underline"
                  >
                    Bloquear todas
                  </button>
                </div>
              )}
            </div>

            {isTargetAdmin ? (
              <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-[#c9a96e]/10 border border-[#c9a96e]/20">
                <ShieldCheck className="h-4 w-4 text-[#c9a96e] shrink-0" />
                <p className="text-xs text-[#3d2b1f]/70 dark:text-[#c9a96e]/70">
                  Administradores têm acesso total a todas as telas automaticamente.
                </p>
              </div>
            ) : loadingPerms ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
              </div>
            ) : (
              <div className="space-y-4">
                {PAGE_GROUPS.map(group => (
                  <div key={group.label}>
                    <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2">
                      {group.label}
                    </p>
                    <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
                      {group.pages.map(page => {
                        const enabled = permissions[page.id] ?? true;
                        return (
                          <div key={page.id} className="flex items-center justify-between px-3 py-2.5 bg-card hover:bg-muted/30 transition-colors">
                            <span className="text-sm">{page.label}</span>
                            <Switch
                              checked={enabled}
                              onCheckedChange={(v) => togglePage(page.id, v)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-border/40 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl" disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Salvando...</> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
