import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DetailSkeleton } from '@/components/ui/PageSkeleton';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Save, Sparkles, Loader2,
  User, MapPin, Building2, DollarSign, CheckCircle2,
  FileText, Scale, AlertCircle, Image as ImageIcon, Upload, X, Search, UserCheck,
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
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
import { reaisPorExtenso, inteiroPorExtenso } from '@/lib/extenso';
import { buildDynamicSteps, BANCO_CNPJ, type FieldConfig, type StepConfig } from '@/lib/petitionFields';
import { padronizarRodape } from '@/lib/petitionFooter';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

type FormData = Record<string, string>;

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Gera automaticamente os campos "por extenso" a partir dos valores numéricos,
// preenchendo apenas os que o advogado deixou em branco (não sobrescreve manual).
function autoExtenso(formData: FormData): Record<string, string> {
  const extras: Record<string, string> = {};
  const vazio = (k: string) => !(formData[k] && formData[k].trim());

  for (const [key, raw] of Object.entries(formData)) {
    const val = String(raw ?? '').trim();
    if (!val || key.endsWith('_extenso')) continue;

    // Valores monetários (valor_*) → reais por extenso
    if (/^valor_/.test(key)) {
      const extKey = `${key}_extenso`;
      if (vazio(extKey)) {
        const txt = reaisPorExtenso(val);
        if (txt) extras[extKey] = txt;
      }
    }

    // Quantidades de parcelas → inteiro por extenso
    if (/^num_parcelas/.test(key)) {
      const extKey = `${key}_extenso`;
      const n = parseInt(val.replace(/\D/g, ''), 10);
      if (vazio(extKey) && !isNaN(n)) extras[extKey] = inteiroPorExtenso(n);
    }
  }

  // Idade por extenso (mantém MAIÚSCULAS conforme padrão dos modelos)
  if (formData.idade_numerica?.trim() && vazio('idade_extenso')) {
    const n = parseInt(formData.idade_numerica.replace(/\D/g, ''), 10);
    if (!isNaN(n)) extras.idade_extenso = inteiroPorExtenso(n).toUpperCase();
  }

  return extras;
}

// L\u00ea o template .docx (via URL p\u00fablica) e devolve os marcadores {{...}} e se h\u00e1
// imagem no corpo (espa\u00e7o para o print). Remove as tags XML antes de casar, para
// juntar marcadores quebrados em runs.
async function extrairModeloInfo(url: string): Promise<{ placeholders: string[]; temImagem: boolean }> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Falha ao baixar o modelo');
  const buf = await resp.arrayBuffer();
  const zip = new PizZip(buf);
  const xml = zip.file('word/document.xml')?.asText() || '';
  const texto = xml.replace(/<[^>]+>/g, '');
  const set = new Set<string>();
  for (const m of texto.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    set.add(m[1].trim());
  }
  const rels = zip.file('word/_rels/document.xml.rels')?.asText() || '';
  const temImagem = /Target="media\/image[^"]+\.(?:png|jpe?g|gif)"/i.test(rels);
  return { placeholders: [...set], temImagem };
}

function buildEnderecoCliente(formData: FormData): string {
  const cidadeUf = [formData.endereco_cidade, formData.endereco_uf].filter(Boolean).join('/');
  const parts = [
    formData.endereco_rua,
    formData.endereco_numero ? `n° ${formData.endereco_numero}` : '',
    formData.endereco_complemento,
    formData.endereco_bairro ? `bairro: ${formData.endereco_bairro}` : '',
    cidadeUf,
    formData.endereco_cep ? `Cep: ${formData.endereco_cep}` : '',
  ].filter(Boolean);

  return parts.join(', ');
}

function buildQualificacao(formData: FormData): string {
  return [
    formData.nacionalidade,
    formData.naturalidade,
    formData.estado_civil,
    formData.profissao,
  ].filter(Boolean).join(', ');
}

