import { useState, useEffect } from 'react';
import { MessageCircle, FileText, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lead, LeadStatus, LeadOrigem } from '@/types/leads';
import { useLeads } from '@/hooks/useLeads';
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

interface LeadModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  isNew?: boolean;
}

const STATUSES: LeadStatus[] = [
  'Lead Frio',
  'Em Atendimento',
  'Aguardando Contrato',
  'Contrato Assinado',
  'Ganho',
  'Perdido',
];

const ORIGENS: LeadOrigem[] = ['Instagram', 'Google', 'Site', 'Indicação', 'Outro'];

export function LeadModal({ lead, isOpen, onClose, isNew = false }: LeadModalProps) {
  const { createLead, updateLead, deleteLead } = useLeads();
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    status: 'Lead Frio' as LeadStatus,
    origem: 'Outro' as LeadOrigem,
    resumo_ia: '',
    link_contrato: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setFormData({
        nome: lead.nome || '',
        telefone: lead.telefone || '',
        email: lead.email || '',
        status: lead.status || 'Lead Frio',
        origem: (lead.origem as LeadOrigem) || 'Outro',
        resumo_ia: lead.resumo_ia || '',
        link_contrato: lead.link_contrato || '',
      });
    } else {
      setFormData({
        nome: '',
        telefone: '',
        email: '',
        status: 'Lead Frio',
        origem: 'Outro',
        resumo_ia: '',
        link_contrato: '',
      });
    }
  }, [lead, isOpen]);

  const handleSave = async () => {
    if (!formData.nome.trim()) return;
    
    setSaving(true);
    
    if (isNew) {
      await createLead(formData);
    } else if (lead) {
      await updateLead(lead.id, formData);
    }
    
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (lead) {
      await deleteLead(lead.id);
      onClose();
    }
  };

  const whatsappLink = formData.telefone
    ? `https://wa.me/${formData.telefone.replace(/\D/g, '')}`
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isNew ? 'Novo Lead' : 'Detalhes do Lead'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="rounded-xl"
                placeholder="Nome do lead"
              />
            </div>

            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className="rounded-xl"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="rounded-xl"
                placeholder="email@exemplo.com"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as LeadStatus })}
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

            <div>
              <Label htmlFor="origem">Origem</Label>
              <Select
                value={formData.origem}
                onValueChange={(value) => setFormData({ ...formData, origem: value as LeadOrigem })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((origem) => (
                    <SelectItem key={origem} value={origem}>
                      {origem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="link_contrato">Link do Contrato</Label>
              <Input
                id="link_contrato"
                value={formData.link_contrato}
                onChange={(e) => setFormData({ ...formData, link_contrato: e.target.value })}
                className="rounded-xl"
                placeholder="https://..."
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="resumo_ia">Resumo / Anotações</Label>
              <Textarea
                id="resumo_ia"
                value={formData.resumo_ia}
                onChange={(e) => setFormData({ ...formData, resumo_ia: e.target.value })}
                className="rounded-xl min-h-[100px]"
                placeholder="Observações sobre o lead..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            {whatsappLink && (
              <Button
                variant="outline"
                className="rounded-xl border-green-500 text-green-600 hover:bg-green-50"
                asChild
              >
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </a>
              </Button>
            )}

            {formData.link_contrato ? (
              <Button
                variant="outline"
                className="rounded-xl bg-accent/20 border-accent text-accent-foreground hover:bg-accent/30"
                asChild
              >
                <a href={formData.link_contrato} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Contrato
                </a>
              </Button>
            ) : (
              <Button variant="outline" className="rounded-xl" disabled>
                <FileText className="h-4 w-4 mr-2" />
                Contrato Pendente
              </Button>
            )}

            {!isNew && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="rounded-xl ml-auto">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.
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
              disabled={saving || !formData.nome.trim()}
              className="rounded-xl"
            >
              {saving ? 'Salvando...' : isNew ? 'Criar Lead' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
