import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sparkles, Loader2, ArrowRight, ArrowLeft, User, FileText, 
  Wand2, CheckCircle2, Download, AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TipTapEditor } from './TipTapEditor';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

interface PetitionGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: { name: string; path: string }[];
}

interface ClientData {
  nome: string;
  cpf: string;
  rg: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  estado_civil: string;
  profissao: string;
  nacionalidade: string;
  email: string;
  telefone: string;
}

const EMPTY_CLIENT: ClientData = {
  nome: '', cpf: '', rg: '', endereco: '', cidade: '', uf: '', cep: '',
  estado_civil: '', profissao: '', nacionalidade: 'brasileiro(a)', email: '', telefone: '',
};

const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];

type Step = 'form' | 'ai' | 'editor' | 'export';

export function PetitionGeneratorModal({ open, onOpenChange, templates }: PetitionGeneratorModalProps) {
  const [step, setStep] = useState<Step>('form');
  const [client, setClient] = useState<ClientData>({ ...EMPTY_CLIENT });
  const [resumoCaso, setResumoCaso] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiContent, setAiContent] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'form', label: 'Dados', icon: <User className="h-4 w-4" /> },
    { key: 'ai', label: 'IA', icon: <Wand2 className="h-4 w-4" /> },
    { key: 'editor', label: 'Revisão', icon: <FileText className="h-4 w-4" /> },
    { key: 'export', label: 'Exportar', icon: <Download className="h-4 w-4" /> },
  ];
  const currentStepIndex = steps.findIndex(s => s.key === step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleField = (field: keyof ClientData, value: string) => {
    setClient(prev => ({ ...prev, [field]: value }));
  };

  const canProceedToAI = client.nome.trim() && resumoCaso.trim().length >= 20 && selectedTemplate;

  const handleGenerateAI = async () => {
    setStep('ai');
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('petition-rewrite', {
        body: { resumo: resumoCaso, tipo_acao: selectedTemplate },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      const text = data.fatos_juridicos || '';
      setAiContent(text);
      // Convert plain text to HTML paragraphs for editor
      const htmlContent = text
        .split('\n\n')
        .filter((p: string) => p.trim())
        .map((p: string) => `<p>${p.trim()}</p>`)
        .join('');
      setEditorContent(htmlContent);
      setStep('editor');
    } catch (err: any) {
      console.error('AI error:', err);
      toast({
        title: 'Erro na geração com IA',
        description: err.message || 'Não foi possível processar o resumo.',
        variant: 'destructive',
      });
      setStep('form');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportDocx = async () => {
    if (!selectedTemplate) return;
    setExporting(true);
    setStep('export');

    try {
      // Find template path
      const tpl = templates.find(t => t.name === selectedTemplate);
      if (!tpl) throw new Error('Template não encontrado');

      // Download template from public/templates
      const response = await fetch(tpl.path);
      if (!response.ok) throw new Error('Erro ao baixar o template');
      const arrayBuffer = await response.arrayBuffer();

      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{{', end: '}}' },
      });

      // Strip HTML tags for plain text insertion into DOCX
      const plainText = editorContent
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      doc.render({
        nome: client.nome,
        cpf: client.cpf,
        rg: client.rg,
        endereco: client.endereco,
        cidade: client.cidade,
        uf: client.uf,
        cep: client.cep,
        estado_civil: client.estado_civil,
        profissao: client.profissao,
        nacionalidade: client.nacionalidade,
        email: client.email,
        telefone: client.telefone,
        fatos_juridicos: plainText,
        data_atual: new Date().toLocaleDateString('pt-BR', {
          day: 'numeric', month: 'long', year: 'numeric',
        }),
      });

      const out = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const filename = `Peticao_${client.nome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
      saveAs(out, filename);

      toast({ title: 'Petição exportada!', description: `Arquivo ${filename} salvo com sucesso.` });
    } catch (err: any) {
      console.error('Export error:', err);
      toast({
        title: 'Erro na exportação',
        description: err.message || 'Não foi possível gerar o documento.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleReset = () => {
    setStep('form');
    setClient({ ...EMPTY_CLIENT });
    setResumoCaso('');
    setSelectedTemplate('');
    setAiContent('');
    setEditorContent('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header with progress */}
        <div className="border-b border-border/50 bg-card">
          <DialogHeader className="px-6 pt-6 pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Gerador de Petições com IA
            </DialogTitle>
            <DialogDescription>
              Preencha os dados, gere os fatos com IA, revise e exporte o documento final
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 mb-3">
              {steps.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    i <= currentStepIndex
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted/50 text-muted-foreground'
                  }`}>
                    {i < currentStepIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.icon}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                  )}
                </div>
              ))}
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        </div>

        <ScrollArea className="flex-1 max-h-[calc(90vh-200px)]">
          {/* STEP 1: Form */}
          {step === 'form' && (
            <div className="p-6 space-y-6">
              {/* Template selection */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Modelo de Petição *</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione o modelo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Client qualification */}
              <div>
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Qualificação do Cliente
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-muted-foreground">Nome Completo *</Label>
                    <Input value={client.nome} onChange={e => handleField('nome', e.target.value)} 
                      className="rounded-xl mt-1" placeholder="Nome completo do cliente" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">CPF</Label>
                    <Input value={client.cpf} onChange={e => handleField('cpf', e.target.value)}
                      className="rounded-xl mt-1" placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">RG</Label>
                    <Input value={client.rg} onChange={e => handleField('rg', e.target.value)}
                      className="rounded-xl mt-1" placeholder="0000000" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Nacionalidade</Label>
                    <Input value={client.nacionalidade} onChange={e => handleField('nacionalidade', e.target.value)}
                      className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Estado Civil</Label>
                    <Select value={client.estado_civil} onValueChange={v => handleField('estado_civil', v)}>
                      <SelectTrigger className="rounded-xl mt-1">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_CIVIS.map(ec => <SelectItem key={ec} value={ec}>{ec}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Profissão</Label>
                    <Input value={client.profissao} onChange={e => handleField('profissao', e.target.value)}
                      className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Endereço</Label>
                    <Input value={client.endereco} onChange={e => handleField('endereco', e.target.value)}
                      className="rounded-xl mt-1" placeholder="Rua, número, bairro" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Cidade</Label>
                    <Input value={client.cidade} onChange={e => handleField('cidade', e.target.value)}
                      className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">UF</Label>
                    <Input value={client.uf} onChange={e => handleField('uf', e.target.value)}
                      className="rounded-xl mt-1" placeholder="MA" maxLength={2} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">CEP</Label>
                    <Input value={client.cep} onChange={e => handleField('cep', e.target.value)}
                      className="rounded-xl mt-1" placeholder="00000-000" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Telefone</Label>
                    <Input value={client.telefone} onChange={e => handleField('telefone', e.target.value)}
                      className="rounded-xl mt-1" placeholder="(00) 00000-0000" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Case summary */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Resumo do Caso *
                </Label>
                <p className="text-xs text-muted-foreground">
                  Descreva os fatos de forma simples. A IA irá reescrever em linguagem jurídica formal.
                </p>
                <Textarea
                  value={resumoCaso}
                  onChange={e => setResumoCaso(e.target.value)}
                  className="rounded-xl min-h-[160px] text-sm"
                  placeholder="Ex: O cliente contratou um empréstimo consignado junto ao banco X em janeiro de 2024. Porém, notou que foram cobradas tarifas que não foram informadas no momento da contratação. Ao tentar resolver na agência, foi ignorado..."
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {resumoCaso.length} caracteres {resumoCaso.length < 20 && resumoCaso.length > 0 && '(mínimo 20)'}
                  </span>
                  {resumoCaso.length >= 20 && (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Pronto
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: AI Processing */}
          {step === 'ai' && aiLoading && (
            <div className="p-12 flex flex-col items-center justify-center gap-6">
              <div className="relative">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                </div>
                <Loader2 className="h-6 w-6 text-primary animate-spin absolute -top-2 -right-2" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg text-foreground">A IA está redigindo os fatos...</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Transformando o resumo em linguagem jurídica formal e persuasiva, 
                  adequada para a seção "Dos Fatos" da petição inicial.
                </p>
              </div>
              <div className="w-64">
                <Progress value={65} className="h-2 animate-pulse" />
              </div>
            </div>
          )}

          {/* STEP 3: TipTap Editor */}
          {step === 'editor' && (
            <div className="flex flex-col h-[calc(90vh-260px)]">
              <div className="px-6 py-3 bg-muted/30 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-emerald-600 border-emerald-300 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Gerado pela IA
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Revise e edite o texto antes de exportar
                  </span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <TipTapEditor
                  content={editorContent}
                  onChange={setEditorContent}
                />
              </div>
            </div>
          )}

          {/* STEP 4: Export complete */}
          {step === 'export' && (
            <div className="p-12 flex flex-col items-center justify-center gap-6">
              {exporting ? (
                <>
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-lg">Gerando documento...</h3>
                    <p className="text-sm text-muted-foreground">
                      Aplicando os dados no template e gerando o ficheiro .docx
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-20 w-20 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-lg">Petição exportada com sucesso!</h3>
                    <p className="text-sm text-muted-foreground">
                      O ficheiro .docx foi salvo na sua máquina com o papel timbrado preservado.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleReset} className="rounded-xl gap-2">
                      <ArrowLeft className="h-4 w-4" />
                      Nova Petição
                    </Button>
                    <Button onClick={() => onOpenChange(false)} className="rounded-xl">
                      Fechar
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer actions */}
        {(step === 'form' || step === 'editor') && (
          <div className="border-t border-border/50 p-4 flex items-center justify-between bg-card">
            {step === 'form' && (
              <>
                <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
                  Cancelar
                </Button>
                <Button
                  onClick={handleGenerateAI}
                  disabled={!canProceedToAI}
                  className="rounded-xl gap-2 bg-primary hover:bg-primary/90"
                >
                  <Sparkles className="h-4 w-4" />
                  Gerar Rascunho com IA
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {step === 'editor' && (
              <>
                <Button variant="ghost" onClick={() => setStep('form')} className="rounded-xl gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao Formulário
                </Button>
                <Button
                  onClick={handleExportDocx}
                  className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Download className="h-4 w-4" />
                  Exportar Petição Final (.docx)
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
