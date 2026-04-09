import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useRef, useCallback } from 'react';
import { useDocumentos } from '@/hooks/useDocumentos';
import { useLeads } from '@/hooks/useLeads';
import { supabase } from '@/integrations/supabase/client';
import { Upload, HardDrive, Cloud, FileText, X, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ADMIN_USER_ID = '5c775450-665f-4f43-99cb-efb6167d4e20';

type TipoDoc = 'Petição' | 'Contrato' | 'Procuração' | 'Documento Pessoal' | 'Comprovante' | 'Outros';
type Destino = 'local' | 'drive' | 'ambos';

interface DocumentoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId?: string;
  processoId?: string;
}

export function DocumentoUploadModal({ open, onOpenChange, clienteId, processoId }: DocumentoUploadModalProps) {
  const { uploadDocumento, uploading } = useDocumentos(processoId, clienteId);
  const { leads } = useLeads();

  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoDoc>('Outros');
  const [file, setFile] = useState<File | null>(null);
  const [destino, setDestino] = useState<Destino>('local');
  const [selectedCliente, setSelectedCliente] = useState(clienteId || '');
  const [dragging, setDragging] = useState(false);
  const [uploading2, setUploading2] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setNome('');
    setTipo('Outros');
    setFile(null);
    setDestino('local');
    setSelectedCliente(clienteId || '');
    setDragging(false);
  };

  const handleFile = (f: File) => {
    setFile(f);
    if (!nome) setNome(f.name.replace(/\.[^.]+$/, ''));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // Get admin Drive token
  const getAdminToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data } = await (supabase as any)
        .from('google_drive_tokens')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', ADMIN_USER_ID)
        .maybeSingle();
      if (!data) return null;
      const expired = data.expires_at && new Date(data.expires_at) < new Date();
      if (expired && data.refresh_token) {
        const { data: r } = await supabase.functions.invoke('google-drive', {
          body: { action: 'refresh', refresh_token: data.refresh_token },
          headers: { 'apikey': 'sb_publishable__O6J3-8NscavVIOhuxsD4w_kZwkZ7pi' },
        });
        if (r?.access_token) {
          await (supabase as any).from('google_drive_tokens').update({
            access_token: r.access_token,
            expires_at: new Date(Date.now() + (r.expires_in || 3600) * 1000).toISOString(),
          }).eq('user_id', ADMIN_USER_ID);
          return r.access_token;
        }
        return null;
      }
      return data.access_token;
    } catch { return null; }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading2(true);

    try {
      const cliente = leads.find(l => l.id === selectedCliente);

      // 1. Save locally
      if (destino === 'local' || destino === 'ambos') {
        await uploadDocumento(file, {
          nome: nome || file.name,
          tipo,
          cliente_id: selectedCliente || clienteId,
          processo_id: processoId,
        });
      }

      // 2. Save to Drive
      if (destino === 'drive' || destino === 'ambos') {
        const token = await getAdminToken();
        if (!token) { toast.error('Drive não conectado'); }
        else {
          // Get or create client folder
          let folderId = 'root';
          if (cliente?.nome) {
            const { data: folderData } = await supabase.functions.invoke('google-drive', {
              body: { action: 'find_or_create_client_folder', access_token: token, client_name: cliente.nome, client_id: cliente.id },
              headers: { 'apikey': 'sb_publishable__O6J3-8NscavVIOhuxsD4w_kZwkZ7pi' },
            });
            if (folderData?.folder_id) folderId = folderData.folder_id;
          }

          // Upload file
          const reader = new FileReader();
          await new Promise<void>((resolve, reject) => {
            reader.onload = async (ev) => {
              try {
                const base64 = (ev.target?.result as string).split(',')[1];
                await supabase.functions.invoke('google-drive', {
                  body: { action: 'upload_file', access_token: token, folder_id: folderId, file_name: file.name, file_content: base64, mime_type: file.type },
                  headers: { 'apikey': 'sb_publishable__O6J3-8NscavVIOhuxsD4w_kZwkZ7pi' },
                });
                resolve();
              } catch (err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          toast.success(cliente?.nome
            ? `Salvo no Drive · Pasta de ${cliente.nome}`
            : 'Salvo no Google Drive');
        }
      }

      if (destino === 'local') toast.success('Documento salvo localmente!');
      if (destino === 'ambos') toast.success('Documento salvo local e no Drive!');

      reset();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar documento');
    } finally {
      setUploading2(false);
    }
  };

  const isLoading = uploading || uploading2;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Novo Documento
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'relative border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-all text-center',
              dragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : file
                  ? 'border-emerald-400/50 bg-emerald-50/30 dark:bg-emerald-950/10'
                  : 'border-border/50 hover:border-border hover:bg-muted/30'
            )}
          >
            <input ref={fileInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {file ? (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button type="button" className="ml-auto p-1 rounded-lg hover:bg-muted/50 transition-colors" onClick={e => { e.stopPropagation(); setFile(null); setNome(''); }}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-medium text-muted-foreground/70">Clique ou arraste o arquivo</p>
                <p className="text-xs text-muted-foreground/40">PDF, DOC, JPG, PNG e outros</p>
              </div>
            )}
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome do documento</Label>
            <Input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Contrato de Empréstimo - João Silva"
              className="h-9 rounded-xl text-sm"
              required
            />
          </div>

          {/* Tipo + Cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</Label>
              <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {['Petição','Contrato','Procuração','Documento Pessoal','Comprovante','Outros'].map(t => (
                    <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</Label>
              <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                <SelectTrigger className="h-9 rounded-xl text-sm">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-48">
                  {leads.filter(l => l.nome).sort((a, b) => (a.nome||'').localeCompare(b.nome||'')).map(l => (
                    <SelectItem key={l.id} value={l.id} className="text-sm">{l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Destino */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Salvar em</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'local', label: 'Local', sub: 'Sistema', icon: HardDrive },
                { id: 'drive', label: 'Drive', sub: 'Google', icon: Cloud },
                { id: 'ambos', label: 'Ambos', sub: 'Local + Drive', icon: CheckCircle2 },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDestino(opt.id as Destino)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center',
                    destino === opt.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border/40 hover:border-border/70 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <opt.icon className="h-5 w-5" />
                  <span className="text-xs font-semibold leading-none">{opt.label}</span>
                  <span className="text-[9px] text-muted-foreground/60 leading-none">{opt.sub}</span>
                </button>
              ))}
            </div>
            {(destino === 'drive' || destino === 'ambos') && !selectedCliente && (
              <p className="text-[11px] text-amber-600/80 flex items-center gap-1 mt-1">
                ⚠ Selecione um cliente para salvar na pasta certa do Drive
              </p>
            )}
          </div>

          {/* Submit */}
          <Button type="submit" disabled={isLoading || !file} className="w-full h-10 rounded-xl font-semibold gap-2">
            {isLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
              : <><Upload className="h-4 w-4" /> Salvar Documento</>
            }
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
