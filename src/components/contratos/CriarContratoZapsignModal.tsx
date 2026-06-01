import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { validateCPF } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Zap, Loader2, AlertCircle, Send, User, Mail, Phone, CreditCard,
  Calendar, ChevronDown, ChevronUp, Package, FileText, CheckCircle2, MapPin,
} from 'lucide-react';
import {
  TEMPLATES_DISPONIVEIS,
  ENVELOPE_PRESETS,
  getTemplateInfo,
  getTemplatePdfUrl,
  type CampoTemplate,
} from '@/integrations/zapsign/templateFields';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  leadId?: string;
  leadNome?: string;
  leadEmail?: string;
  leadPhone?: string;
  leadCpf?: string;
}

type Modo = 'template' | 'envelope';

export function CriarContratoZapsignModal({
  isOpen, onClose, onSuccess,
  leadId, leadNome = '', leadEmail = '', leadPhone = '', leadCpf = '',
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<Modo>('template');

  // Template único
  const [templateKey, setTemplateKey] = useState('');

  // Envelope
  const [envelopePreset, setEnvelopePreset] = useState('');
  const [customTemplates, setCustomTemplates] = useState<string[]>([]);
  const [showCustom, setShowCustom] = useState(false);

  // Campos dinâmicos
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [enviarAosCriar, setEnviarAosCriar] = useState(true);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Templates a usar (template único ou lista do envelope)
  const templatesAtivos = useMemo(() => {
    if (modo === 'template') return templateKey ? [templateKey] : [];
    if (envelopePreset) {
      const preset = ENVELOPE_PRESETS.find(p => p.id === envelopePreset);
      return preset?.templates || [];
    }
    return customTemplates;
  }, [modo, templateKey, envelopePreset, customTemplates]);

  // Campos necessários (união de todos os templates selecionados)
  const camposNecessarios = useMemo(() => {
    const todosIds = new Set<string>();
    const resultado: CampoTemplate[] = [];
    for (const key of templatesAtivos) {
      const info = getTemplateInfo(key);
      if (!info) continue;
      for (const campo of info.campos) {
        if (!todosIds.has(campo.id)) {
          todosIds.add(campo.id);
          resultado.push(campo);
        }
      }
    }
    return resultado;
  }, [templatesAtivos]);

  // Pré-preencher campos do lead
  useEffect(() => {
    if (!isOpen) return;
    setCampos(prev => ({
      ...prev,
      nome_completo: leadNome || '',
      cpf: leadCpf || '',
      telefone_contato: leadPhone || '',
    }));
  }, [isOpen, leadNome, leadEmail, leadPhone, leadCpf]);

  // Preencher defaults ao trocar de template
  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const campo of camposNecessarios) {
      if (campo.default && !campos[campo.id]) {
        defaults[campo.id] = campo.default;
      }
    }
    if (Object.keys(defaults).length > 0) {
      setCampos(prev => ({ ...defaults, ...prev }));
    }
  }, [camposNecessarios]);

  const updateCampo = (id: string, value: string) => {
    setCampos(prev => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors(prev => { const e = { ...prev }; delete e[id]; return e; });
    // Buscar CEP automaticamente quando tiver 8 dígitos
    if (id === 'cep') {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 8) buscarCep(digits);
    }
  };

  const buscarCep = async (cep: string) => {
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setCampos(prev => ({
          ...prev,
          endereco:   data.logradouro || prev.endereco,
          bairro:     data.bairro     || prev.bairro,
          cidade_uf:  data.localidade ? `${data.localidade}/${data.uf}` : prev.cidade_uf,
        }));
      }
    } catch { /* silencia erros de CEP */ } finally {
      setBuscandoCep(false);
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (templatesAtivos.length === 0) { toast({ title: 'Selecione pelo menos um template', variant: 'destructive' }); return false; }
    for (const campo of camposNecessarios) {
      if (campo.obrigatorio && !campos[campo.id]?.trim()) {
        errs[campo.id] = `${campo.label} é obrigatório`;
      }
      if (campo.tipo === 'cpf' && campos[campo.id] && !validateCPF(campos[campo.id])) {
        errs[campo.id] = 'CPF inválido';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const signers = [{
        name:  campos.nome_completo,
        email: leadEmail || undefined,
        phone: campos.telefone_contato || leadPhone || undefined,
        cpf:   campos.cpf?.replace(/\D/g, '') || undefined,
      }];

      // Preparar documentos com URLs dos PDFs
      const docsGerados = templatesAtivos.map(key => {
        const info = getTemplateInfo(key);
        const pdfUrl = getTemplatePdfUrl(key);
        return {
          name: `${info?.nome || key} - ${campos.nome_completo}`,
          file_url: pdfUrl,
        };
      });

      let documentResponse: any;
      const action = docsGerados.length > 1 ? 'create_envelope' : 'create_document';

      const invokeBody = docsGerados.length === 1
        ? { action, name: docsGerados[0].name, file_url: docsGerados[0].file_url, signers, expires_in_days: parseInt(expiresInDays) }
        : { action: 'create_envelope', docs: docsGerados, signers, expires_in_days: parseInt(expiresInDays) };

      const { data, error } = await supabase.functions.invoke('zapsign', { body: invokeBody });

      if (error) throw new Error(error.message || JSON.stringify(error));
      if (data?.error) throw new Error(data.error.message || JSON.stringify(data.error));
      documentResponse = data;

      // Envelope: salvar apenas o doc principal com link único
      const envelopeDocs: any[] = documentResponse.envelope_docs || [documentResponse];
      const mainDoc = envelopeDocs[0];
      const envelopeId = envelopeDocs.length > 1 ? crypto.randomUUID() : null;

      // Salvar doc principal com o link de assinatura
      await supabase.from('contract_reminders_zapsign').insert({
        document_id:   mainDoc.id,
        document_name: envelopeDocs.length > 1
          ? `Envelope (${envelopeDocs.length} docs) - ${campos.nome_completo}`
          : mainDoc.name,
        lead_id:       leadId || null,
        signer_name:   campos.nome_completo,
        signer_email:  leadEmail || null,
        signer_phone:  campos.telefone_contato || leadPhone || null,
        signer_cpf:    campos.cpf?.replace(/\D/g, '') || null,
        status:        'pending',
        background_check_status: 'pending',
        contract_link: mainDoc.signers?.[0]?.sign_url || mainDoc.id,
        sent_at:       enviarAosCriar ? new Date().toISOString() : null,
        metadata:      envelopeDocs.length > 1 ? { envelope_docs: envelopeDocs.map((d: any) => ({ id: d.id, name: d.name, sign_url: d.signers?.[0]?.sign_url })) } : {},
      } as any);

      const totalDocs = envelopeDocs.length;
      toast({
        title: totalDocs > 1
          ? `✅ Envelope criado! ${totalDocs} documentos`
          : '✅ Contrato criado!',
        description: totalDocs > 1
          ? `1 link com ${totalDocs} documentos enviado para ${campos.nome_completo}`
          : `Link de assinatura enviado para ${campos.nome_completo}`,
      });

      onSuccess?.();
      onClose();
      resetForm();
    } catch (err: any) {
      toast({ title: 'Erro ao criar contrato', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTemplateKey('');
    setEnvelopePreset('');
    setCustomTemplates([]);
    setCampos({});
    setErrors({});
    setModo('template');
    setShowCustom(false);
  };

  const toggleCustomTemplate = (key: string) => {
    setCustomTemplates(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Agrupar campos por categoria
  const camposPessoais  = camposNecessarios.filter(c => ['nome_completo','cpf','rg','orgao_rg','nacionalidade','estado_civil','profissao'].includes(c.id));
  const camposEndereco  = camposNecessarios.filter(c => ['endereco','numero_end','bairro','cidade_uf','cep'].includes(c.id));
  const camposEspecificos = camposNecessarios.filter(c => !camposPessoais.find(p => p.id === c.id) && !camposEndereco.find(p => p.id === c.id));

  const FieldError = ({ id }: { id: string }) => errors[id]
    ? <p className="flex items-center gap-1 text-xs text-red-500 mt-1"><AlertCircle className="h-3 w-3" /> {errors[id]}</p>
    : null;

  const renderCampo = (campo: CampoTemplate) => {
    const val = campos[campo.id] || '';
    const baseClass = cn('h-9 text-sm', errors[campo.id] && 'border-red-500');

    if (campo.tipo === 'area') {
      return (
        <Textarea
          value={val}
          onChange={e => updateCampo(campo.id, e.target.value)}
          placeholder={campo.placeholder}
          disabled={loading}
          className={cn('text-sm resize-none', errors[campo.id] && 'border-red-500')}
          rows={2}
        />
      );
    }

    return (
      <Input
        value={val}
        onChange={e => updateCampo(campo.id, campo.tipo === 'cpf' ? e.target.value.replace(/\D/g, '').slice(0, 11) : e.target.value)}
        placeholder={campo.placeholder || campo.default}
        disabled={loading}
        className={cn(baseClass, campo.tipo === 'cpf' && 'font-mono tracking-wider')}
        maxLength={campo.tipo === 'cpf' ? 11 : undefined}
      />
    );
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{children}</p>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-cyan-100 dark:bg-cyan-950/40 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Criar Contrato Zapsign</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Gere e envie documentos para assinatura digital</p>
            </div>
          </div>

          {/* Seletor modo */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 mt-4 w-fit">
            <button
              type="button"
              onClick={() => { setModo('template'); setEnvelopePreset(''); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                modo === 'template' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <FileText className="h-3.5 w-3.5" /> Documento único
            </button>
            <button
              type="button"
              onClick={() => { setModo('envelope'); setTemplateKey(''); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                modo === 'envelope' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Package className="h-3.5 w-3.5" /> Envelope
              <Badge className="text-[10px] bg-cyan-100 text-cyan-700 border-0 ml-0.5">Novo</Badge>
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* ── SELEÇÃO TEMPLATE / ENVELOPE ── */}
            {modo === 'template' ? (
              <div className="space-y-2">
                <SectionTitle>Modelo de Documento</SectionTitle>
                <div className="grid grid-cols-1 gap-2">
                  {TEMPLATES_DISPONIVEIS.map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTemplateKey(t.key)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all text-sm',
                        templateKey === t.key
                          ? 'border-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/20 text-cyan-700'
                          : 'border-border hover:border-cyan-200 hover:bg-muted/40'
                      )}
                    >
                      <FileText className={cn('h-4 w-4 shrink-0', templateKey === t.key ? 'text-cyan-600' : 'text-muted-foreground')} />
                      <span className="flex-1 font-medium">{t.nome}</span>
                      {templateKey === t.key && <CheckCircle2 className="h-4 w-4 text-cyan-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <SectionTitle>Envelope (múltiplos documentos — 1 link)</SectionTitle>

                {/* Presets */}
                <div className="grid grid-cols-1 gap-2">
                  {ENVELOPE_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => { setEnvelopePreset(preset.id); setShowCustom(false); setCustomTemplates([]); }}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                        envelopePreset === preset.id
                          ? 'border-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/20'
                          : 'border-border hover:border-cyan-200 hover:bg-muted/40'
                      )}
                    >
                      <Package className={cn('h-4 w-4 shrink-0 mt-0.5', envelopePreset === preset.id ? 'text-cyan-600' : 'text-muted-foreground')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium', envelopePreset === preset.id && 'text-cyan-700')}>{preset.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{preset.descricao}</p>
                      </div>
                      {envelopePreset === preset.id && <CheckCircle2 className="h-4 w-4 text-cyan-600 shrink-0 mt-0.5" />}
                    </button>
                  ))}
                </div>

                {/* Personalizado */}
                <button
                  type="button"
                  onClick={() => { setShowCustom(v => !v); setEnvelopePreset(''); }}
                  className={cn(
                    'flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border text-sm transition-all',
                    showCustom ? 'border-cyan-300 bg-cyan-50/30' : 'border-dashed border-border hover:border-cyan-200'
                  )}
                >
                  {showCustom ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Personalizar seleção
                </button>

                {showCustom && (
                  <div className="grid grid-cols-1 gap-2 pl-2">
                    {TEMPLATES_DISPONIVEIS.map(t => (
                      <label key={t.key} className="flex items-center gap-3 cursor-pointer px-3 py-2 rounded-lg hover:bg-muted/40">
                        <input
                          type="checkbox"
                          checked={customTemplates.includes(t.key)}
                          onChange={() => toggleCustomTemplate(t.key)}
                          className="h-4 w-4 rounded accent-cyan-600"
                        />
                        <span className="text-sm">{t.nome}</span>
                      </label>
                    ))}
                  </div>
                )}

                {templatesAtivos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {templatesAtivos.map(key => {
                      const info = getTemplateInfo(key);
                      return (
                        <Badge key={key} variant="outline" className="text-xs bg-cyan-50 text-cyan-700 border-cyan-200 gap-1">
                          <FileText className="h-3 w-3" />
                          {info?.nome.split(' ').slice(0, 3).join(' ')}...
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── CAMPOS DINÂMICOS ── */}
            {camposNecessarios.length > 0 && (
              <>
                <div className="border-t border-dashed border-border" />

                {/* Dados pessoais */}
                {camposPessoais.length > 0 && (
                  <div className="space-y-3">
                    <SectionTitle>Dados do Cliente</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      {camposPessoais.map(campo => (
                        <div key={campo.id} className={cn('space-y-1', ['nome_completo','profissao','estado_civil'].includes(campo.id) && 'col-span-2')}>
                          <Label className="text-xs font-medium flex items-center gap-1">
                            {campo.id === 'nome_completo' && <User className="h-3 w-3 text-muted-foreground" />}
                            {campo.id === 'cpf' && <CreditCard className="h-3 w-3 text-muted-foreground" />}
                            {campo.label}
                            {campo.obrigatorio && <span className="text-red-500">*</span>}
                            {campo.origem === 'lead' && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 border-green-200 text-green-700 bg-green-50 ml-auto">auto</Badge>
                            )}
                          </Label>
                          {renderCampo(campo)}
                          <FieldError id={campo.id} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Endereço */}
                {camposEndereco.length > 0 && (
                  <div className="space-y-3">
                    <SectionTitle>Endereço</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      {camposEndereco.map(campo => (
                        <div key={campo.id} className={cn('space-y-1', ['endereco'].includes(campo.id) && 'col-span-2')}>
                          <Label className="text-xs font-medium flex items-center gap-1">
                            {campo.id === 'cep' && <MapPin className="h-3 w-3 text-muted-foreground" />}
                            {campo.label}
                            {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                            {campo.id === 'cep' && buscandoCep && (
                              <span className="ml-auto text-cyan-600 flex items-center gap-1 text-[10px]">
                                <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                              </span>
                            )}
                            {campo.id === 'cep' && !buscandoCep && campos.cep?.replace(/\D/g, '').length === 8 && campos.endereco && (
                              <span className="ml-auto text-emerald-600 flex items-center gap-1 text-[10px]">
                                <CheckCircle2 className="h-3 w-3" /> Endereço encontrado
                              </span>
                            )}
                          </Label>
                          {renderCampo(campo)}
                          <FieldError id={campo.id} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Campos específicos do caso */}
                {camposEspecificos.length > 0 && (
                  <div className="space-y-3">
                    <SectionTitle>Dados do Processo</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      {camposEspecificos.map(campo => (
                        <div key={campo.id} className={cn('space-y-1', ['reu','numeros_contratos'].includes(campo.id) && 'col-span-2')}>
                          <Label className="text-xs font-medium flex items-center gap-1">
                            {campo.id === 'telefone_contato' && <Phone className="h-3 w-3 text-muted-foreground" />}
                            {campo.label}
                            {campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
                          </Label>
                          {renderCampo(campo)}
                          <FieldError id={campo.id} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Config */}
                <div className="border-t border-dashed border-border pt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        Prazo para assinatura
                      </Label>
                      <div className="flex gap-2">
                        {['1','3','7','14','30'].map(d => (
                          <button
                            key={d} type="button"
                            onClick={() => setExpiresInDays(d)}
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-xs border transition-all',
                              expiresInDays === d
                                ? 'bg-cyan-600 text-white border-cyan-600'
                                : 'border-border text-muted-foreground hover:border-cyan-300'
                            )}
                          >
                            {d}d
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <label className={cn(
                    'flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl border transition-colors',
                    enviarAosCriar
                      ? 'border-cyan-300 bg-cyan-50/50 dark:bg-cyan-950/20 dark:border-cyan-800'
                      : 'border-border bg-muted/20'
                  )}>
                    <input
                      type="checkbox"
                      checked={enviarAosCriar}
                      onChange={e => setEnviarAosCriar(e.target.checked)}
                      disabled={loading}
                      className="h-4 w-4 rounded accent-cyan-600"
                    />
                    <div>
                      <p className="text-sm font-medium">Enviar para assinatura ao criar</p>
                      <p className="text-xs text-muted-foreground">O cliente receberá um email com o link</p>
                    </div>
                    <Send className={cn('h-4 w-4 ml-auto shrink-0', enviarAosCriar ? 'text-cyan-600' : 'text-muted-foreground')} />
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-4 border-t bg-muted/20 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              <span className="text-red-500">*</span> Campos obrigatórios
              {templatesAtivos.length > 0 && (
                <span className="ml-2 text-cyan-600 font-medium">
                  {templatesAtivos.length} documento{templatesAtivos.length > 1 ? 's' : ''}
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading} size="sm">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || templatesAtivos.length === 0}
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700 text-white min-w-[130px]"
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</>
                  : modo === 'envelope'
                    ? <><Package className="h-4 w-4 mr-2" /> Criar Envelope</>
                    : <><Send className="h-4 w-4 mr-2" /> {enviarAosCriar ? 'Criar e Enviar' : 'Criar'}</>
                }
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
