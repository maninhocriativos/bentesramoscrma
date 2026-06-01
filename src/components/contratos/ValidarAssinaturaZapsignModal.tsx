import { useState } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { zapsignClient } from '@/integrations/zapsign/client';
import { validateCPF } from '@/lib/utils';

interface ValidarAssinaturaZapsignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  documentId: string;
  documentName: string;
  signerName: string;
  signerEmail: string;
  signerCPF: string;
  currentStatus?: 'pending' | 'approved' | 'rejected' | 'manual';
}

export function ValidarAssinaturaZapsignModal({
  isOpen,
  onClose,
  onSuccess,
  documentId,
  documentName,
  signerName,
  signerEmail,
  signerCPF,
  currentStatus = 'pending',
}: ValidarAssinaturaZapsignModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [validationStatus, setValidationStatus] = useState<
    'pending' | 'validating' | 'approved' | 'rejected' | 'manual'
  >(currentStatus);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleValidate = async () => {
    if (!validateCPF(signerCPF)) {
      setError('CPF inválido');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Chamar API de validação Zapsign
      const result = await zapsignClient.validateSignature(
        documentId,
        signerCPF, // ou use o signer_id se disponível
        signerCPF
      );

      const newStatus = result.status || 'approved';
      setValidationStatus(newStatus);

      // Salvar no banco
      const { error: dbError } = await supabase
        .from('contract_reminders_zapsign')
        .update({
          background_check_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('document_id', documentId);

      if (dbError) throw dbError;

      toast({
        title: 'Validação realizada',
        description: `Status: ${newStatus === 'approved' ? 'Aprovado' : 'Rejeitado'}`,
      });

      onSuccess?.();
    } catch (error: any) {
      setError(error.message || 'Erro ao validar');
      toast({
        title: 'Erro na validação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualApprove = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('contract_reminders_zapsign')
        .update({
          background_check_status: 'manual',
          updated_at: new Date().toISOString(),
        })
        .eq('document_id', documentId);

      if (error) throw error;

      setValidationStatus('manual');
      toast({
        title: 'Marcado para validação manual',
        description: 'Será revisado pela equipe',
      });

      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'manual':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'pending':
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Aprovado';
      case 'rejected':
        return 'Rejeitado';
      case 'manual':
        return 'Validação Manual';
      case 'pending':
      default:
        return 'Pendente';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Validar Assinatura - Background Check</DialogTitle>
          <DialogDescription>
            Valide a identidade do signatário através do CPF
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Contrato */}
          <Card className="bg-muted/30 border-border">
            <CardContent className="pt-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Contrato</p>
                <p className="font-medium text-sm">{documentName}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Signatário</p>
                  <p className="font-medium text-sm">{signerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="font-medium text-sm text-cyan-600">{signerEmail}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">CPF</p>
                <p className="font-medium text-sm font-mono">{signerCPF}</p>
              </div>
            </CardContent>
          </Card>

          {/* Status Atual */}
          <div className="space-y-2">
            <Label>Status de Validação</Label>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={getStatusBadgeColor(validationStatus)}
              >
                {getStatusLabel(validationStatus)}
              </Badge>
              {validationStatus === 'approved' && (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Opções de Validação */}
          {validationStatus === 'pending' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Escolha como validar a identidade do signatário:
              </p>

              <div className="grid gap-3">
                {/* Validação Automática */}
                <Button
                  onClick={handleValidate}
                  disabled={loading}
                  className="justify-start h-auto p-3"
                  variant="outline"
                >
                  <div className="flex-1 text-left">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <>
                        <p className="font-medium text-sm">
                          Validação Automática
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Valida CPF em tempo real
                        </p>
                      </>
                    )}
                  </div>
                </Button>

                {/* Validação Manual */}
                <Button
                  onClick={handleManualApprove}
                  disabled={loading}
                  className="justify-start h-auto p-3"
                  variant="outline"
                >
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">
                      Marcar para Validação Manual
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Será revisado pela equipe
                    </p>
                  </div>
                </Button>
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-xs">
                  Notas (opcional)
                </Label>
                <textarea
                  id="notes"
                  placeholder="Adicione qualquer informação relevante..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                  className="w-full h-20 px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
                />
              </div>
            </div>
          )}

          {validationStatus === 'approved' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm text-emerald-700 font-medium">
                Signatário validado com sucesso!
              </p>
            </div>
          )}

          {validationStatus === 'manual' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <p className="text-sm text-amber-700 font-medium">
                Marcado para validação manual
              </p>
            </div>
          )}

          {validationStatus === 'rejected' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-700 font-medium">
                CPF não passou na validação
              </p>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
