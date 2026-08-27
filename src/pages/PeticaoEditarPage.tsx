// Formulário dinâmico de preenchimento — backend Cloudflare. Os campos vêm
// dos {{marcadores}} reais do .docx do modelo (fetchModelFields), a
// mesclagem final acontece no Worker (petitionEngine.ts) — esta tela só
// coleta os dados, autosalva e dispara a geração. Print do contrato ainda
// não é suportado neste fluxo (ver TODO em petitionEngine.ts no repo
// peticoes-cloudflare) — fica pra uma etapa seguinte.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DetailSkeleton } from '@/components/ui/PageSkeleton';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Save, Sparkles, Loader2,
  CheckCircle2, AlertCircle, Search, UserCheck,
} from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { saveAs } from 'file-saver';
import { parseValor } from '@/lib/extenso';
import { buildDynamicSteps, normalizeKey, BANCO_CNPJ, BANCO_ENDERECO, type FieldConfig, type StepConfig } from '@/lib/petitionFields';
import * as api from '@/lib/peticoesV2Client';

type FormData = Record<string, string>;

function FieldInput({
  config, value, onChange, submitted,
}: {
  config: FieldConfig;
  value: string;
  onChange: (v: string) => void;
  submitted: boolean;
}) {
  const isEmpty = submitted && !config.optional && !value?.trim();
  return (
    <div className={config.span === 'full' ? 'col-span-2' : ''}>
      <Label className={cn('text-xs mb-1.5 flex items-center gap-1', isEmpty ? 'text-destructive' : 'text-muted-foreground')}>
        {config.label}
        {config.optional && <span className="text-muted-foreground/60 font-normal">(opcional)</span>}
        {isEmpty && <AlertCircle className="h-3 w-3" />}
      </Label>
      {config.type === 'select' ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={cn('rounded-xl mt-0', isEmpty && 'border-destructive')}><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>{config.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
        </Select>
      ) : config.type === 'textarea' ? (
        <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={config.placeholder} className={cn('rounded-xl mt-0 min-h-[80px]', isEmpty && 'border-destructive')} />
      ) : config.type === 'autocomplete' ? (
        <AutocompleteInput value={value} onChange={onChange} options={config.options || []} placeholder={config.placeholder} invalid={isEmpty} capitalize />
      ) : (
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder={config.placeholder} className={cn('rounded-xl mt-0', isEmpty && 'border-destructive')} />
      )}
      {config.hint && <p className="text-[10px] text-muted-foreground mt-1">{config.hint}</p>}
    </div>
  );
}

