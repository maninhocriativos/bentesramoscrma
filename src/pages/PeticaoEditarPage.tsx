import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Check, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { usePeticoes } from '@/hooks/usePeticoes';
import { 
  WIZARD_STEPS, 
  ESTADOS_CIVIS, 
  PRODUTOS_BANCARIOS, 
  UFS_BRASIL,
  TIPOS_PEDIDOS,
  type Petition,
  type PetitionPayload 
} from '@/types/peticoes';
import { cn } from '@/lib/utils';

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

  const autoSaveTimeout = useRef<NodeJS.Timeout>();

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
        // Criar nova
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
      // Ir para revisão
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
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <AppHeader title={`Nova Petição - ${petition?.petition_types?.title || ''}`} />
      
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Stepper */}
          <div className="flex items-center justify-between mb-8">
            {WIZARD_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all",
                      currentStep === step.id
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : currentStep > step.id
                        ? "bg-success text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className={cn(
                    "mt-2 text-xs font-medium",
                    currentStep === step.id ? "text-primary" : "text-muted-foreground"
                  )}>
                    {step.title}
                  </span>
                </div>
                {index < WIZARD_STEPS.length - 1 && (
                  <div className={cn(
                    "flex-1 h-1 mx-2",
                    currentStep > step.id ? "bg-success" : "bg-muted"
                  )} />
                )}
              </div>
            ))}
          </div>

          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {WIZARD_STEPS[currentStep - 1]?.title}
                {saving ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Salvando...
                  </span>
                ) : lastSaved && (
                  <span className="text-xs text-success flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Salvo
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step 1: Cliente */}
              {currentStep === 1 && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Label htmlFor="nome_completo">Nome Completo *</Label>
                      <Input
                        id="nome_completo"
                        value={payload.client?.nome_completo || ''}
                        onChange={(e) => updateField('client', 'nome_completo', e.target.value)}
                        placeholder="Nome completo do cliente"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input
                        id="cpf"
                        value={payload.client?.cpf || ''}
                        onChange={(e) => updateField('client', 'cpf', e.target.value)}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rg">RG</Label>
                      <Input
                        id="rg"
                        value={payload.client?.rg || ''}
                        onChange={(e) => updateField('client', 'rg', e.target.value)}
                        placeholder="0000000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="estado_civil">Estado Civil *</Label>
                      <Select
                        value={payload.client?.estado_civil || ''}
                        onValueChange={(value) => updateField('client', 'estado_civil', value)}
                      >
                        <SelectTrigger>
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
                      <Label htmlFor="profissao">Profissão *</Label>
                      <Input
                        id="profissao"
                        value={payload.client?.profissao || ''}
                        onChange={(e) => updateField('client', 'profissao', e.target.value)}
                        placeholder="Ex: Aposentado, Comerciante"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={payload.client?.email || ''}
                        onChange={(e) => updateField('client', 'email', e.target.value)}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        value={payload.client?.telefone || ''}
                        onChange={(e) => updateField('client', 'telefone', e.target.value)}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: Endereço */}
              {currentStep === 2 && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cep">CEP *</Label>
                      <Input
                        id="cep"
                        value={payload.endereco?.cep || ''}
                        onChange={(e) => updateField('endereco', 'cep', e.target.value)}
                        placeholder="00000-000"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="rua">Rua *</Label>
                      <Input
                        id="rua"
                        value={payload.endereco?.rua || ''}
                        onChange={(e) => updateField('endereco', 'rua', e.target.value)}
                        placeholder="Nome da rua"
                      />
                    </div>
                    <div>
                      <Label htmlFor="numero">Número *</Label>
                      <Input
                        id="numero"
                        value={payload.endereco?.numero || ''}
                        onChange={(e) => updateField('endereco', 'numero', e.target.value)}
                        placeholder="123"
                      />
                    </div>
                    <div>
                      <Label htmlFor="complemento">Complemento</Label>
                      <Input
                        id="complemento"
                        value={payload.endereco?.complemento || ''}
                        onChange={(e) => updateField('endereco', 'complemento', e.target.value)}
                        placeholder="Apto, Bloco, etc"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bairro">Bairro *</Label>
                      <Input
                        id="bairro"
                        value={payload.endereco?.bairro || ''}
                        onChange={(e) => updateField('endereco', 'bairro', e.target.value)}
                        placeholder="Nome do bairro"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cidade">Cidade *</Label>
                      <Input
                        id="cidade"
                        value={payload.endereco?.cidade || ''}
                        onChange={(e) => updateField('endereco', 'cidade', e.target.value)}
                        placeholder="Nome da cidade"
                      />
                    </div>
                    <div>
                      <Label htmlFor="uf">UF *</Label>
                      <Select
                        value={payload.endereco?.uf || ''}
                        onValueChange={(value) => updateField('endereco', 'uf', value)}
                      >
                        <SelectTrigger>
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
                </>
              )}

              {/* Step 3: Banco */}
              {currentStep === 3 && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Label htmlFor="banco_nome">Nome do Banco *</Label>
                      <Input
                        id="banco_nome"
                        value={payload.banco?.banco_nome || ''}
                        onChange={(e) => updateField('banco', 'banco_nome', e.target.value)}
                        placeholder="Ex: Banco do Brasil, Itaú, etc"
                      />
                    </div>
                    <div>
                      <Label htmlFor="banco_cnpj">CNPJ do Banco</Label>
                      <Input
                        id="banco_cnpj"
                        value={payload.banco?.banco_cnpj || ''}
                        onChange={(e) => updateField('banco', 'banco_cnpj', e.target.value)}
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="produto">Tipo de Produto</Label>
                      <Select
                        value={payload.banco?.produto || ''}
                        onValueChange={(value) => updateField('banco', 'produto', value)}
                      >
                        <SelectTrigger>
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
                      <Label htmlFor="agencia">Agência</Label>
                      <Input
                        id="agencia"
                        value={payload.banco?.agencia || ''}
                        onChange={(e) => updateField('banco', 'agencia', e.target.value)}
                        placeholder="0000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="conta">Conta</Label>
                      <Input
                        id="conta"
                        value={payload.banco?.conta || ''}
                        onChange={(e) => updateField('banco', 'conta', e.target.value)}
                        placeholder="00000-0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="data_inicio">Data Início do Contrato</Label>
                      <Input
                        id="data_inicio"
                        type="date"
                        value={payload.banco?.data_inicio || ''}
                        onChange={(e) => updateField('banco', 'data_inicio', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="data_fim">Data Fim do Contrato</Label>
                      <Input
                        id="data_fim"
                        type="date"
                        value={payload.banco?.data_fim || ''}
                        onChange={(e) => updateField('banco', 'data_fim', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Step 4: Valores */}
              {currentStep === 4 && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="valor_cobrado">Valor Cobrado Indevidamente (R$)</Label>
                      <Input
                        id="valor_cobrado"
                        type="number"
                        step="0.01"
                        value={payload.valores?.valor_cobrado || ''}
                        onChange={(e) => updateField('valores', 'valor_cobrado', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="valor_total">Valor Total da Causa (R$)</Label>
                      <Input
                        id="valor_total"
                        type="number"
                        step="0.01"
                        value={payload.valores?.valor_total || ''}
                        onChange={(e) => updateField('valores', 'valor_total', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="periodo_inicio">Período Início</Label>
                      <Input
                        id="periodo_inicio"
                        type="date"
                        value={payload.valores?.periodo_inicio || ''}
                        onChange={(e) => updateField('valores', 'periodo_inicio', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="periodo_fim">Período Fim</Label>
                      <Input
                        id="periodo_fim"
                        type="date"
                        value={payload.valores?.periodo_fim || ''}
                        onChange={(e) => updateField('valores', 'periodo_fim', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="parcelas">Número de Parcelas</Label>
                      <Input
                        id="parcelas"
                        type="number"
                        value={payload.valores?.parcelas || ''}
                        onChange={(e) => updateField('valores', 'parcelas', parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Pedidos Selecionados</Label>
                    <div className="grid sm:grid-cols-2 gap-2 mt-2">
                      {TIPOS_PEDIDOS.map((pedido) => {
                        const selected = payload.valores?.pedidos_selecionados?.includes(pedido.value);
                        return (
                          <label
                            key={pedido.value}
                            className={cn(
                              "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                              selected 
                                ? "bg-primary/10 border-primary" 
                                : "bg-card hover:bg-muted/50"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                const current = payload.valores?.pedidos_selecionados || [];
                                const updated = e.target.checked
                                  ? [...current, pedido.value]
                                  : current.filter(p => p !== pedido.value);
                                updateField('valores', 'pedidos_selecionados', updated);
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{pedido.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={payload.valores?.observacoes || ''}
                      onChange={(e) => updateField('valores', 'observacoes', e.target.value)}
                      placeholder="Informações adicionais relevantes para a petição..."
                      rows={4}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {currentStep === 1 ? 'Cancelar' : 'Voltar'}
            </Button>
            <Button onClick={handleNext}>
              {currentStep === 4 ? 'Ir para Revisão' : 'Próximo'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