function buildTemplateData(formData: FormData, actionName: string): Record<string, string> {
  const enderecoCliente = formData.endereco_cliente || buildEnderecoCliente(formData);
  const qualificacao = formData.qualificacao || buildQualificacao(formData);
  const tipoAcao = formData.tipo_acao || actionName;
  const reuNome = formData.reu_nome || formData.banco_nome || '';
  const reuCnpj = formData.reu_cnpj || formData.banco_cnpj || '';
  const reuEndereco = formData.reu_endereco || formData.banco_endereco || '';
  const nomeCompleto = formData.nome_completo || formData.nome_maiusculo || '';
  const nomeMaiusculo = formData.nome_maiusculo || nomeCompleto.toUpperCase();
  const varaJuizo = formData.vara_juizo || '____ª VARA DO JUIZADO ESPECIAL CÍVEL DA COMARCA DE MANAUS/AM';

  const data: Record<string, string> = {
    ...formData,
    ...autoExtenso(formData),
    // Alias: alguns modelos usam {{data_petição}} (com cedilha) e o form salva data_peticao.
    'data_petição': formData.data_petição || formData.data_peticao || '',
    nome_completo: nomeCompleto,
    nome_maiusculo: nomeMaiusculo,
    qualificacao,
    endereco_cliente: enderecoCliente,
    tipo_acao: tipoAcao,
    reu_nome: reuNome,
    reu_cnpj: reuCnpj,
    reu_endereco: reuEndereco,
    doc_id: formData.rg || formData.cpf || '',
    vara_juizo: varaJuizo,
    NOME_COMPLETO: nomeMaiusculo,
    NOME_COMPLETO_NORMAL: nomeCompleto,
    QUALIFICACAO: qualificacao,
    RG: formData.rg || '',
    CPF: formData.cpf || '',
    ENDERECO_CLIENTE: enderecoCliente,
    TIPO_ACAO: tipoAcao,
    REU_NOME: reuNome,
    REU_CNPJ: reuCnpj,
    REU_ENDERECO: reuEndereco,
    BANCO_NOME: formData.banco_nome || reuNome,
    BANCO_CNPJ: formData.banco_cnpj || reuCnpj,
    BANCO_ENDERECO: formData.banco_endereco || reuEndereco,
    DOC_ID: formData.rg || formData.cpf || '',
    VARA_JUIZO: varaJuizo,
  };

  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value ?? '')]),
  );
}

// ─── Inserção do print do contrato no .docx ─────────────────────────────────────

interface PrintImagem { bytes: Uint8Array; width: number; height: number }

// Converte o arquivo enviado (JPG/PNG) em PNG e devolve também as dimensões.
async function fileToPng(file: File): Promise<PrintImagem> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  const blob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/png'));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: img.naturalWidth, height: img.naturalHeight };
}

