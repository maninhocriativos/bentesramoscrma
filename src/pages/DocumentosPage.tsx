import { useState, useEffect, useCallback } from 'react';
import { useDocumentos } from '@/hooks/useDocumentos';
import { useLeads } from '@/hooks/useLeads';
import { usePerfil } from '@/hooks/usePerfil';
import { DocumentoUploadModal } from '@/components/documentos/DocumentoUploadModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Folder, File, FileText, Upload, ArrowLeft, Search,
  Loader2, Plus, RefreshCw, ExternalLink, Download,
  Cloud, HardDrive, ChevronRight, Home, FolderOpen,
  FileImage, FileSpreadsheet, FolderPlus, Eye, X, FolderInput, Trash2,
  MoreVertical,
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
  thumbnailLink?: string;
}
interface Crumb { id: string; name: string; }

// Classificação por tipo de arquivo (mime ou extensão) — usada pro ícone
// colorido nas tabelas e pela pílula "Tipo" na aba local. Cores do design
// (Figma SISTEMA-BENTES-E-RAMOS, tela "Gestão de Documentos", 2026-09-10).
type FileCat = 'pdf' | 'doc' | 'image' | 'sheet' | 'other';

function categorize(nameOrMime: string): FileCat {
  const s = (nameOrMime || '').toLowerCase();
  if (s.includes('pdf')) return 'pdf';
  if (s.includes('sheet') || s.includes('excel') || /\.(xlsx?|csv)$/.test(s)) return 'sheet';
  if (s.includes('image') || /\.(jpe?g|png|gif|webp|bmp)$/.test(s)) return 'image';
  if (s.includes('word') || s.includes('document') || /\.(docx?|odt)$/.test(s)) return 'doc';
  return 'other';
}

const FILE_CAT_STYLE: Record<FileCat, { icon: typeof FileText; iconBg: string; iconColor: string; pillBg: string; pillText: string; label: string }> = {
  doc:   { icon: FileText,       iconBg: 'rgba(21,101,192,0.08)', iconColor: '#1565c0', pillBg: '#e8f0fe', pillText: '#1565c0', label: 'docx' },
  pdf:   { icon: FileText,       iconBg: 'rgba(198,40,40,0.08)',  iconColor: '#c62828', pillBg: '#fdecea', pillText: '#c62828', label: 'pdf' },
  image: { icon: FileImage,      iconBg: 'rgba(173,20,87,0.08)',  iconColor: '#ad1457', pillBg: '#fce4ec', pillText: '#ad1457', label: 'imagem' },
  sheet: { icon: FileSpreadsheet, iconBg: 'rgba(46,125,50,0.08)', iconColor: '#2e7d32', pillBg: '#e8f5e9', pillText: '#2e7d32', label: 'planilha' },
  other: { icon: File,           iconBg: '#f0eae1',               iconColor: '#6e5e5a', pillBg: '#f0eae1', pillText: '#6e5e5a', label: 'arquivo' },
};

