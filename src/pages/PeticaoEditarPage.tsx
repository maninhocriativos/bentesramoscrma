// Formulário dinâmico de preenchimento — backend Cloudflare. Os campos vêm
// dos {{marcadores}} reais do .docx do modelo (fetchModelFields), a
// mesclagem final acontece no Worker (petitionEngine.ts) — esta tela coleta
// os dados, autosalva, pré-visualiza (via Worker + Edge Function
// docx-to-pdf) e dispara a geração — inclusive com o print do contrato,
// convertido pra PNG aqui no navegador (Canvas não existe no Worker) e
// enviado pronto em /generate.
// Layout redesenhado a partir do Figma real (SISTEMA-BENTES-E-RAMOS, nodes
// peticao-cliente-desktop / peticao-revisao-desktop, 2026-09-10) — mesmo
// "chrome" (cabeçalho, barra de passos, rodapé de ações) pra qualquer
// etapa, já que as 7 etapas do Figma são todas o mesmo componente aqui,
// só mudando o `currentStep`.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DetailSkeleton } from '@/components/ui/PageSkeleton';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Save, Sparkles, Loader2,
  CheckCircle2, AlertCircle, Search, UserCheck, Eye,
  Image as ImageIcon, Upload, X, LogOut,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { saveAs } from 'file-saver';
import { parseValor } from '@/lib/extenso';
import { buildDynamicSteps, BANCO_CNPJ, BANCO_ENDERECO, type FieldConfig, type StepConfig } from '@/lib/petitionFields';
import * as api from '@/lib/peticoesV2Client';
import type { PrintSlot, PrintParaEnviar } from '@/lib/peticoesV2Client';
import { NotificacoesBell } from '@/components/NotificacoesBell';
import { useAuth } from '@/hooks/useAuth';

type FormData = Record<string, string>;

function base64ToBlobUrl(base64: string, mime = 'application/pdf'): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

// Converte o arquivo enviado (JPG/PNG) em PNG via <canvas> — o Worker não
// tem essa API, então essa conversão só pode acontecer aqui.
async function fileToPngBlob(file: File): Promise<Blob> {
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
  return new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/png'));
}

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
      <Label className={cn('text-[13px] font-semibold mb-2 flex items-center gap-1', isEmpty ? 'text-destructive' : 'text-[#29201e]')}>
        {config.label}
        {config.optional && <span className="text-[#6e5e5a] font-normal">(opcional)</span>}
        {isEmpty && <AlertCircle className="h-3 w-3" />}
      </Label>
      {config.type === 'select' ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={cn('rounded-xl mt-0 h-11 border-[#efebe4]', isEmpty && 'border-destructive')}><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>{config.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
        </Select>
      ) : config.type === 'textarea' ? (
        <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={config.placeholder} className={cn('rounded-xl mt-0 min-h-[80px] border-[#efebe4]', isEmpty && 'border-destructive')} />
      ) : config.type === 'autocomplete' ? (
        <AutocompleteInput value={value} onChange={onChange} options={config.options || []} placeholder={config.placeholder} invalid={isEmpty} capitalize />
      ) : (
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder={config.placeholder} className={cn('rounded-xl mt-0 h-11 border-[#efebe4]', isEmpty && 'border-destructive')} />
      )}
      {config.hint && <p className="text-[10px] text-[#6e5e5a] mt-1">{config.hint}</p>}
    </div>
  );
}

