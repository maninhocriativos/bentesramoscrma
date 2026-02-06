import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Send,
  Loader2,
  User,
  Plus,
  Trash2,
  FileText,
  Upload,
  FileSignature,
  Mail,
  MessageSquare,
  Check,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useModelosContratos } from '@/hooks/useModelosContratos';
import { useOfficeSettings } from '@/hooks/useOfficeSettings';
import { cn } from '@/lib/utils';

interface Lead {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  estado_civil: string | null;
  profissao: string | null;
  nacionalidade: string | null;
  rg: string | null;
}

interface Signatario {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  tipoAssinatura: 'sign' | 'approve' | 'witness' | 'party';
  authType: 'email' | 'sms' | 'whatsapp';
}

interface GerarContratoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preSelectedLead?: Lead | null;
}

const TIPO_ASSINATURA_OPTIONS = [
  { value: 'sign', label: 'Assinar' },
  { value: 'approve', label: 'Aprovar' },
  { value: 'witness', label: 'Testemunha' },
  { value: 'party', label: 'Parte' },
];

const AUTH_TYPE_OPTIONS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
];

export function GerarContratoModal({
  isOpen,
  onClose,
  onSuccess,
  preSelectedLead,
}: GerarContratoModalProps) {
  const { toast } = useToast();
  const { modelos } = useModelosContratos();
  const { settings } = useOfficeSettings();
  
  // Steps
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Data source
  const [dataSource, setDataSource] = useState<'lead' | 'manual'>('lead');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [manualData, setManualData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    rg: '',
    endereco: '',
    cidade: '',
    uf: '',
    cep: '',
    estado_civil: '',
    profissao: '',
    nacionalidade: 'brasileiro(a)',
  });
  
  // Step 2: Template source
  const [templateSource, setTemplateSource] = useState<'modelo' | 'upload' | 'generate'>('modelo');
  const [selectedModeloId, setSelectedModeloId] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [generatedContent, setGeneratedContent] = useState('');
  
  // Step 3: Signers
  const [signatarios, setSignatarios] = useState<Signatario[]>([]);
  const [includeAdvogado, setIncludeAdvogado] = useState(true);
  
  // Step 4: Delivery
  const [sendViaEmail, setSendViaEmail] = useState(true);
  const [sendViaWhatsapp, setSendViaWhatsapp] = useState(true);
  const [customMessage, setCustomMessage] = useState('Por favor, assine o contrato.');
  
  // State
  const [sending, setSending] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Fetch leads
  useEffect(() => {
    const fetchLeads = async () => {
      setLoadingLeads(true);
      const { data } = await supabase
        .from('leads_juridicos')
        .select('id, nome, email, telefone, cpf, endereco, cidade, uf, cep, estado_civil, profissao, nacionalidade, rg')
        .order('nome');
      if (data) setLeads(data);
      setLoadingLeads(false);
    };
    if (isOpen) fetchLeads();
  }, [isOpen]);

  // Pre-fill when opening with a pre-selected lead
  useEffect(() => {
    if (isOpen && preSelectedLead) {
      setDataSource('lead');
      setSelectedLeadId(preSelectedLead.id);
      addSignatarioFromLead(preSelectedLead);
    }
  }, [isOpen, preSelectedLead]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setDataSource('lead');
      setSelectedLeadId('');
      setManualData({
        nome: '', email: '', telefone: '', cpf: '', rg: '',
        endereco: '', cidade: '', uf: '', cep: '',
        estado_civil: '', profissao: '', nacionalidade: 'brasileiro(a)',
      });
      setTemplateSource('modelo');
      setSelectedModeloId('');
      setUploadedFile(null);
      setGeneratedContent('');
      setSignatarios([]);
      setIncludeAdvogado(true);
      setSendViaEmail(true);
      setSendViaWhatsapp(true);
      setCustomMessage('Por favor, assine o contrato.');
    }
  }, [isOpen]);

  const addSignatarioFromLead = (lead: Lead) => {
    const newSignatario: Signatario = {
      id: crypto.randomUUID(),
      nome: lead.nome || '',
      email: lead.email || '',
      telefone: lead.telefone || '',
      cpf: lead.cpf || '',
      tipoAssinatura: 'sign',
      authType: 'email',
    };
    setSignatarios(prev => [...prev, newSignatario]);
  };

  const handleLeadSelect = (leadId: string) => {
    setSelectedLeadId(leadId);
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      // Clear existing signatarios and add the selected lead
      setSignatarios([]);
      addSignatarioFromLead(lead);
    }
  };

  const addSignatario = () => {
    const newSignatario: Signatario = {
      id: crypto.randomUUID(),
      nome: '',
      email: '',
      telefone: '',
      cpf: '',
      tipoAssinatura: 'sign',
      authType: 'email',
    };
    setSignatarios(prev => [...prev, newSignatario]);
  };

  const updateSignatario = (id: string, field: keyof Signatario, value: string) => {
    setSignatarios(prev =>
      prev.map(s => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const removeSignatario = (id: string) => {
    setSignatarios(prev => prev.filter(s => s.id !== id));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setUploadedFile(selectedFile);
    }
  };

  const getFileToSend = async (): Promise<{ base64: string; filename: string } | null> => {
    if (templateSource === 'upload' && uploadedFile) {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(uploadedFile);
      });
      return { base64, filename: uploadedFile.name };
    }
    
    if (templateSource === 'modelo' && selectedModeloId) {
      const modelo = modelos.find(m => m.id === selectedModeloId);
      if (modelo?.arquivo_url) {
        try {
          const response = await fetch(modelo.arquivo_url);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          return { base64, filename: modelo.arquivo_nome };
        } catch (error) {
          console.error('Error fetching modelo:', error);
          return null;
        }
      }
    }
    
    // For generated content, we'd need to convert to PDF
    // For now, throw an error as this requires more implementation
    if (templateSource === 'generate') {
      toast({
        title: 'Funcionalidade em desenvolvimento',
        description: 'A geração dinâmica de PDF será implementada em breve.',
        variant: 'destructive',
      });
      return null;
    }
    
    return null;
  };

  const handleSubmit = async () => {
    if (signatarios.length === 0) {
      toast({
        title: 'Adicione signatários',
        description: 'É necessário pelo menos um signatário para enviar o contrato.',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);

    try {
      // Get file to send
      const fileData = await getFileToSend();
      if (!fileData) {
        throw new Error('Não foi possível obter o arquivo do contrato.');
      }

      // 1. Create document in Clicksign
      const { data: docData, error: docError } = await supabase.functions.invoke('clicksign', {
        body: {
          action: 'create_document',
          file_content: fileData.base64,
          file_name: fileData.filename,
        },
      });

      if (docError) throw docError;
      if (docData.error) throw new Error(docData.error);

      const documentKey = docData.document?.key;
      if (!documentKey) throw new Error('Falha ao criar documento');

      // 2. Add each signer and create signature lists
      const allSigners = [...signatarios];
      
      // Add advogado if enabled
      if (includeAdvogado && settings?.lawyer_name && settings?.email) {
        allSigners.push({
          id: 'advogado',
          nome: settings.lawyer_name,
          email: settings.email,
          telefone: settings.phone || '',
          cpf: '',
          tipoAssinatura: 'sign',
          authType: 'email',
        });
      }

      for (const signer of allSigners) {
        // Add signer
        const { data: signerData, error: signerError } = await supabase.functions.invoke('clicksign', {
          body: {
            action: 'add_signer',
            signer: {
              email: signer.email,
              name: signer.nome,
              phone: signer.telefone || undefined,
              documentation: signer.cpf || undefined,
              auth_type: signer.authType,
            },
          },
        });

        if (signerError) throw signerError;
        if (signerData.error) throw new Error(signerData.error);

        const signerKey = signerData.signer?.key;
        if (!signerKey) throw new Error(`Falha ao adicionar signatário: ${signer.nome}`);

        // Create signature list
        const { data: listData, error: listError } = await supabase.functions.invoke('clicksign', {
          body: {
            action: 'create_list',
            document_key: documentKey,
            signer_key: signerKey,
            message: customMessage,
          },
        });

        if (listError) throw listError;
        if (listData.error) throw new Error(listData.error);
      }

      // 3. Update lead with contract link if using lead data
      const clicksignUrl = `https://app.clicksign.com/document/${documentKey}`;
      
      if (dataSource === 'lead' && selectedLeadId) {
        await supabase
          .from('leads_juridicos')
          .update({ 
            link_contrato: clicksignUrl,
            contract_key: documentKey,
            contract_sent_at: new Date().toISOString(),
          })
          .eq('id', selectedLeadId);

        // Create contract reminder
        await supabase.from('contract_reminders').insert({
          document_key: documentKey,
          document_name: fileData.filename,
          contract_link: clicksignUrl,
          lead_id: selectedLeadId,
          signer_name: signatarios[0]?.nome,
          signer_email: signatarios[0]?.email,
          signer_phone: signatarios[0]?.telefone,
          status: 'pending',
        });

        // Create interaction record
        await supabase.from('interacoes').insert({
          cliente_id: selectedLeadId,
          tipo: 'Documento',
          resumo: 'Contrato enviado para assinatura via Clicksign',
          detalhes: `Documento: ${fileData.filename}\nSignatários: ${allSigners.map(s => s.nome).join(', ')}`,
        });
      }

      // 4. Send via WhatsApp if enabled
      if (sendViaWhatsapp && signatarios[0]?.telefone) {
        const mensagemWhatsapp = 
          `Olá ${signatarios[0].nome}! 👋\n\n` +
          `Seu contrato está pronto para assinatura.\n\n` +
          `📋 Documento: ${fileData.filename}\n` +
          `🔗 Link: ${clicksignUrl}\n\n` +
          `${customMessage}`;

        await supabase.functions.invoke('zapi-send', {
          body: {
            phone: signatarios[0].telefone,
            message: mensagemWhatsapp,
          },
        });
      }

      toast({
        title: 'Contrato enviado com sucesso! 🎉',
        description: `O contrato foi enviado para ${allSigners.length} signatário(s).`,
      });

      onClose();
      onSuccess?.();

    } catch (error: any) {
      console.error('Error sending contract:', error);
      toast({
        title: 'Erro ao enviar contrato',
        description: error.message || 'Falha ao processar contrato no Clicksign.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        if (dataSource === 'lead') return !!selectedLeadId;
        return !!manualData.nome && !!manualData.email;
      case 2:
        if (templateSource === 'modelo') return !!selectedModeloId;
        if (templateSource === 'upload') return !!uploadedFile;
        if (templateSource === 'generate') return !!generatedContent;
        return false;
      case 3:
        return signatarios.length > 0 && signatarios.every(s => s.nome && s.email);
      case 4:
        return sendViaEmail || sendViaWhatsapp;
      default:
        return false;
    }
  };

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1: return 'Dados do Cliente';
      case 2: return 'Documento';
      case 3: return 'Signatários';
      case 4: return 'Envio';
      default: return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Gerar Contrato para Assinatura
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2 py-3 border-b">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  currentStep === step
                    ? "bg-primary text-primary-foreground"
                    : currentStep > step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {currentStep > step ? <Check className="h-4 w-4" /> : step}
              </div>
              <span
                className={cn(
                  "ml-2 text-sm hidden sm:inline",
                  currentStep === step ? "font-medium" : "text-muted-foreground"
                )}
              >
                {getStepTitle(step)}
              </span>
              {step < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />}
            </div>
          ))}
        </div>

        <ScrollArea className="flex-1 px-1">
          <div className="p-4 space-y-4">
            {/* Step 1: Data Source */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <Tabs value={dataSource} onValueChange={(v) => setDataSource(v as any)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="lead" className="gap-2">
                      <User className="h-4 w-4" />
                      Selecionar Lead
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Preencher Manual
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="lead" className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Selecionar Lead</Label>
                      <Select value={selectedLeadId} onValueChange={handleLeadSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Buscar lead..." />
                        </SelectTrigger>
                        <SelectContent>
                          {loadingLeads ? (
                            <div className="p-2 text-center">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            </div>
                          ) : (
                            leads.map((lead) => (
                              <SelectItem key={lead.id} value={lead.id}>
                                <div className="flex flex-col">
                                  <span>{lead.nome || 'Sem nome'}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {lead.email} {lead.telefone && `• ${lead.telefone}`}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedLeadId && (
                      <Card className="bg-muted/50">
                        <CardContent className="pt-4">
                          <p className="text-sm text-muted-foreground mb-2">
                            Dados do lead serão usados para o contrato
                          </p>
                          {(() => {
                            const lead = leads.find(l => l.id === selectedLeadId);
                            if (!lead) return null;
                            return (
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div><strong>Nome:</strong> {lead.nome || '-'}</div>
                                <div><strong>Email:</strong> {lead.email || '-'}</div>
                                <div><strong>Telefone:</strong> {lead.telefone || '-'}</div>
                                <div><strong>CPF:</strong> {lead.cpf || '-'}</div>
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="manual" className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome Completo *</Label>
                        <Input
                          value={manualData.nome}
                          onChange={(e) => setManualData({ ...manualData, nome: e.target.value })}
                          placeholder="Nome do cliente"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          value={manualData.email}
                          onChange={(e) => setManualData({ ...manualData, email: e.target.value })}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input
                          value={manualData.telefone}
                          onChange={(e) => setManualData({ ...manualData, telefone: e.target.value })}
                          placeholder="+55 92 99999-9999"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CPF</Label>
                        <Input
                          value={manualData.cpf}
                          onChange={(e) => setManualData({ ...manualData, cpf: e.target.value })}
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>RG</Label>
                        <Input
                          value={manualData.rg}
                          onChange={(e) => setManualData({ ...manualData, rg: e.target.value })}
                          placeholder="0000000-0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nacionalidade</Label>
                        <Input
                          value={manualData.nacionalidade}
                          onChange={(e) => setManualData({ ...manualData, nacionalidade: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <Label>Endereço</Label>
                        <Input
                          value={manualData.endereco}
                          onChange={(e) => setManualData({ ...manualData, endereco: e.target.value })}
                          placeholder="Rua, número, bairro..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cidade</Label>
                        <Input
                          value={manualData.cidade}
                          onChange={(e) => setManualData({ ...manualData, cidade: e.target.value })}
                          placeholder="Manaus"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>UF</Label>
                        <Input
                          value={manualData.uf}
                          onChange={(e) => setManualData({ ...manualData, uf: e.target.value })}
                          placeholder="AM"
                          maxLength={2}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Step 2: Template Source */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <Tabs value={templateSource} onValueChange={(v) => setTemplateSource(v as any)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="modelo" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Modelo
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Upload
                    </TabsTrigger>
                    <TabsTrigger value="generate" className="gap-2">
                      <FileSignature className="h-4 w-4" />
                      Gerar PDF
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="modelo" className="mt-4 space-y-4">
                    <Label>Selecionar Modelo de Contrato</Label>
                    {modelos.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-auto">
                        {modelos.map((modelo) => (
                          <Card
                            key={modelo.id}
                            className={cn(
                              "cursor-pointer transition-all hover:border-primary",
                              selectedModeloId === modelo.id && "border-primary bg-primary/5"
                            )}
                            onClick={() => setSelectedModeloId(modelo.id)}
                          >
                            <CardContent className="p-3 flex items-center gap-3">
                              <FileText className="h-8 w-8 text-primary/60" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{modelo.nome}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {modelo.descricao || modelo.arquivo_nome}
                                </p>
                              </div>
                              <Badge variant="secondary">{modelo.categoria}</Badge>
                              {selectedModeloId === modelo.id && (
                                <Check className="h-5 w-5 text-primary" />
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="border-dashed">
                        <CardContent className="py-8 text-center">
                          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Nenhum modelo cadastrado. Use a aba "Modelos" para enviar.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="upload" className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Upload do Contrato (PDF)</Label>
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                      />
                      {uploadedFile && (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm">{uploadedFile.name}</span>
                          <Check className="h-4 w-4 text-emerald-600 ml-auto" />
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="generate" className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Conteúdo do Contrato</Label>
                      <Textarea
                        value={generatedContent}
                        onChange={(e) => setGeneratedContent(e.target.value)}
                        placeholder="Digite ou cole o conteúdo do contrato aqui..."
                        rows={10}
                      />
                      <p className="text-xs text-muted-foreground">
                        O conteúdo será convertido em PDF automaticamente.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Step 3: Signers */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Signatários</Label>
                  <Button variant="outline" size="sm" onClick={addSignatario}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>

                {signatarios.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <User className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Adicione pelo menos um signatário
                      </p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={addSignatario}>
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar Signatário
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {signatarios.map((signer, index) => (
                      <Card key={signer.id}>
                        <CardHeader className="py-2 px-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Signatário {index + 1}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSignatario(signer.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="py-2 px-3 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Nome *</Label>
                              <Input
                                value={signer.nome}
                                onChange={(e) => updateSignatario(signer.id, 'nome', e.target.value)}
                                placeholder="Nome completo"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Email *</Label>
                              <Input
                                type="email"
                                value={signer.email}
                                onChange={(e) => updateSignatario(signer.id, 'email', e.target.value)}
                                placeholder="email@exemplo.com"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Telefone</Label>
                              <Input
                                value={signer.telefone}
                                onChange={(e) => updateSignatario(signer.id, 'telefone', e.target.value)}
                                placeholder="+55 92 99999-9999"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">CPF</Label>
                              <Input
                                value={signer.cpf}
                                onChange={(e) => updateSignatario(signer.id, 'cpf', e.target.value)}
                                placeholder="000.000.000-00"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Tipo de Assinatura</Label>
                              <Select
                                value={signer.tipoAssinatura}
                                onValueChange={(v) => updateSignatario(signer.id, 'tipoAssinatura', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIPO_ASSINATURA_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Autenticação</Label>
                              <Select
                                value={signer.authType}
                                onValueChange={(v) => updateSignatario(signer.id, 'authType', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {AUTH_TYPE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      <div className="flex items-center gap-2">
                                        <opt.icon className="h-4 w-4" />
                                        {opt.label}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Include lawyer option */}
                {settings?.lawyer_name && (
                  <Card className="bg-muted/50">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="include-advogado"
                          checked={includeAdvogado}
                          onCheckedChange={(checked) => setIncludeAdvogado(!!checked)}
                        />
                        <label
                          htmlFor="include-advogado"
                          className="flex items-center gap-2 cursor-pointer flex-1"
                        >
                          <Building2 className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium">
                              Incluir advogado como signatário
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {settings.lawyer_name} ({settings.email})
                            </p>
                          </div>
                        </label>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Step 4: Delivery */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <Label>Métodos de Envio</Label>
                
                <div className="space-y-3">
                  <Card className={cn(sendViaEmail && "border-primary bg-primary/5")}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="send-email"
                          checked={sendViaEmail}
                          onCheckedChange={(checked) => setSendViaEmail(!!checked)}
                        />
                        <label
                          htmlFor="send-email"
                          className="flex items-center gap-2 cursor-pointer flex-1"
                        >
                          <Mail className="h-5 w-5 text-primary" />
                          <div>
                            <p className="text-sm font-medium">Enviar via Email</p>
                            <p className="text-xs text-muted-foreground">
                              Clicksign envia automaticamente para os signatários
                            </p>
                          </div>
                        </label>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={cn(sendViaWhatsapp && "border-primary bg-primary/5")}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="send-whatsapp"
                          checked={sendViaWhatsapp}
                          onCheckedChange={(checked) => setSendViaWhatsapp(!!checked)}
                        />
                        <label
                          htmlFor="send-whatsapp"
                          className="flex items-center gap-2 cursor-pointer flex-1"
                        >
                          <MessageSquare className="h-5 w-5 text-emerald-600" />
                          <div>
                            <p className="text-sm font-medium">Enviar via WhatsApp</p>
                            <p className="text-xs text-muted-foreground">
                              Envia mensagem com link via Z-API
                            </p>
                          </div>
                        </label>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-2">
                  <Label>Mensagem Personalizada</Label>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Mensagem que será enviada junto com o contrato..."
                    rows={3}
                  />
                </div>

                {/* Summary */}
                <Card className="bg-muted/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Resumo do Envio</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p>
                      📄 <strong>Documento:</strong>{' '}
                      {templateSource === 'upload' && uploadedFile?.name}
                      {templateSource === 'modelo' && modelos.find(m => m.id === selectedModeloId)?.nome}
                      {templateSource === 'generate' && 'PDF gerado'}
                    </p>
                    <p>
                      👥 <strong>Signatários:</strong> {signatarios.length}
                      {includeAdvogado && settings?.lawyer_name && ' + advogado'}
                    </p>
                    <p>
                      📨 <strong>Envio:</strong>{' '}
                      {[sendViaEmail && 'Email', sendViaWhatsapp && 'WhatsApp'].filter(Boolean).join(' + ')}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Navigation */}
        <div className="flex justify-between gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => (currentStep > 1 ? setCurrentStep(currentStep - 1) : onClose())}
          >
            {currentStep === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          {currentStep < 4 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={sending || !canProceed()}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar para Assinatura
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
