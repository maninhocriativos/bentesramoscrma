import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Save, Sparkles, Loader2, User, MapPin,
  Building2, DollarSign, CheckCircle2, FileText, Download
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import type { PetitionModelV2 } from '@/hooks/usePeticoesV2';

const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const BANCOS = [
  'Banco do Brasil','Bradesco','Itaú Unibanco','Caixa Econômica Federal','Santander',
  'Banco Safra','Banco Inter','Nubank','C6 Bank','Banco PAN','Banco BMG','Banrisul',
  'Banco do Nordeste','Banco da Amazônia','Sicoob','Sicredi','Agibank','Banco Cetelem',
  'Banco Crefisa','PicPay','Will Bank','Outro',
];
const PEDIDOS = [
  { value: 'dano_moral', label: 'Danos Morais' },
  { value: 'repeticao_indebito', label: 'Repetição de Indébito' },
  { value: 'tutela_urgencia', label: 'Tutela de Urgência' },
  { value: 'revisao_contratual', label: 'Revisão Contratual' },
  { value: 'declaratoria_inexistencia', label: 'Declaratória de Inexistência' },
  { value: 'restituicao_valores', label: 'Restituição de Valores' },
  { value: 'cancelamento_contrato', label: 'Cancelamento de Contrato' },
  { value: 'exclusao_cadastros', label: 'Exclusão de Cadastros Restritivos' },
];

interface FormData {
  cliente: { nome_completo: string; cpf: string; rg: string; estado_civil: string; profissao: string; email: string; telefone: string; nacionalidade: string; };
  endereco: { cep: string; rua: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string; };
  banco: { banco_nome: string; tipo_produto: string; agencia: string; conta: string; data_inicio: string; data_fim: string; };
  valores: { valor_cobrado: string; valor_total: string; periodo_inicio: string; periodo_fim: string; pedidos_selecionados: string[]; observacoes: string; };
}

