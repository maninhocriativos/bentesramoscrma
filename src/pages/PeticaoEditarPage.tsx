import { useState, useEffect, useCallback, useRef } from 'react';
import { DetailSkeleton } from '@/components/ui/PageSkeleton';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Save, Sparkles, Loader2,
  User, MapPin, Building2, DollarSign, CheckCircle2,
  FileText, Scale, AlertCircle,
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

// ─── Constantes ────────────────────────────────────────────────────────────────

const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const ANOS = Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i));

const BANCOS = [
  'Banco do Brasil','Bradesco','Itaú Unibanco','Caixa Econômica Federal','Santander',
  'Banco Safra','Banco Inter','Nubank','C6 Bank','Banco PAN','Banco BMG','Banrisul',
  'Banco do Nordeste','Banco da Amazônia','Sicoob','Sicredi','Agibank','Banco Cetelem',
  'Banco Crefisa','PicPay','Will Bank','Facta Financeira','Banco Itaú Consignado',
  'Banco Daycoval','Banco Bmg','Banco Mercantil','Outro',
];

// ─── Tipos ─────────────────────────────────────────────────────────────────────

type FormData = Record<string, string>;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function numberToWords(value: string): string {
  // Simple helper — advogado preenche por extenso manualmente
  return value;
}

function detectActionSlug(actionName: string): string {
  const name = actionName.toLowerCase();
  if (name.includes('venda casada')) return 'venda-casada';
  if (name.includes('rmc') || name.includes('rcc') || name.includes('cartão consignado')) return 'rmc-rcc';
  if (name.includes('cancelamento') && name.includes('voo')) return 'cancelamento-voo';
  if (name.includes('empréstimo fraudulento') || name.includes('emprestimo fraudulento')) return 'emprestimo-fraudulento';
  if (name.includes('diferença salarial') || name.includes('diferenca salarial')) return 'diferenca-salarial';
  if (name.includes('negativação') || name.includes('negativacao')) return 'negativacao-indevida';
  return 'generico';
}

// ─── Configuração de campos por tipo de ação ───────────────────────────────────

interface FieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'select' | 'textarea' | 'date';
  options?: string[];
  span?: 'full' | 'half';
  hint?: string;
}

interface StepConfig {
  id: number;
  title: string;
  icon: React.ElementType;
  fields: FieldConfig[];
}

