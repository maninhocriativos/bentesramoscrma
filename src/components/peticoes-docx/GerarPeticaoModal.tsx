import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { FileText, Loader2, Sparkles, User, Gavel, Building2, Info } from 'lucide-react';
import type { ModeloPeticao } from '@/hooks/useModelosPeticaoDocx';

interface GerarPeticaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelos: ModeloPeticao[];
  onGenerate: (modeloId: string, dados: Record<string, string>) => Promise<ArrayBuffer | null>;
  onPreview: (docxBuffer: ArrayBuffer) => void;
  defaultModeloId?: string;
}

export default function GerarPeticaoModal({ open, onOpenChange, modelos, onGenerate, onPreview, defaultModeloId }: GerarPeticaoModalProps) {
  const [modeloId, setModeloId] = useState('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [docType, setDocType] = useState<'civil' | 'militar'>('civil');
  const [isIdoso, setIsIdoso] = useState(false);

  useEffect(() => {
    if (open && defaultModeloId) {
      setModeloId(defaultModeloId);
      setFormData({});
      setDocType('civil');
      setIsIdoso(false);
    }
  }, [open, defaultModeloId]);

  const groupedModelos = useMemo(() => {
    const groups: Record<string, ModeloPeticao[]> = {};
    modelos.forEach(m => {
      const cat = m.categoria || 'Outros';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    });
    return groups;
  }, [modelos]);

  const selectedModelo = useMemo(() => modelos.find(m => m.id === modeloId), [modelos, modeloId]);
  const isGenerateDisabled = !modeloId || !formData.NOME_COMPLETO || generating;

  const handleModelChange = (id: string) => {
    setModeloId(id);
    setFormData({});
    setDocType('civil');
    setIsIdoso(false);
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (isGenerateDisabled) return;

    setGenerating(true);
    try {
      const dados = { ...formData };
      if (docType === 'militar') {
        dados.RG_MILITAR = dados.RG_MILITAR || dados._rg_number || '';
        delete dados.RG;
      } else {
        dados.RG = dados._rg_number || '';
        delete dados.RG_MILITAR;
      }
      delete dados._rg_number;

      if (!isIdoso) delete dados.IDOSO_IDADE;

      const result = await onGenerate(modeloId, dados);
      if (result) {
        onPreview(result);
        onOpenChange(false);
        setModeloId('');
        setFormData({});
        setDocType('civil');
        setIsIdoso(false);
      }
    } finally {
      setGenerating(false);
    }
  };

  const hasMarker = (marker: string) => {
    if (!selectedModelo) return false;
    return selectedModelo.marcadores?.includes(marker);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(54rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] gap-0 flex flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border/30 bg-background px-6 pt-6 pb-4 sm:px-7">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nova Petição
          </DialogTitle>
          <DialogDescription>
            Selecione o modelo e preencha os dados para gerar o documento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-7">
          <div className="space-y-6 pb-8 pt-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary/70" />
                <h3 className="text-sm font-semibold">Seleção do Modelo</h3>
              </div>
              <div>
                <Label>Tipo de Petição *</Label>
                <Select value={modeloId} onValueChange={handleModelChange}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Escolha o tipo de petição" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(groupedModelos).map(([cat, items]) => (
                      <SelectGroup key={cat}>
                        <SelectLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat}</SelectLabel>
                        {items.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            <div className="flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              {m.nome}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedModelo && (
              <>
                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary/70" />
                    <h3 className="text-sm font-semibold">Dados do Cliente (Requerente)</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Label>Nome completo *</Label>
                      <Input
                        value={formData.NOME_COMPLETO || ''}
                        onChange={e => handleFieldChange('NOME_COMPLETO', e.target.value)}
                        placeholder="Nome completo do cliente"
                        className="mt-1.5"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Qualificação *</Label>
                      <Input
                        value={formData.QUALIFICACAO || ''}
                        onChange={e => handleFieldChange('QUALIFICACAO', e.target.value)}
                        placeholder="Ex: brasileiro, casado, servidor público"
                        className="mt-1.5"
                      />
                    </div>

                    {(hasMarker('RG') || hasMarker('RG_MILITAR')) && (
                      <>
                        <div className="md:col-span-2">
                          <Label className="mb-2 block">Tipo de documento</Label>
                          <RadioGroup
                            value={docType}
                            onValueChange={(value) => setDocType(value as 'civil' | 'militar')}
                            className="flex flex-wrap gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="civil" id="rg-civil" />
                              <Label htmlFor="rg-civil" className="cursor-pointer font-normal">RG Civil</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="militar" id="rg-militar" />
                              <Label htmlFor="rg-militar" className="cursor-pointer font-normal">RG Militar</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        <div>
                          <Label>Número do RG *</Label>
                          <Input
                            value={formData._rg_number || ''}
                            onChange={e => handleFieldChange('_rg_number', e.target.value)}
                            placeholder={docType === 'militar' ? 'Número do RG Militar' : 'Número do RG'}
                            className="mt-1.5"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <Label>CPF *</Label>
                      <Input
                        value={formData.CPF || ''}
                        onChange={e => handleFieldChange('CPF', e.target.value)}
                        placeholder="000.000.000-00"
                        className="mt-1.5"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Endereço completo *</Label>
                      <Input
                        value={formData.ENDERECO_CLIENTE || ''}
                        onChange={e => handleFieldChange('ENDERECO_CLIENTE', e.target.value)}
                        placeholder="Rua, número, bairro, cidade - UF"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Gavel className="h-4 w-4 text-primary/70" />
                    <h3 className="text-sm font-semibold">Dados do Processo</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Label>Vara / Juízo completo *</Label>
                      <Input
                        value={formData.VARA_JUIZO || ''}
                        onChange={e => handleFieldChange('VARA_JUIZO', e.target.value)}
                        placeholder="Ex: 1ª Vara Cível de Manaus"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>Comarca</Label>
                      <Input
                        value={formData.COMARCA || ''}
                        onChange={e => handleFieldChange('COMARCA', e.target.value)}
                        placeholder="Ex: Manaus/AM"
                        className="mt-1.5"
                      />
                    </div>

                    {hasMarker('IDOSO_IDADE') && (
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="is-idoso"
                            checked={isIdoso}
                            onCheckedChange={(checked) => setIsIdoso(checked === true)}
                          />
                          <Label htmlFor="is-idoso" className="cursor-pointer font-normal">
                            É idoso? (prioridade legal)
                          </Label>
                        </div>
                        {isIdoso && (
                          <div>
                            <Label>Idade por extenso</Label>
                            <Input
                              value={formData.IDOSO_IDADE || ''}
                              onChange={e => handleFieldChange('IDOSO_IDADE', e.target.value)}
                              placeholder="Ex: 68 (SESSENTA E OITO)"
                              className="mt-1.5"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary/70" />
                    <h3 className="text-sm font-semibold">Dados do Réu</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Label>Nome do réu / parte contrária *</Label>
                      <Input
                        value={formData.REU_NOME || ''}
                        onChange={e => handleFieldChange('REU_NOME', e.target.value)}
                        placeholder="Nome da parte ré/requerida"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>CNPJ do réu</Label>
                      <Input
                        value={formData.REU_CNPJ || ''}
                        onChange={e => handleFieldChange('REU_CNPJ', e.target.value)}
                        placeholder="00.000.000/0000-00"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>Endereço do réu</Label>
                      <Input
                        value={formData.REU_ENDERECO || ''}
                        onChange={e => handleFieldChange('REU_ENDERECO', e.target.value)}
                        placeholder="Endereço completo do réu"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Gavel className="h-4 w-4 text-primary/70" />
                    <h3 className="text-sm font-semibold">Tipo da Ação</h3>
                  </div>
                  <div>
                    <Label>Tipo da ação judicial *</Label>
                    <Input
                      value={formData.TIPO_ACAO || ''}
                      onChange={e => handleFieldChange('TIPO_ACAO', e.target.value)}
                      placeholder="Ex: AÇÃO DE INDENIZAÇÃO POR DANOS MORAIS"
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary/70" />
                    <h3 className="text-sm font-semibold">Informações Adicionais</h3>
                  </div>
                  <div>
                    <Label>Dados específicos do caso</Label>
                    <Textarea
                      value={formData.INFORMACOES_ADICIONAIS || ''}
                      onChange={e => handleFieldChange('INFORMACOES_ADICIONAIS', e.target.value)}
                      placeholder="Insira aqui informações específicas do caso que serão incluídas na petição gerada..."
                      className="mt-1.5 min-h-[140px]"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-border/30 bg-background px-6 py-4 sm:px-7">
          <Button
            onClick={handleGenerate}
            disabled={isGenerateDisabled}
            className="h-11 w-full"
          >
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {generating ? 'Gerando Petição...' : 'Gerar Petição'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
