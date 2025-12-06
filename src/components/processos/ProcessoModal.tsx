import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Processo, ProcessoStatus } from '@/types/processos';
import { Lead } from '@/types/leads';
import { useProcessos } from '@/hooks/useProcessos';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ProcessoModalProps {
  processo: Processo | null;
  isOpen: boolean;
  onClose: () => void;
  isNew?: boolean;
  canDelete?: boolean;
  leads: Lead[];
}

const STATUSES: ProcessoStatus[] = [
  'Em Andamento',
  'Suspenso',
  'Arquivado',
  'Ganho',
  'Perdido',
];

export function ProcessoModal({ 
  processo, 
  isOpen, 
  onClose, 
  isNew = false, 
  canDelete = false,
  leads 
}: ProcessoModalProps) {
  const { createProcesso, updateProcesso, deleteProcesso } = useProcessos();
  const [formData, setFormData] = useState({
    numero_processo: '',
    titulo_acao: '',
    status: 'Em Andamento' as ProcessoStatus,
    advogado_responsavel: '',
    cliente_id: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (processo) {
      setFormData({
        numero_processo: processo.numero_processo || '',
        titulo_acao: processo.titulo_acao || '',
        status: (processo.status as ProcessoStatus) || 'Em Andamento',
        advogado_responsavel: processo.advogado_responsavel || '',
        cliente_id: processo.cliente_id || '',
      });
    } else {
      setFormData({
        numero_processo: '',
        titulo_acao: '',
        status: 'Em Andamento',
        advogado_responsavel: '',
        cliente_id: '',
      });
    }
  }, [processo, isOpen]);

  const handleSave = async () => {
    setSaving(true);
    
    const data = {
      ...formData,
      cliente_id: formData.cliente_id || null,
    };

    if (isNew) {
      await createProcesso(data);
    } else if (processo) {
      await updateProcesso(processo.id, data);
    }
    
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (processo) {
      await deleteProcesso(processo.id);
      onClose();
    }
  };

  // Filter leads that have status "Ganho" or "Contrato Assinado" - these are clients
  const clienteOptions = leads.filter(l => 
    l.status === 'Ganho' || l.status === 'Contrato Assinado'
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isNew ? 'Novo Processo' : 'Detalhes do Processo'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="numero_processo">Número do Processo</Label>
              <Input
                id="numero_processo"
                value={formData.numero_processo}
                onChange={(e) => setFormData({ ...formData, numero_processo: e.target.value })}
                className="rounded-xl"
                placeholder="0000000-00.0000.0.00.0000"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as ProcessoStatus })}
              >
                <SelectTrigger className="rounded-xl">
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

            <div className="col-span-2">
              <Label htmlFor="titulo_acao">Título da Ação</Label>
              <Input
                id="titulo_acao"
                value={formData.titulo_acao}
                onChange={(e) => setFormData({ ...formData, titulo_acao: e.target.value })}
                className="rounded-xl"
                placeholder="Ex: Ação de Indenização por Danos Morais"
              />
            </div>

            <div>
              <Label htmlFor="advogado_responsavel">Advogado Responsável</Label>
              <Input
                id="advogado_responsavel"
                value={formData.advogado_responsavel}
                onChange={(e) => setFormData({ ...formData, advogado_responsavel: e.target.value })}
                className="rounded-xl"
                placeholder="Nome do advogado"
              />
            </div>

            <div>
              <Label htmlFor="cliente_id">Cliente (Lead)</Label>
              <Select
                value={formData.cliente_id}
                onValueChange={(value) => setFormData({ ...formData, cliente_id: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {clienteOptions.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            {!isNew && canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="rounded-xl">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir este processo? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDelete}
                      className="rounded-xl bg-destructive hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="rounded-xl">
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="rounded-xl"
            >
              {saving ? 'Salvando...' : isNew ? 'Criar Processo' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
