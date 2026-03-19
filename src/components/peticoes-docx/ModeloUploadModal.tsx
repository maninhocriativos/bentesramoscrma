import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Plus, Trash2, FileText, Loader2, Variable } from 'lucide-react';
import type { VariavelMapping } from '@/hooks/useModelosPeticaoDocx';

const VARIAVEIS_PADRAO = [
  { variavel: 'NOME_COMPLETO', label: 'Nome Completo' },
  { variavel: 'QUALIFICACAO', label: 'Qualificação' },
  { variavel: 'CPF', label: 'CPF' },
  { variavel: 'RG', label: 'RG' },
  { variavel: 'ENDERECO_CLIENTE', label: 'Endereço do Cliente' },
  { variavel: 'TIPO_ACAO', label: 'Tipo da Ação' },
  { variavel: 'REU_NOME', label: 'Nome do Réu' },
  { variavel: 'REU_CNPJ', label: 'CNPJ do Réu' },
  { variavel: 'REU_ENDERECO', label: 'Endereço do Réu' },
  { variavel: 'VARA_JUIZO', label: 'Vara / Juízo' },
  { variavel: 'COMARCA', label: 'Comarca' },
  { variavel: 'RG_MILITAR', label: 'RG Militar' },
  { variavel: 'DOC_ID', label: 'Registro Geral (Doc ID)' },
  { variavel: 'IDOSO_IDADE', label: 'Idade do Idoso' },
];

interface ModeloUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (nome: string, file: File, variaveis: VariavelMapping[]) => Promise<void>;
}

export default function ModeloUploadModal({ open, onOpenChange, onSave }: ModeloUploadModalProps) {
  const [nome, setNome] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [variaveis, setVariaveis] = useState<VariavelMapping[]>(
    VARIAVEIS_PADRAO.map(v => ({ textoOriginal: '', variavel: v.variavel }))
  );
  const [saving, setSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.docx')) {
      setFile(selectedFile);
    }
  };

  const updateVariavel = (index: number, textoOriginal: string) => {
    setVariaveis(prev => prev.map((v, i) => i === index ? { ...v, textoOriginal } : v));
  };

  const handleSave = async () => {
    if (!nome || !file) return;
    setSaving(true);
    try {
      const activeVars = variaveis.filter(v => v.textoOriginal.trim() !== '');
      await onSave(nome, file, activeVars);
      setNome('');
      setFile(null);
      setVariaveis(VARIAVEIS_PADRAO.map(v => ({ textoOriginal: '', variavel: v.variavel })));
      onOpenChange(false);
    } catch {
      // error handled in hook
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Adicionar Modelo de Petição
          </DialogTitle>
          <DialogDescription>
            Faça upload do .docx original e mapeie as variáveis que serão substituídas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome do Modelo</Label>
            <Input
              placeholder="Ex: Ação de Cobrança, Divórcio Consensual..."
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Arquivo .docx</Label>
            <div className="mt-1">
              {file ? (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium flex-1 truncate">{file.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {(file.size / 1024).toFixed(0)} KB
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFile(null)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-border/60 rounded-lg cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para selecionar o .docx</span>
                  <input type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
                </label>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Variable className="h-4 w-4 text-primary" />
              <Label className="mb-0">Mapeamento de Variáveis</Label>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Informe qual texto fixo no documento representa cada campo. O sistema fará o find & replace.
            </p>
            <ScrollArea className="h-[240px]">
              <div className="space-y-2.5 pr-3">
                {VARIAVEIS_PADRAO.map((vp, index) => (
                  <div key={vp.variavel} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 shrink-0 font-mono min-w-[140px] justify-center">
                      {`{{${vp.variavel}}}`}
                    </Badge>
                    <Input
                      placeholder={`Texto no documento para ${vp.label}`}
                      value={variaveis[index]?.textoOriginal || ''}
                      onChange={e => updateVariavel(index, e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Button onClick={handleSave} disabled={!nome || !file || saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            {saving ? 'Salvando...' : 'Salvar Modelo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