export default function PeticaoEditarPage() {
  const navigate       = useNavigate();
  const { id }         = useParams();
  const [searchParams] = useSearchParams();
  const { toast }      = useToast();

  const [currentStep,    setCurrentStep]    = useState(1);
  const [formData,       setFormData]       = useState<FormData>({});
  const [petitionId,     setPetitionId]     = useState(id || '');
  const [modelNome,      setModelNome]      = useState('');
  const [actionName,     setActionName]     = useState('');
  const [placeholders,   setPlaceholders]   = useState<string[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [generating,     setGenerating]     = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitted,      setSubmitted]      = useState(false);
  const [leadQuery,   setLeadQuery]   = useState('');
  const [leadResults, setLeadResults] = useState<Array<Record<string, string>>>([]);
  const [leadOpen,    setLeadOpen]    = useState(false);
  const leadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = useMemo(() => buildDynamicSteps(placeholders, false), [placeholders]);

  useEffect(() => {
    const init = async () => {
      setLoadingInitial(true);
      const actionId = searchParams.get('action');
      const modelId  = searchParams.get('model');

      try {
        if (id) {
          const petition = await api.fetchPetition(id);
          if (!petition) { navigate('/peticoes'); return; }
          setFormData((petition.form_data_json as FormData) || {});
          setCurrentStep(petition.current_step || 1);
          setActionName(petition.action_types?.nome || '');
          setModelNome(petition.petition_models?.nome || '');
          setPetitionId(id);
          if (petition.model_id) {
            const fields = await api.fetchModelFields(petition.model_id);
            setPlaceholders(fields);
          }
          setLoadingInitial(false);
          return;
        }

        if (actionId && modelId) {
          const newId = await api.createPetition(actionId, modelId);
          setPetitionId(newId);
          navigate(`/peticoes/${newId}/editar`, { replace: true });
          return;
        }

        navigate('/peticoes');
      } catch (err) {
        toast({ title: 'Erro ao carregar petição', description: err instanceof Error ? err.message : 'Erro desconhecido', variant: 'destructive' });
        navigate('/peticoes');
      }
    };
    init();
  }, [id, searchParams, navigate, toast]);

  const doAutosave = useCallback(async () => {
    if (!petitionId) return;
    try {
      await api.savePetitionDraft(petitionId, formData, currentStep);
    } catch (err) {
      console.error('[PeticaoEditarPage] autosave falhou:', err);
    }
  }, [petitionId, formData, currentStep]);

  useEffect(() => {
    if (!petitionId || loadingInitial) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(doAutosave, 2000);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [formData, currentStep, doAutosave, petitionId, loadingInitial]);

  const handleCepLookup = async (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          endereco_rua:    data.logradouro || prev.endereco_rua || '',
          endereco_bairro: data.bairro     || prev.endereco_bairro || '',
          endereco_cidade: data.localidade || prev.endereco_cidade || '',
          endereco_uf:     data.uf         || prev.endereco_uf || '',
        }));
      }
    } catch { /* ignore */ }
  };

  const VALOR_TOTAL_FONTES = ['valor_emprestimo', 'valor_seguro', 'valor_encargos'];

  const updateField = (key: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'banco_nome') {
        if (BANCO_CNPJ[value]) next.banco_cnpj = BANCO_CNPJ[value];
        const end = BANCO_ENDERECO[value];
        if (end) { next.banco_endereco = end.endereco; next.banco_cep = end.cep; }
      }
      if (VALOR_TOTAL_FONTES.includes(key)) {
        const soma = VALOR_TOTAL_FONTES.reduce((acc, k) => acc + (parseValor(next[k] || '') || 0), 0);
        next.valor_total_contrato = soma > 0 ? soma.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      }
      return next;
    });
    if (key === 'endereco_cep') handleCepLookup(value);
  };

  const buscarLeads = (q: string) => {
    setLeadQuery(q);
    if (leadTimer.current) clearTimeout(leadTimer.current);
    const termo = q.trim();
    if (termo.length < 2) { setLeadResults([]); setLeadOpen(false); return; }
    leadTimer.current = setTimeout(async () => {
      const { data, error } = await (supabase.rpc as any)('buscar_leads_peticao', { termo });
      if (error) { console.warn('[busca lead]', error.message); return; }
      setLeadResults((data as Array<Record<string, string>>) || []);
      setLeadOpen(true);
    }, 250);
  };

  const aplicarLead = (l: Record<string, string>) => {
    setFormData(prev => ({
      ...prev,
      nome_maiusculo:  (l.nome || '').toUpperCase(),
      nome_completo:   l.nome || prev.nome_completo || '',
      cpf:             l.cpf || prev.cpf || '',
      rg:              l.rg || prev.rg || '',
      estado_civil:    l.estado_civil || prev.estado_civil || '',
      nacionalidade:   l.nacionalidade || prev.nacionalidade || '',
      profissao:       l.profissao || prev.profissao || '',
      endereco_rua:    l.endereco || prev.endereco_rua || '',
      endereco_numero: l.numero || prev.endereco_numero || '',
      endereco_bairro: l.bairro || prev.endereco_bairro || '',
      endereco_cidade: l.cidade || prev.endereco_cidade || '',
      endereco_uf:     l.uf || prev.endereco_uf || '',
      endereco_cep:    l.cep || prev.endereco_cep || '',
    }));
    setLeadOpen(false);
    setLeadQuery(l.nome || '');
    toast({ title: 'Cliente carregado', description: `Dados de ${l.nome} preenchidos automaticamente.` });
  };

  const currentStepConfig = steps.find(s => s.id === currentStep) || steps[0];
  const currentIdx        = steps.findIndex(s => s.id === currentStep);
  const isReviewStep      = currentStepConfig.title === 'Revisão';
  const progress          = ((currentIdx + 1) / steps.length) * 100;

  const stepMissingFields = (step: StepConfig) => step.fields.filter(f => !f.optional && !(formData[f.key] || '').trim());
  const firstInvalidStepIdx = () => steps.findIndex(s => s.title !== 'Revisão' && stepMissingFields(s).length > 0);

  const goNext = () => {
    if (!isReviewStep && stepMissingFields(currentStepConfig).length > 0) {
      setSubmitted(true);
      toast({ title: 'Campos obrigatórios', description: 'Preencha os campos destacados antes de continuar.', variant: 'destructive' });
      return;
    }
    setSubmitted(false);
    if (currentIdx < steps.length - 1) setCurrentStep(steps[currentIdx + 1].id);
  };
  const goPrev = () => {
    if (currentIdx === 0) navigate('/peticoes');
    else setCurrentStep(steps[currentIdx - 1].id);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    await doAutosave();
    toast({ title: 'Salvo', description: 'Rascunho salvo com sucesso.' });
    setSaving(false);
  };

  const handleGenerate = async () => {
    setSubmitted(true);
    if (!petitionId) return;

    const invalidIdx = firstInvalidStepIdx();
    if (invalidIdx !== -1) {
      setCurrentStep(steps[invalidIdx].id);
      toast({ title: 'Faltam campos obrigatórios', description: `Preencha a etapa "${steps[invalidIdx].title}" antes de gerar.`, variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      await api.savePetitionDraft(petitionId, formData, currentStep);
      const result = await api.generatePetition(petitionId);
      const blob = await api.downloadPetitionFile(result.r2_key);
      const clienteNome = formData.nome_completo || formData.nome_maiusculo || 'documento';
      saveAs(blob, `Peticao_${clienteNome.replace(/\s+/g, '_')}.docx`);
      toast({ title: '✅ Petição gerada!', description: 'O arquivo .docx foi baixado.' });
      navigate(`/peticoes/${petitionId}/revisao`);
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro na geração', description: err instanceof Error ? err.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  if (loadingInitial) {
    return (<><AppHeader title="Carregando..." /><DetailSkeleton /></>);
  }

  return (
    <>
      <AppHeader title={actionName || 'Nova Petição'} />
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 max-w-[860px] mx-auto space-y-5">
          <Card className="rounded-2xl border border-border/50 shadow-sm overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-foreground leading-tight">{modelNome || 'Petição'}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{actionName}</p>
                </div>
                <Badge variant="outline" className="text-xs">Rascunho</Badge>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {steps.map((step, i) => {
                  const Icon = step.icon;
                  const isActive = step.id === currentStep;
                  const isDone = step.id < currentStep;
                  return (
                    <div key={step.id} className="flex items-center gap-1.5">
                      <button onClick={() => setCurrentStep(step.id)}
                        className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all',
                          isActive && 'bg-primary text-primary-foreground shadow-sm',
                          isDone && 'bg-primary/10 text-primary',
                          !isActive && !isDone && 'bg-muted/50 text-muted-foreground hover:bg-muted')}>
                        {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">{step.title}</span>
                      </button>
                      {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
                    </div>
                  );
                })}
              </div>
              <Progress value={progress} className="h-1.5 rounded-full" />
            </div>
          </Card>

          <Card className="rounded-2xl border border-border/50 shadow-sm">
            <CardContent className="p-5 md:p-6">
              {!isReviewStep && currentStepConfig.fields.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-2">
                    <currentStepConfig.icon className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-foreground">{currentStepConfig.title}</h3>
                  </div>

                  {currentStepConfig.title === 'Cliente' && (
                    <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">Cliente já está no sistema?</span>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={leadQuery} onChange={e => buscarLeads(e.target.value)} onFocus={() => leadResults.length && setLeadOpen(true)}
                          placeholder="Buscar por nome, telefone ou CPF..." className="pl-10 rounded-lg bg-background" />
                      </div>
                      {leadOpen && leadResults.length > 0 && (
                        <div className="absolute z-20 left-3 right-3 mt-1 rounded-lg border border-border/60 bg-popover shadow-xl max-h-64 overflow-y-auto">
                          {leadResults.map(l => (
                            <button key={l.id} type="button" onClick={() => aplicarLead(l)} className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0">
                              <p className="text-sm font-medium text-foreground">{l.nome || 'Sem nome'}</p>
                              <p className="text-xs text-muted-foreground">{[l.cpf && `CPF ${l.cpf}`, l.cidade, l.telefone].filter(Boolean).join(' · ') || '—'}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {currentStepConfig.fields.map(field => (
                      <FieldInput key={field.key} config={field} value={formData[field.key] || ''} onChange={v => updateField(field.key, v)} submitted={submitted} />
                    ))}
                  </div>
                </div>
              )}

              {isReviewStep && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-foreground">Revisão</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Confira os dados preenchidos nas etapas anteriores e clique em <b>Gerar Petição</b> pra baixar o .docx.
                    O print do contrato ainda não é suportado neste fluxo — se o modelo precisar dele, insira manualmente no .docx gerado antes de protocolar.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={goPrev} className="gap-2 rounded-xl"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleSaveDraft} disabled={saving} className="gap-2 rounded-xl">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar Rascunho
              </Button>
              {isReviewStep ? (
                <Button onClick={handleGenerate} disabled={generating} className="gap-2 rounded-xl font-bold">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar Petição
                </Button>
              ) : (
                <Button onClick={goNext} className="gap-2 rounded-xl font-bold">Próximo <ArrowRight className="h-4 w-4" /></Button>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </>
  );
}
