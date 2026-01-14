import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Check, X, AlertTriangle, FileText, 
  Loader2, Sparkles, CheckCircle2, XCircle 
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { usePeticoes } from '@/hooks/usePeticoes';
import { supabase } from '@/integrations/supabase/client';
import type { Petition, ValidationIsa } from '@/types/peticoes';
import { cn } from '@/lib/utils';

export default function PeticaoRevisaoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getPetition, updatePetition } = usePeticoes();

  const [petition, setPetition] = useState<Petition | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [validation, setValidation] = useState<ValidationIsa | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const data = await getPetition(id);
      if (data) {
        setPetition(data);
        setValidation(data.validation_isa);
      } else {
        navigate('/peticoes');
      }
      setLoading(false);
    };
    load();
  }, [id, getPetition, navigate]);

  const handleValidate = async () => {
    if (!petition) return;
    setValidating(true);

    try {
      const { data, error } = await supabase.functions.invoke('petition-validate', {
        body: { petitionId: petition.id },
      });

      if (error) throw error;

      setValidation(data.validation);
      await updatePetition(petition.id, { 
        validation_isa: data.validation,
        summary_isa: data.summary,
        status: 'em_revisao',
      });

      toast({
        title: 'Validação concluída',
        description: 'A ISA analisou a petição',
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erro na validação',
        description: 'Tente novamente',
        variant: 'destructive',
      });
    }

    setValidating(false);
  };

  const handleGenerate = async () => {
    if (!petition) return;
    setGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('petition-generate', {
        body: { petitionId: petition.id },
      });

      if (error) throw error;

      await updatePetition(petition.id, { status: 'aprovado' });

      toast({
        title: 'Petição gerada!',
        description: 'Redirecionando para o documento...',
      });

      navigate(`/peticoes/${petition.id}/saida`);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erro na geração',
        description: 'Tente novamente',
        variant: 'destructive',
      });
    }

    setGenerating(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const hasErrors = validation?.errors && validation.errors.length > 0;
  const hasWarnings = validation?.warnings && validation.warnings.length > 0;
  const isValid = validation && !hasErrors;

  return (
    <AppLayout>
      <AppHeader title="Revisão da Petição" />
      
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Back button */}
          <Button 
            variant="ghost" 
            onClick={() => navigate(`/peticoes/${id}/editar`)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para edição
          </Button>

          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resumo do Caso
              </CardTitle>
            </CardHeader>
            <CardContent>
              {petition?.summary_isa ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {petition.summary_isa}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Clique em "Validar com ISA" para gerar o resumo do caso.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Validation Results */}
          {validation && (
            <div className="space-y-4">
              {/* Errors */}
              {hasErrors && (
                <Card className="border-destructive">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-destructive flex items-center gap-2 text-base">
                      <XCircle className="h-5 w-5" />
                      Erros ({validation.errors.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {validation.errors.map((error, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <X className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          {error}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Warnings */}
              {hasWarnings && (
                <Card className="border-yellow-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-yellow-600 flex items-center gap-2 text-base">
                      <AlertTriangle className="h-5 w-5" />
                      Avisos ({validation.warnings.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {validation.warnings.map((warning, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Checklist */}
              {validation.checklist_docs && validation.checklist_docs.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Check className="h-5 w-5" />
                      Checklist de Documentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {validation.checklist_docs.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          {item.present ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : item.required ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                          )}
                          <span className={cn(
                            !item.present && item.required && "text-destructive"
                          )}>
                            {item.item}
                            {item.required && <span className="text-destructive ml-1">*</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Success */}
              {isValid && (
                <Card className="border-success bg-success/5">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-success" />
                      <div>
                        <p className="font-medium text-success">Petição validada!</p>
                        <p className="text-sm text-muted-foreground">
                          Todos os campos obrigatórios estão preenchidos.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Actions */}
          <Separator />
          
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={validating}
            >
              {validating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Validar com ISA
            </Button>

            <Button
              onClick={handleGenerate}
              disabled={generating || (validation && hasErrors)}
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Gerar Petição
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
