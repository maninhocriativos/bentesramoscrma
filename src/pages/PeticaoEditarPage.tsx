import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Check, Loader2, Sparkles, User, MapPin, Building2, Calculator } from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { usePeticoes } from '@/hooks/usePeticoes';
import { 
  WIZARD_STEPS, 
  ESTADOS_CIVIS, 
  PRODUTOS_BANCARIOS, 
  UFS_BRASIL,
  BANCOS_BRASIL,
  TIPOS_PEDIDOS,
  type Petition,
  type PetitionPayload 
} from '@/types/peticoes';
import { cn } from '@/lib/utils';

const STEP_ICONS = [User, MapPin, Building2, Calculator];

export default function PeticaoEditarPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getPetition, createPetition, updatePayload } = usePeticoes();

  const [petition, setPetition] = useState<Petition | null>(null);
  const [payload, setPayload] = useState<PetitionPayload>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [templateHtml, setTemplateHtml] = useState<string | null>(null);

  const autoSaveTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Carregar ou criar petição
  useEffect(() => {
    const loadPetition = async () => {
      setLoading(true);
      
      if (id && id !== 'nova') {
        const data = await getPetition(id);
        if (data) {
          setPetition(data);
          setPayload(data.payload || {});
          setCurrentStep(data.step_current || 1);
        } else {
          toast({ title: 'Erro', description: 'Petição não encontrada', variant: 'destructive' });
          navigate('/peticoes');
        }
      } else {
        const typeSlug = searchParams.get('type');
        if (!typeSlug) {
          navigate('/peticoes');
          return;
        }

        const newId = await createPetition(typeSlug);
        if (newId) {
          navigate(`/peticoes/${newId}/editar`, { replace: true });
        } else {
          navigate('/peticoes');
        }
      }
      
      setLoading(false);
    };

    loadPetition();
  }, [id, searchParams, getPetition, createPetition, navigate, toast]);

  // Auto-save
  const triggerAutoSave = useCallback(() => {
    if (!petition?.id) return;
    
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }

    autoSaveTimeout.current = setTimeout(async () => {
      setSaving(true);
      const success = await updatePayload(petition.id, payload, currentStep);
      if (success) {
        setLastSaved(new Date());
      }
      setSaving(false);
    }, 1000);
  }, [petition?.id, payload, currentStep, updatePayload]);

  // Update payload field
  const updateField = useCallback((
    section: keyof PetitionPayload,
    field: string,
    value: string | number | string[]
  ) => {
    setPayload(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
    triggerAutoSave();
  }, [triggerAutoSave]);

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
      triggerAutoSave();
    } else {
      navigate(`/peticoes/${petition?.id}/revisao`);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      navigate('/peticoes');
    }
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
            <p className="text-muted-foreground">Carregando petição...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <AppHeader title={`Nova Petição - ${petition?.petition_types?.title || ''}`} />
      
      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Premium Stepper */}
            <div className="relative">
              {/* Progress line background */}
              <div className="absolute top-6 left-0 right-0 h-1 bg-muted rounded-full mx-16" />
              {/* Progress line filled */}
              <div 
                className="absolute top-6 left-0 h-1 bg-gradient-to-r from-primary to-primary/80 rounded-full mx-16 transition-all duration-500"
                style={{ width: `calc(${((currentStep - 1) / 3) * 100}% - 8rem)` }}
              />
              
              <div className="relative flex items-start justify-between">
                {WIZARD_STEPS.map((step, index) => {
                  const StepIcon = STEP_ICONS[index];
                  const isCompleted = currentStep > step.id;
                  const isCurrent = currentStep === step.id;
                  
                  return (
                    <div 
                      key={step.id} 
                      className="flex flex-col items-center cursor-pointer group"
                      onClick={() => {
                        if (isCompleted || isCurrent) {
                          setCurrentStep(step.id);
                        }
                      }}
                    >
                      <div
                        className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
                          isCurrent && "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground scale-110 ring-4 ring-primary/20",
                          isCompleted && "bg-emerald-500 text-white",
                          !isCurrent && !isCompleted && "bg-muted text-muted-foreground group-hover:bg-muted/80"
                        )}
                      >
                        {isCompleted ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <StepIcon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="mt-3 text-center">
                        <span className={cn(
                          "text-sm font-semibold block",
                          isCurrent ? "text-primary" : "text-muted-foreground"
                        )}>
                          {step.title}
                        </span>
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {step.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form Card */}
            <Card className="border-0 shadow-xl bg-gradient-to-b from-card to-card/95">
              <CardHeader className="border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      {(() => {
                        const StepIcon = STEP_ICONS[currentStep - 1];
                        return <StepIcon className="h-5 w-5 text-primary" />;
                      })()}
                      {WIZARD_STEPS[currentStep - 1]?.title}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {WIZARD_STEPS[currentStep - 1]?.description}
                    </CardDescription>
                  </div>
                  
                  {/* Save indicator */}
                  <div className="flex items-center gap-2">
                    {saving ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-full">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Salvando...
                      </span>
                    ) : lastSaved && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full">
                        <Check className="h-3 w-3" />
                        Salvo
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                {/* Step 1: Cliente */}
                {currentStep === 1 && (
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="sm:col-span-2">
                      <Label htmlFor="nome_completo" className="text-sm font-medium">Nome Completo *</Label>
                      <Input
                        id="nome_completo"
                        value={payload.client?.nome_completo || ''}
                        onChange={(e) => updateField('client', 'nome_completo', e.target.value)}
                        placeholder="Nome completo do cliente"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cpf" className="text-sm font-medium">CPF *</Label>
                      <Input
                        id="cpf"
                        value={payload.client?.cpf || ''}
                        onChange={(e) => updateField('client', 'cpf', e.target.value)}
                        placeholder="000.000.000-00"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rg" className="text-sm font-medium">RG</Label>
                      <Input
                        id="rg"
                        value={payload.client?.rg || ''}
                        onChange={(e) => updateField('client', 'rg', e.target.value)}
                        placeholder="0000000"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="estado_civil" className="text-sm font-medium">Estado Civil *</Label>
                      <Select
                        value={payload.client?.estado_civil || ''}
                        onValueChange={(value) => updateField('client', 'estado_civil', value)}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {ESTADOS_CIVIS.map((ec) => (
                            <SelectItem key={ec} value={ec}>{ec}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="profissao" className="text-sm font-medium">Profissão *</Label>
                      <Input
                        id="profissao"
                        value={payload.client?.profissao || ''}
                        onChange={(e) => updateField('client', 'profissao', e.target.value)}
                        placeholder="Ex: Aposentado, Comerciante"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={payload.client?.email || ''}
                        onChange={(e) => updateField('client', 'email', e.target.value)}
                        placeholder="email@exemplo.com"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="telefone" className="text-sm font-medium">Telefone</Label>
                      <Input
                        id="telefone"
                        value={payload.client?.telefone || ''}
                        onChange={(e) => updateField('client', 'telefone', e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Endereço */}
                {currentStep === 2 && (
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="cep" className="text-sm font-medium">CEP *</Label>
                      <Input
                        id="cep"
                        value={payload.endereco?.cep || ''}
                        onChange={(e) => updateField('endereco', 'cep', e.target.value)}
                        placeholder="00000-000"
                        className="mt-1.5"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="rua" className="text-sm font-medium">Rua *</Label>
                      <Input
                        id="rua"
                        value={payload.endereco?.rua || ''}
                        onChange={(e) => updateField('endereco', 'rua', e.target.value)}
                        placeholder="Nome da rua"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="numero" className="text-sm font-medium">Número *</Label>
                      <Input
                        id="numero"
                        value={payload.endereco?.numero || ''}
                        onChange={(e) => updateField('endereco', 'numero', e.target.value)}
                        placeholder="123"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="complemento" className="text-sm font-medium">Complemento</Label>
                      <Input
                        id="complemento"
                        value={payload.endereco?.complemento || ''}
                        onChange={(e) => updateField('endereco', 'complemento', e.target.value)}
                        placeholder="Apto, Bloco, etc"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bairro" className="text-sm font-medium">Bairro *</Label>
                      <Input
                        id="bairro"
                        value={payload.endereco?.bairro || ''}
                        onChange={(e) => updateField('endereco', 'bairro', e.target.value)}
                        placeholder="Nome do bairro"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cidade" className="text-sm font-medium">Cidade *</Label>
                      <Input
                        id="cidade"
                        value={payload.endereco?.cidade || ''}
                        onChange={(e) => updateField('endereco', 'cidade', e.target.value)}
                        placeholder="Nome da cidade"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="uf" className="text-sm font-medium">UF *</Label>
                      <Select
                        value={payload.endereco?.uf || ''}
                        onValueChange={(value) => updateField('endereco', 'uf', value)}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {UFS_BRASIL.map((uf) => (
                            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Step 3: Banco */}
                {currentStep === 3 && (
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="sm:col-span-2">
                      <Label htmlFor="banco_nome" className="text-sm font-medium">Nome do Banco *</Label>
                      <Select
                        value={payload.banco?.banco_nome || ''}
                        onValueChange={(value) => updateField('banco', 'banco_nome', value)}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Selecione o banco" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {BANCOS_BRASIL.map((banco) => (
                            <SelectItem key={banco} value={banco}>{banco}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="produto" className="text-sm font-medium">Tipo de Produto</Label>
                      <Select
                        value={payload.banco?.produto || ''}
                        onValueChange={(value) => updateField('banco', 'produto', value)}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUTOS_BANCARIOS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="agencia" className="text-sm font-medium">Agência</Label>
                      <Input
                        id="agencia"
                        value={payload.banco?.agencia || ''}
                        onChange={(e) => updateField('banco', 'agencia', e.target.value)}
                        placeholder="0000"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="conta" className="text-sm font-medium">Conta</Label>
                      <Input
                        id="conta"
                        value={payload.banco?.conta || ''}
                        onChange={(e) => updateField('banco', 'conta', e.target.value)}
                        placeholder="00000-0"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="data_inicio" className="text-sm font-medium">Data Início do Contrato</Label>
                      <Input
                        id="data_inicio"
                        type="date"
                        value={payload.banco?.data_inicio || ''}
                        onChange={(e) => updateField('banco', 'data_inicio', e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="data_fim" className="text-sm font-medium">Data Fim do Contrato</Label>
                      <Input
                        id="data_fim"
                        type="date"
                        value={payload.banco?.data_fim || ''}
                        onChange={(e) => updateField('banco', 'data_fim', e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                )}

                {/* Step 4: Valores */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="valor_cobrado" className="text-sm font-medium">Valor Cobrado Indevidamente (R$)</Label>
                        <Input
                          id="valor_cobrado"
                          type="number"
                          step="0.01"
                          value={payload.valores?.valor_cobrado || ''}
                          onChange={(e) => updateField('valores', 'valor_cobrado', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="valor_total" className="text-sm font-medium">Valor Total da Causa (R$)</Label>
                        <Input
                          id="valor_total"
                          type="number"
                          step="0.01"
                          value={payload.valores?.valor_total || ''}
                          onChange={(e) => updateField('valores', 'valor_total', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="periodo_inicio" className="text-sm font-medium">Período Início</Label>
                        <Input
                          id="periodo_inicio"
                          type="date"
                          value={payload.valores?.periodo_inicio || ''}
                          onChange={(e) => updateField('valores', 'periodo_inicio', e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="periodo_fim" className="text-sm font-medium">Período Fim</Label>
                        <Input
                          id="periodo_fim"
                          type="date"
                          value={payload.valores?.periodo_fim || ''}
                          onChange={(e) => updateField('valores', 'periodo_fim', e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    {/* Pedidos */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Pedidos Selecionados</Label>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {TIPOS_PEDIDOS.map((pedido) => {
                          const isChecked = payload.valores?.pedidos_selecionados?.includes(pedido.value) || false;
                          return (
                            <label
                              key={pedido.value}
                              className={cn(
                                "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                                isChecked 
                                  ? "border-primary bg-primary/5" 
                                  : "border-muted hover:border-primary/50"
                              )}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  const current = payload.valores?.pedidos_selecionados || [];
                                  const updated = checked
                                    ? [...current, pedido.value]
                                    : current.filter(v => v !== pedido.value);
                                  updateField('valores', 'pedidos_selecionados', updated);
                                }}
                              />
                              <span className="font-medium">{pedido.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="observacoes" className="text-sm font-medium">Observações Adicionais</Label>
                      <Textarea
                        id="observacoes"
                        value={payload.valores?.observacoes || ''}
                        onChange={(e) => updateField('valores', 'observacoes', e.target.value)}
                        placeholder="Detalhes adicionais sobre o caso..."
                        className="mt-1.5 min-h-[100px]"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                onClick={handleBack}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {currentStep === 1 ? 'Cancelar' : 'Voltar'}
              </Button>

              <Button
                onClick={handleNext}
                className="gap-2 min-w-[140px]"
              >
                {currentStep === 4 ? (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Revisar com IA
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </AppLayout>
  );
}
