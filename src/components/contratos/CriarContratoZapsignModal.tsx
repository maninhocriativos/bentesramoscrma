import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { zapsignClient } from '@/integrations/zapsign/client';
import { validateCPF, formatPhone } from '@/lib/utils';

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

  // Carregar modelos quando modal abre
  useEffect(() => {
    if (isOpen) loadModelos();
  }, [isOpen]);

  const loadModelos = async () => {
    try {
      const { data } = await supabase
        .from('modelos_contratos')
        .select('id, nome, descricao, arquivo_url')
        .in('tipo', ['zapsign', 'clicksign'])
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
    if (!signerEmail.includes('@')) newErrors.signerEmail = 'Email inválido';
    if (!signerCPF.trim()) newErrors.signerCPF = 'CPF obrigatório';
    if (!validateCPF(signerCPF)) newErrors.signerCPF = 'CPF inválido';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Buscar modelo
      const { data: modelo } = await supabase
        .from('modelos_contratos')
        .select('arquivo_url, nome')
        .eq('id', modeloId)
        .single();

      if (!modelo) throw new Error('Modelo não encontrado');

      // Criar documento na Zapsign
      const documentResponse = await zapsignClient.createDocument({
        name: `${modelo.nome} - ${signerName}`,
        signers: [
          {
            name: signerName,
            email: signerEmail,
            phone: formatPhone(signerPhone),
            cpf: signerCPF.replace(/\D/g, ''),
          },
        ],
        file_url: modelo.arquivo_url,
        expires_in_days: parseInt(expiresInDays),
        metadata: {
          lead_id: leadId,
          modelo_id: modeloId,
          created_from: 'crm',
        },
      });

      // Salvar no banco de dados
      const { error: dbError } = await supabase
        .from('contract_reminders_zapsign')
        .insert({
          document_id: documentResponse.id,
          document_name: documentResponse.name,
          lead_id: leadId,
          signer_name: signerName,
          signer_email: signerEmail,
          signer_phone: formatPhone(signerPhone),
          signer_cpf: signerCPF.replace(/\D/g, ''),
          modelo_contrato_id: modeloId,
          status: 'pending',
          background_check_status: 'pending',
          contract_link: documentResponse.id,
          created_at: new Date().toISOString(),
        });

      if (dbError) throw dbError;

      // Enviar documento se selecionado
      if (enviarAposCriar) {
        await zapsignClient.sendDocument(documentResponse.id);
        await supabase
          .from('contract_reminders_zapsign')
          .update({
            status: 'pending',
            sent_at: new Date().toISOString(),
          })
          .eq('document_id', documentResponse.id);
      }

      toast({
        title: 'Contrato criado com sucesso!',
        description: `Documento enviado para ${signerEmail}`,
      });

      onSuccess?.();
      onClose();
      resetForm();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar contrato',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setModeloId('');
    setSignerName(leadNome);
    setSignerEmail(leadEmail);
    setSignerPhone(leadPhone);
    setSignerCPF('');
    setExpiresInDays('7');
    setErrors({});
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Criar Contrato Zapsign</DialogTitle>
          <DialogDescription>
            Gere um novo contrato usando os modelos do escritório
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Modelo */}
          <div className="space-y-2">
            <Label htmlFor="modelo">Modelo de Contrato *</Label>
            <Select value={modeloId} onValueChange={setModeloId}>
              <SelectTrigger
                id="modelo"
                className={errors.modeloId ? 'border-red-500' : ''}
              >
                <SelectValue placeholder="Selecione um modelo..." />
              </SelectTrigger>
              <SelectContent>
                {modelos.map((modelo) => (
                  <SelectItem key={modelo.id} value={modelo.id}>
                    {modelo.nome}
                    {modelo.descricao && ` - ${modelo.descricao}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.modeloId && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.modeloId}
              </p>
            )}
          </div>

          {/* Dados do Signatário */}
          <Card className="bg-muted/30 border-border">
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  placeholder="Nome do signatário"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  disabled={loading}
                  className={errors.signerName ? 'border-red-500' : ''}
                />
                {errors.signerName && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.signerName}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    disabled={loading}
                    className={errors.signerEmail ? 'border-red-500' : ''}
                  />
                  {errors.signerEmail && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.signerEmail}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(11) 99999-9999"
                    value={signerPhone}
                    onChange={(e) => setSignerPhone(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf">CPF (sem pontuação) *</Label>
                <Input
                  id="cpf"
                  placeholder="12345678901"
                  value={signerCPF}
                  onChange={(e) =>
                    setSignerCPF(e.target.value.replace(/\D/g, ''))
                  }
                  disabled={loading}
                  maxLength={11}
                  className={errors.signerCPF ? 'border-red-500' : ''}
                />
                {errors.signerCPF && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.signerCPF}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Opções */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="expires">Expira em (dias)</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger id="expires">
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

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enviarAposCriar}
                onChange={(e) => setEnviarAposCriar(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm text-muted-foreground">
                Enviar para assinatura após criar
              </span>
            </label>
          </div>

          {/* Botões */}
          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {enviarAposCriar ? 'Criar e Enviar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
