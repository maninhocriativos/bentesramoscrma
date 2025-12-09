import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useRef } from 'react';
import { useDocumentos } from '@/hooks/useDocumentos';
import { Upload } from 'lucide-react';

export function DocumentoUploadModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { uploadDocumento, uploading } = useDocumentos();
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'Petição' | 'Contrato' | 'Procuração' | 'Documento Pessoal' | 'Comprovante' | 'Outros'>('Outros');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    await uploadDocumento(file, { nome, tipo });
    setNome('');
    setFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Documento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} required />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Petição">Petição</SelectItem>
                <SelectItem value="Contrato">Contrato</SelectItem>
                <SelectItem value="Procuração">Procuração</SelectItem>
                <SelectItem value="Documento Pessoal">Documento Pessoal</SelectItem>
                <SelectItem value="Comprovante">Comprovante</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Arquivo</Label>
            <input type="file" ref={fileInputRef} onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
            <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />{file ? file.name : 'Selecionar arquivo'}
            </Button>
          </div>
          <Button type="submit" disabled={uploading || !file} className="w-full">
            {uploading ? 'Enviando...' : 'Enviar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
