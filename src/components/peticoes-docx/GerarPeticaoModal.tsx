import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import type { ModeloPeticao } from '@/hooks/useModelosPeticaoDocx';

const FIELD_LABELS: Record<string, { label: string; placeholder: string; type?: 'textarea' }> = {
  NOME_COMPLETO: { label: 'Nome completo do cliente *', placeholder: 'Nome completo' },
  QUALIFICACAO: { label: 'Qualificação', placeholder: 'Ex: brasileiro, casado, professor, portador do...' },
  CPF: { label: 'CPF', placeholder: '000.000.000-00' },
  RG: { label: 'RG', placeholder: 'Número do RG' },
  RG_MILITAR: { label: 'RG Militar', placeholder: 'Número do RG Militar' },
  DOC_ID: { label: 'Registro Geral (Doc ID)', placeholder: 'Número do documento' },
  ENDERECO_CLIENTE: { label: 'Endereço completo', placeholder: 'Rua, número, bairro, cidade - UF' },
  TIPO_ACAO: { label: 'Tipo da Ação', placeholder: 'Ex: Ação de Obrigação de Fazer c/c Indenização' },
  REU_NOME: { label: 'Nome do réu / parte contrária', placeholder: 'Nome da parte ré/requerida' },
  REU_CNPJ: { label: 'CNPJ do réu', placeholder: '00.000.000/0000-00' },
  REU_ENDERECO: { label: 'Endereço do réu', placeholder: 'Endereço completo do réu' },
  VARA_JUIZO: { label: 'Vara / Juízo', placeholder: 'Ex: 1ª Vara Cível de Manaus' },
  COMARCA: { label: 'Comarca', placeholder: 'Ex: Manaus/AM' },
  IDOSO_IDADE: { label: 'Idade do idoso (por extenso)', placeholder: 'Ex: 68 (SESSENTA E OITO)' },
};

interface GerarPeticaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelos: ModeloPeticao[];
  onGenerate: (modeloId: string, dados: Record<string, string>) => Promise<ArrayBuffer | null>;
  onPreview: (docxBuffer: ArrayBuffer) => void;
}

export default function GerarPeticaoModal({ open, onOpenChange, modelos, onGenerate, onPreview }: GerarPeticaoModalProps) {
  const [modeloId, setModeloId] = useState('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);

  const selectedModelo = useMemo(() => modelos.find(m => m.id === modeloId), [modelos, modeloId]);

  const modelVars = useMemo(() => {
    if (!selectedModelo) return [];
    return selectedModelo.variaveis.map(v => v.variavel);
  }, [selectedModelo]);

  const handleModelChange = (id: string) => {
    setModeloId(id);
    setFormData({});
  };

  const handleFieldChange = (varName: string, value: string) => {
    setFormData(prev => ({ ...prev, [varName]: value }));
  };

  const handleGenerate = async () => {
    if (!modeloId || !formData.NOME_COMPLETO) return;
    setGenerating(true);
    try {
      const result = await onGenerate(modeloId, formData);
      if (result) {
        onPreview(result);
        onOpenChange(false);
        setModeloId('');
        setFormData({});
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nova Petição
          </DialogTitle>
          <DialogDescription>
            Selecione o modelo e preencha os dados para gerar o documento.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-3">
            <div>
              <Label>Selecionar Modelo *</Label>
              <Select value={modeloId} onValueChange={handleModelChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Escolha o tipo de petição" />
                </SelectTrigger>
                <SelectContent>
                  {modelos.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        {m.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {modelVars.map(varName => {
              const field = FIELD_LABELS[varName] || { label: varName, placeholder: '' };
              return (
                <div key={varName}>
                  <Label>{field.label}</Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      value={formData[varName] || ''}
                      onChange={e => handleFieldChange(varName, e.target.value)}
                      placeholder={field.placeholder}
                      className="mt-1 min-h-[80px]"
                    />
                  ) : (
                    <Input
                      value={formData[varName] || ''}
                      onChange={e => handleFieldChange(varName, e.target.value)}
                      placeholder={field.placeholder}
                      className="mt-1"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Button onClick={handleGenerate} disabled={!modeloId || !formData.NOME_COMPLETO || generating} className="w-full mt-2">
          {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {generating ? 'Gerando Petição...' : 'Gerar Petição'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
