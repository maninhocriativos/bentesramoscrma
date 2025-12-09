import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Interacao } from '@/types/interacoes';

interface InteracaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  onSave: (interacao: Omit<Interacao, 'id' | 'created_at'>) => Promise<any>;
}

const tiposInteracao = [
  'Ligação',
  'Email',
  'WhatsApp',
  'Reunião',
  'Atendimento Presencial',
] as const;

export function InteracaoModal({ open, onOpenChange, clienteId, onSave }: InteracaoModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tipo: 'Ligação' as Interacao['tipo'],
    direcao: 'Saída' as Interacao['direcao'],
    resumo: '',
    detalhes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    await onSave({
      ...form,
      cliente_id: clienteId,
      processo_id: null,
      responsavel_id: null,
      data_interacao: new Date().toISOString(),
    });

    setLoading(false);
    setForm({ tipo: 'Ligação', direcao: 'Saída', resumo: '', detalhes: '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Interação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(value) => setForm({ ...form, tipo: value as Interacao['tipo'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposInteracao.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Direção</Label>
              <Select
                value={form.direcao}
                onValueChange={(value) => setForm({ ...form, direcao: value as Interacao['direcao'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Entrada">Entrada</SelectItem>
                  <SelectItem value="Saída">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Resumo *</Label>
            <Input
              required
              value={form.resumo}
              onChange={(e) => setForm({ ...form, resumo: e.target.value })}
              placeholder="Breve descrição da interação"
            />
          </div>

          <div className="space-y-2">
            <Label>Detalhes</Label>
            <Textarea
              value={form.detalhes}
              onChange={(e) => setForm({ ...form, detalhes: e.target.value })}
              placeholder="Detalhes adicionais..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}