// Ajusta a caixa de exibição (extent) do print no document.xml: preserva a LARGURA
// definida no template e recalcula a ALTURA pela proporção da nova imagem — evita
// que o print fique esticado/achatado ao herdar a caixa da imagem antiga.
function ajustarExtent(zip: PizZip, targetMedia: string, imgW: number, imgH: number) {
  if (!imgW || !imgH) return;
  const relsTxt = zip.file('word/_rels/document.xml.rels')?.asText() || '';
  const esc = targetMedia.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const relEl = relsTxt.match(new RegExp('<Relationship\\b[^>]*Target="' + esc + '"[^>]*>'));
  const rId = relEl?.[0].match(/Id="(rId\d+)"/)?.[1];
  if (!rId) return;

  let doc = zip.file('word/document.xml')?.asText() || '';
  let blipIdx = doc.indexOf(`r:embed="${rId}"`);
  if (blipIdx < 0) return;

  // wp:extent (nível do desenho) — o mais próximo ANTES do blip
  const wpRe = /<wp:extent\b[^>]*\bcx="(\d+)"[^>]*\bcy="\d+"[^>]*\/>/g;
  let wp: RegExpExecArray | null = null, m: RegExpExecArray | null;
  while ((m = wpRe.exec(doc)) && m.index < blipIdx) wp = m;
  if (wp) {
    const cx = parseInt(wp[1], 10);
    const cy = Math.round((cx * imgH) / imgW);
    doc = doc.slice(0, wp.index) + `<wp:extent cx="${cx}" cy="${cy}"/>` + doc.slice(wp.index + wp[0].length);
  }

  // a:ext (nível da figura) — o primeiro DEPOIS do blip
  blipIdx = doc.indexOf(`r:embed="${rId}"`);
  const aRe = /<a:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="\d+"[^>]*\/>/g;
  aRe.lastIndex = blipIdx;
  const a = aRe.exec(doc);
  if (a) {
    const cx = parseInt(a[1], 10);
    const cy = Math.round((cx * imgH) / imgW);
    doc = doc.slice(0, a.index) + `<a:ext cx="${cx}" cy="${cy}"/>` + doc.slice(a.index + a[0].length);
  }

  zip.file('word/document.xml', doc);
}

