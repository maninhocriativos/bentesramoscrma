import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useRef, useCallback } from 'react';
import { useDocumentos } from '@/hooks/useDocumentos';
import { useLeads } from '@/hooks/useLeads';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload, HardDrive, Cloud, FileText, X, CheckCircle2,
  Loader2, Folder, ChevronRight, FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type TipoDoc = 'Petição' | 'Contrato' | 'Procuração' | 'Documento Pessoal' | 'Comprovante' | 'Outros';
type Destino = 'local' | 'drive' | 'ambos';

interface DriveFolder { id: string; name: string; mimeType: string; }
interface FolderCrumb  { id: string; name: string; }

interface DocumentoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId?: string;
  processoId?: string;
  driveFolder?: FolderCrumb; // pasta já aberta no Drive quando o modal é aberto
}

const ANON_KEY = 'sb_publishable__O6J3-8NscavVIOhuxsD4w_kZwkZ7pi';

export function DocumentoUploadModal({
  open, onOpenChange, clienteId, processoId, driveFolder,
}: DocumentoUploadModalProps) {
  const { uploadDocumento, uploading } = useDocumentos(processoId, clienteId);
  const { leads } = useLeads();

  const [nome,           setNome]           = useState('');
  const [tipo,           setTipo]           = useState<TipoDoc>('Outros');
  const [file,           setFile]           = useState<File | null>(null);
  const [destino,        setDestino]        = useState<Destino>('local');
  const [selectedCliente, setSelectedCliente] = useState(clienteId || '');
  const [dragging,       setDragging]       = useState(false);
  const [uploading2,     setUploading2]     = useState(false);

  // Folder picker state
  const [driveFolderTarget, setDriveFolderTarget] = useState<FolderCrumb | null>(driveFolder || null);
  const [folderPickerOpen,  setFolderPickerOpen]  = useState(false);
  const [pickerCrumbs,      setPickerCrumbs]      = useState<FolderCrumb[]>([]);
  const [pickerItems,       setPickerItems]        = useState<DriveFolder[]>([]);
  const [pickerLoading,     setPickerLoading]      = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setNome('');
    setTipo('Outros');
    setFile(null);
    setDestino('local');
    setSelectedCliente(clienteId || '');
    setDragging(false);
    setDriveFolderTarget(driveFolder || null);
    setFolderPickerOpen(false);
    setPickerCrumbs([]);
    setPickerItems([]);
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

  const getAdminToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data } = await supabase.functions.invoke('google-drive', {
        body: { action: 'get_office_token' },
        headers: { apikey: ANON_KEY },
      });
      return data?.connected && data?.access_token ? data.access_token : null;
    } catch { return null; }
  }, []);

  const loadPickerFolder = async (folderId?: string) => {
    setPickerLoading(true);
    try {
      const token = await getAdminToken();
      if (!token) { toast.error('Drive não conectado'); return; }
      const { data } = await supabase.functions.invoke('google-drive', {
        body: { action: 'list_files', access_token: token, folder_id: folderId || 'root' },
        headers: { apikey: ANON_KEY },
      });
      const folders = ((data?.files || []) as DriveFolder[]).filter(
        f => f.mimeType === 'application/vnd.google-apps.folder'
      );
      setPickerItems(folders);
    } catch { toast.error('Erro ao carregar pastas'); }
    finally { setPickerLoading(false); }
  };

  const openFolderPicker = () => {
    if (folderPickerOpen) { setFolderPickerOpen(false); return; }
    setPickerCrumbs([]);
    loadPickerFolder();
    setFolderPickerOpen(true);
  };

  const pickerEnterFolder = (f: DriveFolder) => {
    const nc = [...pickerCrumbs, { id: f.id, name: f.name }];
    setPickerCrumbs(nc);
    loadPickerFolder(f.id);
  };

  const pickerGoTo = (idx: number) => {
    if (idx === -1) { setPickerCrumbs([]); loadPickerFolder(); return; }
    const nc = pickerCrumbs.slice(0, idx + 1);
    setPickerCrumbs(nc);
    loadPickerFolder(nc[nc.length - 1].id);
  };

  const selectCurrentFolder = () => {
    const current = pickerCrumbs.length > 0
      ? pickerCrumbs[pickerCrumbs.length - 1]
      : null; // null = raiz
    setDriveFolderTarget(current);
    setFolderPickerOpen(false);
  };

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
          let folderId = 'root';

          if (driveFolderTarget?.id) {
            // User explicitly picked a folder
            folderId = driveFolderTarget.id;
          } else if (cliente?.nome) {
            // Auto: find or create client folder
            const { data: folderData } = await supabase.functions.invoke('google-drive', {
              body: {
                action: 'find_or_create_client_folder',
                access_token: token,
                client_name: cliente.nome,
                client_id: cliente.id,
              },
              headers: { apikey: ANON_KEY },
            });
            if (folderData?.folder_id) folderId = folderData.folder_id;
          }

          const reader = new FileReader();
          await new Promise<void>((resolve, reject) => {
            reader.onload = async (ev) => {
              try {
                const base64 = (ev.target?.result as string).split(',')[1];
                await supabase.functions.invoke('google-drive', {
                  body: {
                    action: 'upload_file',
                    access_token: token,
                    folder_id: folderId,
                    file_name: file.name,
                    file_content: base64,
                    mime_type: file.type,
                  },
                  headers: { apikey: ANON_KEY },
                });
                resolve();
              } catch (err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          const folderLabel = driveFolderTarget?.name
            ? `Pasta "${driveFolderTarget.name}"`
            : cliente?.nome
              ? `Pasta de ${cliente.nome}`
              : 'Raiz do Drive';
          toast.success(`Salvo no Drive · ${folderLabel}`);
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
  const showDriveFolder = destino === 'drive' || destino === 'ambos';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Novo Documento
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

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
                { id: 'local', label: 'Local',  sub: 'Sistema',      icon: HardDrive  },
                { id: 'drive', label: 'Drive',  sub: 'Google',       icon: Cloud      },
                { id: 'ambos', label: 'Ambos',  sub: 'Local + Drive',icon: CheckCircle2 },
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
          </div>

          {/* Pasta de destino no Drive */}
          {showDriveFolder && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pasta de destino no Drive</Label>

              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 h-9 px-3 rounded-xl border border-border/40 bg-muted/20 flex items-center gap-2 text-sm">
                  <Folder className="h-3.5 w-3.5 text-[#c9a96e] shrink-0" />
                  <span className="truncate text-sm">
                    {driveFolderTarget
                      ? driveFolderTarget.name
                      : selectedCliente
                        ? `Auto — pasta do cliente`
                        : 'Raiz do Drive'}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl shrink-0 gap-1.5"
                  onClick={openFolderPicker}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  {folderPickerOpen ? 'Fechar' : 'Selecionar'}
                </Button>
                {driveFolderTarget && (
                  <button
                    type="button"
                    className="h-9 w-9 flex items-center justify-center rounded-xl border border-border/40 hover:bg-muted/50 transition-colors shrink-0"
                    title="Usar pasta automática"
                    onClick={() => setDriveFolderTarget(null)}
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Inline folder browser */}
              {folderPickerOpen && (
                <div className="border border-border/40 rounded-xl overflow-hidden bg-card">
                  {/* Breadcrumb nav */}
                  <div className="flex items-center gap-0.5 px-2 py-1.5 bg-muted/30 border-b border-border/30 text-xs flex-wrap">
                    <button
                      type="button"
                      onClick={() => pickerGoTo(-1)}
                      className="text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/60 transition-colors font-medium"
                    >
                      Raiz
                    </button>
                    {pickerCrumbs.map((c, i) => (
                      <span key={c.id} className="flex items-center">
                        <ChevronRight className="h-2.5 w-2.5 text-border/60 mx-0.5" />
                        <button
                          type="button"
                          onClick={() => pickerGoTo(i)}
                          className={cn(
                            'px-1.5 py-0.5 rounded hover:bg-muted/60 transition-colors font-medium truncate max-w-[100px]',
                            i === pickerCrumbs.length - 1 ? 'text-[#c9a96e]' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {c.name}
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Select current location */}
                  <button
                    type="button"
                    onClick={selectCurrentFolder}
                    className="w-full text-left px-3 py-2.5 text-xs font-semibold text-[#c9a96e] hover:bg-[#c9a96e]/5 border-b border-border/20 transition-colors flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Salvar aqui: <span className="font-bold">{pickerCrumbs.length > 0 ? pickerCrumbs[pickerCrumbs.length - 1].name : 'Raiz do Drive'}</span>
                  </button>

                  {/* Folder list */}
                  <div className="max-h-36 overflow-y-auto">
                    {pickerLoading ? (
                      <div className="flex items-center justify-center py-5">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : pickerItems.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground/40 py-5">Nenhuma subpasta</p>
                    ) : (
                      pickerItems.map((f, i) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => pickerEnterFolder(f)}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40 transition-colors text-left',
                            i < pickerItems.length - 1 && 'border-b border-border/10'
                          )}
                        >
                          <Folder className="h-4 w-4 text-[#c9a96e] shrink-0" />
                          <span className="flex-1 truncate">{f.name}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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
