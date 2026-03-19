import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import type { ModeloPeticao } from '@/hooks/useModelosPeticaoDocx';

interface GerarPeticaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelos: ModeloPeticao[];
  onGenerate: (modeloId: string, dados: {
    cliente_nome: string;
    cliente_cpf_rg: string;
    cliente_endereco: string;
    valor_causa: string;
    parte_contraria: string;
    vara_comarca: string;
    informacoes_adicionais: string;
  }) => Promise<ArrayBuffer | null>;
  onPreview: (docxBuffer: ArrayBuffer) => void;
}

export default function GerarPeticaoModal({ open, onOpenChange, modelos, onGenerate, onPreview }: GerarPeticaoModalProps) {
  const [modeloId, setModeloId] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [cpfRg, setCpfRg] = useState('');
  const [endereco, setEndereco] = useState('');
  const [valorCausa, setValorCausa] = useState('');
  const [parteContraria, setParteContraria] = useState('');
  const [varaComarca, setVaraComarca] = useState('');
  const [infoAdicionais, setInfoAdicionais] = useState('');
  const [generating, setGenerating] = useState(false);

  const formatCurrency = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const num = parseInt(digits || '0') / 100;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleGenerate = async () => {
    if (!modeloId || !clienteNome) return;
    setGenerating(true);
    try {
      const result = await onGenerate(modeloId, {
        cliente_nome: clienteNome,
        cliente_cpf_rg: cpfRg,
        cliente_endereco: endereco,
        valor_causa: valorCausa,
        parte_contraria: parteContraria,
        vara_comarca: varaComarca,
        informacoes_adicionais: infoAdicionais,
      });
      if (result) {
        onPreview(result);
        onOpenChange(false);
        // Reset form
        setModeloId('');
        setClienteNome('');
        setCpfRg('');
        setEndereco('');
        setValorCausa('');
        setParteContraria('');
        setVaraComarca('');
        setInfoAdicionais('');
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
            Preencha os dados do cliente e selecione o modelo para gerar o documento.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-3">
            <div>
              <Label>Selecionar Modelo *</Label>
              <Select value={modeloId} onValueChange={setModeloId}>
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

            <div>
              <Label>Nome completo do cliente *</Label>
              <Input value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="Nome completo" className="mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPF / RG</Label>
                <Input value={cpfRg} onChange={e => setCpfRg(e.target.value)} placeholder="000.000.000-00" className="mt-1" />
              </div>
              <div>
                <Label>Valor da Causa</Label>
                <Input
                  value={valorCausa}
                  onChange={e => setValorCausa(formatCurrency(e.target.value))}
                  placeholder="R$ 0,00"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Endereço completo</Label>
              <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade - UF" className="mt-1" />
            </div>

            <div>
              <Label>Parte contrária</Label>
              <Input value={parteContraria} onChange={e => setParteContraria(e.target.value)} placeholder="Nome da parte ré/requerida" className="mt-1" />
            </div>

            <div>
              <Label>Vara / Comarca</Label>
              <Input value={varaComarca} onChange={e => setVaraComarca(e.target.value)} placeholder="Ex: 1ª Vara Cível de Manaus" className="mt-1" />
            </div>

            <div>
              <Label>Informações adicionais</Label>
              <Textarea
                value={infoAdicionais}
                onChange={e => setInfoAdicionais(e.target.value)}
                placeholder="Dados específicos desta petição que devem constar no documento..."
                className="mt-1 min-h-[100px]"
              />
            </div>
          </div>
        </ScrollArea>

        <Button onClick={handleGenerate} disabled={!modeloId || !clienteNome || generating} className="w-full mt-2">
          {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {generating ? 'Gerando Petição...' : 'Gerar Petição'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
