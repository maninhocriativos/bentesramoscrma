import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useDocumentos } from '@/hooks/useDocumentos';
import { useLeads } from '@/hooks/useLeads';
import { usePerfil } from '@/hooks/usePerfil';
import { DocumentoUploadModal } from '@/components/documentos/DocumentoUploadModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Folder, File, FileText, Upload, ArrowLeft, Search,
  Loader2, Plus, RefreshCw, ExternalLink, Download,
  Cloud, HardDrive, ChevronRight, Home, FolderOpen,
  FileImage, FileSpreadsheet, FolderPlus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const ANON_KEY = 'sb_publishable__O6J3-8NscavVIOhuxsD4w_kZwkZ7pi';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
}
interface Crumb { id: string; name: string; }

export default function DocumentosPage() {
  const { canAccessSettings: isAdmin } = usePerfil();
  const { toast: toastHook } = useToast();
  const { documentos, loading: localLoading, uploadDocumento } = useDocumentos();
  const { leads } = useLeads();

  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [checkingConn, setCheckingConn] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>();
  const [breadcrumbs, setBreadcrumbs] = useState<Crumb[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [activeTab, setActiveTab] = useState<'drive' | 'local'>('drive');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [isOperating, setIsOperating] = useState(false);
  const [newFolderDialog, setNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Busca o token do Drive compartilhado do escritório via edge function
  // (service role no servidor — não depende de RLS, funciona para todos os usuários)
  const getAdminToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data } = await supabase.functions.invoke('google-drive', {
        body: { action: 'get_office_token' },
        headers: { apikey: ANON_KEY },
      });
      if (data?.connected && data?.access_token) return data.access_token;
      return null;
    } catch { return null; }
  }, []);

  const callDrive = useCallback(async (action: string, params: Record<string, any> = {}) => {
    const token = await getAdminToken();
    if (!token) throw new Error('Drive não conectado');
    const { data, error } = await supabase.functions.invoke('google-drive', { body: { action, access_token: token, ...params }, headers: { apikey: ANON_KEY } });
    if (error || data?.error) throw new Error(data?.error || error?.message);
    return data;
  }, [getAdminToken]);

  useEffect(() => {
    getAdminToken().then(t => { setIsConnected(!!t); setCheckingConn(false); });
  }, [getAdminToken]);

  const loadFiles = useCallback(async (fid?: string) => {
    if (!isConnected) return;
    setDriveLoading(true);
    try {
      const d = await callDrive('list_files', { folder_id: fid || 'root' });
      setDriveFiles(d?.files || []);
    } catch { toast.error('Erro ao carregar arquivos'); }
    finally { setDriveLoading(false); }
  }, [isConnected, callDrive]);

  useEffect(() => { if (isConnected) loadFiles(currentFolderId); }, [isConnected, currentFolderId, loadFiles]);

  const enterFolder = (f: DriveFile) => { setBreadcrumbs(p => [...p, { id: f.id, name: f.name }]); setCurrentFolderId(f.id); };
  const goBreadcrumb = (i: number) => {
    if (i === -1) { setBreadcrumbs([]); setCurrentFolderId(undefined); return; }
    const b = breadcrumbs.slice(0, i + 1); setBreadcrumbs(b); setCurrentFolderId(b[b.length - 1].id);
  };
  const goBack = () => { const b = [...breadcrumbs]; b.pop(); setBreadcrumbs(b); setCurrentFolderId(b.length > 0 ? b[b.length - 1].id : undefined); };

  const openClientFolder = async () => {
    if (!selectedClient) { toast.error('Selecione um cliente'); return; }
    const c = leads.find(l => l.id === selectedClient);
    if (!c?.nome) return;
    setIsOperating(true);
    try {
      const d = await callDrive('find_or_create_client_folder', { client_name: c.nome, client_id: c.id });
      setBreadcrumbs([{ id: d.folder_id, name: d.folder_name }]);
      setCurrentFolderId(d.folder_id);
      toast.success(`Pasta "${d.folder_name}" aberta`);
    } catch { toast.error('Erro ao abrir pasta'); }
    finally { setIsOperating(false); }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    try {
      const d = await callDrive('create_folder', {
        folder_name: name,
        parent_id: currentFolderId || 'root',
      });
      toast.success(`Pasta "${d.folder_name || name}" criada`);
      setNewFolderName('');
      setNewFolderDialog(false);
      loadFiles(currentFolderId);
    } catch { toast.error('Erro ao criar pasta'); }
    finally { setCreatingFolder(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !currentFolderId) { toast.error('Navegue até uma pasta primeiro'); return; }
    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = (ev.target?.result as string).split(',')[1];
      await callDrive('upload_file', { folder_id: currentFolderId, file_name: f.name, file_content: b64, mime_type: f.type });
      loadFiles(currentFolderId); toast.success('Arquivo enviado!'); setUploadingFile(false);
    };
    reader.readAsDataURL(f); e.target.value = '';
  };

  const importFile = async (df: DriveFile) => {
    try {
      const d = await callDrive('download_file', { file_id: df.id });
      const bytes = new Uint8Array(atob(d.content).split('').map((c: string) => c.charCodeAt(0)));
      const blob = new Blob([bytes], { type: d.mimeType });
      await uploadDocumento(new window.File([blob], d.name, { type: d.mimeType }), { nome: d.name, tipo: 'Outros' });
      toast.success('Arquivo importado!');
    } catch { toast.error('Erro ao importar'); }
  };

  const openLocal = async (url: string) => {
    const path = url.includes('/documentos/') ? url.split('/documentos/')[1].split('?')[0] : url.split('?')[0];
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toastHook({ title: 'Erro ao abrir documento', variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank');
  };

  const fmtSize = (s?: string) => { if (!s) return '—'; const n = parseInt(s); if (n < 1024) return `${n}B`; if (n < 1048576) return `${(n/1024).toFixed(0)}KB`; return `${(n/1048576).toFixed(1)}MB`; };
  const fmtDate = (d?: string) => d ? format(new Date(d), "dd MMM yy", { locale: ptBR }) : '—';

  const folders = driveFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder' && f.name.toLowerCase().includes(search.toLowerCase()));
  const files   = driveFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && f.name.toLowerCase().includes(search.toLowerCase()));
  const localList = documentos.filter(d => d.nome.toLowerCase().includes(search.toLowerCase()) || d.tipo.toLowerCase().includes(search.toLowerCase()));

  const FileIcon = ({ mime }: { mime: string }) => {
    if (mime.includes('pdf')) return <FileText className="h-4 w-4 text-rose-400 shrink-0" />;
    if (mime.includes('image')) return <FileImage className="h-4 w-4 text-sky-400 shrink-0" />;
    if (mime.includes('sheet') || mime.includes('excel')) return <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />;
    return <File className="h-4 w-4 text-muted-foreground/50 shrink-0" />;
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-background">

        {/* ══ HERO HEADER ══ */}
        <div className="relative overflow-hidden border-b border-border/40">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#3d2b1f]/8 via-transparent to-[#c9a96e]/5 pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#c9a96e]/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />

          <div className="relative px-8 pt-7 pb-5">
            {/* Title row */}
            <div className="flex items-start justify-between gap-6 mb-6">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="h-7 w-1 rounded-full bg-[#c9a96e]" />
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">Documentos</h1>
                </div>
                <p className="text-sm text-muted-foreground ml-3.5 pl-0.5">
                  {checkingConn ? 'Verificando conexão...' : isConnected
                    ? '✦ Google Drive conectado · Acesso compartilhado com o escritório'
                    : 'Gestão de documentos e arquivos do escritório'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isAdmin && (
                  <button
                    onClick={async () => {
                      const { data: { session } } = await supabase.auth.getSession();
                      const h: Record<string, string> = { 'Content-Type': 'application/json' };
                      if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`;
                      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive?action=get_auth_url`, { headers: h });
                      const r = await res.json();
                      if (r.authUrl) window.open(r.authUrl, 'Google Drive Auth', 'width=600,height=700');
                    }}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${isConnected ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-600 hover:bg-emerald-500/15' : 'border-border/50 bg-muted/40 text-muted-foreground hover:bg-muted/70'}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                    {isConnected ? 'Drive Conectado' : 'Conectar Drive'}
                  </button>
                )}
                {!isAdmin && isConnected && (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-emerald-500/30 bg-emerald-500/8 text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Drive Conectado
                  </div>
                )}
                <Button
                  onClick={() => setUploadModalOpen(true)}
                  size="sm"
                  className="h-9 px-4 rounded-xl gap-2 font-semibold bg-[#3d2b1f] hover:bg-[#2d1f16] text-white border-0 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo Documento
                </Button>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-6 mb-5">
              {[
                { label: 'Pastas', value: folders.length || '—', show: activeTab === 'drive' && isConnected },
                { label: 'Arquivos no Drive', value: files.length || '—', show: activeTab === 'drive' && isConnected },
                { label: 'Documentos locais', value: documentos.length, show: true },
              ].filter(s => s.show).map(s => (
                <div key={s.label} className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-foreground">{s.value}</span>
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-transparent">
              {[
                { id: 'drive', label: 'Google Drive', icon: Cloud },
                { id: 'local', label: 'Armazenamento Local', icon: HardDrive },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-2 px-4 pb-3 pt-1 text-sm font-medium border-b-2 transition-all ${
                    activeTab === t.id
                      ? 'border-[#c9a96e] text-[#c9a96e]'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                  {t.id === 'local' && documentos.length > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-bold">{documentos.length}</span>
                  )}
                  {t.id === 'drive' && isConnected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ══ CONTENT ══ */}
        <div className="flex-1 overflow-auto px-8 py-6">

          {/* ── DRIVE ── */}
          {activeTab === 'drive' && (
            <div className="space-y-6">
              {checkingConn ? (
                <div className="flex items-center justify-center py-24">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-[#c9a96e]/60" />
                    <p className="text-sm text-muted-foreground">Conectando ao Drive...</p>
                  </div>
                </div>
              ) : !isConnected ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="h-20 w-20 rounded-3xl border border-border/30 bg-muted/20 flex items-center justify-center mb-6">
                    <Cloud className="h-9 w-9 text-muted-foreground/30" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">Drive não configurado</h3>
                  <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                    {isAdmin ? 'Conecte sua conta Google para sincronizar documentos com o escritório.' : 'O administrador precisa conectar o Google Drive.'}
                  </p>
                  {isAdmin && (
                    <Button className="mt-6 rounded-xl gap-2 bg-[#3d2b1f] hover:bg-[#2d1f16] text-white" onClick={async () => {
                      const { data: { session } } = await supabase.auth.getSession();
                      const h: Record<string, string> = { 'Content-Type': 'application/json' };
                      if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`;
                      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive?action=get_auth_url`, { headers: h });
                      const r = await res.json(); if (r.authUrl) window.open(r.authUrl, '_blank', 'width=600,height=700');
                    }}>
                      <Cloud className="h-4 w-4" /> Conectar Google Drive
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Toolbar */}
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="flex gap-2 flex-1 min-w-0">
                      <Select value={selectedClient} onValueChange={setSelectedClient}>
                        <SelectTrigger className="flex-1 h-9 rounded-xl text-sm bg-card border-border/40">
                          <SelectValue placeholder="Ir para pasta de cliente..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-64">
                          {leads.filter(l => l.nome).sort((a, b) => (a.nome||'').localeCompare(b.nome||'')).map(l => (
                            <SelectItem key={l.id} value={l.id} className="text-sm">{l.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={openClientFolder} disabled={!selectedClient || isOperating} size="sm" className="h-9 rounded-xl gap-1.5 shrink-0 bg-[#3d2b1f] hover:bg-[#2d1f16] text-white">
                        {isOperating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                        Abrir
                      </Button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 h-9 w-40 rounded-xl text-sm bg-card border-border/40" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted/50" onClick={() => loadFiles(currentFolderId)} disabled={driveLoading}>
                        <RefreshCw className={`h-3.5 w-3.5 ${driveLoading ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl gap-1.5 border-border/40"
                        onClick={() => setNewFolderDialog(true)}
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        Nova Pasta
                      </Button>
                      {currentFolderId && (
                        <>
                          <input type="file" id="drive-upload" className="hidden" onChange={handleUpload} />
                          <Button variant="outline" size="sm" className="h-9 rounded-xl gap-1.5 border-border/40" onClick={() => document.getElementById('drive-upload')?.click()} disabled={uploadingFile}>
                            {uploadingFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            Enviar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Breadcrumbs */}
                  <nav className="flex items-center gap-0.5 text-sm flex-wrap -mt-2">
                    <button onClick={() => goBreadcrumb(-1)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all text-xs font-medium">
                      <Home className="h-3 w-3" /> Meu Drive
                    </button>
                    {breadcrumbs.map((c, i) => (
                      <span key={c.id} className="flex items-center">
                        <ChevronRight className="h-3 w-3 text-border mx-0.5" />
                        <button
                          onClick={() => goBreadcrumb(i)}
                          className={`px-2.5 py-1.5 rounded-lg transition-all text-xs font-medium ${i === breadcrumbs.length - 1
                            ? 'bg-[#c9a96e]/10 text-[#c9a96e] border border-[#c9a96e]/20'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}
                        >{c.name}</button>
                      </span>
                    ))}
                    {breadcrumbs.length > 0 && (
                      <button onClick={goBack} className="ml-2 flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-all">
                        <ArrowLeft className="h-3 w-3" /> Voltar
                      </button>
                    )}
                  </nav>

                  {/* Files */}
                  {driveLoading ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
                      </div>
                      <Skeleton className="h-56 rounded-2xl" />
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border/30 rounded-2xl">
                      <Folder className="h-12 w-12 text-muted-foreground/15 mb-3" />
                      <p className="text-sm text-muted-foreground/50 font-medium">{currentFolderId ? 'Pasta vazia' : 'Nenhum arquivo'}</p>
                    </div>
                  ) : (
                    <div className="space-y-6">

                      {/* Folders */}
                      {folders.length > 0 && (
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Pastas</span>
                            <div className="flex-1 h-px bg-border/30" />
                            <span className="text-[10px] text-muted-foreground/40">{folders.length}</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
                            {folders.map(f => (
                              <button
                                key={f.id}
                                onClick={() => enterFolder(f)}
                                className="group relative flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/30 hover:border-[#c9a96e]/40 hover:shadow-sm transition-all text-left overflow-hidden"
                              >
                                <div className="absolute inset-0 bg-gradient-to-br from-[#c9a96e]/0 to-[#c9a96e]/0 group-hover:from-[#c9a96e]/3 group-hover:to-transparent transition-all" />
                                <Folder className="h-8 w-8 text-[#c9a96e] shrink-0 group-hover:scale-105 transition-transform" />
                                <div className="min-w-0 relative">
                                  <p className="text-xs font-semibold truncate leading-snug text-foreground">{f.name}</p>
                                  <p className="text-[9px] text-muted-foreground/40 mt-0.5 font-medium uppercase tracking-wide">Pasta</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Files */}
                      {files.length > 0 && (
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Arquivos</span>
                            <div className="flex-1 h-px bg-border/30" />
                            <span className="text-[10px] text-muted-foreground/40">{files.length}</span>
                          </div>
                          <div className="rounded-2xl border border-border/30 bg-card overflow-hidden shadow-sm">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-border/20 bg-muted/20">
                                  <th className="text-left text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest px-5 py-3">Nome</th>
                                  <th className="text-left text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest px-5 py-3 hidden sm:table-cell">Tamanho</th>
                                  <th className="text-left text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest px-5 py-3 hidden md:table-cell">Modificado</th>
                                  <th className="w-24 px-5 py-3" />
                                </tr>
                              </thead>
                              <tbody>
                                {files.map((f, i) => (
                                  <tr key={f.id} className={`group hover:bg-[#c9a96e]/3 transition-colors ${i < files.length - 1 ? 'border-b border-border/15' : ''}`}>
                                    <td className="px-5 py-3.5">
                                      <div className="flex items-center gap-3">
                                        <FileIcon mime={f.mimeType} />
                                        <span className="text-sm font-medium truncate max-w-[180px] sm:max-w-[280px] md:max-w-none">{f.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-5 py-3.5 hidden sm:table-cell">
                                      <span className="text-xs text-muted-foreground/60 font-medium tabular-nums">{fmtSize(f.size)}</span>
                                    </td>
                                    <td className="px-5 py-3.5 hidden md:table-cell">
                                      <span className="text-xs text-muted-foreground/60">{fmtDate(f.modifiedTime)}</span>
                                    </td>
                                    <td className="px-5 py-3.5">
                                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => window.open(f.webViewLink, '_blank')} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all" title="Abrir no Drive">
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => importFile(f)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all" title="Importar para o sistema">
                                          <Download className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── LOCAL ── */}
          {activeTab === 'local' && (
            <div className="space-y-5">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar documentos..." className="pl-9 h-9 rounded-xl text-sm bg-card border-border/40" />
              </div>

              {localLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
              ) : localList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border/30 rounded-2xl">
                  <HardDrive className="h-12 w-12 text-muted-foreground/15 mb-3" />
                  <p className="text-sm text-muted-foreground/50 font-medium">Nenhum documento local</p>
                  <p className="text-xs text-muted-foreground/30 mt-1">Clique em "Novo Documento" para adicionar</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/30 bg-card overflow-hidden shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/20 bg-muted/20">
                        <th className="text-left text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest px-5 py-3">Nome</th>
                        <th className="text-left text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest px-5 py-3 hidden sm:table-cell">Tipo</th>
                        <th className="text-left text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest px-5 py-3 hidden md:table-cell">Data</th>
                        <th className="w-16 px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {localList.map((d, i) => (
                        <tr key={d.id} className={`group hover:bg-[#c9a96e]/3 transition-colors ${i < localList.length - 1 ? 'border-b border-border/15' : ''}`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-[#c9a96e]/60 shrink-0" />
                              <span className="text-sm font-medium truncate max-w-[200px]">{d.nome}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 hidden sm:table-cell">
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-semibold border border-border/30">{d.tipo}</span>
                          </td>
                          <td className="px-5 py-3.5 hidden md:table-cell">
                            <span className="text-xs text-muted-foreground/60">{fmtDate(d.created_at)}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openLocal(d.arquivo_url)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <DocumentoUploadModal open={uploadModalOpen} onOpenChange={setUploadModalOpen} />

      {/* ── Dialog Nova Pasta ── */}
      {newFolderDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setNewFolderDialog(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border/40 shadow-2xl p-6">
            <h2 className="text-base font-bold mb-1">Nova Pasta</h2>
            <p className="text-xs text-muted-foreground mb-4">
              {currentFolderId
                ? `Será criada em: ${breadcrumbs[breadcrumbs.length - 1]?.name || 'pasta atual'}`
                : 'Será criada na raiz do Drive'}
            </p>
            <Input
              autoFocus
              placeholder="Nome da pasta"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setNewFolderDialog(false); }}
              className="mb-4"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setNewFolderDialog(false); setNewFolderName(''); }}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="rounded-xl gap-1.5 bg-[#3d2b1f] hover:bg-[#2d1f16] text-white"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || creatingFolder}
              >
                {creatingFolder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
                Criar
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
