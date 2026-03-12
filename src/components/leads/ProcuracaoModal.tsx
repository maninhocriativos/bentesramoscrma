import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  FileText, Download, Save, Eye, Loader2, Sparkles, Pencil, Printer,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignJustify,
  Heading1, Heading2, Type, List, ListOrdered, Minus, Undo2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOfficeSettings } from '@/hooks/useOfficeSettings';
import { useAuth } from '@/hooks/useAuth';
import { generateProcuracaoHtml, ProcuracaoData, OfficeData } from '@/lib/procuracaoTemplate';
import { ESTADOS_CIVIS } from '@/types/peticoes';
import { cn } from '@/lib/utils';

interface ProcuracaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    nome: string;
    telefone?: string | null;
    email?: string | null;
    tipo_acao?: string | null;
  };
  onSuccess?: () => void;
}

const NACIONALIDADES = ['brasileiro(a)', 'estrangeiro(a)'];

function EditorToolbarButton({
  icon: Icon, label, onClick, active,
}: { icon: React.ElementType; label: string; onClick: () => void; active?: boolean }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
            className={cn(
              "h-7 w-7 flex items-center justify-center rounded transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground shadow-sm"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ProcuracaoModal({ open, onOpenChange, lead, onSuccess }: ProcuracaoModalProps) {
  const { toast } = useToast();
  const { settings } = useOfficeSettings();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dados');
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // The editable HTML content (separate from the form-generated one)
  const [editableHtml, setEditableHtml] = useState('');
  const [htmlInitialized, setHtmlInitialized] = useState(false);

  const [formData, setFormData] = useState<ProcuracaoData>({
    nome: lead.nome || '',
    nacionalidade: 'brasileiro(a)',
    estadoCivil: '',
    profissao: '',
    rg: '',
    cpf: '',
    endereco: '',
    numero: '',
    bairro: '',
    cep: '',
    cidade: 'Manaus',
    uf: 'AM',
    objetivo: lead.tipo_acao ? `ingressar com ação judicial referente a ${lead.tipo_acao}` : '',
  });

  useEffect(() => {
    if (open && lead.id) {
      fetchLeadData();
      setHtmlInitialized(false);
      setActiveTab('dados');
    }
  }, [open, lead.id]);

  const fetchLeadData = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('leads_juridicos')
        .select('nacionalidade, estado_civil, profissao, rg, cpf, endereco, numero, bairro, cep, cidade, uf, tipo_acao')
        .eq('id', lead.id)
        .single();

      if (data && !error) {
        setFormData(prev => ({
          ...prev,
          nome: lead.nome || '',
          nacionalidade: data.nacionalidade || 'brasileiro(a)',
          estadoCivil: data.estado_civil || '',
          profissao: data.profissao || '',
          rg: data.rg || '',
          cpf: data.cpf || '',
          endereco: data.endereco || '',
          numero: data.numero || '',
          bairro: data.bairro || '',
          cep: data.cep || '',
          cidade: data.cidade || 'Manaus',
          uf: data.uf || 'AM',
          objetivo: data.tipo_acao ? `ingressar com ação judicial referente a ${data.tipo_acao}` : prev.objetivo,
        }));
      }
    } catch (err) {
      console.error('Erro ao buscar dados do lead:', err);
    }
    setLoadingData(false);
  };

  const officeData: OfficeData = {
    officeName: settings?.office_name,
    oabNumber: settings?.oab_number,
    oabState: settings?.oab_state,
    address: settings?.address,
    city: settings?.city,
    state: settings?.state,
    zipCode: settings?.zip_code,
    email: settings?.email,
    phone: settings?.phone,
    website: settings?.website,
    lawyerName: settings?.lawyer_name,
    oabMain: settings?.oab_main,
    oabSecondary: settings?.oab_secondary,
  };

  // Generate HTML from form data
  const generateFromForm = useCallback(() => {
    const html = generateProcuracaoHtml(formData, officeData);
    // Strip the full HTML doc wrapper, extract just the body content for editing
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;
    setEditableHtml(bodyContent);
    setHtmlInitialized(true);
    setActiveTab('editor');
    toast({ title: 'Procuração gerada', description: 'Edite livremente o documento abaixo' });
  }, [formData, officeData, toast]);

  // Generate via ISA AI
  const generateWithISA = async () => {
    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'system',
              content: `Você é um assistente jurídico especializado em gerar procurações "Ad Judicia et Extra". 
Gere o HTML do corpo da procuração (sem tags html/head/body) seguindo rigorosamente o padrão jurídico brasileiro.
Use classes CSS: header, title, section, section-title, poderes, lgpd, antifraude, data-local, assinatura, assinatura-linha, assinatura-nome, footer, footer-line.
Inclua: cabeçalho com nome do escritório, qualificação completa do outorgante, outorgado com dados do escritório, poderes especiais completos, cláusula LGPD, cláusula antifraude, local/data, assinatura e rodapé.`,
            },
            {
              role: 'user',
              content: `Gere uma procuração "Ad Judicia et Extra" com os seguintes dados:

OUTORGANTE:
- Nome: ${formData.nome || 'NÃO INFORMADO'}
- Nacionalidade: ${formData.nacionalidade || 'brasileiro(a)'}
- Estado Civil: ${formData.estadoCivil || 'NÃO INFORMADO'}
- Profissão: ${formData.profissao || 'NÃO INFORMADO'}
- RG: ${formData.rg || 'NÃO INFORMADO'}
- CPF: ${formData.cpf || 'NÃO INFORMADO'}
- Endereço: ${formData.endereco || 'NÃO INFORMADO'}, nº ${formData.numero || 'S/N'}, Bairro: ${formData.bairro || 'NÃO INFORMADO'}, CEP: ${formData.cep || 'NÃO INFORMADO'}, ${formData.cidade || 'Manaus'}/${formData.uf || 'AM'}

ESCRITÓRIO (OUTORGADO):
- Nome: ${officeData.officeName || 'BENTES RAMOS SOCIEDADE INDIVIDUAL DE ADVOCACIA'}
- OAB: ${officeData.oabState || 'AM'} nº ${officeData.oabNumber || '115/2016'}
- CNPJ: ${officeData.cnpj || '29.516.950/0001-55'}
- Endereço: ${officeData.address || 'Rua Salvador, nº 120, sala 708, 7º andar'}
- Advogado: ${officeData.lawyerName || 'ANDREY AUGUSTO BENTES RAMOS'}, OAB/${officeData.oabState || 'AM'} nº ${officeData.oabMain || '7.526'}
- Email: ${officeData.email || 'juridico@bentesramos.adv.br'}
- Telefone: ${officeData.phone || '(92) 3343-6173'}

OBJETIVO: ${formData.objetivo || 'defesa de seus interesses em juízo ou fora dele'}

Gere o HTML completo da procuração com todas as cláusulas padrão incluindo LGPD e antifraude.`,
            },
          ],
        },
      });

      if (error) throw error;

      const aiContent = data?.choices?.[0]?.message?.content || data?.reply || data?.content || '';
      
      if (aiContent) {
        // Clean up - extract only the HTML content
        let cleanHtml = aiContent;
        // Remove markdown code blocks if present
        cleanHtml = cleanHtml.replace(/```html?\n?/g, '').replace(/```\n?/g, '');
        // If it has full HTML doc, extract body
        const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) cleanHtml = bodyMatch[1];

        setEditableHtml(cleanHtml);
        setHtmlInitialized(true);
        setActiveTab('editor');
        toast({ title: '✨ ISA gerou a procuração', description: 'Revise e edite conforme necessário' });
      } else {
        throw new Error('ISA não retornou conteúdo');
      }
    } catch (err: any) {
      console.error('Erro ao gerar com ISA:', err);
      toast({
        title: 'Erro na geração com ISA',
        description: 'Tente o modelo padrão ou tente novamente',
        variant: 'destructive',
      });
    }
    setGeneratingAI(false);
  };

  // Sync editor content
  useEffect(() => {
    if (activeTab === 'editor' && editorRef.current && htmlInitialized) {
      editorRef.current.innerHTML = editableHtml;
    }
  }, [activeTab, htmlInitialized]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setEditableHtml(editorRef.current.innerHTML);
    }
  }, []);

  // Build full HTML document for saving/printing
  const buildFullHtml = useCallback(() => {
    const baseTemplate = generateProcuracaoHtml(formData, officeData);
    // Replace body content with edited content
    const styleMatch = baseTemplate.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const styles = styleMatch ? styleMatch[0] : '';
    
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Procuração Ad Judicia et Extra - ${formData.nome}</title>
  ${styles}
</head>
<body>
  ${editableHtml}
</body>
</html>`;
  }, [editableHtml, formData, officeData]);

  // Preview
  useEffect(() => {
    if (activeTab === 'preview' && iframeRef.current && editableHtml) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(buildFullHtml());
        doc.close();
      }
    }
  }, [activeTab, editableHtml, buildFullHtml]);

  const handleSave = async () => {
    if (!editableHtml) {
      toast({ title: 'Gere a procuração primeiro', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await supabase
        .from('leads_juridicos')
        .update({
          nacionalidade: formData.nacionalidade,
          estado_civil: formData.estadoCivil,
          profissao: formData.profissao,
          rg: formData.rg,
          cpf: formData.cpf,
          endereco: formData.endereco,
          numero: formData.numero,
          bairro: formData.bairro,
          cep: formData.cep,
          cidade: formData.cidade,
          uf: formData.uf,
        })
        .eq('id', lead.id);

      const { error } = await supabase
        .from('procuracoes')
        .insert({
          lead_id: lead.id,
          html_content: buildFullHtml(),
          objetivo: formData.objetivo,
          created_by: user?.id,
        });

      if (error) throw error;

      toast({ title: '✅ Procuração salva com sucesso!' });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDownload = () => {
    const blob = new Blob([buildFullHtml()], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `procuracao-${lead.nome?.toLowerCase().replace(/\s+/g, '-') || 'cliente'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast({ title: 'Arquivo baixado!' });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(buildFullHtml());
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              Procuração — {lead.nome}
            </DialogTitle>
          </DialogHeader>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-2">
            <TabsList className="grid w-full grid-cols-3 h-10">
              <TabsTrigger value="dados" className="gap-2 text-xs">
                <FileText className="h-3.5 w-3.5" />
                Dados do Cliente
              </TabsTrigger>
              <TabsTrigger value="editor" className="gap-2 text-xs" disabled={!htmlInitialized}>
                <Pencil className="h-3.5 w-3.5" />
                Editor Visual
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2 text-xs" disabled={!htmlInitialized}>
                <Eye className="h-3.5 w-3.5" />
                Visualizar
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1 - DADOS */}
          <TabsContent value="dados" className="flex-1 min-h-0 mt-0 px-6">
            <ScrollArea className="h-[55vh] pr-4 pt-4">
              {loadingData ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Identificação */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      Identificação
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Label className="text-xs">Nome Completo *</Label>
                        <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Nome completo" />
                      </div>
                      <div>
                        <Label className="text-xs">Nacionalidade</Label>
                        <Select value={formData.nacionalidade} onValueChange={(v) => setFormData({ ...formData, nacionalidade: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{NACIONALIDADES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Estado Civil</Label>
                        <Select value={formData.estadoCivil} onValueChange={(v) => setFormData({ ...formData, estadoCivil: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>{ESTADOS_CIVIS.map(ec => <SelectItem key={ec} value={ec}>{ec}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Profissão</Label>
                        <Input value={formData.profissao} onChange={(e) => setFormData({ ...formData, profissao: e.target.value })} placeholder="Ex: Comerciante" />
                      </div>
                      <div>
                        <Label className="text-xs">RG</Label>
                        <Input value={formData.rg} onChange={(e) => setFormData({ ...formData, rg: e.target.value })} placeholder="0000000" />
                      </div>
                      <div>
                        <Label className="text-xs">CPF</Label>
                        <Input value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} placeholder="000.000.000-00" />
                      </div>
                    </div>
                  </div>

                  {/* Endereço */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      Endereço
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <Label className="text-xs">Logradouro</Label>
                        <Input value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} placeholder="Rua, Avenida..." />
                      </div>
                      <div>
                        <Label className="text-xs">Número</Label>
                        <Input value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} placeholder="Nº" />
                      </div>
                      <div>
                        <Label className="text-xs">Bairro</Label>
                        <Input value={formData.bairro} onChange={(e) => setFormData({ ...formData, bairro: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">CEP</Label>
                        <Input value={formData.cep} onChange={(e) => setFormData({ ...formData, cep: e.target.value })} placeholder="00000-000" />
                      </div>
                      <div>
                        <Label className="text-xs">Cidade</Label>
                        <Input value={formData.cidade} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">UF</Label>
                        <Input value={formData.uf} onChange={(e) => setFormData({ ...formData, uf: e.target.value })} maxLength={2} />
                      </div>
                    </div>
                  </div>

                  {/* Objetivo */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      Objetivo da Procuração
                    </h4>
                    <Textarea
                      value={formData.objetivo}
                      onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                      placeholder="Ex: ingressar com ação judicial referente a revisão de juros abusivos"
                      rows={3}
                    />
                  </div>

                  {/* Generation buttons */}
                  <div className="border-t pt-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Gerar Procuração</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={generateFromForm}
                        disabled={!formData.nome || generatingAI}
                        className="gap-2 h-12"
                        variant="outline"
                      >
                        <FileText className="h-4 w-4" />
                        <div className="text-left">
                          <div className="text-xs font-medium">Modelo Padrão</div>
                          <div className="text-[10px] text-muted-foreground">Gerar com template</div>
                        </div>
                      </Button>
                      <Button
                        onClick={generateWithISA}
                        disabled={!formData.nome || generatingAI}
                        className="gap-2 h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0"
                      >
                        {generatingAI ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        <div className="text-left">
                          <div className="text-xs font-medium">Gerar com ISA</div>
                          <div className="text-[10px] opacity-80">Inteligência artificial</div>
                        </div>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* TAB 2 - EDITOR VISUAL */}
          <TabsContent value="editor" className="flex-1 min-h-0 mt-0 flex flex-col">
            {/* Formatting toolbar */}
            <div className="flex items-center gap-0.5 px-4 py-1.5 border-b bg-card overflow-x-auto">
              <EditorToolbarButton icon={Bold} label="Negrito" onClick={() => execCommand('bold')} />
              <EditorToolbarButton icon={Italic} label="Itálico" onClick={() => execCommand('italic')} />
              <EditorToolbarButton icon={Underline} label="Sublinhado" onClick={() => execCommand('underline')} />
              <Separator orientation="vertical" className="mx-1 h-4" />
              <EditorToolbarButton icon={Heading1} label="Título 1" onClick={() => execCommand('formatBlock', 'h1')} />
              <EditorToolbarButton icon={Heading2} label="Título 2" onClick={() => execCommand('formatBlock', 'h2')} />
              <EditorToolbarButton icon={Type} label="Parágrafo" onClick={() => execCommand('formatBlock', 'p')} />
              <Separator orientation="vertical" className="mx-1 h-4" />
              <EditorToolbarButton icon={AlignLeft} label="Esquerda" onClick={() => execCommand('justifyLeft')} />
              <EditorToolbarButton icon={AlignCenter} label="Centralizar" onClick={() => execCommand('justifyCenter')} />
              <EditorToolbarButton icon={AlignJustify} label="Justificar" onClick={() => execCommand('justifyFull')} />
              <Separator orientation="vertical" className="mx-1 h-4" />
              <EditorToolbarButton icon={List} label="Lista" onClick={() => execCommand('insertUnorderedList')} />
              <EditorToolbarButton icon={ListOrdered} label="Lista numerada" onClick={() => execCommand('insertOrderedList')} />
              <EditorToolbarButton icon={Minus} label="Linha" onClick={() => execCommand('insertHorizontalRule')} />
              <Separator orientation="vertical" className="mx-1 h-4" />
              <EditorToolbarButton
                icon={Undo2}
                label="Regenerar do formulário"
                onClick={generateFromForm}
              />
            </div>

            {/* A4 Editor area */}
            <div className="flex-1 min-h-0 overflow-auto bg-[#e8e8e8] dark:bg-muted/30">
              <div className="flex justify-center py-6 px-4">
                <div
                  className="bg-white shadow-2xl rounded-sm border border-gray-300"
                  style={{ width: '210mm', minHeight: '297mm', maxWidth: '100%' }}
                >
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="petition-editor focus:outline-none"
                    onInput={() => {
                      if (editorRef.current) setEditableHtml(editorRef.current.innerHTML);
                    }}
                    style={{
                      fontFamily: '"Times New Roman", Times, serif',
                      fontSize: '12pt',
                      lineHeight: '1.6',
                      color: '#000',
                      padding: '20mm 25mm',
                      textAlign: 'justify',
                      wordBreak: 'break-word',
                    }}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3 - PREVIEW */}
          <TabsContent value="preview" className="flex-1 min-h-0 mt-0">
            <div className="h-full bg-white">
              <iframe ref={iframeRef} className="w-full h-full border-0" title="Preview da Procuração" />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t bg-muted/20">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <div className="flex items-center gap-2">
            {htmlInitialized && (
              <>
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Baixar
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !formData.nome || !htmlInitialized}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar Procuração
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
