import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProcessos } from '@/hooks/useProcessos';
import { ProcessoStatus } from '@/types/processos';

interface CreateProcessoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNome?: string;
  onSuccess: () => void;
}

const STATUSES: ProcessoStatus[] = [
  'Em Andamento',
  'Suspenso',
  'Arquivado',
  'Ganho',
  'Perdido',
];

export function CreateProcessoModal({ open, onOpenChange, clienteId, clienteNome, onSuccess }: CreateProcessoModalProps) {
  const { createProcesso } = useProcessos();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    numero_processo: '',
    titulo_acao: '',
    status: 'Em Andamento' as ProcessoStatus,
    advogado_responsavel: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    await createProcesso({
      ...formData,
      cliente_id: clienteId,
    });

    setSaving(false);
    setFormData({
      numero_processo: '',
      titulo_acao: '',
      status: 'Em Andamento',
      advogado_responsavel: '',
    });
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Processo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Número do Processo</Label>
            <Input
              value={formData.numero_processo}
              onChange={(e) => setFormData({ ...formData, numero_processo: e.target.value })}
              placeholder="0000000-00.0000.0.00.0000"
            />
          </div>

          <div className="space-y-2">
            <Label>Título da Ação *</Label>
            <Input
              required
              value={formData.titulo_acao}
              onChange={(e) => setFormData({ ...formData, titulo_acao: e.target.value })}
              placeholder="Ex: Ação de Indenização"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as ProcessoStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Advogado Responsável</Label>
            <Input
              value={formData.advogado_responsavel}
              onChange={(e) => setFormData({ ...formData, advogado_responsavel: e.target.value })}
              placeholder="Nome do advogado"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Criar Processo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}