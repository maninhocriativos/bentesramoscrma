import { useState, useEffect, useMemo, useCallback } from 'react';
import { MessageCircle, FileText, Trash2, Sparkles, Bot } from 'lucide-react';
import { useInteracoes } from '@/hooks/useInteracoes';
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
  canDelete?: boolean;
}

type LeadModalFormData = {
  nome: string;
  telefone: string;
  email: string;
  status: LeadStatus;
  origem: LeadOrigem;
  resumo_ia: string;
  link_contrato: string;
  valor_causa: string | number;
  tipo_acao: string;
  fonte_trafego: string;
  contratos_adicionais: number;
};

interface LeadModalDraft {
  formData: LeadModalFormData;
  updatedAt: string;
}

const LEAD_DRAFT_STORAGE_PREFIX = 'lead_modal_draft_v1';
const LEAD_DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24;

const STATUSES: LeadStatus[] = [
  'Lead Frio',
  'Bentes Ramos',
  'Em Atendimento',
  'Em Negociação',
  'Aguardando Contrato',
  'Contrato Assinado',
  'Ganho',
  'Perdido',
];

const ORIGENS: LeadOrigem[] = ['Instagram', 'Google', 'Site', 'Indicação', 'Bentes Ramos', 'Outro'];

const FONTES_TRAFEGO = [
  { value: 'organico', label: 'Orgânico' },
  { value: 'trafego_pago', label: 'Tráfego Pago 💰' },
  { value: 'indicacao', label: 'Indicação 🤝' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'facebook_ads', label: 'Facebook Ads' },
  { value: 'site', label: 'Site' },
  { value: 'outro', label: 'Outro' },
];

const createEmptyFormData = (): LeadModalFormData => ({
  nome: '',
  telefone: '',
  email: '',
  status: 'Lead Frio',
  origem: 'Outro',
  resumo_ia: '',
  link_contrato: '',
  valor_causa: '',
  tipo_acao: '',
  fonte_trafego: 'organico',
  contratos_adicionais: 0,
});

const createFormDataFromLead = (lead: Lead | null): LeadModalFormData => {
  if (!lead) return createEmptyFormData();

  return {
    nome: lead.nome || '',
    telefone: lead.telefone || '',
    email: lead.email || '',
    status: lead.status || 'Lead Frio',
    origem: (lead.origem as LeadOrigem) || 'Outro',
    resumo_ia: lead.resumo_ia || '',
    link_contrato: lead.link_contrato || '',
    valor_causa: lead.valor_causa ?? '',
    tipo_acao: lead.tipo_acao || '',
    fonte_trafego: lead.fonte_trafego || 'organico',
    contratos_adicionais: lead.contratos_adicionais || 0,
  };
};