// Substitui a imagem do CORPO do documento (o print do contrato) pela enviada e
// ajusta a caixa de exibição. A logo do timbre fica no cabeçalho (header rels),
// então não é tocada. Havendo várias imagens no corpo, troca a maior.
function substituirPrintNoDocx(zip: PizZip, png: PrintImagem): boolean {
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (!relsFile) return false;

  const rels = relsFile.asText();
  const alvos = [...rels.matchAll(/Target="(media\/image[^"]+\.(?:png|jpe?g|gif))"/gi)].map(m => m[1]);
  if (alvos.length === 0) return false;

  let alvo = alvos[0];
  let maior = -1;
  for (const t of alvos) {
    const f = zip.file(`word/${t}`);
    const sz = f ? f.asUint8Array().length : 0;
    if (sz > maior) { maior = sz; alvo = t; }
  }

  zip.file(`word/${alvo}`, png.bytes);
  ajustarExtent(zip, alvo, png.width, png.height);
  return true;
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
      ) : config.type === 'autocomplete' ? (
        <AutocompleteInput
          value={value}
          onChange={onChange}
          options={config.options || []}
          placeholder={config.placeholder}
          invalid={isEmpty}
          capitalize
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
  const [placeholders,   setPlaceholders]   = useState<string[]>([]);
  const [temPrint,       setTemPrint]       = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [generating,     setGenerating]     = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitted,      setSubmitted]      = useState(false);
  const [printFile,      setPrintFile]      = useState<File | null>(null);
  // Busca de lead do CRM para autopreencher os dados do cliente
  const [leadQuery,   setLeadQuery]   = useState('');
  const [leadResults, setLeadResults] = useState<Array<Record<string, string>>>([]);
  const [leadOpen,    setLeadOpen]    = useState(false);
  const leadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Campos gerados dinamicamente a partir dos {{marcadores}} do template do modelo.
  const steps = useMemo(() => buildDynamicSteps(placeholders, temPrint), [placeholders, temPrint]);
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
          setModel(d.petition_models_v2 || null);
          setPetitionId(id);
          // Carrega os campos do formulário a partir dos marcadores do template.
          const tplUrl = d.petition_models_v2?.template_file_url;
          if (tplUrl) {
            try {
              const info = await extrairModeloInfo(tplUrl);
              setPlaceholders(info.placeholders);
              setTemPrint(info.temImagem);
            } catch (e) { console.error('Falha ao ler campos do modelo:', e); }
          }
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
        setActionName(aName);
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
    setFormData(prev => {
      const next = { ...prev, [key]: value };
      // Ao selecionar o banco, puxa o CNPJ automaticamente (se conhecido).
      // Banco não mapeado → mantém o CNPJ para preenchimento manual.
      if (key === 'banco_nome' && BANCO_CNPJ[value]) {
        next.banco_cnpj = BANCO_CNPJ[value];
      }
      return next;
    });
    if (key === 'endereco_cep') handleCepLookup(value);
  };

  // ── Busca de lead do CRM ────────────────────────────────────────────────────────

  // Busca precisa por nome, telefone OU CPF (RPC compara só os dígitos de tel/cpf,
  // então casa mesmo com valores formatados no banco). Debounce de 250ms.
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

  // ── Navegação ──────────────────────────────────────────────────────────────────

  const currentStepConfig = activeSteps.find(s => s.id === currentStep) || activeSteps[0];
  const currentIdx        = activeSteps.findIndex(s => s.id === currentStep);
  const isLastStep        = currentIdx === activeSteps.length - 1;
  const isReviewStep      = currentStepConfig.title === 'Revisão';
  const isPrintStep       = currentStepConfig.title === 'Print';
  const progress          = ((currentIdx + 1) / activeSteps.length) * 100;

  // Campos de um passo que ainda estão vazios — todo campo aqui veio de um
  // {{marcador}} real do modelo .docx, então deixá-lo em branco vira um espaço
  // vazio na petição final. Sem essa checagem dava pra clicar "Próximo" e depois
  // "Gerar" com o formulário inteiro vazio, baixando o modelo sem nenhum dado
  // preenchido (foi exatamente o que aconteceu no teste do Gabriel).
  const stepMissingFields = (step: StepConfig) =>
    step.fields.filter(f => !(formData[f.key] || '').trim());

  const firstInvalidStepIdx = () =>
    activeSteps.findIndex(s => s.title !== 'Revisão' && s.title !== 'Print' && stepMissingFields(s).length > 0);

  const goNext = () => {
    if (!isReviewStep && !isPrintStep && stepMissingFields(currentStepConfig).length > 0) {
      setSubmitted(true);
      toast({ title: 'Campos obrigatórios', description: 'Preencha os campos destacados antes de continuar.', variant: 'destructive' });
      return;
    }
    setSubmitted(false);
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

    const invalidIdx = firstInvalidStepIdx();
    if (invalidIdx !== -1) {
      setCurrentStep(activeSteps[invalidIdx].id);
      toast({
        title: 'Faltam campos obrigatórios',
        description: `Preencha a etapa "${activeSteps[invalidIdx].title}" antes de gerar — senão a petição sai com espaços em branco.`,
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    try {
      const { error: saveError } = await supabase.from('petitions_v2').update({
        form_data_json: formData as any,
        status:         'review',
        updated_at:     new Date().toISOString(),
      }).eq('id', petitionId);
      if (saveError) throw saveError;

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

      // Renderizar com aliases compatíveis com os modelos .docx
      const templateData = buildTemplateData(formData, actionName);
      doc.render(templateData);

      // Insere o print do contrato enviado no lugar da imagem do corpo do modelo
      // (substitui o print antigo que vinha chumbado no template).
      const outZip = doc.getZip();
      if (printFile) {
        try {
          const png = await fileToPng(printFile);
          const ok = substituirPrintNoDocx(outZip, png);
          if (!ok) {
            toast({ title: 'Aviso', description: 'Este modelo não tem espaço para print — o documento será gerado sem a imagem.', variant: 'destructive' });
          }
        } catch (imgErr) {
          console.error('Falha ao inserir o print no documento:', imgErr);
          toast({ title: 'Aviso', description: 'Não foi possível inserir o print; o documento será gerado sem ele.', variant: 'destructive' });
        }
      }

      // Padroniza o rodapé do timbre (emojis + site) em qualquer modelo.
      try { padronizarRodape(outZip); } catch (e) { console.error('Falha ao padronizar rodapé:', e); }

      const blob = outZip.generate({
        type:     'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      // Salvar no Storage
      const fileName    = `peticao-${petitionId}-${Date.now()}.docx`;
      const storagePath = `peticoes/geradas/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('peticoes-modelos').upload(storagePath, blob, {
        cacheControl: '3600', upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('peticoes-modelos')
        .getPublicUrl(storagePath);

      const { error: statusError } = await supabase.from('petitions_v2').update({
        status:             'generated',
        generated_docx_url: publicUrl,
        updated_at:         new Date().toISOString(),
      }).eq('id', petitionId);
      if (statusError) throw statusError;

      const { error: versionError } = await supabase.from('petition_versions').insert({
        petition_id:        petitionId,
        version_number:     1,
        form_data_json:     formData as any,
        generated_docx_url: publicUrl,
      });
      if (versionError) console.error('[PeticaoEditarPage] Falha ao salvar versão:', versionError);

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

                  {/* Autopreenchimento a partir de um lead do CRM (só na etapa Cliente) */}
                  {currentStepConfig.title === 'Cliente' && (
                    <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">Cliente já está no sistema?</span>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={leadQuery}
                          onChange={e => buscarLeads(e.target.value)}
                          onFocus={() => leadResults.length && setLeadOpen(true)}
                          placeholder="Buscar por nome, telefone ou CPF..."
                          className="pl-10 rounded-lg bg-background"
                        />
                      </div>
                      {leadOpen && leadResults.length > 0 && (
                        <div className="absolute z-20 left-3 right-3 mt-1 rounded-lg border border-border/60 bg-popover shadow-xl max-h-64 overflow-y-auto">
                          {leadResults.map(l => (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => aplicarLead(l)}
                              className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
                            >
                              <p className="text-sm font-medium text-foreground">{l.nome || 'Sem nome'}</p>
                              <p className="text-xs text-muted-foreground">
                                {[l.cpf && `CPF ${l.cpf}`, l.cidade, l.telefone].filter(Boolean).join(' · ') || '—'}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

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

              {/* Print step — anexar o print do contrato */}
              {isPrintStep && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ImageIcon className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-foreground">Print do contrato</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Anexe o print do contrato do cliente (CET / proposta). Ele entra no lugar da
                    imagem de exemplo do modelo, na seção <b>DOS FATOS</b>. Opcional — pode gerar sem.
                  </p>
                  {printFile ? (
                    <div className="flex items-center gap-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
                      <img
                        src={URL.createObjectURL(printFile)}
                        alt="Prévia do print"
                        className="h-28 w-28 object-contain rounded-lg border border-border/50 bg-background"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{printFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(printFile.size / 1024).toFixed(0)} KB · pronto para inserir</p>
                        <label className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-primary cursor-pointer hover:underline">
                          <Upload className="h-3.5 w-3.5" /> Trocar imagem
                          <input type="file" accept="image/png,image/jpeg" className="hidden"
                            onChange={e => setPrintFile(e.target.files?.[0] ?? null)} />
                        </label>
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setPrintFile(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 p-10 rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">Clique para anexar o print</span>
                      <span className="text-xs text-muted-foreground">PNG ou JPG</span>
                      <input type="file" accept="image/png,image/jpeg" className="hidden"
                        onChange={e => setPrintFile(e.target.files?.[0] ?? null)} />
                    </label>
                  )}
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

                  {/* Lembrete do print anexado (o upload fica no passo "Print") */}
                  {temPrint && (
                    <div className={cn(
                      'flex items-center gap-2 p-3 rounded-xl border text-sm',
                      printFile
                        ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                        : 'border-amber-200 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                    )}>
                      <ImageIcon className="h-4 w-4 shrink-0" />
                      {printFile
                        ? <span>Print anexado: <b>{printFile.name}</b></span>
                        : <span>Nenhum print anexado — volte ao passo <b>Print</b> se quiser inserir o contrato.</span>}
                    </div>
                  )}

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
