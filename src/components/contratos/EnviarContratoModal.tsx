import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Send, Loader2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Lead {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
}

interface EnviarContratoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preSelectedLead?: Lead | null;
}

export function EnviarContratoModal({ isOpen, onClose, onSuccess, preSelectedLead }: EnviarContratoModalProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerPhone, setSignerPhone] = useState('');
  const [authType, setAuthType] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [message, setMessage] = useState('Por favor, assine o contrato.');
  const [sending, setSending] = useState(false);

  // Fetch leads for selection
  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase
        .from('leads_juridicos')
        .select('id, nome, email, telefone')
        .order('nome');
      if (data) setLeads(data);
    };
    if (isOpen) fetchLeads();
  }, [isOpen]);

  // Pre-fill when opening with a pre-selected lead
  useEffect(() => {
    if (isOpen && preSelectedLead) {
      setSelectedLeadId(preSelectedLead.id);
      setSignerName(preSelectedLead.nome || '');
      setSignerEmail(preSelectedLead.email || '');
      setSignerPhone(preSelectedLead.telefone || '');
    }
  }, [isOpen, preSelectedLead]);

  // Auto-fill when lead is selected
  const handleLeadSelect = (leadId: string) => {
    const actualId = leadId === 'none' ? '' : leadId;
    setSelectedLeadId(actualId);
    const lead = leads.find(l => l.id === actualId);
    if (lead) {
      setSignerName(lead.nome || '');
      setSignerEmail(lead.email || '');
      setSignerPhone(lead.telefone || '');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !signerName || !signerEmail) return;

    setSending(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 1. Create document in Clicksign
      const { data: docData, error: docError } = await supabase.functions.invoke('clicksign', {
        body: {
          action: 'create_document',
          file_content: fileBase64,
          file_name: file.name,
        },
      });

      if (docError) throw docError;
      if (docData.error) throw new Error(docData.error);

      const documentKey = docData.document?.key;
      if (!documentKey) throw new Error('Falha ao criar documento');

      // 2. Add signer
      const { data: signerData, error: signerError } = await supabase.functions.invoke('clicksign', {
        body: {
          action: 'add_signer',
          signer: {
            email: signerEmail,
            name: signerName,
            phone: signerPhone || undefined,
            auth_type: authType,
          },
        },
      });

      if (signerError) throw signerError;
      if (signerData.error) throw new Error(signerData.error);

      const signerKey = signerData.signer?.key;
      if (!signerKey) throw new Error('Falha ao adicionar signatário');

      // 3. Create signature list (associate signer with document)
      const { data: listData, error: listError } = await supabase.functions.invoke('clicksign', {
        body: {
          action: 'create_list',
          document_key: documentKey,
          signer_key: signerKey,
          message: message,
        },
      });

      if (listError) throw listError;
      if (listData.error) throw new Error(listData.error);

      // Update lead with contract link if a lead was selected
      if (selectedLeadId && documentKey) {
        const requestKey: string | undefined = listData?.list?.request_signature_key;
        // Só persiste link de assinatura VÁLIDO (/sign/<request_signature_key>).
        // O antigo fallback /document/<key> é uma página interna que exige login e
        // leva a erro para o cliente — nesses casos guardamos null e a listagem
        // resolve o sign_url correto depois (via edge function).
        const clicksignSignUrl = requestKey
          ? `https://app.clicksign.com/sign/${requestKey}`
          : null;

        await supabase
          .from('leads_juridicos')
          .update({ 
            link_contrato: clicksignSignUrl,
            contract_key: documentKey,
            contract_sent_at: new Date().toISOString(),
          })
          .eq('id', selectedLeadId);
        
        // Also create an interaction record
        await supabase.from('interacoes').insert({
          cliente_id: selectedLeadId,
          tipo: 'Documento',
          resumo: 'Contrato enviado para assinatura via Clicksign',
          detalhes: `Documento: ${file.name}\nEmail: ${signerEmail}`,
        });
      }

      toast({
        title: 'Contrato enviado!',
        description: `O contrato foi enviado para ${signerEmail} via Clicksign.`,
      });

      // Reset form
      setFile(null);
      setSelectedLeadId('');
      setSignerName('');
      setSignerEmail('');
      setSignerPhone('');
      setMessage('Por favor, assine o contrato.');
      onClose();
      onSuccess?.();

    } catch (error: any) {
      console.error('Error sending contract:', error);
      toast({
        title: 'Erro ao enviar contrato',
        description: error.message || 'Falha ao processar contrato no Clicksign.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar Contrato para Assinatura</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contract-file">Arquivo do Contrato (PDF)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="contract-file"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="flex-1"
              />
            </div>
            {file && (
              <p className="text-sm text-muted-foreground">{file.name}</p>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Vincular a Lead (opcional)
            </h4>
            
            <div className="space-y-2 mb-4">
              <Select value={selectedLeadId || 'none'} onValueChange={handleLeadSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um lead para vincular..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (envio avulso)</SelectItem>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.nome || 'Sem nome'} {lead.email ? `(${lead.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ao vincular, o link do contrato será salvo no cadastro do lead
              </p>
            </div>

            <h4 className="font-medium mb-3">Dados do Signatário</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signer-name">Nome Completo *</Label>
                <Input
                  id="signer-name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Nome do cliente"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signer-email">Email *</Label>
                <Input
                  id="signer-email"
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signer-phone">Telefone (opcional)</Label>
                <Input
                  id="signer-phone"
                  value={signerPhone}
                  onChange={(e) => setSignerPhone(e.target.value)}
                  placeholder="+5511999999999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-type">Método de Autenticação</Label>
                <Select value={authType} onValueChange={(v) => setAuthType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem para o Signatário</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mensagem que será enviada junto com o contrato..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!file || !signerName || !signerEmail || sending}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar para Assinatura
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