export default function PeticaoEditarPage() {
  const navigate       = useNavigate();
  const { id }         = useParams();
  const [searchParams] = useSearchParams();
  const { toast }      = useToast();
  const { signOut, user } = useAuth();

  const [currentStep,    setCurrentStep]    = useState(1);
  const [formData,       setFormData]       = useState<FormData>({});
  const [petitionId,     setPetitionId]     = useState(id || '');
  const [modelNome,      setModelNome]      = useState('');
  const [actionName,     setActionName]     = useState('');
  const [placeholders,   setPlaceholders]   = useState<string[]>([]);
  const [temImagem,      setTemImagem]      = useState(false);
  const [printSlots,     setPrintSlots]     = useState<PrintSlot[] | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [generating,     setGenerating]     = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitted,      setSubmitted]      = useState(false);
  const [printFiles,     setPrintFiles]     = useState<File[]>([]);
  const [printsPorSlot,  setPrintsPorSlot]  = useState<Record<number, File | null>>({});
  const [previewOpen,    setPreviewOpen]    = useState(false);
  const [previewPdfUrl,  setPreviewPdfUrl]  = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [leadQuery,   setLeadQuery]   = useState('');
  const [leadResults, setLeadResults] = useState<Array<Record<string, string>>>([]);
  const [leadOpen,    setLeadOpen]    = useState(false);
  const leadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSignOut = async () => { await signOut(); navigate('/auth'); };

  const steps = useMemo(() => buildDynamicSteps(placeholders, temImagem), [placeholders, temImagem]);

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
          setPrintSlots(petition.petition_models?.print_slots_json || null);
          setPetitionId(id);
          if (petition.model_id) {
            const fields = await api.fetchModelFields(petition.model_id);
            setPlaceholders(fields.placeholders);
            setTemImagem(fields.temImagem);
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
  const isPrintStep       = currentStepConfig.title === 'Print';
  const progress          = ((currentIdx + 1) / steps.length) * 100;

  const stepMissingFields = (step: StepConfig) => step.fields.filter(f => !f.optional && !(formData[f.key] || '').trim());
  const firstInvalidStepIdx = () => steps.findIndex(s => s.title !== 'Revisão' && s.title !== 'Print' && stepMissingFields(s).length > 0);

  const goNext = () => {
    if (!isReviewStep && !isPrintStep && stepMissingFields(currentStepConfig).length > 0) {
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

  // Monta os prints já convertidos pra PNG, no formato que /generate espera.
  const montarPrintsParaEnviar = async (): Promise<PrintParaEnviar[]> => {
    if (printSlots && printSlots.length > 0) {
      const resultado: PrintParaEnviar[] = [];
      for (let i = 0; i < printSlots.length; i++) {
        const file = printsPorSlot[i];
        if (!file) continue;
        const blob = await fileToPngBlob(file);
        resultado.push({ field: `print_slot_${i}`, blob });
      }
      return resultado;
    }
    const resultado: PrintParaEnviar[] = [];
    for (let i = 0; i < printFiles.length; i++) {
      const blob = await fileToPngBlob(printFiles[i]);
      resultado.push({ field: `print_generico_${i}`, blob });
    }
    return resultado;
  };

  const handlePreview = async () => {
    const invalidIdx = firstInvalidStepIdx();
    if (invalidIdx !== -1) {
      setSubmitted(true);
      setCurrentStep(steps[invalidIdx].id);
      toast({ title: 'Faltam campos obrigatórios', description: `Preencha a etapa "${steps[invalidIdx].title}" antes de pré-visualizar.`, variant: 'destructive' });
      return;
    }
    if (!petitionId) return;

    setPreviewLoading(true);
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewPdfUrl(null);
    setPreviewOpen(true);
    try {
      const base64_docx = await api.previewPetition(petitionId, formData);
      const { data, error } = await supabase.functions.invoke('docx-to-pdf', { body: { base64_docx } });
      if (error) throw error;
      if (!data?.base64_pdf) throw new Error(data?.error?.message || 'PDF não retornado');
      setPreviewPdfUrl(base64ToBlobUrl(data.base64_pdf));
    } catch (err) {
      console.error('[PeticaoEditarPage] Erro ao pré-visualizar:', err);
      toast({ title: 'Erro na pré-visualização', description: err instanceof Error ? err.message : 'Erro desconhecido', variant: 'destructive' });
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
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
      const prints = await montarPrintsParaEnviar();
      const result = await api.generatePetition(petitionId, prints);
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

  // Resumo dinâmico pra etapa de Revisão — os nomes de campo variam por
  // modelo, então tenta os candidatos mais comuns em vez de assumir uma
  // chave fixa; card de valor só aparece se algum valor_* tiver dado real.
  const resumoCliente = formData.nome_completo || formData.nome_maiusculo || null;
  const resumoClienteSub = formData.cpf ? `CPF: ${formData.cpf}` : formData.rg ? `RG: ${formData.rg}` : null;
  const resumoReu = formData.reu_nome || formData.banco_nome || null;
  const resumoReuSub = formData.reu_cnpj || formData.banco_cnpj ? `CNPJ: ${formData.reu_cnpj || formData.banco_cnpj}` : null;
  const primeiroValorKey = Object.keys(formData).find(k => /^valor/.test(k) && formData[k]?.trim());
  const resumoValor = primeiroValorKey ? formData[primeiroValorKey] : null;

  if (loadingInitial) {
    return <DetailSkeleton />;
  }

  return (
    <>
      <div className="flex flex-col h-full bg-[#f9f6f0]">
        <div className="bg-white border-b border-[#efebe4] px-6 sm:px-10 py-5 flex items-center justify-between shrink-0 gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl text-[#29201e] truncate">{modelNome || 'Petição'}</h1>
            <p className="text-sm text-[#6e5e5a] mt-1 truncate">{actionName}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-[#dcfce7] border-[#15803d] text-[#15803d]">
              <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
              Google Drive Conectado
            </div>
            <NotificacoesBell />
            {user && (
              <button onClick={handleSignOut} title="Sair" className="h-9 w-9 rounded-full border border-[#efebe4] flex items-center justify-center text-[#6e5e5a] hover:bg-[#f5efe6] transition-colors">
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border-b border-[#efebe4] px-6 sm:px-10 py-5 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isDone = step.id < currentStep;
              return (
                <div key={step.id} className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setCurrentStep(step.id)} className="flex items-center gap-2">
                    <span className={cn('h-7 w-7 rounded-[14px] flex items-center justify-center text-xs font-semibold shrink-0',
                      isActive ? 'bg-[#3e2f2b] text-white' : isDone ? 'bg-[#c5a47e] text-white' : 'bg-[#f5efe6] text-[#6e5e5a]')}>
                      {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.id}
                    </span>
                    <span className={cn('text-sm whitespace-nowrap', isActive ? 'font-semibold text-[#29201e]' : 'text-[#6e5e5a]')}>{step.title}</span>
                  </button>
                  {i < steps.length - 1 && <div className="h-px w-5 bg-[#efebe4] shrink-0" />}
                </div>
              );
            })}
          </div>
          <div className="h-1 rounded-full bg-[#f5efe6] mt-4 overflow-hidden">
            <div className="h-full bg-[#3e2f2b] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 sm:p-10">
          <div className="bg-white border border-[#efebe4] rounded-2xl p-6 sm:p-8">
            {!isReviewStep && !isPrintStep && currentStepConfig.fields.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <currentStepConfig.icon className="h-5 w-5 text-[#3e2f2b]" />
                  <h2 className="text-lg text-[#29201e]">{currentStepConfig.title === 'Cliente' ? 'Dados Gerais do Cliente' : currentStepConfig.title}</h2>
                </div>

                {currentStepConfig.title === 'Cliente' && (
                  <div className="relative rounded-xl bg-[#f5efe6] p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-[#3e2f2b]" />
                      <span className="text-[13px] font-semibold text-[#3e2f2b]">Cliente já está cadastrado no sistema?</span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6e5e5a]" />
                      <Input value={leadQuery} onChange={e => buscarLeads(e.target.value)} onFocus={() => leadResults.length && setLeadOpen(true)}
                        placeholder="Buscar por nome, telefone ou CPF..." className="pl-10 h-10 rounded-lg bg-white border-[#e3d9cd]" />
                    </div>
                    {leadOpen && leadResults.length > 0 && (
                      <div className="absolute z-20 left-4 right-4 mt-1 rounded-lg border border-[#efebe4] bg-white shadow-xl max-h-64 overflow-y-auto">
                        {leadResults.map(l => (
                          <button key={l.id} type="button" onClick={() => aplicarLead(l)} className="w-full text-left px-3 py-2 hover:bg-[#f5efe6] transition-colors border-b border-[#efebe4] last:border-0">
                            <p className="text-sm font-medium text-[#29201e]">{l.nome || 'Sem nome'}</p>
                            <p className="text-xs text-[#6e5e5a]">{[l.cpf && `CPF ${l.cpf}`, l.cidade, l.telefone].filter(Boolean).join(' · ') || '—'}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-5">
                  {currentStepConfig.fields.map(field => (
                    <FieldInput key={field.key} config={field} value={formData[field.key] || ''} onChange={v => updateField(field.key, v)} submitted={submitted} />
                  ))}
                </div>
              </div>
            )}

            {isPrintStep && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <ImageIcon className="h-5 w-5 text-[#3e2f2b]" />
                  <h2 className="text-lg text-[#29201e]">Prints do contrato</h2>
                </div>

                {printSlots ? (
                  <>
                    <p className="text-sm text-[#6e5e5a]">
                      Este modelo tem {printSlots.length} espaço{printSlots.length > 1 ? 's' : ''} de print
                      identificado{printSlots.length > 1 ? 's' : ''}. Cada um vai exatamente no lugar
                      correspondente do documento. Opcional — pode gerar sem preencher algum.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {printSlots.map((slot, i) => {
                        const file = printsPorSlot[i];
                        return (
                          <div key={i} className="p-3 rounded-xl border border-[#efebe4] space-y-2">
                            <p className="text-xs font-semibold text-[#29201e] truncate" title={slot.label}>{i + 1}. {slot.label}</p>
                            {file ? (
                              <div className="relative">
                                <button className="absolute top-1 right-1 h-6 w-6 rounded-lg bg-white/80 flex items-center justify-center hover:bg-white"
                                  onClick={() => setPrintsPorSlot(prev => ({ ...prev, [i]: null }))}>
                                  <X className="h-3.5 w-3.5" />
                                </button>
                                <img src={URL.createObjectURL(file)} alt={slot.label} className="h-28 w-full object-contain rounded-lg border border-[#efebe4] bg-[#f9f6f0]" />
                                <p className="text-[11px] text-[#6e5e5a] truncate mt-1">{file.name}</p>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-lg border-2 border-dashed border-[#efebe4] hover:border-[#c5a47e] hover:bg-[#f5efe6] transition-colors cursor-pointer">
                                <Upload className="h-5 w-5 text-[#6e5e5a]" />
                                <span className="text-xs font-medium text-[#29201e]">Anexar print</span>
                                <input type="file" accept="image/png,image/jpeg" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) setPrintsPorSlot(prev => ({ ...prev, [i]: f })); e.target.value = ''; }} />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[#6e5e5a]">
                      Anexe o(s) print(s) do contrato do cliente (CET / proposta). O primeiro entra no
                      lugar da imagem de exemplo do modelo; os demais são adicionados ao final do
                      documento. Opcional — pode gerar sem.
                    </p>
                    {printFiles.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {printFiles.map((f, i) => (
                          <div key={i} className="relative p-3 rounded-xl border border-[#c5a47e]/40 bg-[#f5efe6]">
                            <span className="absolute top-2 left-2 h-5 w-5 rounded-full bg-[#3e2f2b] text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                            <button className="absolute top-1 right-1 h-6 w-6 rounded-lg flex items-center justify-center hover:bg-white/60" onClick={() => setPrintFiles(prev => prev.filter((_, idx) => idx !== i))}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <img src={URL.createObjectURL(f)} alt={`Print ${i + 1}`} className="h-28 w-full object-contain rounded-lg border border-[#efebe4] bg-white mt-3" />
                            <p className="text-xs font-medium text-[#29201e] truncate mt-2">{f.name}</p>
                            <p className="text-[11px] text-[#6e5e5a]">{(f.size / 1024).toFixed(0)} KB</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="flex flex-col items-center justify-center gap-1.5 p-6 rounded-xl border-2 border-dashed border-[#efebe4] hover:border-[#c5a47e] hover:bg-[#f5efe6] transition-colors cursor-pointer">
                      <Upload className="h-6 w-6 text-[#6e5e5a]" />
                      <span className="text-sm font-medium text-[#29201e]">Clique para anexar print(s)</span>
                      <input type="file" accept="image/png,image/jpeg" multiple className="hidden"
                        onChange={e => { const files = Array.from(e.target.files || []); if (files.length) setPrintFiles(prev => [...prev, ...files]); e.target.value = ''; }} />
                    </label>
                  </>
                )}
              </div>
            )}

            {isReviewStep && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#3e2f2b]" />
                  <h2 className="text-lg text-[#29201e]">Revisão e Geração da Petição Inicial</h2>
                </div>
                <div className="rounded-xl bg-[#f5efe6] border border-[#efebe4] p-5 space-y-2">
                  <p className="text-sm font-semibold text-[#29201e]">Instruções de Finalização</p>
                  <p className="text-[13px] text-[#6e5e5a] leading-relaxed">
                    Confira os dados preenchidos nas etapas anteriores. Use <b>Pré-visualizar</b> pra ver
                    como a petição fica antes de gerar, ou <b>Gerar Petição</b> pra concluir e baixar o
                    arquivo final.
                  </p>
                </div>
                {(resumoCliente || resumoReu || resumoValor) && (
                  <div className="flex gap-4 flex-wrap">
                    {resumoCliente && (
                      <div className="flex-1 min-w-[180px] border border-[#efebe4] rounded-xl p-4">
                        <p className="text-xs font-semibold text-[#6e5e5a] uppercase tracking-wide">Cliente</p>
                        <p className="text-sm font-semibold text-[#29201e] mt-1">{resumoCliente}</p>
                        {resumoClienteSub && <p className="text-[13px] text-[#6e5e5a] mt-0.5">{resumoClienteSub}</p>}
                      </div>
                    )}
                    {resumoReu && (
                      <div className="flex-1 min-w-[180px] border border-[#efebe4] rounded-xl p-4">
                        <p className="text-xs font-semibold text-[#6e5e5a] uppercase tracking-wide">Réu / Banco</p>
                        <p className="text-sm font-semibold text-[#29201e] mt-1">{resumoReu}</p>
                        {resumoReuSub && <p className="text-[13px] text-[#6e5e5a] mt-0.5">{resumoReuSub}</p>}
                      </div>
                    )}
                    {resumoValor && (
                      <div className="flex-1 min-w-[180px] border border-[#efebe4] rounded-xl p-4">
                        <p className="text-xs font-semibold text-[#6e5e5a] uppercase tracking-wide">Valor</p>
                        <p className="text-sm font-semibold text-[#29201e] mt-1">R$ {resumoValor}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border-t border-[#efebe4] px-6 sm:px-10 py-5 flex items-center justify-between gap-3 shrink-0">
          <button onClick={goPrev} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#efebe4] text-sm font-semibold text-[#29201e] hover:bg-[#f5efe6] transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="flex items-center gap-3">
            <button onClick={handleSaveDraft} disabled={saving} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#c5a47e] text-sm font-semibold text-[#3e2f2b] hover:bg-[#f5efe6] transition-colors disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar Rascunho
            </button>
            {isReviewStep ? (
              <>
                <button onClick={handlePreview} disabled={previewLoading} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#3e2f2b] text-sm font-semibold text-[#3e2f2b] hover:bg-[#f5efe6] transition-colors disabled:opacity-60">
                  {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Pré-visualizar
                </button>
                <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#3e2f2b] hover:bg-[#2d211d] text-white text-sm font-semibold transition-colors disabled:opacity-60">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar Petição
                </button>
              </>
            ) : (
              <button onClick={goNext} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#3e2f2b] hover:bg-[#2d211d] text-white text-sm font-semibold transition-colors">
                Próximo <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={(o) => { setPreviewOpen(o); if (!o && previewPdfUrl) { URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null); } }}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 rounded-2xl">
          <DialogHeader className="px-5 pt-4 pb-3 border-b border-[#efebe4]">
            <DialogTitle className="text-base text-[#29201e]">Pré-visualização</DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-[#f9f6f0]">
            {previewLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-[#6e5e5a]">
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando pré-visualização...
              </div>
            ) : previewPdfUrl ? (
              <iframe src={previewPdfUrl} title="Pré-visualização da petição" className="w-full h-full border-0" />
            ) : (
              <div className="flex items-center justify-center h-full text-[#6e5e5a] text-sm">
                Não foi possível carregar a pré-visualização.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
