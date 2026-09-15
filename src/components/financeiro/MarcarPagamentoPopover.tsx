import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Loader2 } from 'lucide-react';
import { useContasBancarias } from '@/hooks/useContasBancarias';

interface MarcarPagamentoPopoverProps {
  onConfirm: (dataPagamento: string, contaBancariaId: string | null) => Promise<void>;
  label?: string;
}

/**
 * Popover compartilhado pra dar baixa em parcela/despesa — pergunta data de
 * pagamento + de qual conta, pra alimentar o saldo por conta. Reusado em
 * ParcelasTable e DespesasTable.
 */
export function MarcarPagamentoPopover({ onConfirm, label = 'Pagar' }: MarcarPagamentoPopoverProps) {
  const { contasAtivas, fetchContas } = useContasBancarias();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [dataPagamento, setDataPagamento] = useState(today);
  const [contaId, setContaId] = useState('');

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(dataPagamento, contaId || null);
    setSaving(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (o) fetchContas(); }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Check className="h-4 w-4 mr-1" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 rounded-xl" align="end">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Data do Pagamento</Label>
            <Input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} className="rounded-xl h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Conta Bancária (opcional)</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger className="rounded-xl h-9 text-sm">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {contasAtivas.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="w-full rounded-xl bg-[#3d2b1f] hover:bg-[#3d2b1f]/90 text-white" onClick={handleConfirm} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirmar Pagamento'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