export default function DocumentosPage() {
  const { canAccessSettings: isAdmin } = usePerfil();
  const { toast: toastHook } = useToast();
  const { documentos, loading: localLoading, uploadDocumento, deleteDocumento, fetchDocumentos } = useDocumentos();
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
  const [preview, setPreview] = useState<{ name: string; mime: string; url: string; isBlob: boolean } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'drive' | 'local'; id: string; name: string; arquivoUrl?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      const loadedFiles: DriveFile[] = d?.files || [];
      setDriveFiles(loadedFiles);
      setThumbnails({});
      // Miniatura real só pra imagens -- busca em paralelo, sem bloquear a lista.
      loadedFiles.filter(f => f.mimeType.startsWith('image/') && f.thumbnailLink).forEach(f => {
        callDrive('get_thumbnail', { thumbnail_url: f.thumbnailLink })
          .then(t => { if (t?.content) setThumbnails(prev => ({ ...prev, [f.id]: `data:${t.mimeType};base64,${t.content}` })); })
          .catch(() => {});
      });
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

  // Aceita um id explícito (vindo do próprio onValueChange do Select) em vez
  // de só ler `selectedClient` do state — evita abrir a pasta errada por
  // causa do delay do setState (o Select já dispara a busca ao escolher,
  // sem precisar de um botão "Abrir" separado).
  const openClientFolder = async (clienteIdParam?: string) => {
    const clienteId = clienteIdParam ?? selectedClient;
    if (!clienteId) { toast.error('Selecione um cliente'); return; }
    const c = leads.find(l => l.id === clienteId);
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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'local') {
        await deleteDocumento(deleteTarget.id, deleteTarget.arquivoUrl || '');
      } else {
        await callDrive('delete_file', { file_id: deleteTarget.id });
        toast.success(`"${deleteTarget.name}" movido para a lixeira do Drive`);
        loadFiles(currentFolderId);
      }
      setDeleteTarget(null);
    } catch {
      toast.error('Erro ao excluir');
    } finally {
      setDeleting(false);
    }
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

  const guessMime = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    if (ext === 'pdf') return 'application/pdf';
    return 'application/octet-stream';
  };

  const triggerBlobDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const closePreview = () => {
    if (preview?.isBlob && preview.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const openDrivePreview = async (f: DriveFile) => {
    setPreviewLoading(true);
    setPreview({ name: f.name, mime: f.mimeType, url: '', isBlob: true });
    try {
      const d = await callDrive('download_file', { file_id: f.id });
      const bytes = Uint8Array.from(atob(d.content), (c: string) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: d.mimeType || f.mimeType });
      setPreview({ name: f.name, mime: d.mimeType || f.mimeType, url: URL.createObjectURL(blob), isBlob: true });
    } catch { toast.error('Erro ao carregar prévia'); setPreview(null); }
    finally { setPreviewLoading(false); }
  };

  const downloadDriveFile = async (f: DriveFile) => {
    try {
      const d = await callDrive('download_file', { file_id: f.id });
      const bytes = Uint8Array.from(atob(d.content), (c: string) => c.charCodeAt(0));
      triggerBlobDownload(new Blob([bytes], { type: d.mimeType || f.mimeType }), f.name);
    } catch { toast.error('Erro ao baixar arquivo'); }
  };

  const getLocalPath = (url: string) => url.includes('/documentos/') ? url.split('/documentos/')[1].split('?')[0] : url.split('?')[0];

  const openLocalPreview = async (doc: typeof documentos[number]) => {
    const name = doc.arquivo_nome || doc.nome;
    setPreviewLoading(true);
    setPreview({ name, mime: guessMime(name), url: '', isBlob: false });
    try {
      const { data, error } = await supabase.storage.from('documentos').createSignedUrl(getLocalPath(doc.arquivo_url), 300);
      if (error || !data?.signedUrl) throw error;
      setPreview({ name, mime: guessMime(name), url: data.signedUrl, isBlob: false });
    } catch { toastHook({ title: 'Erro ao carregar prévia', variant: 'destructive' }); setPreview(null); }
    finally { setPreviewLoading(false); }
  };

  const downloadLocalDoc = async (doc: typeof documentos[number]) => {
    try {
      const { data, error } = await supabase.storage.from('documentos').createSignedUrl(getLocalPath(doc.arquivo_url), 60);
      if (error || !data?.signedUrl) throw error;
      const blob = await fetch(data.signedUrl).then(r => r.blob());
      triggerBlobDownload(blob, doc.arquivo_nome || doc.nome);
    } catch { toastHook({ title: 'Erro ao baixar documento', variant: 'destructive' }); }
  };

  const handleDownloadFromPreview = async () => {
    if (!preview) return;
    try {
      const blob = await fetch(preview.url).then(r => r.blob());
      triggerBlobDownload(blob, preview.name);
    } catch { toast.error('Erro ao baixar arquivo'); }
  };

  const fmtSize = (s?: string) => { if (!s) return '—'; const n = parseInt(s); if (n < 1024) return `${n}B`; if (n < 1048576) return `${(n/1024).toFixed(0)}KB`; return `${(n/1048576).toFixed(1)}MB`; };
  const fmtDate = (d?: string) => d ? format(new Date(d), "dd MMM yy", { locale: ptBR }) : '—';

  const folders = driveFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder' && f.name.toLowerCase().includes(search.toLowerCase()));
  const files   = driveFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && f.name.toLowerCase().includes(search.toLowerCase()));
  const localList = documentos.filter(d => d.nome.toLowerCase().includes(search.toLowerCase()) || d.tipo.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="flex flex-col h-full bg-[#f9f6f0]">

        {/* ══ HEADER ══ */}
        <div className="bg-white border-b border-[#efebe4] px-6 sm:px-10 py-6 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl text-[#29201e]">Gestão de Documentos</h1>
            <p className="text-sm text-[#6e5e5a] mt-1.5">
              {checkingConn ? 'Verificando conexão...' : isConnected
                ? 'Acesso compartilhado com o escritório'
                : 'Gestão de documentos e arquivos do escritório'}
            </p>
          </div>

          <div className="flex items-center gap-3">
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  isConnected ? 'bg-[#dcfce7] border-[#bbf7d0] text-[#15803d] hover:bg-[#cdf5db]' : 'bg-[#f0eae1] border-[#efebe4] text-[#6e5e5a] hover:bg-[#e7e0d5]'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-[#22c55e]' : 'bg-[#6e5e5a]/50'}`} />
                {isConnected ? 'Google Drive Conectado' : 'Conectar Drive'}
              </button>
            )}
            {!isAdmin && isConnected && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-[#dcfce7] border-[#bbf7d0] text-[#15803d]">
                <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                Google Drive Conectado
              </div>
            )}
            <Button
              onClick={() => setUploadModalOpen(true)}
              className="h-[38px] px-4 rounded-xl gap-2 font-semibold bg-[#3e2f2b] hover:bg-[#2d211d] text-white border-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Documento
            </Button>
          </div>
        </div>

        {/* ══ STATS ══ */}
        <div className="bg-white px-6 sm:px-10 pt-4 flex items-center gap-6 shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-lg text-[#29201e]">{files.length || '—'}</span>
            <span className="text-[13px] text-[#6e5e5a]">Arquivos no Drive</span>
          </div>
          <div className="h-4 w-px bg-[#efebe4]" />
          <div className="flex items-baseline gap-2">
            <span className="text-lg text-[#29201e]">{documentos.length}</span>
            <span className="text-[13px] text-[#6e5e5a]">Documentos Locais</span>
          </div>
        </div>

        {/* ══ TABS ══ */}
        <div className="bg-white border-b border-[#efebe4] px-6 sm:px-10 flex items-end shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('drive')}
            className={`flex items-center gap-2 pb-3.5 pt-4 px-4 sm:px-5 border-b-2 shrink-0 transition-colors ${activeTab === 'drive' ? 'border-[#3e2f2b]' : 'border-transparent'}`}
          >
            <span className={`p-1 rounded-md ${activeTab === 'drive' ? 'bg-[#dcfce7]' : 'bg-[#f0eae1]'}`}>
              <HardDrive className={`h-3 w-3 ${activeTab === 'drive' ? 'text-[#15803d]' : 'text-[#6e5e5a]'}`} />
            </span>
            <span className={`text-sm whitespace-nowrap ${activeTab === 'drive' ? 'font-semibold text-[#29201e]' : 'text-[#6e5e5a]'}`}>Google Drive</span>
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-2 pb-3.5 pt-4 px-4 sm:px-5 border-b-2 shrink-0 transition-colors ${activeTab === 'local' ? 'border-[#3e2f2b]' : 'border-transparent'}`}
          >
            <span className={`p-1 rounded-md ${activeTab === 'local' ? 'bg-[#dcfce7]' : 'bg-[#f0eae1]'}`}>
              <HardDrive className={`h-3 w-3 ${activeTab === 'local' ? 'text-[#15803d]' : 'text-[#6e5e5a]'}`} />
            </span>
            <span className={`text-sm whitespace-nowrap ${activeTab === 'local' ? 'font-semibold text-[#29201e]' : 'text-[#6e5e5a]'}`}>Armazenamento Local</span>
            {documentos.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#f0eae1] text-[11px] font-semibold text-[#6e5e5a]">{documentos.length}</span>
            )}
          </button>
        </div>

        {/* ══ CONTEÚDO ══ */}
        <div className="flex-1 overflow-auto px-6 sm:px-10 py-8">

          {/* ── DRIVE ── */}
          {activeTab === 'drive' && (
            <div className="space-y-8">
              {checkingConn ? (
                <div className="flex items-center justify-center py-24">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-[#3e2f2b]/50" />
                    <p className="text-sm text-[#6e5e5a]">Conectando ao Drive...</p>
                  </div>
                </div>
              ) : !isConnected ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="h-20 w-20 rounded-3xl border border-[#efebe4] bg-[#f0eae1] flex items-center justify-center mb-6">
                    <Cloud className="h-9 w-9 text-[#6e5e5a]/40" />
                  </div>
                  <h3 className="text-base font-semibold text-[#29201e] mb-2">Drive não configurado</h3>
                  <p className="text-sm text-[#6e5e5a] max-w-xs leading-relaxed">
                    {isAdmin ? 'Conecte sua conta Google para sincronizar documentos com o escritório.' : 'O administrador precisa conectar o Google Drive.'}
                  </p>
                  {isAdmin && (
                    <Button className="mt-6 rounded-xl gap-2 bg-[#3e2f2b] hover:bg-[#2d211d] text-white" onClick={async () => {
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
                  {/* Barra de ações */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); openClientFolder(v); }}>
                      <SelectTrigger className="w-auto max-w-[240px] h-auto border-0 bg-transparent shadow-none px-0 gap-2 text-sm text-[#6e5e5a] hover:text-[#29201e] focus:ring-0 [&>svg]:hidden">
                        <Folder className="h-3.5 w-3.5 shrink-0" />
                        <SelectValue placeholder="Pasta de cliente..." />
                        {isOperating && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-64">
                        {leads.filter(l => l.nome).sort((a, b) => (a.nome||'').localeCompare(b.nome||'')).map(l => (
                          <SelectItem key={l.id} value={l.id} className="text-sm">{l.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex gap-2.5 items-center">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6e5e5a]" />
                        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar no Drive..." className="pl-10 h-[38px] w-full sm:w-[280px] rounded-xl text-sm bg-white border-[#efebe4]" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-[38px] w-[38px] rounded-xl hover:bg-[#f0eae1] text-[#6e5e5a] shrink-0" onClick={() => loadFiles(currentFolderId)} disabled={driveLoading}>
                        <RefreshCw className={`h-4 w-4 ${driveLoading ? 'animate-spin' : ''}`} />
                      </Button>
                      <input type="file" id="drive-upload" className="hidden" onChange={handleUpload} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button className="h-[38px] px-4 rounded-xl gap-2 font-semibold bg-[#3e2f2b] hover:bg-[#2d211d] text-white shrink-0" disabled={uploadingFile}>
                            {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Novo
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => setNewFolderDialog(true)} className="gap-2 cursor-pointer">
                            <FolderPlus className="h-3.5 w-3.5" /> Nova Pasta
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!currentFolderId}
                            onClick={() => document.getElementById('drive-upload')?.click()}
                            className="gap-2 cursor-pointer"
                          >
                            <Upload className="h-3.5 w-3.5" /> Enviar Arquivo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Breadcrumbs */}
                  <nav className="flex items-center gap-0.5 text-sm flex-wrap -mt-4">
                    <button onClick={() => goBreadcrumb(-1)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#6e5e5a] hover:text-[#29201e] hover:bg-[#f0eae1] transition-all text-xs font-medium">
                      <Home className="h-3 w-3" /> Meu Drive
                    </button>
                    {breadcrumbs.map((c, i) => (
                      <span key={c.id} className="flex items-center">
                        <ChevronRight className="h-3 w-3 text-[#efebe4] mx-0.5" />
                        <button
                          onClick={() => goBreadcrumb(i)}
                          className={`px-2.5 py-1.5 rounded-lg transition-all text-xs font-medium ${i === breadcrumbs.length - 1
                            ? 'bg-[#f5efe6] text-[#3e2f2b] border border-[#e3d9cd]'
                            : 'text-[#6e5e5a] hover:text-[#29201e] hover:bg-[#f0eae1]'}`}
                        >{c.name}</button>
                      </span>
                    ))}
                    {breadcrumbs.length > 0 && (
                      <button onClick={goBack} className="ml-2 flex items-center gap-1 text-xs text-[#6e5e5a]/70 hover:text-[#6e5e5a] px-2 py-1.5 rounded-lg hover:bg-[#f0eae1]/60 transition-all">
                        <ArrowLeft className="h-3 w-3" /> Voltar
                      </button>
                    )}
                  </nav>

                  {/* Arquivos */}
                  {driveLoading ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {[1,2,3].map(i => <Skeleton key={i} className="h-[92px] rounded-2xl" />)}
                      </div>
                      <Skeleton className="h-56 rounded-[20px]" />
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[#efebe4] rounded-2xl">
                      <Folder className="h-12 w-12 text-[#6e5e5a]/15 mb-3" />
                      <p className="text-sm text-[#6e5e5a]/60 font-medium">{currentFolderId ? 'Pasta vazia' : 'Nenhum arquivo'}</p>
                    </div>
                  ) : (
                    <div className="space-y-8">

                      {/* Pastas Recentes */}
                      {folders.length > 0 && (
                        <div className="space-y-4">
                          <h2 className="text-lg text-[#29201e]">Pastas Recentes</h2>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {folders.map(f => (
                              <div
                                key={f.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => enterFolder(f)}
                                onKeyDown={e => { if (e.key === 'Enter') enterFolder(f); }}
                                className="bg-white border border-[#efebe4] rounded-2xl p-4 flex flex-col gap-3 shadow-[0_2px_2px_rgba(62,47,43,0.08)] hover:border-[#c9a96e]/50 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="p-2.5 rounded-[10px] bg-[#f5efe6] border border-[#e3d9cd]">
                                    <Folder className="h-5 w-5 text-[#c9a96e]" />
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button onClick={e => e.stopPropagation()} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-[#f0eae1] text-[#6e5e5a]">
                                        <MoreVertical className="h-4 w-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()} className="rounded-xl">
                                      <DropdownMenuItem onClick={() => setDeleteTarget({ kind: 'drive', id: f.id, name: f.name })} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                                        <Trash2 className="h-3.5 w-3.5" /> Excluir pasta
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[#29201e] truncate">{f.name}</p>
                                  <p className="text-xs text-[#6e5e5a] mt-0.5">Pasta</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Arquivos Recentes */}
                      {files.length > 0 && (
                        <div className="space-y-4">
                          <h2 className="text-lg text-[#29201e]">Arquivos Recentes</h2>
                          <div className="bg-white border border-[#efebe4] rounded-[20px] overflow-hidden">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-[#f0eae1] border-b border-[#efebe4]">
                                  <th className="text-left text-[13px] font-semibold text-[#6e5e5a] px-6 py-3.5">Nome do arquivo</th>
                                  <th className="text-left text-[13px] font-semibold text-[#6e5e5a] px-6 py-3.5 w-[110px] hidden sm:table-cell">Tamanho</th>
                                  <th className="text-left text-[13px] font-semibold text-[#6e5e5a] px-6 py-3.5 w-[140px] hidden md:table-cell">Modificado em</th>
                                  <th className="w-[80px] px-6 py-3.5" />
                                </tr>
                              </thead>
                              <tbody>
                                {files.map((f, i) => {
                                  const cat = categorize(f.mimeType);
                                  const style = FILE_CAT_STYLE[cat];
                                  const Icon = style.icon;
                                  return (
                                    <tr key={f.id} className={`border-b border-[#efebe4] last:border-b-0 ${i % 2 === 1 ? 'bg-[#faf8f5]' : ''}`}>
                                      <td className="px-6 py-4">
                                        <button onClick={() => openDrivePreview(f)} className="flex items-center gap-3 text-left w-full">
                                          {thumbnails[f.id] ? (
                                            <img src={thumbnails[f.id]} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0 border border-[#efebe4]" />
                                          ) : (
                                            <span className="p-2 rounded-lg shrink-0" style={{ background: style.iconBg }}>
                                              <Icon className="h-[18px] w-[18px]" style={{ color: style.iconColor }} />
                                            </span>
                                          )}
                                          <span className="text-sm font-medium text-[#29201e] truncate max-w-[180px] sm:max-w-[280px] md:max-w-none">{f.name}</span>
                                        </button>
                                      </td>
                                      <td className="px-6 py-4 hidden sm:table-cell">
                                        <span className="text-sm text-[#6e5e5a] tabular-nums">{fmtSize(f.size)}</span>
                                      </td>
                                      <td className="px-6 py-4 hidden md:table-cell">
                                        <span className="text-sm text-[#6e5e5a]">{fmtDate(f.modifiedTime)}</span>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-3">
                                          <button onClick={() => downloadDriveFile(f)} title="Baixar" className="text-[#6e5e5a] hover:text-[#29201e] transition-colors">
                                            <Download className="h-4 w-4" />
                                          </button>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <button className="text-[#6e5e5a] hover:text-[#29201e] transition-colors">
                                                <MoreVertical className="h-4 w-4" />
                                              </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-xl">
                                              <DropdownMenuItem onClick={() => openDrivePreview(f)} className="gap-2 cursor-pointer">
                                                <Eye className="h-3.5 w-3.5" /> Pré-visualizar
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => window.open(f.webViewLink, '_blank')} className="gap-2 cursor-pointer">
                                                <ExternalLink className="h-3.5 w-3.5" /> Abrir no Drive
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => importFile(f)} className="gap-2 cursor-pointer">
                                                <FolderInput className="h-3.5 w-3.5" /> Importar para o sistema
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem onClick={() => setDeleteTarget({ kind: 'drive', id: f.id, name: f.name })} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                                                <Trash2 className="h-3.5 w-3.5" /> Excluir
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
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
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6e5e5a]" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar documentos..." className="pl-10 h-[38px] w-full sm:w-[280px] rounded-xl text-sm bg-white border-[#efebe4]" />
                </div>
                <Button onClick={() => setUploadModalOpen(true)} className="h-[38px] px-4 rounded-xl gap-2 font-semibold bg-[#3e2f2b] hover:bg-[#2d211d] text-white shrink-0">
                  <Upload className="h-4 w-4" /> Enviar Arquivo
                </Button>
              </div>

              {localLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
              ) : localList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[#efebe4] rounded-2xl">
                  <HardDrive className="h-12 w-12 text-[#6e5e5a]/15 mb-3" />
                  <p className="text-sm text-[#6e5e5a]/60 font-medium">Nenhum documento local</p>
                  <p className="text-xs text-[#6e5e5a]/40 mt-1">Clique em "Enviar Arquivo" para adicionar</p>
                </div>
              ) : (
                <div className="bg-white border border-[#efebe4] rounded-[20px] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#f0eae1] border-b border-[#efebe4]">
                        <th className="text-left text-[13px] font-semibold text-[#6e5e5a] px-6 py-3.5">Nome do arquivo</th>
                        <th className="text-left text-[13px] font-semibold text-[#6e5e5a] px-6 py-3.5 w-[110px] hidden sm:table-cell">Tipo</th>
                        <th className="text-left text-[13px] font-semibold text-[#6e5e5a] px-6 py-3.5 w-[140px] hidden md:table-cell">Data</th>
                        <th className="w-[80px] px-6 py-3.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {localList.map((d, i) => {
                        const cat = categorize(d.arquivo_nome || d.nome);
                        const style = FILE_CAT_STYLE[cat];
                        return (
                          <tr key={d.id} className={`border-b border-[#efebe4] last:border-b-0 ${i % 2 === 1 ? 'bg-[#faf8f5]' : ''}`}>
                            <td className="px-6 py-4">
                              <button onClick={() => openLocalPreview(d)} className="flex items-center gap-3 text-left w-full">
                                <FileText className="h-4 w-4 text-[#6e5e5a] shrink-0" />
                                <span className="text-sm font-medium text-[#29201e] truncate max-w-[200px]">{d.nome}</span>
                              </button>
                            </td>
                            <td className="px-6 py-4 hidden sm:table-cell">
                              <span
                                className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
                                style={{ background: style.pillBg, color: style.pillText }}
                              >
                                {style.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 hidden md:table-cell">
                              <span className="text-sm text-[#6e5e5a]">{fmtDate(d.created_at)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-3">
                                <button onClick={() => downloadLocalDoc(d)} title="Baixar" className="text-[#6e5e5a] hover:text-[#29201e] transition-colors">
                                  <Download className="h-4 w-4" />
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="text-[#6e5e5a] hover:text-[#29201e] transition-colors">
                                      <MoreVertical className="h-4 w-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-xl">
                                    <DropdownMenuItem onClick={() => openLocalPreview(d)} className="gap-2 cursor-pointer">
                                      <Eye className="h-3.5 w-3.5" /> Pré-visualizar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openLocal(d.arquivo_url)} className="gap-2 cursor-pointer">
                                      <ExternalLink className="h-3.5 w-3.5" /> Abrir em nova aba
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setDeleteTarget({ kind: 'local', id: d.id, name: d.nome, arquivoUrl: d.arquivo_url })} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <DocumentoUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUploaded={() => { fetchDocumentos(); if (isConnected) loadFiles(currentFolderId); }}
        driveFolder={
          activeTab === 'drive' && currentFolderId && breadcrumbs.length > 0
            ? breadcrumbs[breadcrumbs.length - 1]
            : undefined
        }
      />

      {/* ── Modal Prévia ── */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(41,32,30,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) closePreview(); }}
        >
          <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white border border-[#efebe4] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#efebe4] shrink-0">
              <p className="text-sm font-semibold text-[#29201e] truncate">{preview.name}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="outline" className="h-8 rounded-lg gap-1.5 border-[#efebe4]" onClick={handleDownloadFromPreview} disabled={previewLoading || !preview.url}>
                  <Download className="h-3.5 w-3.5" /> Baixar
                </Button>
                <button onClick={closePreview} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#f0eae1] text-[#6e5e5a] hover:text-[#29201e] transition-all">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-[#f9f6f0] flex items-center justify-center p-4 min-h-[300px]">
              {previewLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-[#3e2f2b]/50" />
              ) : preview.mime.includes('image') ? (
                <img src={preview.url} alt={preview.name} className="max-w-full max-h-[75vh] object-contain rounded-lg" />
              ) : preview.mime.includes('pdf') ? (
                <iframe src={preview.url} title={preview.name} className="w-full h-[75vh] rounded-lg border-0 bg-white" />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center py-10">
                  <File className="h-10 w-10 text-[#6e5e5a]/30" />
                  <p className="text-sm text-[#6e5e5a] max-w-xs">Pré-visualização não disponível para este tipo de arquivo. Baixe para abrir.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog Nova Pasta ── */}
      {newFolderDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(41,32,30,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setNewFolderDialog(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white border border-[#efebe4] shadow-2xl p-6">
            <h2 className="text-base font-bold text-[#29201e] mb-1">Nova Pasta</h2>
            <p className="text-xs text-[#6e5e5a] mb-4">
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
              className="mb-4 border-[#efebe4]"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="rounded-xl border-[#efebe4]" onClick={() => { setNewFolderDialog(false); setNewFolderName(''); }}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="rounded-xl gap-1.5 bg-[#3e2f2b] hover:bg-[#2d211d] text-white"
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
      {/* ── Dialog Confirmar Exclusão ── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(41,32,30,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white border border-[#efebe4] shadow-2xl p-6">
            <h2 className="text-base font-bold text-[#29201e] mb-1">Excluir {deleteTarget.kind === 'local' ? 'documento' : 'do Drive'}?</h2>
            <p className="text-xs text-[#6e5e5a] mb-4">
              {deleteTarget.kind === 'drive'
                ? <>"{deleteTarget.name}" será movido para a lixeira do Google Drive (recuperável por lá por 30 dias).</>
                : <>"{deleteTarget.name}" será excluído permanentemente do sistema. Essa ação não pode ser desfeita.</>}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="rounded-xl border-[#efebe4]" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="rounded-xl gap-1.5"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
