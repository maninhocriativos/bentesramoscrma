import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Tag, Plus, Pencil, Ban, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useCategoriasFinanceiras } from '@/hooks/useCategoriasFinanceiras';
import { CategoriaFinanceira } from '@/types/financeiro';

const CORES_DISPONIVEIS = ['#3d2b1f', '#c9a96e', '#16a34a', '#dc2626', '#2563eb', '#9333ea', '#ea580c', '#0891b2'];

export function CategoriasFinanceirasManager() {
  const { categorias, loading, createCategoria, updateCategoria, desativarCategoria } = useCategoriasFinanceiras();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoriaFinanceira | null>(null);
  const [desativando, setDesativando] = useState<CategoriaFinanceira | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: '', tipo: 'despesa' as 'receita' | 'despesa', cor: CORES_DISPONIVEIS[0] });

  const openNew = (tipo: 'receita' | 'despesa') => {
    setEditing(null);
    setForm({ nome: '', tipo, cor: CORES_DISPONIVEIS[0] });
    setDialogOpen(true);
  };

  const openEdit = (c: CategoriaFinanceira) => {
    setEditing(c);
    setForm({ nome: c.nome, tipo: c.tipo, cor: c.cor || CORES_DISPONIVEIS[0] });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    if (editing) {
      await updateCategoria(editing.id, { nome: form.nome.trim(), cor: form.cor });
    } else {
      await createCategoria({ nome: form.nome.trim(), tipo: form.tipo, cor: form.cor, ordem: categorias.length, ativa: true });
    }
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDesativar = async () => {
    if (!desativando) return;
    await desativarCategoria(desativando.id);
    setDesativando(null);
  };

  const receitas = categorias.filter(c => c.tipo === 'receita');
  const despesas = categorias.filter(c => c.tipo === 'despesa');

  const Secao = ({ titulo, icon: Icon, tipo, itens }: { titulo: string; icon: any; tipo: 'receita' | 'despesa'; itens: CategoriaFinanceira[] }) => (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" style={{ color: tipo === 'receita' ? '#16a34a' : '#dc2626' }} />
          {titulo}
        </CardTitle>
        <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={() => openNew(tipo)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nova
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {itens.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma categoria de {tipo}.</p>
        ) : itens.map(c => (
          <div key={c.id} className="flex items-center gap-2.5 rounded-xl border border-border/50 px-3 py-2">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: c.cor || '#9ca3af' }} />
            <span className={`text-sm font-medium flex-1 ${!c.ativa ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{c.nome}</span>
            {!c.ativa && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => openEdit(c)}>
              <Pencil className="h-3 w-3" />
            </Button>
            {c.ativa && (
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-600" onClick={() => setDesativando(c)}>
                <Ban className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Secao titulo="Categorias de Receita" icon={TrendingUp} tipo="receita" itens={receitas} />
      <Secao titulo="Categorias de Despesa" icon={TrendingDown} tipo="despesa" itens={despesas} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-[#b8922a]" /> {editing ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nome</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Consultoria Jurídica" className="rounded-xl h-9 text-sm" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as 'receita' | 'despesa' }))} disabled={!!editing}>
                <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
              {editing && <p className="text-[10px] text-muted-foreground">Tipo não pode ser alterado depois de criada.</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cor</Label>
              <div className="flex gap-1.5 flex-wrap">
                {CORES_DISPONIVEIS.map(cor => (
                  <button key={cor} type="button" onClick={() => setForm(f => ({ ...f, cor }))}
                    className="h-7 w-7 rounded-full transition-all"
                    style={{ background: cor, border: form.cor === cor ? '2.5px solid #3d2b1f' : '2px solid transparent', outline: form.cor === cor ? '2px solid white' : 'none', outlineOffset: -4 }} />
                ))}
              </div>
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
              Ela some da lista de novos lançamentos, mas honorários/despesas que já usam essa categoria continuam
              intactos (não é uma exclusão — histórico e relatórios de meses passados não mudam).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDesativar} className="bg-red-600 hover:bg-red-700">Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