export function LeadModal({ lead, isOpen, onClose, isNew = false, canDelete = true }: LeadModalProps) {
  const { createLead, updateLead, deleteLead } = useLeads();
  const { interacoes } = useInteracoes(lead?.id);
  const [formData, setFormData] = useState<LeadModalFormData>(() => createFormDataFromLead(lead));
  const [saving, setSaving] = useState(false);
  const [isDraftReady, setIsDraftReady] = useState(false);

  const draftStorageKey = useMemo(() => {
    const draftId = isNew ? '__new__' : lead?.id ?? '__new__';
    return `${LEAD_DRAFT_STORAGE_PREFIX}:${draftId}`;
  }, [isNew, lead?.id]);

  const readDraft = useCallback((): LeadModalDraft | null => {
    if (!draftStorageKey || typeof window === 'undefined') return null;

    try {
      const rawDraft = window.localStorage.getItem(draftStorageKey);
      if (!rawDraft) return null;

      const parsedDraft = JSON.parse(rawDraft) as LeadModalDraft;
      const updatedAt = new Date(parsedDraft.updatedAt).getTime();

      if (!updatedAt || Date.now() - updatedAt > LEAD_DRAFT_MAX_AGE_MS) {
        window.localStorage.removeItem(draftStorageKey);
        return null;
      }

      return parsedDraft;
    } catch {
      window.localStorage.removeItem(draftStorageKey);
      return null;
    }
  }, [draftStorageKey]);

  const clearDraft = useCallback(() => {
    if (!draftStorageKey || typeof window === 'undefined') return;
    window.localStorage.removeItem(draftStorageKey);
  }, [draftStorageKey]);

  useEffect(() => {
    if (!isOpen) {
      setIsDraftReady(false);
      return;
    }

    const baseData = createFormDataFromLead(lead);
    const draft = readDraft();

    if (draft?.formData) {
      setFormData({ ...baseData, ...draft.formData });
    } else {
      setFormData(baseData);
    }

    setIsDraftReady(true);
  }, [lead, isOpen, readDraft]);

  useEffect(() => {
    if (!isOpen || !isDraftReady || !draftStorageKey || typeof window === 'undefined') return;

    const hasAnyData = Boolean(
      formData.nome.trim() ||
        formData.telefone.trim() ||
        formData.email.trim() ||
        formData.resumo_ia.trim() ||
        formData.link_contrato.trim() ||
        String(formData.valor_causa).trim() ||
        formData.tipo_acao.trim() ||
        Number(formData.contratos_adicionais) > 0
    );

    if (!hasAnyData) {
      window.localStorage.removeItem(draftStorageKey);
      return;
    }

    const payload: LeadModalDraft = {
      formData,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
  }, [formData, isOpen, isDraftReady, draftStorageKey]);

  const handleSave = async () => {
    if (!formData.nome.trim()) return;

    setSaving(true);

    try {
      const dataToSave = {
        ...formData,
        valor_causa: formData.valor_causa ? Number(formData.valor_causa) : null,
        contratos_adicionais: Number(formData.contratos_adicionais) || 0,
      };

      if (isNew) {
        await createLead(dataToSave);
      } else if (lead) {
        await updateLead(lead.id, dataToSave);
      }

      clearDraft();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (lead) {
      await deleteLead(lead.id);
      clearDraft();
      onClose();
    }
  };

  const whatsappLink = formData.telefone
    ? `https://wa.me/${formData.telefone.replace(/\D/g, '')}`
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-xl">
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

            <div>
              <Label htmlFor="tipo_acao">Tipo de Ação</Label>
              <Input
                id="tipo_acao"
                value={formData.tipo_acao}
                onChange={(e) => setFormData({ ...formData, tipo_acao: e.target.value })}
                className="rounded-xl"
                placeholder="Ex: Trabalhista, Cível..."
              />
            </div>

            <div>
              <Label htmlFor="valor_causa">Valor da Causa</Label>
              <Input
                id="valor_causa"
                type="number"
                value={formData.valor_causa}
                onChange={(e) => setFormData({ ...formData, valor_causa: e.target.value })}
                className="rounded-xl"
                placeholder="R$ 0,00"
              />
            </div>

            <div>
              <Label htmlFor="fonte_trafego">Fonte de Tráfego</Label>
              <Select
                value={formData.fonte_trafego}
                onValueChange={(value) => setFormData({ ...formData, fonte_trafego: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONTES_TRAFEGO.map((ft) => (
                    <SelectItem key={ft.value} value={ft.value}>
                      {ft.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contratos_adicionais">Contratos Adicionais</Label>
              <Input
                id="contratos_adicionais"
                type="number"
                min="0"
                value={formData.contratos_adicionais}
                onChange={(e) => setFormData({ ...formData, contratos_adicionais: parseInt(e.target.value) || 0 })}
                className="rounded-xl"
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">Taxa de reaproveitamento</p>
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
                className="rounded-xl min-h-[80px]"
                placeholder="Observações sobre o lead..."
              />
            </div>

            {/* Insights da IA baseados nas interações */}
            {!isNew && interacoes.length > 0 && (
              <div className="col-span-2 bg-muted/50 rounded-xl p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm">Insights da Isa</span>
                  <Sparkles className="h-3 w-3 text-gold" />
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Total de interações:</span>
                    <span className="font-semibold text-foreground">{interacoes.length}</span>
                  </div>
                  
                  {interacoes[0] && (
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">Última interação:</p>
                      <p className="text-foreground line-clamp-2">{interacoes[0].resumo}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(interacoes[0].data_interacao).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
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

            {!isNew && canDelete && (
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
