import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Landmark, Plus, Pencil, Ban, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useContasBancarias } from '@/hooks/useContasBancarias';
import { ContaBancaria } from '@/types/financeiro';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function ContasBancariasManager() {
  const { contas, loading, saldos, createConta, updateConta, desativarConta } = useContasBancarias();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContaBancaria | null>(null);
  const [desativando, setDesativando] = useState<ContaBancaria | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: '', banco: '', tipo: 'Corrente' as ContaBancaria['tipo'], saldo_inicial: '0', observacoes: '' });

  const openNew = () => {
    setEditing(null);
    setForm({ nome: '', banco: '', tipo: 'Corrente', saldo_inicial: '0', observacoes: '' });
    setDialogOpen(true);
  };

  const openEdit = (c: ContaBancaria) => {
    setEditing(c);
    setForm({ nome: c.nome, banco: c.banco || '', tipo: c.tipo, saldo_inicial: String(c.saldo_inicial), observacoes: c.observacoes || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    if (editing) {
      await updateConta(editing.id, { nome: form.nome.trim(), banco: form.banco || null, tipo: form.tipo, observacoes: form.observacoes || null });
    } else {
      await createConta({
        nome: form.nome.trim(), banco: form.banco || null, tipo: form.tipo,
        saldo_inicial: Number(form.saldo_inicial) || 0, observacoes: form.observacoes || null, ativa: true,
      });
    }
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDesativar = async () => {
    if (!desativando) return;
    await desativarConta(desativando.id);
    setDesativando(null);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4 text-[#b8922a]" /> Contas Bancárias
        </CardTitle>
        <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={openNew}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nova Conta
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {contas.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 col-span-2">Nenhuma conta bancária cadastrada.</p>
        ) : contas.map(c => {
          const saldo = saldos[c.id];
          return (
            <div key={c.id} className="rounded-xl border border-border/50 p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold truncate ${!c.ativa ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{c.nome}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{[c.banco, c.tipo].filter(Boolean).join(' · ')}</p>
                </div>
                {!c.ativa && <Badge variant="outline" className="text-[10px] shrink-0">Inativa</Badge>}
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg shrink-0" onClick={() => openEdit(c)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                {c.ativa && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-600 shrink-0" onClick={() => setDesativando(c)}>
                    <Ban className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <span className="text-[11px] text-muted-foreground">Saldo Atual</span>
                <span className={`text-sm font-black ${(saldo?.saldoAtual ?? c.saldo_inicial) < 0 ? 'text-red-600' : 'text-foreground'}`}>
                  {fmt(saldo?.saldoAtual ?? c.saldo_inicial)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-emerald-600"><TrendingUp className="h-3 w-3" /> {fmt(saldo?.entradasMes ?? 0)}</span>
                <span className="flex items-center gap-1 text-red-600"><TrendingDown className="h-3 w-3" /> {fmt(saldo?.saidasMes ?? 0)}</span>
              </div>
            </div>
          );
        })}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4 text-[#b8922a]" /> {editing ? 'Editar Conta' : 'Nova Conta Bancária'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nome</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Conta Principal" className="rounded-xl h-9 text-sm" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Banco</Label>
                <Input value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} placeholder="Ex: Bradesco" className="rounded-xl h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as ContaBancaria['tipo'] }))}>
                  <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Corrente">Corrente</SelectItem>
                    <SelectItem value="Poupança">Poupança</SelectItem>
                    <SelectItem value="Caixa">Caixa</SelectItem>
                    <SelectItem value="Outra">Outra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Saldo Inicial (R$)</Label>
                <Input type="number" step="0.01" value={form.saldo_inicial} onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} className="rounded-xl h-9 text-sm" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className="rounded-xl text-sm resize-none min-h-[56px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button className="rounded-xl bg-[#3d2b1f] hover:bg-[#3d2b1f]/90 text-white" onClick={handleSave} disabled={saving || !form.nome.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!desativando} onOpenChange={o => !o && setDesativando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar "{desativando?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Ela some da lista de contas disponíveis pra novos pagamentos/recebimentos, mas o histórico já
              registrado nela continua intacto (não é uma exclusão).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDesativar} className="bg-red-600 hover:bg-red-700">Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