const EMPTY_FORM: FormData = {
  cliente: { nome_completo: '', cpf: '', rg: '', estado_civil: '', profissao: '', email: '', telefone: '', nacionalidade: 'brasileiro(a)' },
  endereco: { cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
  banco: { banco_nome: '', tipo_produto: '', agencia: '', conta: '', data_inicio: '', data_fim: '' },
  valores: { valor_cobrado: '', valor_total: '', periodo_inicio: '', periodo_fim: '', pedidos_selecionados: [], observacoes: '' },
};

const STEPS = [
  { id: 1, title: 'Cliente', icon: User },
  { id: 2, title: 'Endereço', icon: MapPin },
  { id: 3, title: 'Banco', icon: Building2 },
  { id: 4, title: 'Valores', icon: DollarSign },
  { id: 5, title: 'Revisão', icon: CheckCircle2 },
];

export default function PeticaoEditarPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });
  const [petitionId, setPetitionId] = useState(id || '');
  const [model, setModel] = useState<PetitionModelV2 | null>(null);
  const [actionName, setActionName] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const autosaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoadingInitial(true);
      const actionId = searchParams.get('action');
      const modelId = searchParams.get('model');

      if (id) {
        const { data } = await supabase.from('petitions_v2').select('*, action_types(nome), petition_models_v2(*)').eq('id', id).single();
        if (data) {
          const d = data as unknown as { form_data_json: FormData; current_step: number; action_types: { nome: string }; petition_models_v2: PetitionModelV2 };
          setFormData({ ...EMPTY_FORM, ...(d.form_data_json || {}) });
          setCurrentStep(d.current_step || 1);
          setActionName(d.action_types?.nome || '');
          setModel(d.petition_models_v2 || null);
          setPetitionId(id);
        }
      } else if (actionId && modelId) {
        const { data: { user } } = await supabase.auth.getUser();
        const [{ data: actionData }, { data: modelData }] = await Promise.all([
          supabase.from('action_types').select('nome').eq('id', actionId).single(),
          supabase.from('petition_models_v2').select('*').eq('id', modelId).single(),
        ]);
        setActionName((actionData as { nome: string })?.nome || '');
        setModel((modelData as unknown as PetitionModelV2) || null);

        const { data: newPetition } = await supabase.from('petitions_v2').insert({
          action_type_id: actionId, model_id: modelId, status: 'draft', current_step: 1, form_data_json: {}, created_by: user?.id,
        }).select('id').single();

        if (newPetition) {
          setPetitionId((newPetition as { id: string }).id);
          navigate(`/peticoes/${(newPetition as { id: string }).id}/editar`, { replace: true });
        }
      }
      setLoadingInitial(false);
    };
    init();
  }, [id, searchParams, navigate]);

  const doAutosave = useCallback(async () => {
    if (!petitionId) return;
    await supabase.from('petitions_v2').update({
      form_data_json: formData as unknown as Record<string, unknown>,
      current_step: currentStep,
      updated_at: new Date().toISOString(),
    }).eq('id', petitionId);
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
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData(prev => ({ ...prev, endereco: { ...prev.endereco, rua: data.logradouro || prev.endereco.rua, bairro: data.bairro || prev.endereco.bairro, cidade: data.localidade || prev.endereco.cidade, uf: data.uf || prev.endereco.uf } }));
      }
    } catch { /* ignore */ }
  };

  const updateField = (section: keyof FormData, field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    await doAutosave();
    toast({ title: 'Salvo', description: 'Rascunho salvo com sucesso' });
    setSaving(false);
  };

  const handleGenerate = async () => {
    if (!petitionId || !model?.template_file_url) return;
    setGenerating(true);
    try {
      await supabase.from('petitions_v2').update({ form_data_json: formData as unknown as Record<string, unknown>, status: 'review', updated_at: new Date().toISOString() }).eq('id', petitionId);

      let fatosJuridicos = formData.valores.observacoes || '';
      if (fatosJuridicos.length > 20) {
        try {
          const { data: aiData } = await supabase.functions.invoke('petition-rewrite', { body: { resumo: fatosJuridicos, tipo_acao: actionName } });
          if (aiData?.fatos_juridicos) fatosJuridicos = aiData.fatos_juridicos;
        } catch { /* fallback */ }
      }

      const response = await fetch(model.template_file_url);
      if (!response.ok) throw new Error('Erro ao baixar template');
      const arrayBuffer = await response.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{{', end: '}}' },
        nullGetter() { return ''; },
      });

      const pedidoTexts = formData.valores.pedidos_selecionados.map(p => PEDIDOS.find(x => x.value === p)?.label || p);

      const templateData: Record<string, string> = {
        cliente_nome: formData.cliente.nome_completo || '',
        nome: formData.cliente.nome_completo || '',
        cpf: formData.cliente.cpf || '',
        cliente_cpf: formData.cliente.cpf || '',
        rg: formData.cliente.rg || '',
        cliente_rg: formData.cliente.rg || '',
        estado_civil: formData.cliente.estado_civil || '',
        profissao: formData.cliente.profissao || '',
        nacionalidade: formData.cliente.nacionalidade || '',
        email: formData.cliente.email || '',
        telefone: formData.cliente.telefone || '',
        endereco: `${formData.endereco.rua || ''}, ${formData.endereco.numero || ''}${formData.endereco.complemento ? ', ' + formData.endereco.complemento : ''}, ${formData.endereco.bairro || ''}`,
        endereco_cep: formData.endereco.cep || '',
        cep: formData.endereco.cep || '',
        endereco_rua: formData.endereco.rua || '',
        endereco_numero: formData.endereco.numero || '',
        endereco_complemento: formData.endereco.complemento || '',
        endereco_bairro: formData.endereco.bairro || '',
        endereco_cidade: formData.endereco.cidade || '',
        cidade: formData.endereco.cidade || '',
        endereco_uf: formData.endereco.uf || '',
        uf: formData.endereco.uf || '',
        banco_nome: formData.banco.banco_nome || '',
        tipo_produto: formData.banco.tipo_produto || '',
        agencia: formData.banco.agencia || '',
        conta: formData.banco.conta || '',
        data_inicio_contrato: formData.banco.data_inicio || '',
        data_fim_contrato: formData.banco.data_fim || '',
        valor_cobrado_indevidamente: formData.valores.valor_cobrado || '',
        valor_total_causa: formData.valores.valor_total || '',
        periodo_inicio: formData.valores.periodo_inicio || '',
        periodo_fim: formData.valores.periodo_fim || '',
        observacoes_adicionais: formData.valores.observacoes || '',
        fatos_juridicos: fatosJuridicos || '',
        pedido_danos_morais: pedidoTexts.includes('Danos Morais') ? 'Sim' : '',
        pedido_repeticao_indebito: pedidoTexts.includes('Repetição de Indébito') ? 'Sim' : '',
        pedido_tutela_urgencia: pedidoTexts.includes('Tutela de Urgência') ? 'Sim' : '',
        pedido_revisao_contratual: pedidoTexts.includes('Revisão Contratual') ? 'Sim' : '',
        pedido_declaratoria_inexistencia: pedidoTexts.includes('Declaratória de Inexistência') ? 'Sim' : '',
        pedido_restituicao_valores: pedidoTexts.includes('Restituição de Valores') ? 'Sim' : '',
        pedido_cancelamento_contrato: pedidoTexts.includes('Cancelamento de Contrato') ? 'Sim' : '',
        pedido_exclusao_cadastros: pedidoTexts.includes('Exclusão de Cadastros Restritivos') ? 'Sim' : '',
        data_atual: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
      };

      

      try {
        doc.render(templateData);
      } catch (renderErr: unknown) {
        console.error('Docxtemplater render error:', renderErr);
        if (renderErr && typeof renderErr === 'object' && 'properties' in renderErr) {
          const props = (renderErr as { properties: { errors: Array<{ properties: { explanation: string } }> } }).properties;
          console.error('Template errors:', JSON.stringify(props.errors?.map(e => e.properties?.explanation)));
        }
        throw new Error('Erro ao processar template. Verifique se os placeholders do modelo estão no formato {{tag}}.');
      }

      const blob = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const fileName = `peticao-${petitionId}-${Date.now()}.docx`;
      await supabase.storage.from('documentos').upload(`peticoes/${fileName}`, blob, { cacheControl: '3600', upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(`peticoes/${fileName}`);

      await supabase.from('petitions_v2').update({ status: 'generated', generated_docx_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', petitionId);
      await supabase.from('petition_versions').insert({ petition_id: petitionId, version_number: 1, form_data_json: formData as unknown as Record<string, unknown>, generated_docx_url: publicUrl });

      saveAs(blob, `Peticao_${formData.cliente.nome_completo.replace(/\s+/g, '_')}.docx`);
      toast({ title: 'Petição gerada!', description: 'O documento DOCX foi baixado.' });
      navigate('/peticoes');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Erro ao gerar:', err);
      toast({ title: 'Erro na geração', description: message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const needsBankData = model?.requires_bank_data !== false;
  const activeSteps = STEPS.filter(s => { if (s.id === 3 && !needsBankData) return false; return true; });
  const progress = ((activeSteps.findIndex(s => s.id === currentStep) + 1) / activeSteps.length) * 100;

  if (loadingInitial) {
    return (
      <AppLayout><AppHeader title="Carregando..." />
        <DetailSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <AppHeader title={actionName || 'Nova Petição'} />
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 max-w-[900px] mx-auto space-y-6">
          {/* Progress */}
          <Card className="rounded-xl border border-border/50 shadow-sm overflow-hidden">
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-foreground">{model?.nome || 'Petição'}</h2>
                  <p className="text-xs text-muted-foreground">{actionName}</p>
                </div>
                <Badge variant="outline" className="text-xs">Rascunho</Badge>
              </div>
              <div className="flex items-center gap-2">
                {activeSteps.map((step, i) => {
                  const Icon = step.icon;
                  const isActive = step.id === currentStep;
                  const isDone = step.id < currentStep;
                  return (
                    <div key={step.id} className="flex items-center gap-2">
                      <button onClick={() => setCurrentStep(step.id)} className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        isActive && "bg-primary text-primary-foreground shadow-sm",
                        isDone && "bg-primary/10 text-primary",
                        !isActive && !isDone && "bg-muted/50 text-muted-foreground hover:bg-muted"
                      )}>
                        {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">{step.title}</span>
                      </button>
                      {i < activeSteps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/40" />}
                    </div>
                  );
                })}
              </div>
              <Progress value={progress} className="h-1" />
            </div>
          </Card>

          {/* Step Content */}
          <Card className="rounded-xl border border-border/50 shadow-sm">
            <CardContent className="p-5 md:p-6">
              {currentStep === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-4"><User className="h-5 w-5 text-primary" /><h3 className="font-semibold text-foreground">Dados do Cliente</h3></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2"><Label className="text-xs text-muted-foreground">Nome Completo *</Label><Input value={formData.cliente.nome_completo} onChange={e => updateField('cliente', 'nome_completo', e.target.value)} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">CPF *</Label><Input value={formData.cliente.cpf} onChange={e => updateField('cliente', 'cpf', e.target.value)} className="rounded-xl mt-1" placeholder="000.000.000-00" /></div>
                    <div><Label className="text-xs text-muted-foreground">RG</Label><Input value={formData.cliente.rg} onChange={e => updateField('cliente', 'rg', e.target.value)} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">Estado Civil *</Label>
                      <Select value={formData.cliente.estado_civil} onValueChange={v => updateField('cliente', 'estado_civil', v)}>
                        <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>{ESTADOS_CIVIS.map(ec => <SelectItem key={ec} value={ec}>{ec}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs text-muted-foreground">Profissão *</Label><Input value={formData.cliente.profissao} onChange={e => updateField('cliente', 'profissao', e.target.value)} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">E-mail</Label><Input value={formData.cliente.email} onChange={e => updateField('cliente', 'email', e.target.value)} className="rounded-xl mt-1" type="email" /></div>
                    <div><Label className="text-xs text-muted-foreground">Telefone</Label><Input value={formData.cliente.telefone} onChange={e => updateField('cliente', 'telefone', e.target.value)} className="rounded-xl mt-1" placeholder="(00) 00000-0000" /></div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-4"><MapPin className="h-5 w-5 text-primary" /><h3 className="font-semibold text-foreground">Endereço do Cliente</h3></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label className="text-xs text-muted-foreground">CEP *</Label><Input value={formData.endereco.cep} onChange={e => { updateField('endereco', 'cep', e.target.value); handleCepLookup(e.target.value); }} className="rounded-xl mt-1" placeholder="00000-000" /></div>
                    <div className="sm:col-span-2"><Label className="text-xs text-muted-foreground">Rua *</Label><Input value={formData.endereco.rua} onChange={e => updateField('endereco', 'rua', e.target.value)} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">Número *</Label><Input value={formData.endereco.numero} onChange={e => updateField('endereco', 'numero', e.target.value)} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">Complemento</Label><Input value={formData.endereco.complemento} onChange={e => updateField('endereco', 'complemento', e.target.value)} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">Bairro *</Label><Input value={formData.endereco.bairro} onChange={e => updateField('endereco', 'bairro', e.target.value)} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">Cidade *</Label><Input value={formData.endereco.cidade} onChange={e => updateField('endereco', 'cidade', e.target.value)} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">UF *</Label>
                      <Select value={formData.endereco.uf} onValueChange={v => updateField('endereco', 'uf', v)}>
                        <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>{UFS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && needsBankData && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-4"><Building2 className="h-5 w-5 text-primary" /><h3 className="font-semibold text-foreground">Dados Bancários</h3></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2"><Label className="text-xs text-muted-foreground">Banco *</Label>
                      <Select value={formData.banco.banco_nome} onValueChange={v => updateField('banco', 'banco_nome', v)}>
                        <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Selecione o banco..." /></SelectTrigger>
                        <SelectContent>{BANCOS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs text-muted-foreground">Tipo de Produto</Label>
                      <Select value={formData.banco.tipo_produto} onValueChange={v => updateField('banco', 'tipo_produto', v)}>
                        <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="emprestimo">Empréstimo</SelectItem><SelectItem value="financiamento">Financiamento</SelectItem>
                          <SelectItem value="consignado">Consignado</SelectItem><SelectItem value="cartao">Cartão de Crédito</SelectItem>
                          <SelectItem value="pacote_servicos">Pacote de Serviços</SelectItem><SelectItem value="outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs text-muted-foreground">Agência</Label><Input value={formData.banco.agencia} onChange={e => updateField('banco', 'agencia', e.target.value)} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">Conta</Label><Input value={formData.banco.conta} onChange={e => updateField('banco', 'conta', e.target.value)} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">Data Início Contrato</Label><Input type="date" value={formData.banco.data_inicio} onChange={e => updateField('banco', 'data_inicio', e.target.value)} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">Data Fim Contrato</Label><Input type="date" value={formData.banco.data_fim} onChange={e => updateField('banco', 'data_fim', e.target.value)} className="rounded-xl mt-1" /></div>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-4"><DollarSign className="h-5 w-5 text-primary" /><h3 className="font-semibold text-foreground">Valores e Pedidos</h3></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label className="text-xs text-muted-foreground">Valor Cobrado Indevidamente</Label><Input value={formData.valores.valor_cobrado} onChange={e => updateField('valores', 'valor_cobrado', e.target.value)} className="rounded-xl mt-1" placeholder="R$ 0,00" /></div>
                    <div><Label className="text-xs text-muted-foreground">Valor Total da Causa</Label><Input value={formData.valores.valor_total} onChange={e => updateField('valores', 'valor_total', e.target.value)} className="rounded-xl mt-1" placeholder="R$ 0,00" /></div>
                    <div><Label className="text-xs text-muted-foreground">Período Início</Label><Input type="date" value={formData.valores.periodo_inicio} onChange={e => updateField('valores', 'periodo_inicio', e.target.value)} className="rounded-xl mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">Período Fim</Label><Input type="date" value={formData.valores.periodo_fim} onChange={e => updateField('valores', 'periodo_fim', e.target.value)} className="rounded-xl mt-1" /></div>
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-sm font-semibold mb-3 block">Pedidos Selecionados</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PEDIDOS.map(pedido => (
                        <label key={pedido.value} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-primary/30 cursor-pointer transition-colors">
                          <Checkbox checked={formData.valores.pedidos_selecionados.includes(pedido.value)} onCheckedChange={(checked) => {
                            const current = formData.valores.pedidos_selecionados;
                            updateField('valores', 'pedidos_selecionados', checked ? [...current, pedido.value] : current.filter(v => v !== pedido.value));
                          }} />
                          <span className="text-sm">{pedido.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Observações / Resumo dos Fatos</Label>
                    <Textarea value={formData.valores.observacoes} onChange={e => updateField('valores', 'observacoes', e.target.value)} className="rounded-xl mt-1 min-h-[120px]" placeholder="Descreva os fatos. A IA adaptará para linguagem jurídica formal..." />
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-4"><CheckCircle2 className="h-5 w-5 text-primary" /><h3 className="font-semibold text-foreground">Revisão e Geração</h3></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="rounded-xl border border-border/50">
                      <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Cliente</CardTitle></CardHeader>
                      <CardContent className="px-4 pb-4 space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Nome:</span> {formData.cliente.nome_completo || '—'}</p>
                        <p><span className="text-muted-foreground">CPF:</span> {formData.cliente.cpf || '—'}</p>
                        <p><span className="text-muted-foreground">Estado Civil:</span> {formData.cliente.estado_civil || '—'}</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-xl border border-border/50">
                      <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Modelo</CardTitle></CardHeader>
                      <CardContent className="px-4 pb-4 space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Ação:</span> {actionName}</p>
                        <p><span className="text-muted-foreground">Modelo:</span> {model?.nome || '—'}</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-xl border border-border/50 md:col-span-2">
                      <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Pedidos</CardTitle></CardHeader>
                      <CardContent className="px-4 pb-4">
                        <div className="flex flex-wrap gap-2">
                          {formData.valores.pedidos_selecionados.length > 0 ? formData.valores.pedidos_selecionados.map(p => (
                            <Badge key={p} variant="outline" className="text-xs">{PEDIDOS.find(x => x.value === p)?.label || p}</Badge>
                          )) : <span className="text-sm text-muted-foreground">Nenhum pedido selecionado</span>}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <Separator />
                  <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
                    <Button onClick={handleGenerate} disabled={generating || !formData.cliente.nome_completo} className="gap-2 rounded-xl h-12 px-8 shadow-md text-base">
                      {generating ? <><Loader2 className="h-5 w-5 animate-spin" />Gerando...</> : <><Sparkles className="h-5 w-5" />Gerar Petição Final</>}
                    </Button>
                    <Button variant="outline" onClick={handleSaveDraft} disabled={saving} className="gap-2 rounded-xl h-12 px-6">
                      <Save className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar Rascunho'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => {
              if (currentStep === 1) navigate('/peticoes');
              else { const idx = activeSteps.findIndex(s => s.id === currentStep); setCurrentStep(activeSteps[Math.max(0, idx - 1)].id); }
            }} className="gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" />{currentStep === 1 ? 'Voltar' : 'Anterior'}
            </Button>
            {currentStep < 5 && (
              <Button onClick={() => { const idx = activeSteps.findIndex(s => s.id === currentStep); setCurrentStep(activeSteps[Math.min(activeSteps.length - 1, idx + 1)].id); }} className="gap-2 rounded-xl">
                Próximo <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </ScrollArea>
    </AppLayout>
  );
}
