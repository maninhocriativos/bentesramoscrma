import { useState, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, Zap, User, Mail, Phone, CreditCard, Calendar, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { zapsignClient } from '@/integrations/zapsign/client';
import { validateCPF, formatPhone } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CriarContratoZapsignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  leadId?: string;
  leadNome?: string;
  leadEmail?: string;
  leadPhone?: string;
}

export function CriarContratoZapsignModal({
  isOpen,
  onClose,
  onSuccess,
  leadId,
  leadNome = '',
  leadEmail = '',
  leadPhone = '',
}: CriarContratoZapsignModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [modeloId, setModeloId] = useState('');
  const [modelos, setModelos] = useState<any[]>([]);
  const [signerName, setSignerName] = useState(leadNome);
  const [signerEmail, setSignerEmail] = useState(leadEmail);
  const [signerPhone, setSignerPhone] = useState(leadPhone);
  const [signerCPF, setSignerCPF] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [enviarAposCriar, setEnviarAposCriar] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      loadModelos();
      setSignerName(leadNome);
      setSignerEmail(leadEmail);
      setSignerPhone(leadPhone);
    }
  }, [isOpen, leadNome, leadEmail, leadPhone]);

  const loadModelos = async () => {
    try {
      const { data } = await supabase
        .from('modelos_contratos')
        .select('id, nome, descricao, arquivo_url')
        .order('nome');
      setModelos(data || []);
    } catch (error) {
      console.error('Erro ao carregar modelos:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!modeloId) newErrors.modeloId = 'Selecione um modelo';
    if (!signerName.trim()) newErrors.signerName = 'Nome obrigatório';
    if (!signerEmail.trim()) newErrors.signerEmail = 'Email obrigatório';
    else if (!signerEmail.includes('@')) newErrors.signerEmail = 'Email inválido';
    if (!signerCPF.trim()) newErrors.signerCPF = 'CPF obrigatório';
    else if (!validateCPF(signerCPF)) newErrors.signerCPF = 'CPF inválido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const { data: modelo } = await supabase
        .from('modelos_contratos')
        .select('arquivo_url, nome')
        .eq('id', modeloId)
        .single();

      if (!modelo) throw new Error('Modelo não encontrado');

      const documentResponse = await zapsignClient.createDocument({
        name: `${modelo.nome} - ${signerName}`,
        signers: [{
          name: signerName,
          email: signerEmail,
          phone: formatPhone(signerPhone),
          cpf: signerCPF.replace(/\D/g, ''),
        }],
        file_url: modelo.arquivo_url,
        expires_in_days: parseInt(expiresInDays),
        metadata: { lead_id: leadId, modelo_id: modeloId, created_from: 'crm' },
      });

      const { error: dbError } = await supabase
        .from('contract_reminders_zapsign')
        .insert({
          document_id: documentResponse.id,
          document_name: documentResponse.name,
          lead_id: leadId || null,
          signer_name: signerName,
          signer_email: signerEmail,
          signer_phone: formatPhone(signerPhone),
          signer_cpf: signerCPF.replace(/\D/g, ''),
          modelo_contrato_id: modeloId,
          status: 'pending',
          background_check_status: 'pending',
          contract_link: documentResponse.id,
        });

      if (dbError) throw dbError;

      if (enviarAposCriar) {
        await zapsignClient.sendDocument(documentResponse.id);
        await supabase
          .from('contract_reminders_zapsign')
          .update({ sent_at: new Date().toISOString() })
          .eq('document_id', documentResponse.id);
      }

      toast({ title: 'Contrato criado!', description: `Enviado para ${signerEmail}` });
      onSuccess?.();
      onClose();
      resetForm();
    } catch (error: any) {
      toast({ title: 'Erro ao criar contrato', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setModeloId('');
    setSignerName('');
    setSignerEmail('');
    setSignerPhone('');
    setSignerCPF('');
    setExpiresInDays('7');
    setErrors({});
  };

  const FieldError = ({ msg }: { msg?: string }) =>
    msg ? (
      <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
        <AlertCircle className="h-3 w-3 shrink-0" /> {msg}
      </p>
    ) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header fixo */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-cyan-100 dark:bg-cyan-950/40 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Criar Contrato Zapsign</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gere e envie um contrato para assinatura digital
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo com scroll */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Modelo */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Modelo de Contrato <span className="text-red-500">*</span></Label>
              <Select value={modeloId} onValueChange={setModeloId} disabled={loading}>
                <SelectTrigger className={cn('h-10', errors.modeloId && 'border-red-500 focus:ring-red-500')}>
                  <SelectValue placeholder="Selecione um modelo..." />
                </SelectTrigger>
                <SelectContent>
                  {modelos.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                      Nenhum modelo cadastrado
                    </div>
                  ) : (
                    modelos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-medium">{m.nome}</span>
                        {m.descricao && <span className="text-muted-foreground ml-1 text-xs">— {m.descricao}</span>}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FieldError msg={errors.modeloId} />
            </div>

            {/* Separador */}
            <div className="border-t border-dashed border-border" />

            {/* Dados do signatário */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Dados do Signatário
              </p>

              {/* Nome */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Nome Completo <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="Nome completo do signatário"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  disabled={loading}
                  className={cn('h-10', errors.signerName && 'border-red-500')}
                />
                <FieldError msg={errors.signerName} />
              </div>

              {/* Email + Telefone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    disabled={loading}
                    className={cn('h-10', errors.signerEmail && 'border-red-500')}
                  />
                  <FieldError msg={errors.signerEmail} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    Telefone
                  </Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={signerPhone}
                    onChange={(e) => setSignerPhone(e.target.value)}
                    disabled={loading}
                    className="h-10"
                  />
                </div>
              </div>

              {/* CPF */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  CPF <span className="text-red-500">*</span>
                  <span className="text-xs text-muted-foreground font-normal">(somente números)</span>
                </Label>
                <Input
                  placeholder="00000000000"
                  value={signerCPF}
                  onChange={(e) => setSignerCPF(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  disabled={loading}
                  maxLength={11}
                  className={cn('h-10 font-mono tracking-widest', errors.signerCPF && 'border-red-500')}
                />
                <FieldError msg={errors.signerCPF} />
              </div>
            </div>

            {/* Separador */}
            <div className="border-t border-dashed border-border" />

            {/* Configurações */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Configurações
              </p>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Prazo para assinatura
                </Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays} disabled={loading}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 dia</SelectItem>
                    <SelectItem value="3">3 dias</SelectItem>
                    <SelectItem value="7">7 dias (padrão)</SelectItem>
                    <SelectItem value="14">14 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <label className={cn(
                'flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl border transition-colors',
                enviarAposCriar
                  ? 'border-cyan-300 bg-cyan-50/50 dark:bg-cyan-950/20 dark:border-cyan-800'
                  : 'border-border bg-muted/20'
              )}>
                <input
                  type="checkbox"
                  checked={enviarAposCriar}
                  onChange={(e) => setEnviarAposCriar(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 rounded accent-cyan-600"
                />
                <div>
                  <p className="text-sm font-medium">Enviar para assinatura após criar</p>
                  <p className="text-xs text-muted-foreground">
                    O signatário receberá um email com o link
                  </p>
                </div>
                <Send className={cn('h-4 w-4 ml-auto shrink-0', enviarAposCriar ? 'text-cyan-600' : 'text-muted-foreground')} />
              </label>
            </div>
          </div>

          {/* Footer fixo */}
          <div className="shrink-0 px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              <span className="text-red-500">*</span> Campos obrigatórios
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading} size="sm">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700 text-white min-w-[110px]"
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</>
                  : enviarAposCriar
                    ? <><Send className="h-4 w-4 mr-2" /> Criar e Enviar</>
                    : 'Criar Contrato'
                }
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