function getStepsConfig(actionSlug: string): StepConfig[] {

  const clienteBase: FieldConfig[] = [
    { key: 'nome_maiusculo',    label: 'Nome Completo (MAIÚSCULAS)',  placeholder: 'NOME CONFORME DOCUMENTOS',  span: 'full' },
    { key: 'nome_completo',     label: 'Nome Completo (normal)',      placeholder: 'Nome conforme documentos',  span: 'full' },
    { key: 'cpf',               label: 'CPF',                         placeholder: '000.000.000-00' },
    { key: 'rg',                label: 'RG',                          placeholder: '0000000-0 SSP/AM' },
    { key: 'estado_civil',      label: 'Estado Civil',                type: 'select', options: ESTADOS_CIVIS },
    { key: 'profissao',         label: 'Profissão',                   placeholder: 'Ex: aposentado(a), servidor(a) público(a)' },
    { key: 'nacionalidade',     label: 'Nacionalidade',               placeholder: 'brasileiro(a)' },
    { key: 'naturalidade',      label: 'Naturalidade',                placeholder: 'amazonense' },
  ];

  const clienteIdoso: FieldConfig[] = [
    ...clienteBase,
    { key: 'idade_numerica', label: 'Idade (número)', placeholder: '68' },
    { key: 'idade_extenso',  label: 'Idade (por extenso)', placeholder: 'SESSENTA E OITO' },
  ];

  const enderecoFields: FieldConfig[] = [
    { key: 'endereco_rua',        label: 'Rua',        placeholder: 'Rua das Flores', span: 'full' },
    { key: 'endereco_numero',     label: 'Número',     placeholder: '123' },
    { key: 'endereco_complemento',label: 'Complemento',placeholder: 'Apto 10' },
    { key: 'endereco_bairro',     label: 'Bairro',     placeholder: 'Centro' },
    { key: 'endereco_cidade',     label: 'Cidade',     placeholder: 'Manaus' },
    { key: 'endereco_uf',         label: 'UF', type: 'select', options: UFS },
    { key: 'endereco_cep',        label: 'CEP',        placeholder: '69.000-000' },
  ];

  const bancoBase: FieldConfig[] = [
    { key: 'banco_nome',     label: 'Banco Réu',  type: 'select', options: BANCOS, span: 'full' },
    { key: 'banco_cnpj',     label: 'CNPJ do Banco', placeholder: '00.000.000/0001-00' },
    { key: 'banco_endereco', label: 'Endereço do Banco', placeholder: 'Av. Paulista, nº 100, Centro, São Paulo/SP', span: 'full' },
  ];

  const dataFields: FieldConfig[] = [
    { key: 'data_peticao', label: 'Data da Petição', placeholder: '06 de março de 2026', span: 'full',
      hint: 'Ex: 06 de março de 2026' },
  ];

  // ── VENDA CASADA ─────────────────────────────────────────────────────────────
  if (actionSlug === 'venda-casada') {
    return [
      {
        id: 1, title: 'Cliente', icon: User,
        fields: clienteIdoso,
      },
      {
        id: 2, title: 'Endereço', icon: MapPin,
        fields: enderecoFields,
      },
      {
        id: 3, title: 'Banco', icon: Building2,
        fields: bancoBase,
      },
      {
        id: 4, title: 'Contrato', icon: FileText,
        fields: [
          { key: 'numero_contrato',              label: 'Número do Contrato',             placeholder: '6182708' },
          { key: 'valor_emprestimo',             label: 'Valor do Empréstimo (R$)',        placeholder: '2.000,05' },
          { key: 'valor_emprestimo_extenso',     label: 'Valor do Empréstimo (extenso)',   placeholder: 'dois mil reais e cinco centavos', span: 'full' },
          { key: 'valor_seguro',                 label: 'Valor do Seguro Prestamista (R$)',placeholder: '122,27' },
          { key: 'valor_seguro_extenso',         label: 'Valor do Seguro (extenso)',       placeholder: 'cento e vinte e dois reais e vinte e sete centavos', span: 'full' },
          { key: 'valor_encargos',               label: 'Valor dos Encargos (R$)',         placeholder: '97,63' },
          { key: 'valor_encargos_extenso',       label: 'Valor dos Encargos (extenso)',    placeholder: 'noventa e sete reais e sessenta e três centavos', span: 'full' },
          { key: 'valor_total_contrato',         label: 'Valor Total do Contrato (R$)',    placeholder: '2.219,65' },
          { key: 'valor_total_contrato_extenso', label: 'Valor Total (extenso)',           placeholder: 'dois mil, duzentos e dezenove reais e sessenta e cinco centavos', span: 'full' },
        ],
      },
      {
        id: 5, title: 'Pedidos', icon: DollarSign,
        fields: [
          { key: 'valor_seguro_dobro',          label: 'Valor do Seguro em Dobro (R$)',    placeholder: '244,54' },
          { key: 'valor_seguro_dobro_extenso',  label: 'Valor em Dobro (extenso)',         placeholder: 'duzentos e quarenta e quatro reais e cinquenta e quatro centavos', span: 'full' },
          { key: 'valor_danos_morais',          label: 'Valor Danos Morais (R$)',          placeholder: '10.000,00' },
          { key: 'valor_danos_morais_extenso',  label: 'Danos Morais (extenso)',           placeholder: 'dez mil reais', span: 'full' },
          { key: 'valor_causa',                 label: 'Valor da Causa (R$)',              placeholder: '10.244,54' },
          { key: 'valor_causa_extenso',         label: 'Valor da Causa (extenso)',         placeholder: 'dez mil, duzentos e quarenta e quatro reais e cinquenta e quatro centavos', span: 'full' },
          ...dataFields,
        ],
      },
      {
        id: 6, title: 'Revisão', icon: CheckCircle2,
        fields: [],
      },
    ];
  }

  // ── RMC / RCC ────────────────────────────────────────────────────────────────
  if (actionSlug === 'rmc-rcc') {
    return [
      {
        id: 1, title: 'Cliente', icon: User,
        fields: clienteIdoso,
      },
      {
        id: 2, title: 'Endereço', icon: MapPin,
        fields: enderecoFields,
      },
      {
        id: 3, title: 'Banco', icon: Building2,
        fields: bancoBase,
      },
      {
        id: 4, title: 'Contrato', icon: FileText,
        fields: [
          { key: 'mes_contratacao',          label: 'Mês da Contratação',    type: 'select', options: MESES },
          { key: 'ano_contratacao',          label: 'Ano da Contratação',    type: 'select', options: ANOS },
          { key: 'num_parcelas',             label: 'Nº de Parcelas',        placeholder: '24' },
          { key: 'num_parcelas_extenso',     label: 'Nº de Parcelas (extenso)', placeholder: 'vinte e quatro' },
          { key: 'valor_emprestimo',         label: 'Valor do Empréstimo (R$)', placeholder: '1.515,00' },
          { key: 'valor_emprestimo_extenso', label: 'Valor do Empréstimo (extenso)', placeholder: 'um mil, quinhentos e quinze reais', span: 'full' },
          { key: 'valor_parcela',            label: 'Valor da Parcela (R$)', placeholder: '88,29' },
          { key: 'valor_parcela_extenso',    label: 'Valor da Parcela (extenso)', placeholder: 'oitenta e oito reais e vinte e nove centavos', span: 'full' },
          { key: 'valor_total_contrato',     label: 'Valor Total do Contrato (R$)', placeholder: '2.118,96' },
          { key: 'valor_total_contrato_extenso', label: 'Valor Total (extenso)', placeholder: 'dois mil, cento e dezoito reais e noventa e seis centavos', span: 'full' },
        ],
      },
      {
        id: 5, title: 'Descontos', icon: Scale,
        fields: [
          { key: 'mes_inicio_desconto',      label: 'Mês Início Desconto',   type: 'select', options: MESES },
          { key: 'ano_inicio_desconto',      label: 'Ano Início Desconto',   type: 'select', options: ANOS },
          { key: 'mes_quitacao',             label: 'Mês Quitação',          type: 'select', options: MESES },
          { key: 'ano_quitacao',             label: 'Ano Quitação',          type: 'select', options: ANOS },
          { key: 'mes_ultimo_desconto',      label: 'Mês Último Desconto',   type: 'select', options: MESES },
          { key: 'ano_ultimo_desconto',      label: 'Ano Último Desconto',   type: 'select', options: ANOS },
          { key: 'periodo_descontos_indevidos', label: 'Período Descontos Indevidos', placeholder: 'dezembro de 2024 a fevereiro de 2026', span: 'full' },
          { key: 'num_parcelas_descontadas', label: 'Nº Parcelas Descontadas', placeholder: '39' },
          { key: 'num_parcelas_descontadas_extenso', label: 'Parcelas Descontadas (extenso)', placeholder: 'trinta e nove' },
          { key: 'valor_total_descontado',   label: 'Total Descontado (R$)', placeholder: '3.436,86' },
          { key: 'valor_total_descontado_extenso', label: 'Total Descontado (extenso)', placeholder: 'três mil, quatrocentos e trinta e seis reais e oitenta e seis centavos', span: 'full' },
          { key: 'valor_descontos_indevidos', label: 'Descontos Indevidos (R$)', placeholder: '1.317,90' },
          { key: 'valor_descontos_indevidos_extenso', label: 'Descontos Indevidos (extenso)', placeholder: 'um mil, trezentos e dezessete reais e noventa centavos', span: 'full' },
        ],
      },
      {
        id: 6, title: 'Pedidos', icon: DollarSign,
        fields: [
          { key: 'valor_devolucao',          label: 'Valor Devolução (R$)',   placeholder: '2.635,80' },
          { key: 'valor_devolucao_extenso',  label: 'Devolução (extenso)',    placeholder: 'dois mil, seiscentos e trinta e cinco reais e oitenta centavos', span: 'full' },
          { key: 'valor_danos_morais',       label: 'Danos Morais (R$)',      placeholder: '20.000,00' },
          { key: 'valor_danos_morais_extenso', label: 'Danos Morais (extenso)', placeholder: 'vinte mil reais', span: 'full' },
          { key: 'valor_causa',              label: 'Valor da Causa (R$)',    placeholder: '22.635,80' },
          { key: 'valor_causa_extenso',      label: 'Valor da Causa (extenso)', placeholder: 'vinte e dois mil, seiscentos e trinta e cinco reais e oitenta centavos', span: 'full' },
          ...dataFields,
        ],
      },
      {
        id: 7, title: 'Revisão', icon: CheckCircle2,
        fields: [],
      },
    ];
  }

  // ── GENÉRICO (fallback para outros tipos) ─────────────────────────────────────
  return [
    {
      id: 1, title: 'Cliente', icon: User,
      fields: [
        ...clienteBase,
        { key: 'idade_numerica', label: 'Idade (número)', placeholder: '65' },
        { key: 'idade_extenso',  label: 'Idade (extenso)', placeholder: 'SESSENTA E CINCO' },
      ],
    },
    {
      id: 2, title: 'Endereço', icon: MapPin,
      fields: enderecoFields,
    },
    {
      id: 3, title: 'Banco / Réu', icon: Building2,
      fields: bancoBase,
    },
    {
      id: 4, title: 'Valores', icon: DollarSign,
      fields: [
        { key: 'valor_emprestimo',         label: 'Valor Principal (R$)',    placeholder: '0,00' },
        { key: 'valor_emprestimo_extenso', label: 'Valor Principal (extenso)', placeholder: 'zero reais', span: 'full' },
        { key: 'valor_danos_morais',       label: 'Danos Morais (R$)',       placeholder: '10.000,00' },
        { key: 'valor_danos_morais_extenso', label: 'Danos Morais (extenso)', placeholder: 'dez mil reais', span: 'full' },
        { key: 'valor_causa',              label: 'Valor da Causa (R$)',     placeholder: '10.000,00' },
        { key: 'valor_causa_extenso',      label: 'Valor da Causa (extenso)', placeholder: 'dez mil reais', span: 'full' },
        ...dataFields,
      ],
    },
    {
      id: 5, title: 'Revisão', icon: CheckCircle2,
      fields: [],
    },
  ];
}

