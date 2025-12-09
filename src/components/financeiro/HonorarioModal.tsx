import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useHonorarios } from '@/hooks/useFinanceiro';

export function HonorarioModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { createHonorario } = useHonorarios();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    await createHonorario({
      tipo: 'Fixo',
      valor_total: Number(formData.get('valor_total')) || 0,
      valor_entrada: null,
      percentual_exito: null,
      forma_pagamento: 'À Vista',
      num_parcelas: 1,
      data_contrato: new Date().toISOString().split('T')[0],
      status: 'Ativo',
      observacoes: formData.get('observacoes') as string || null,
      cliente_id: null,
      processo_id: null,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Honorário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="valor_total">Valor Total (R$)</Label>
            <Input id="valor_total" name="valor_total" type="number" step="0.01" required />
          </div>
          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Input id="observacoes" name="observacoes" />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
