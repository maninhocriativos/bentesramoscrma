import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { useDocumentos } from '@/hooks/useDocumentos';
import { useLeads } from '@/hooks/useLeads';
import { useAuth } from '@/hooks/useAuth';
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
  FileImage, FileSpreadsheet, Link2Off,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const ADMIN_USER_ID = '5c775450-665f-4f43-99cb-efb6167d4e20';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

interface BreadcrumbItem { id: string; name: string; }

export default function DocumentosPage() {
  const { user } = useAuth();
  const { toast: toastHook } = useToast();
  const { documentos, loading: localLoading, uploadDocumento } = useDocumentos();
  const { leads } = useLeads();

  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [activeTab, setActiveTab] = useState<'drive' | 'local'>('drive');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [isOperating, setIsOperating] = useState(false);

  // ── Get access token from ADMIN account ──────────────────────────────────
  const getAdminToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data, error } = await (supabase as any)
        .from('google_drive_tokens')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', ADMIN_USER_ID)
        .maybeSingle();

      if (error || !data) return null;

      const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
      const isExpired = expiresAt && expiresAt < new Date();

      if (isExpired && data.refresh_token) {
        const { data: refreshData } = await supabase.functions.invoke('google-drive', {
          body: { action: 'refresh', refresh_token: data.refresh_token },
          headers: { 'apikey': 'sb_publishable__O6J3-8NscavVIOhuxsD4w_kZwkZ7pi' },
        });
        if (refreshData?.access_token) {
          await (supabase as any).from('google_drive_tokens').update({
            access_token: refreshData.access_token,
            expires_at: new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString(),
          }).eq('user_id', ADMIN_USER_ID);
          return refreshData.access_token;
        }
        return null;
      }

      return data.access_token;
    } catch { return null; }
  }, []);

  // ── Check if admin has Drive connected ───────────────────────────────────
  useEffect(() => {
    const check = async () => {
      const token = await getAdminToken();
      setIsConnected(!!token);
      setCheckingConnection(false);
    };
    check();
  }, [getAdminToken]);

  // ── Call Drive API via edge function ─────────────────────────────────────
  const callDrive = useCallback(async (action: string, params: Record<string, any> = {}) => {
    const accessToken = await getAdminToken();
    if (!accessToken) throw new Error('Drive não conectado');
    const { data, error } = await supabase.functions.invoke('google-drive', {
      body: { action, access_token: accessToken, ...params },
      headers: { 'apikey': 'sb_publishable__O6J3-8NscavVIOhuxsD4w_kZwkZ7pi' },
    });
    if (error || data?.error) throw new Error(data?.error || error?.message);
    return data;
  }, [getAdminToken]);

  // ── Load files ────────────────────────────────────────────────────────────
  const loadFiles = useCallback(async (folderId?: string) => {
    if (!isConnected) return;
    setDriveLoading(true);
    try {
      const data = await callDrive('list_files', { folder_id: folderId || 'root' });
      setDriveFiles(data?.files || []);
    } catch { toast.error('Erro ao carregar arquivos do Drive'); }
    finally { setDriveLoading(false); }
  }, [isConnected, callDrive]);

  useEffect(() => {
    if (isConnected) loadFiles(currentFolderId);
  }, [isConnected, currentFolderId, loadFiles]);

  const handleFolderClick = (f: DriveFile) => {
    setBreadcrumbs(p => [...p, { id: f.id, name: f.name }]);
    setCurrentFolderId(f.id);
  };

  const handleBreadcrumb = (index: number) => {
    if (index === -1) { setBreadcrumbs([]); setCurrentFolderId(undefined); return; }
    const b = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(b);
    setCurrentFolderId(b[b.length - 1].id);
  };

  const handleBack = () => {
    const b = [...breadcrumbs]; b.pop();
    setBreadcrumbs(b);
    setCurrentFolderId(b.length > 0 ? b[b.length - 1].id : undefined);
  };

  // ── Open or create client folder (year/month/client) ─────────────────────
  const handleOpenClientFolder = async () => {
    if (!selectedClient) { toast.error('Selecione um cliente'); return; }
    const client = leads.find(l => l.id === selectedClient);
    if (!client?.nome) { toast.error('Cliente não encontrado'); return; }
    setIsOperating(true);
    try {
      const data = await callDrive('find_or_create_client_folder', { client_name: client.nome, client_id: client.id });
      setBreadcrumbs([{ id: data.folder_id, name: data.folder_name }]);
      setCurrentFolderId(data.folder_id);
      toast.success(`Pasta "${data.folder_name}" aberta`);
    } catch { toast.error('Erro ao abrir pasta do cliente'); }
    finally { setIsOperating(false); }
  };

  // ── Upload to Drive ───────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentFolderId) { toast.error('Navegue até uma pasta primeiro'); return; }
    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      await callDrive('upload_file', { folder_id: currentFolderId, file_name: file.name, file_content: base64, mime_type: file.type });
      loadFiles(currentFolderId);
      toast.success('Arquivo enviado!');
      setUploadingFile(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Import from Drive to local ────────────────────────────────────────────
  const handleImport = async (driveFile: DriveFile) => {
    try {
      const data = await callDrive('download_file', { file_id: driveFile.id });
      const bytes = new Uint8Array(atob(data.content).split('').map((c: string) => c.charCodeAt(0)));
      const blob = new Blob([bytes], { type: data.mimeType });
      const fileObj = new window.File([blob], data.name, { type: data.mimeType });
      await uploadDocumento(fileObj, { nome: data.name, tipo: 'Outros' });
      toast.success('Arquivo importado!');
    } catch { toast.error('Erro ao importar arquivo'); }
  };

  // ── Open local doc ────────────────────────────────────────────────────────
  const openLocal = async (url: string) => {
    const path = url.includes('/documentos/') ? url.split('/documentos/')[1].split('?')[0] : url.split('?')[0];
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toastHook({ title: 'Erro ao abrir documento', variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank');
  };

  const isAdmin = user?.id === ADMIN_USER_ID;

  const formatSize = (s?: string) => {
    if (!s) return '—';
    const n = parseInt(s);
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n/1024).toFixed(0)} KB`;
    return `${(n/1048576).toFixed(1)} MB`;
  };

  const folders = driveFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder')
    .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const files = driveFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder')
    .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const localFiltered = documentos.filter(d =>
    d.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fileIcon = (mime: string) => {
    if (mime.includes('pdf')) return <FileText className="h-4 w-4 text-red-400 shrink-0" />;
    if (mime.includes('image')) return <FileImage className="h-4 w-4 text-blue-400 shrink-0" />;
    if (mime.includes('sheet') || mime.includes('excel')) return <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />;
    return <File className="h-4 w-4 text-muted-foreground/60 shrink-0" />;
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full min-h-0">

        {/* ── Header ── */}
        <div className="bg-background border-b border-border/50 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isConnected
                  ? 'Google Drive conectado · Acesso compartilhado com o escritório'
                  : 'Gestão de documentos do escritório'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl gap-2 text-sm"
                  onClick={async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
                    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive?action=get_auth_url`, { headers });
                    const r = await res.json();
                    if (r.authUrl) window.open(r.authUrl, 'Google Drive Auth', 'width=600,height=700');
                  }}
                >
                  {isConnected
                    ? <><span className="h-2 w-2 rounded-full bg-emerald-500" /> Drive Conectado</>
                    : <><Cloud className="h-4 w-4" /> Conectar Drive</>
                  }
                </Button>
              )}
              <Button onClick={() => setUploadModalOpen(true)} size="sm" className="h-9 rounded-xl gap-2">
                <Plus className="h-4 w-4" /> Novo Documento
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 bg-muted/50 rounded-xl p-1 w-fit">
            {[
              { id: 'drive', label: 'Google Drive', icon: Cloud, badge: null },
              { id: 'local', label: 'Armazenamento Local', icon: HardDrive, badge: documentos.length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground/80'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.badge !== null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                    activeTab === tab.id ? 'bg-muted text-muted-foreground' : 'bg-muted/80 text-muted-foreground/70'
                  }`}>{tab.badge}</span>
                )}
                {tab.id === 'drive' && isConnected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-auto">

          {/* ══ DRIVE TAB ══ */}
          {activeTab === 'drive' && (
            <div className="p-6 space-y-5">
              {checkingConnection ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !isConnected ? (
                <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
                  <div className="h-16 w-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-5 border border-border/50">
                    <Cloud className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <h3 className="font-semibold text-base mb-2">Drive não configurado</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    O administrador do sistema precisa conectar o Google Drive nas configurações.
                  </p>
                  {isAdmin && (
                    <Button className="mt-5 rounded-xl gap-2" onClick={async () => {
                      const { data: { session } } = await supabase.auth.getSession();
                      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
                      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive?action=get_auth_url`, { headers });
                      const r = await res.json();
                      if (r.authUrl) window.open(r.authUrl, '_blank', 'width=600,height=700');
                    }}>
                      <Cloud className="h-4 w-4" /> Conectar Google Drive
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Toolbar */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex gap-2 flex-1 min-w-0">
                      <Select value={selectedClient} onValueChange={setSelectedClient}>
                        <SelectTrigger className="flex-1 h-9 rounded-xl text-sm">
                          <SelectValue placeholder="Ir para pasta de cliente..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-64">
                          {leads.filter(l => l.nome).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(lead => (
                            <SelectItem key={lead.id} value={lead.id} className="text-sm">{lead.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleOpenClientFolder} disabled={!selectedClient || isOperating} size="sm" className="h-9 rounded-xl gap-1.5 shrink-0">
                        {isOperating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                        Abrir
                      </Button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar..." className="pl-9 h-9 w-44 rounded-xl text-sm" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => loadFiles(currentFolderId)} disabled={driveLoading}>
                        <RefreshCw className={`h-3.5 w-3.5 ${driveLoading ? 'animate-spin' : ''}`} />
                      </Button>
                      {currentFolderId && (
                        <>
                          <input type="file" id="drive-upload" className="hidden" onChange={handleUpload} />
                          <Button variant="outline" size="sm" className="h-9 rounded-xl gap-1.5" onClick={() => document.getElementById('drive-upload')?.click()} disabled={uploadingFile}>
                            {uploadingFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            Enviar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Breadcrumbs */}
                  <nav className="flex items-center gap-1 text-sm flex-wrap">
                    <button onClick={() => handleBreadcrumb(-1)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-lg hover:bg-muted/50">
                      <Home className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Meu Drive</span>
                    </button>
                    {breadcrumbs.map((c, i) => (
                      <span key={c.id} className="flex items-center gap-1">
                        <ChevronRight className="h-3.5 w-3.5 text-border" />
                        <button
                          onClick={() => handleBreadcrumb(i)}
                          className={`py-1 px-2 rounded-lg transition-colors ${i === breadcrumbs.length - 1
                            ? 'text-foreground font-medium bg-muted/50'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                        >{c.name}</button>
                      </span>
                    ))}
                    {breadcrumbs.length > 0 && (
                      <button onClick={handleBack} className="ml-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <ArrowLeft className="h-3 w-3" /> Voltar
                      </button>
                    )}
                  </nav>

                  {/* Files */}
                  {driveLoading ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                        {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}
                      </div>
                      <Skeleton className="h-48 rounded-2xl" />
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/50 rounded-2xl">
                      <Folder className="h-10 w-10 text-muted-foreground/20 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground/60">
                        {currentFolderId ? 'Pasta vazia' : 'Nenhum arquivo na raiz'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Folders grid */}
                      {folders.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">
                            Pastas · {folders.length}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                            {folders.map(f => (
                              <button
                                key={f.id}
                                onClick={() => handleFolderClick(f)}
                                className="group flex items-center gap-3 p-3.5 rounded-2xl border border-border/40 bg-card hover:border-amber-400/40 hover:bg-amber-50/20 dark:hover:bg-amber-950/10 transition-all text-left"
                              >
                                <Folder className="h-8 w-8 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold truncate leading-snug">{f.name}</p>
                                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">Pasta</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Files table */}
                      {files.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">
                            Arquivos · {files.length}
                          </p>
                          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border/30">
                                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-4 py-3">Nome</th>
                                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-4 py-3 hidden sm:table-cell">Tamanho</th>
                                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-4 py-3 hidden md:table-cell">Modificado</th>
                                  <th className="w-20 px-4 py-3" />
                                </tr>
                              </thead>
                              <tbody>
                                {files.map((f, i) => (
                                  <tr key={f.id} className={`group hover:bg-muted/30 transition-colors ${i < files.length - 1 ? 'border-b border-border/20' : ''}`}>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        {fileIcon(f.mimeType)}
                                        <span className="font-medium truncate max-w-[180px] sm:max-w-[260px] md:max-w-none">{f.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">{formatSize(f.size)}</td>
                                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                                      {f.modifiedTime ? format(new Date(f.modifiedTime), "dd MMM yy", { locale: ptBR }) : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => window.open(f.webViewLink, '_blank')} title="Abrir no Drive">
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => handleImport(f)} title="Importar para o sistema">
                                          <Download className="h-3.5 w-3.5" />
                                        </Button>
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

          {/* ══ LOCAL TAB ══ */}
          {activeTab === 'local' && (
            <div className="p-6 space-y-5">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar documentos locais..." className="pl-9 h-9 rounded-xl text-sm" />
              </div>

              {localLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
              ) : localFiltered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/50 rounded-2xl">
                  <HardDrive className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground/60">Nenhum documento local</p>
                  <p className="text-xs text-muted-foreground/40 mt-1">Clique em "Novo Documento" para adicionar</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-4 py-3">Nome</th>
                        <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-4 py-3 hidden sm:table-cell">Tipo</th>
                        <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-4 py-3 hidden md:table-cell">Data</th>
                        <th className="w-16 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {localFiltered.map((doc, i) => (
                        <tr key={doc.id} className={`group hover:bg-muted/30 transition-colors ${i < localFiltered.length - 1 ? 'border-b border-border/20' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-primary/50 shrink-0" />
                              <span className="font-medium truncate max-w-[200px]">{doc.nome}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <Badge variant="outline" className="text-[10px] rounded-md px-1.5 font-medium">{doc.tipo}</Badge>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                            {format(new Date(doc.created_at), "dd MMM yy", { locale: ptBR })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openLocal(doc.arquivo_url)}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
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
    </AppLayout>
  );
}
