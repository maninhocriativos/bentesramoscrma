import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Check, X, AlertTriangle, FileText, 
  Loader2, Sparkles, CheckCircle2, XCircle, Wand2, FileCheck
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <Sparkles className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
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
      
      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Back button */}
            <Button 
              variant="ghost" 
              onClick={() => navigate(`/peticoes/${id}/editar`)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para edição
            </Button>

            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 p-8 text-white">
              <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
              <div className="relative flex items-start gap-4">
                <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Wand2 className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">Revisão com IA</h2>
                  <p className="text-white/80">
                    A Isa vai analisar os dados preenchidos e validar todas as informações antes de gerar a petição.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Main content */}
              <div className="lg:col-span-2 space-y-4">
                {/* Summary Card */}
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Resumo do Caso
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {petition?.summary_isa ? (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {petition.summary_isa}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Clique em "Validar com ISA" para gerar o resumo do caso.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Validation Results */}
                {validation && (
                  <div className="space-y-4">
                    {/* Errors */}
                    {hasErrors && (
                      <Card className="border-2 border-destructive/50 bg-destructive/5">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-destructive flex items-center gap-2 text-base">
                            <XCircle className="h-5 w-5" />
                            Erros que precisam ser corrigidos ({validation.errors.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {validation.errors.map((error, i) => (
                              <li key={i} className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
                                <X className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                                <span className="text-sm">{error}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {/* Warnings */}
                    {hasWarnings && (
                      <Card className="border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-amber-600 dark:text-amber-400 flex items-center gap-2 text-base">
                            <AlertTriangle className="h-5 w-5" />
                            Avisos ({validation.warnings.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {validation.warnings.map((warning, i) => (
                              <li key={i} className="flex items-start gap-3 p-3 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg">
                                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                <span className="text-sm">{warning}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {/* Success */}
                    {isValid && (
                      <Card className="border-2 border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20">
                        <CardContent className="py-6">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-500 text-white rounded-full">
                              <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="font-semibold text-emerald-700 dark:text-emerald-400">Petição validada!</p>
                              <p className="text-sm text-muted-foreground">
                                Todos os campos obrigatórios estão preenchidos corretamente.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* Checklist */}
                {validation?.checklist_docs && validation.checklist_docs.length > 0 && (
                  <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Check className="h-5 w-5 text-primary" />
                        Checklist
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {validation.checklist_docs.map((item, i) => (
                          <li key={i} className="flex items-center gap-3">
                            {item.present ? (
                              <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              </div>
                            ) : item.required ? (
                              <div className="p-1 bg-destructive/10 rounded-full">
                                <XCircle className="h-4 w-4 text-destructive" />
                              </div>
                            ) : (
                              <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30" />
                            )}
                            <span className={cn(
                              "text-sm",
                              !item.present && item.required && "text-destructive font-medium"
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

                {/* Actions Card */}
                <Card className="border-0 shadow-lg sticky top-4">
                  <CardHeader>
                    <CardTitle className="text-base">Ações</CardTitle>
                    <CardDescription>
                      Valide os dados antes de gerar a petição
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      onClick={handleValidate}
                      disabled={validating}
                      className="w-full gap-2"
                    >
                      {validating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Validar com ISA
                    </Button>

                    <Button
                      onClick={handleGenerate}
                      disabled={generating || (validation && hasErrors)}
                      className="w-full gap-2"
                    >
                      {generating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileCheck className="h-4 w-4" />
                      )}
                      Gerar Petição
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </AppLayout>
  );
}
