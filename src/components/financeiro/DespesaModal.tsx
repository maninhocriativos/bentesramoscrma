import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useDespesas } from '@/hooks/useFinanceiro';

export function DespesaModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { createDespesa } = useDespesas();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    await createDespesa({
      tipo: formData.get('tipo') as string || 'Outros',
      descricao: formData.get('descricao') as string,
      valor: Number(formData.get('valor')) || 0,
      data_despesa: new Date().toISOString().split('T')[0],
      data_pagamento: null,
      status: 'Pendente',
      responsavel_pagamento: 'Escritório',
      comprovante_url: null,
      processo_id: null,
      cliente_id: null,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Despesa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tipo">Tipo</Label>
            <Input id="tipo" name="tipo" placeholder="Custas, Diligências..." required />
          </div>
          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" name="descricao" required />
          </div>
          <div>
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input id="valor" name="valor" type="number" step="0.01" required />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