// ─── Componente de Campo ────────────────────────────────────────────────────────

function FieldInput({
  config,
  value,
  onChange,
  submitted,
}: {
  config: FieldConfig;
  value: string;
  onChange: (v: string) => void;
  submitted: boolean;
}) {
  const isEmpty = submitted && !value?.trim();

  return (
    <div className={config.span === 'full' ? 'col-span-2' : ''}>
      <Label className={cn('text-xs mb-1.5 flex items-center gap-1', isEmpty ? 'text-destructive' : 'text-muted-foreground')}>
        {config.label}
        {isEmpty && <AlertCircle className="h-3 w-3" />}
      </Label>

      {config.type === 'select' ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={cn('rounded-xl mt-0', isEmpty && 'border-destructive')}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {config.options?.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : config.type === 'textarea' ? (
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={config.placeholder}
          className={cn('rounded-xl mt-0 min-h-[80px]', isEmpty && 'border-destructive')}
        />
      ) : (
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={config.placeholder}
          className={cn('rounded-xl mt-0', isEmpty && 'border-destructive')}
        />
      )}
      {config.hint && <p className="text-[10px] text-muted-foreground mt-1">{config.hint}</p>}
    </div>
  );
}

// ─── Página Principal ───────────────────────────────────────────────────────────

export default function PeticaoEditarPage() {
  const navigate       = useNavigate();
  const { id }         = useParams();
  const [searchParams] = useSearchParams();
  const { toast }      = useToast();

  const [currentStep,    setCurrentStep]    = useState(1);
  const [formData,       setFormData]       = useState<FormData>({});
  const [petitionId,     setPetitionId]     = useState(id || '');
  const [model,          setModel]          = useState<PetitionModelV2 | null>(null);
  const [actionName,     setActionName]     = useState('');
  const [actionSlug,     setActionSlug]     = useState('generico');
  const [saving,         setSaving]         = useState(false);
  const [generating,     setGenerating]     = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitted,      setSubmitted]      = useState(false);
  const autosaveTimer = useRef<NodeJS.Timeout | null>(null);

  const steps = getStepsConfig(actionSlug);
  const reviewStep = steps[steps.length - 1];
  const activeSteps = steps;

  // ── Init ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      setLoadingInitial(true);
      const actionId = searchParams.get('action');
      const modelId  = searchParams.get('model');

      if (id) {
        const { data } = await supabase
          .from('petitions_v2')
          .select('*, action_types(nome, slug), petition_models_v2(*)')
          .eq('id', id)
          .single();

        if (data) {
          const d = data as any;
          setFormData(d.form_data_json || {});
          setCurrentStep(d.current_step || 1);
          setActionName(d.action_types?.nome || '');
          setActionSlug(d.action_types?.slug || detectActionSlug(d.action_types?.nome || ''));
          setModel(d.petition_models_v2 || null);
          setPetitionId(id);
        }
        setLoadingInitial(false);
        return;
      }

      if (actionId && modelId) {
        const [{ data: actionData }, { data: modelData }] = await Promise.all([
          supabase.from('action_types').select('nome, slug').eq('id', actionId).single(),
          supabase.from('petition_models_v2').select('*').eq('id', modelId).single(),
        ]);

        const aName = (actionData as any)?.nome || '';
        const aSlug = (actionData as any)?.slug || detectActionSlug(aName);
        setActionName(aName);
        setActionSlug(aSlug);
        setModel((modelData as any) || null);

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            toast({ title: 'Erro', description: 'Usuário não autenticado.', variant: 'destructive' });
            navigate('/peticoes');
            return;
          }

          const { data: newPetition, error } = await supabase
            .from('petitions_v2')
            .insert({
              action_type_id: actionId,
              model_id:       modelId,
              status:         'draft',
              current_step:   1,
              form_data_json: {},
              created_by:     user.id,
            })
            .select('id')
            .single();

          if (error) {
            toast({ title: 'Erro ao criar petição', description: error.message, variant: 'destructive' });
            setLoadingInitial(false);
            return;
          }

          if (newPetition) {
            const newId = (newPetition as any).id;
            setPetitionId(newId);
            navigate(`/peticoes/${newId}/editar`, { replace: true });
          }
        } catch (err) {
          toast({ title: 'Erro inesperado', description: 'Tente novamente.', variant: 'destructive' });
        }

        setLoadingInitial(false);
        return;
      }

      navigate('/peticoes');
    };
    init();
  }, [id, searchParams, navigate, toast]);

  // ── Autosave ───────────────────────────────────────────────────────────────────

  const doAutosave = useCallback(async () => {
    if (!petitionId) return;
    await supabase.from('petitions_v2').update({
      form_data_json: formData as any,
      current_step:   currentStep,
      updated_at:     new Date().toISOString(),
    }).eq('id', petitionId);
  }, [petitionId, formData, currentStep]);

  useEffect(() => {
    if (!petitionId || loadingInitial) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(doAutosave, 2000);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [formData, currentStep, doAutosave, petitionId, loadingInitial]);

  // ── CEP lookup ─────────────────────────────────────────────────────────────────

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

  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (key === 'endereco_cep') handleCepLookup(value);
  };

  // ── Navegação ──────────────────────────────────────────────────────────────────

  const currentStepConfig = activeSteps.find(s => s.id === currentStep) || activeSteps[0];
  const currentIdx        = activeSteps.findIndex(s => s.id === currentStep);
  const isLastStep        = currentIdx === activeSteps.length - 1;
  const isReviewStep      = currentStepConfig.title === 'Revisão';
  const progress          = ((currentIdx + 1) / activeSteps.length) * 100;

  const goNext = () => {
    if (currentIdx < activeSteps.length - 1) {
      setCurrentStep(activeSteps[currentIdx + 1].id);
    }
  };

  const goPrev = () => {
    if (currentIdx === 0) navigate('/peticoes');
    else setCurrentStep(activeSteps[currentIdx - 1].id);
  };

  // ── Salvar rascunho ────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    setSaving(true);
    await doAutosave();
    toast({ title: 'Salvo', description: 'Rascunho salvo com sucesso.' });
    setSaving(false);
  };

  // ── Gerar petição ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setSubmitted(true);
    if (!petitionId || !model?.template_file_url) {
      toast({ title: 'Erro', description: 'Modelo sem arquivo vinculado.', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      await supabase.from('petitions_v2').update({
        form_data_json: formData as any,
        status:         'review',
        updated_at:     new Date().toISOString(),
      }).eq('id', petitionId);

      // Baixar template
      const response = await fetch(model.template_file_url);
      if (!response.ok) throw new Error('Erro ao baixar o modelo .docx');
      const arrayBuffer = await response.arrayBuffer();

      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks:    true,
        delimiters:    { start: '{{', end: '}}' },
        nullGetter()  { return ''; },
      });

      // Renderizar com todos os campos do formData
      doc.render(formData);

      const blob = doc.getZip().generate({
        type:     'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      // Salvar no Storage
      const fileName    = `peticao-${petitionId}-${Date.now()}.docx`;
      const storagePath = `peticoes/geradas/${fileName}`;

      await supabase.storage.from('peticoes-modelos').upload(storagePath, blob, {
        cacheControl: '3600', upsert: true,
      });

      const { data: { publicUrl } } = supabase.storage
        .from('peticoes-modelos')
        .getPublicUrl(storagePath);

      await supabase.from('petitions_v2').update({
        status:             'generated',
        generated_docx_url: publicUrl,
        updated_at:         new Date().toISOString(),
      }).eq('id', petitionId);

      await supabase.from('petition_versions').insert({
        petition_id:        petitionId,
        version_number:     1,
        form_data_json:     formData as any,
        generated_docx_url: publicUrl,
      });

      const clienteNome = formData.nome_completo || formData.nome_maiusculo || 'documento';
      saveAs(blob, `Peticao_${clienteNome.replace(/\s+/g, '_')}.docx`);

      toast({ title: '✅ Petição gerada!', description: 'O arquivo .docx foi baixado.' });
      navigate('/peticoes');

    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro na geração', description: err.message || 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────────

  if (loadingInitial) {
    return (
      <AppLayout>
        <AppHeader title="Carregando..." />
        <DetailSkeleton />
      </AppLayout>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <AppHeader title={actionName || 'Nova Petição'} />
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 max-w-[860px] mx-auto space-y-5">

          {/* Progress card */}
          <Card className="rounded-2xl border border-border/50 shadow-sm overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-foreground leading-tight">{model?.nome || 'Petição'}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{actionName}</p>
                </div>
                <Badge variant="outline" className="text-xs">Rascunho</Badge>
              </div>

              {/* Steps */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeSteps.map((step, i) => {
                  const Icon     = step.icon;
                  const isActive = step.id === currentStep;
                  const isDone   = step.id < currentStep;
                  return (
                    <div key={step.id} className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentStep(step.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all',
                          isActive && 'bg-primary text-primary-foreground shadow-sm',
                          isDone   && 'bg-primary/10 text-primary',
                          !isActive && !isDone && 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {isDone
                          ? <CheckCircle2 className="h-3.5 w-3.5" />
                          : <Icon className="h-3.5 w-3.5" />
                        }
                        <span className="hidden sm:inline">{step.title}</span>
                      </button>
                      {i < activeSteps.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>

              <Progress value={progress} className="h-1.5 rounded-full" />
            </div>
          </Card>

          {/* Step Content */}
          <Card className="rounded-2xl border border-border/50 shadow-sm">
            <CardContent className="p-5 md:p-6">

              {/* Fields step */}
              {!isReviewStep && currentStepConfig.fields.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-2">
                    <currentStepConfig.icon className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-foreground">{currentStepConfig.title}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {currentStepConfig.fields.map(field => (
                      <FieldInput
                        key={field.key}
                        config={field}
                        value={formData[field.key] || ''}
                        onChange={v => updateField(field.key, v)}
                        submitted={submitted}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Review step */}
              {isReviewStep && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-foreground">Revisão e Geração</h3>
                  </div>

                  {/* Summary cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="rounded-xl border border-border/40">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" /> Cliente
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Nome:</span> {formData.nome_completo || formData.nome_maiusculo || '—'}</p>
                        <p><span className="text-muted-foreground">CPF:</span> {formData.cpf || '—'}</p>
                        <p><span className="text-muted-foreground">RG:</span> {formData.rg || '—'}</p>
                        <p><span className="text-muted-foreground">Profissão:</span> {formData.profissao || '—'}</p>
                        {formData.idade_numerica && (
                          <p><span className="text-muted-foreground">Idade:</span> {formData.idade_numerica} anos</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl border border-border/40">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" /> Banco Réu
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Banco:</span> {formData.banco_nome || '—'}</p>
                        <p><span className="text-muted-foreground">CNPJ:</span> {formData.banco_cnpj || '—'}</p>
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl border border-border/40">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" /> Endereço
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-1 text-sm">
                        <p>{formData.endereco_rua || '—'}, {formData.endereco_numero || '—'}</p>
                        <p>{formData.endereco_bairro || '—'}, {formData.endereco_cidade || '—'}/{formData.endereco_uf || '—'}</p>
                        <p>CEP: {formData.endereco_cep || '—'}</p>
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl border border-border/40">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary" /> Valores
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-1 text-sm">
                        {formData.valor_emprestimo && <p><span className="text-muted-foreground">Empréstimo:</span> R$ {formData.valor_emprestimo}</p>}
                        {formData.valor_seguro && <p><span className="text-muted-foreground">Seguro:</span> R$ {formData.valor_seguro}</p>}
                        {formData.valor_descontos_indevidos && <p><span className="text-muted-foreground">Desc. indevidos:</span> R$ {formData.valor_descontos_indevidos}</p>}
                        {formData.valor_danos_morais && <p><span className="text-muted-foreground">Danos Morais:</span> R$ {formData.valor_danos_morais}</p>}
                        {formData.valor_causa && <p><span className="text-muted-foreground font-semibold">Valor da Causa:</span> R$ {formData.valor_causa}</p>}
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  {/* Modelo info */}
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{model?.nome || '—'}</p>
                      <p className="text-xs text-muted-foreground">{actionName}</p>
                    </div>
                    {model?.template_file_url ? (
                      <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                        ✓ Template vinculado
                      </Badge>
                    ) : (
                      <Badge className="ml-auto bg-red-100 text-red-700 border-red-200 text-xs">
                        ✗ Sem template
                      </Badge>
                    )}
                  </div>

                  <Separator />

                  {/* Botões */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 justify-center pt-2">
                    <Button
                      onClick={handleGenerate}
                      disabled={generating || !model?.template_file_url}
                      className="gap-2 rounded-xl h-12 px-8 shadow-md text-base font-bold"
                    >
                      {generating
                        ? <><Loader2 className="h-5 w-5 animate-spin" /> Gerando...</>
                        : <><Sparkles className="h-5 w-5" /> Gerar Petição Final</>
                      }
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSaveDraft}
                      disabled={saving}
                      className="gap-2 rounded-xl h-12 px-6"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Salvando...' : 'Salvar Rascunho'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navegação */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={goPrev} className="gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              {currentIdx === 0 ? 'Voltar' : 'Anterior'}
            </Button>
            {!isLastStep && (
              <Button onClick={goNext} className="gap-2 rounded-xl font-semibold">
                Próximo <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>

        </div>
      </ScrollArea>
    </AppLayout>
  );
}
