import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Download, Save, Eye, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOfficeSettings } from '@/hooks/useOfficeSettings';
import { useAuth } from '@/hooks/useAuth';
import { generateProcuracaoHtml, ProcuracaoData, OfficeData } from '@/lib/procuracaoTemplate';
import { ESTADOS_CIVIS } from '@/types/peticoes';

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

export function ProcuracaoModal({ open, onOpenChange, lead, onSuccess }: ProcuracaoModalProps) {
  const { toast } = useToast();
  const { settings } = useOfficeSettings();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dados');
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  // Buscar dados existentes do lead
  useEffect(() => {
    if (open && lead.id) {
      fetchLeadData();
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

  const generatedHtml = generateProcuracaoHtml(formData, officeData);

  useEffect(() => {
    if (activeTab === 'preview' && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(generatedHtml);
        doc.close();
      }
    }
  }, [activeTab, generatedHtml]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Salvar dados do lead
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

      // Salvar procuração
      const { error } = await supabase
        .from('procuracoes')
        .insert({
          lead_id: lead.id,
          html_content: generatedHtml,
          objetivo: formData.objetivo,
          created_by: user?.id,
        });

      if (error) throw error;

      toast({ title: 'Procuração gerada com sucesso!' });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message,
        variant: 'destructive',
      });
    }
    setSaving(false);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
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
      printWindow.document.write(generatedHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar Procuração - {lead.nome}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dados" className="gap-2">
              <FileText className="h-4 w-4" />
              Dados do Cliente
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Visualizar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-[50vh] pr-4">
              {loadingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Identificação */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Nome Completo *</Label>
                      <Input
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        placeholder="Nome completo do cliente"
                      />
                    </div>

                    <div>
                      <Label>Nacionalidade</Label>
                      <Select
                        value={formData.nacionalidade}
                        onValueChange={(v) => setFormData({ ...formData, nacionalidade: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NACIONALIDADES.map((n) => (
                            <SelectItem key={n} value={n}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Estado Civil</Label>
                      <Select
                        value={formData.estadoCivil}
                        onValueChange={(v) => setFormData({ ...formData, estadoCivil: v })}
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
                      <Label>Profissão</Label>
                      <Input
                        value={formData.profissao}
                        onChange={(e) => setFormData({ ...formData, profissao: e.target.value })}
                        placeholder="Ex: Comerciante"
                      />
                    </div>

                    <div>
                      <Label>RG</Label>
                      <Input
                        value={formData.rg}
                        onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                        placeholder="0000000"
                      />
                    </div>

                    <div>
                      <Label>CPF</Label>
                      <Input
                        value={formData.cpf}
                        onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                        placeholder="000.000.000-00"
                      />
                    </div>
                  </div>

                  {/* Endereço */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Endereço</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Label>Logradouro</Label>
                        <Input
                          value={formData.endereco}
                          onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                          placeholder="Rua, Avenida..."
                        />
                      </div>

                      <div>
                        <Label>Número</Label>
                        <Input
                          value={formData.numero}
                          onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                          placeholder="Nº"
                        />
                      </div>

                      <div>
                        <Label>Bairro</Label>
                        <Input
                          value={formData.bairro}
                          onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                          placeholder="Bairro"
                        />
                      </div>

                      <div>
                        <Label>CEP</Label>
                        <Input
                          value={formData.cep}
                          onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                          placeholder="00000-000"
                        />
                      </div>

                      <div>
                        <Label>Cidade</Label>
                        <Input
                          value={formData.cidade}
                          onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label>UF</Label>
                        <Input
                          value={formData.uf}
                          onChange={(e) => setFormData({ ...formData, uf: e.target.value })}
                          maxLength={2}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Objetivo */}
                  <div className="border-t pt-4">
                    <Label>Objetivo da Procuração</Label>
                    <Textarea
                      value={formData.objetivo}
                      onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                      placeholder="Ex: ingressar com ação judicial referente a revisão de juros abusivos"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Descreva a finalidade específica desta procuração
                    </p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 min-h-0 mt-4">
            <div className="border rounded-lg overflow-hidden h-[50vh] bg-white">
              <iframe
                ref={iframeRef}
                className="w-full h-full"
                title="Preview da Procuração"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Eye className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Baixar HTML
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.nome}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Procuração
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
