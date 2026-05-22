import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useHonorarios } from '@/hooks/useFinanceiro';
import { DollarSign, Loader2 } from 'lucide-react';

interface HonorarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId?: string;
  processoId?: string;
  onSuccess?: () => void;
}

type Tipo = 'Fixo' | 'Por Êxito' | 'Misto';
type FormaPag = 'À Vista' | 'Parcelado';

export function HonorarioModal({ open, onOpenChange, clienteId, processoId, onSuccess }: HonorarioModalProps) {
  const { createHonorario } = useHonorarios();
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    tipo: 'Fixo' as Tipo,
    valor_total: '',
    valor_entrada: '',
    percentual_exito: '',
    forma_pagamento: 'À Vista' as FormaPag,
    num_parcelas: '1',
    data_contrato: today,
    observacoes: '',
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  const showExito = form.tipo === 'Por Êxito' || form.tipo === 'Misto';
  const showParcelas = form.forma_pagamento === 'Parcelado';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.valor_total) return;
    setSaving(true);
    await createHonorario({
      tipo: form.tipo,
      valor_total: Number(form.valor_total),
      valor_entrada: form.valor_entrada ? Number(form.valor_entrada) : null,
      percentual_exito: form.percentual_exito ? Number(form.percentual_exito) : null,
      forma_pagamento: form.forma_pagamento,
      num_parcelas: showParcelas ? Number(form.num_parcelas) || 1 : 1,
      data_contrato: form.data_contrato || today,
      status: 'Ativo',
      observacoes: form.observacoes || null,
      cliente_id: clienteId || null,
      processo_id: processoId || null,
    });
    setSaving(false);
    onOpenChange(false);
    setForm({ tipo: 'Fixo', valor_total: '', valor_entrada: '', percentual_exito: '', forma_pagamento: 'À Vista', num_parcelas: '1', data_contrato: today, observacoes: '' });
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden rounded-2xl border border-[#c9a96e]/20 max-w-md w-full">
        {/* Header */}
        <div className="h-[3px] w-full bg-gradient-to-r from-[#c9a96e] to-[#b8922a]" />
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
          <div className="h-9 w-9 rounded-xl bg-[#c9a96e]/12 flex items-center justify-center shrink-0">
            <DollarSign className="h-4 w-4 text-[#b8922a]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Novo Honorário</h2>
            <p className="text-[11px] text-muted-foreground">Cadastro de contrato de honorários</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Tipo + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => set('tipo', v as Tipo)}>
                <SelectTrigger className="rounded-xl h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fixo">Fixo</SelectItem>
                  <SelectItem value="Por Êxito">Por Êxito</SelectItem>
                  <SelectItem value="Misto">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Data do Contrato</Label>
              <Input
                type="date"
                value={form.data_contrato}
                onChange={e => set('data_contrato', e.target.value)}
                className="rounded-xl h-9 text-sm"
              />
            </div>
          </div>

          {/* Valor total + Valor entrada */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valor Total (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_total}
                onChange={e => set('valor_total', e.target.value)}
                placeholder="0,00"
                className="rounded-xl h-9 text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valor de Entrada (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_entrada}
                onChange={e => set('valor_entrada', e.target.value)}
                placeholder="0,00"
                className="rounded-xl h-9 text-sm"
              />
            </div>
          </div>

          {/* Percentual êxito (condicional) */}
          {showExito && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Percentual de Êxito (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.percentual_exito}
                onChange={e => set('percentual_exito', e.target.value)}
                placeholder="Ex: 30"
                className="rounded-xl h-9 text-sm"
              />
            </div>
          )}

          {/* Forma de pagamento + Parcelas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Forma de Pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={v => set('forma_pagamento', v as FormaPag)}>
                <SelectTrigger className="rounded-xl h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="À Vista">À Vista</SelectItem>
                  <SelectItem value="Parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showParcelas && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nº de Parcelas</Label>
                <Input
                  type="number"
                  min="2"
                  max="120"
                  value={form.num_parcelas}
                  onChange={e => set('num_parcelas', e.target.value)}
                  placeholder="Ex: 12"
                  className="rounded-xl h-9 text-sm"
                />
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={e => set('observacoes', e.target.value)}
              placeholder="Notas adicionais sobre o contrato..."
              className="rounded-xl text-sm resize-none min-h-[64px]"
            />
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
              disabled={saving || !form.valor_total}
              className="flex-1 rounded-xl h-9 bg-[#3d2b1f] hover:bg-[#3d2b1f]/90 text-white"
            >
              {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Salvando...</> : 'Salvar Honorário'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
