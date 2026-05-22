import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useDespesas } from '@/hooks/useFinanceiro';
import { TrendingDown, Loader2 } from 'lucide-react';

interface DespesaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId?: string;
  processoId?: string;
  onSuccess?: () => void;
}

const TIPOS_DESPESA = [
  'Custas Processuais',
  'Diligências',
  'Honorários de Perito',
  'Honorários de Assistente Técnico',
  'Despesas de Correio',
  'Certidões e Documentos',
  'Despesas de Viagem',
  'Publicações',
  'Outros',
];

export function DespesaModal({ open, onOpenChange, clienteId, processoId, onSuccess }: DespesaModalProps) {
  const { createDespesa } = useDespesas();
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    tipo: '',
    descricao: '',
    valor: '',
    data_despesa: today,
    status: 'Pendente' as 'Pendente' | 'Pago' | 'Reembolsado',
    responsavel_pagamento: 'Escritório' as 'Escritório' | 'Cliente',
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tipo || !form.descricao || !form.valor) return;
    setSaving(true);
    await createDespesa({
      tipo: form.tipo,
      descricao: form.descricao,
      valor: Number(form.valor),
      data_despesa: form.data_despesa || today,
      data_pagamento: form.status === 'Pago' ? today : null,
      status: form.status,
      responsavel_pagamento: form.responsavel_pagamento,
      comprovante_url: null,
      processo_id: processoId || null,
      cliente_id: clienteId || null,
    });
    setSaving(false);
    onOpenChange(false);
    setForm({ tipo: '', descricao: '', valor: '', data_despesa: today, status: 'Pendente', responsavel_pagamento: 'Escritório' });
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden rounded-2xl border border-[#c9a96e]/20 max-w-md w-full">
        {/* Header */}
        <div className="h-[3px] w-full bg-gradient-to-r from-red-500 to-red-400" />
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
          <div className="h-9 w-9 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Nova Despesa</h2>
            <p className="text-[11px] text-muted-foreground">Registro de despesa processual</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo de Despesa</Label>
            <Select value={form.tipo} onValueChange={v => set('tipo', v)} required>
              <SelectTrigger className="rounded-xl h-9 text-sm">
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DESPESA.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Descrição</Label>
            <Textarea
              value={form.descricao}
              onChange={e => set('descricao', e.target.value)}
              placeholder="Descreva a despesa..."
              className="rounded-xl text-sm resize-none min-h-[72px]"
              required
            />
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.valor}
                onChange={e => set('valor', e.target.value)}
                placeholder="0,00"
                className="rounded-xl h-9 text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Data</Label>
              <Input
                type="date"
                value={form.data_despesa}
                onChange={e => set('data_despesa', e.target.value)}
                className="rounded-xl h-9 text-sm"
              />
            </div>
          </div>

          {/* Status + Responsável */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v as typeof form.status)}>
                <SelectTrigger className="rounded-xl h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Reembolsado">Reembolsado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Responsável</Label>
              <Select value={form.responsavel_pagamento} onValueChange={v => set('responsavel_pagamento', v as typeof form.responsavel_pagamento)}>
                <SelectTrigger className="rounded-xl h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Escritório">Escritório</SelectItem>
                  <SelectItem value="Cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl h-9"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.tipo || !form.descricao || !form.valor}
              className="flex-1 rounded-xl h-9 bg-[#3d2b1f] hover:bg-[#3d2b1f]/90 text-white"
            >
              {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Salvando...</> : 'Salvar Despesa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
