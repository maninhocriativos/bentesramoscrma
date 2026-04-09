import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { useDocumentos } from '@/hooks/useDocumentos';
import { useLeads } from '@/hooks/useLeads';
import { useAuth } from '@/hooks/useAuth';
import { GoogleDriveConnect } from '@/components/documentos/GoogleDriveConnect';
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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export default function DocumentosPage() {
  const { user } = useAuth();
  const { toast: toastHook } = useToast();
  const { documentos, loading: localLoading, deleteDocumento, fetchDocumentos, uploadDocumento } = useDocumentos();
  const { isConnected, isLoading: driveLoading, listFiles, findOrCreateClientFolder, uploadFile, downloadFile, isOperating, connect } = useGoogleDrive();
  const { leads } = useLeads();

  // Drive state
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveLoading2, setDriveLoading2] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [activeTab, setActiveTab] = useState<'drive' | 'local'>('drive');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Load Drive files
  const loadDriveFiles = useCallback(async (folderId?: string) => {
    if (!isConnected) return;
    setDriveLoading2(true);
    try {
      const result = await listFiles(folderId || 'root');
      setDriveFiles(result);
    } catch (err) {
      toast.error('Erro ao carregar arquivos do Drive');
    } finally {
      setDriveLoading2(false);
    }
  }, [isConnected, listFiles]);

  useEffect(() => {
    if (isConnected) loadDriveFiles(currentFolderId);
  }, [isConnected, currentFolderId]);

  const handleFolderClick = (folder: DriveFile) => {
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  };

  const handleBreadcrumb = (index: number) => {
    if (index === -1) {
      setBreadcrumbs([]);
      setCurrentFolderId(undefined);
    } else {
      const newCrumbs = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(newCrumbs);
      setCurrentFolderId(newCrumbs[newCrumbs.length - 1].id);
    }
  };

  const handleOpenClientFolder = async () => {
    if (!selectedClient) { toast.error('Selecione um cliente'); return; }
    const client = leads.find(l => l.id === selectedClient);
    if (!client?.nome) { toast.error('Cliente não encontrado'); return; }
    const result = await findOrCreateClientFolder(client.nome, client.id);
    if (result) {
      setBreadcrumbs([{ id: result.folderId, name: result.folderName }]);
      setCurrentFolderId(result.folderId);
      toast.success(`Pasta "${result.folderName}" aberta`);
    }
  };

  const handleUploadToDrive = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentFolderId) { toast.error('Navegue até uma pasta primeiro'); return; }
    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      const result = await uploadFile(currentFolderId, file.name, base64, file.type);
      if (result) loadDriveFiles(currentFolderId);
      setUploadingFile(false);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleImportFromDrive = async (driveFile: DriveFile) => {
    try {
      const result = await downloadFile(driveFile.id);
      if (!result) return;
      const bytes = new Uint8Array(atob(result.content).split('').map(c => c.charCodeAt(0)));
      const blob = new Blob([bytes], { type: result.mimeType });
      const fileObj = new window.File([blob], result.name, { type: result.mimeType });
      await uploadDocumento(fileObj, { nome: result.name, tipo: 'Outros' });
      toast.success('Arquivo importado!');
    } catch { toast.error('Erro ao importar arquivo'); }
  };

  const openLocalDoc = async (arquivoUrl: string) => {
    const filePath = arquivoUrl.includes('/documentos/')
      ? arquivoUrl.split('/documentos/')[1].split('?')[0]
      : arquivoUrl.split('?')[0];
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(filePath, 60);
    if (error || !data?.signedUrl) { toastHook({ title: 'Erro ao abrir documento', variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank');
  };

  const formatSize = (size?: string) => {
    if (!size) return '';
    const bytes = parseInt(size);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredDriveFiles = driveFiles.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const driveFolders = filteredDriveFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
  const driveDocuments = filteredDriveFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
  const filteredLocal = documentos.filter(d =>
    d.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getMimeIcon = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') return <Folder className="h-5 w-5 text-amber-500" />;
    if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (mimeType.includes('image')) return <File className="h-5 w-5 text-blue-500" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-md border-b border-border px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">Documentos</h1>
              <p className="text-xs text-muted-foreground">Gestão de documentos e Google Drive</p>
            </div>
            <div className="flex items-center gap-2">
              <GoogleDriveConnect onOpenDriveModal={() => {}} />
              <Button onClick={() => setUploadModalOpen(true)} size="sm" className="rounded-xl h-9 gap-1.5">
                <Plus className="h-4 w-4" /> Novo Documento
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-muted/40 rounded-xl p-1 w-fit">
            <button
              onClick={() => setActiveTab('drive')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'drive' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Cloud className="h-4 w-4" />
              Google Drive
              {isConnected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
            </button>
            <button
              onClick={() => setActiveTab('local')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'local' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <HardDrive className="h-4 w-4" />
              Local
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{documentos.length}</Badge>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">

          {/* ── DRIVE TAB ── */}
          {activeTab === 'drive' && (
            <>
              {!isConnected ? (
                /* Not connected */
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <Cloud className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Google Drive não conectado</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">Conecte sua conta para ver e gerenciar documentos dos clientes diretamente no Drive.</p>
                  <Button onClick={connect} className="gap-2 rounded-xl">
                    <Cloud className="h-4 w-4" /> Conectar Google Drive
                  </Button>
                </div>
              ) : (
                <>
                  {/* Client folder selector + search */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex gap-2 flex-1">
                      <Select value={selectedClient} onValueChange={setSelectedClient}>
                        <SelectTrigger className="flex-1 h-9 rounded-xl bg-card border-border/50">
                          <SelectValue placeholder="Buscar pasta de cliente..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {leads.filter(l => l.nome).map(lead => (
                            <SelectItem key={lead.id} value={lead.id}>{lead.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleOpenClientFolder} disabled={!selectedClient || isOperating} size="sm" className="h-9 rounded-xl gap-1.5 shrink-0">
                        {isOperating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                        Abrir Pasta
                      </Button>
                    </div>
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar arquivos..." className="pl-9 h-9 rounded-xl bg-card border-border/50" />
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" className="h-9 rounded-xl gap-1.5" onClick={() => loadDriveFiles(currentFolderId)} disabled={driveLoading2}>
                        <RefreshCw className={`h-4 w-4 ${driveLoading2 ? 'animate-spin' : ''}`} />
                      </Button>
                      {currentFolderId && (
                        <>
                          <input type="file" id="drive-upload" className="hidden" onChange={handleUploadToDrive} disabled={uploadingFile} />
                          <Button size="sm" variant="outline" className="h-9 rounded-xl gap-1.5" onClick={() => document.getElementById('drive-upload')?.click()} disabled={uploadingFile}>
                            {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Enviar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Breadcrumbs */}
                  <div className="flex items-center gap-1 text-sm flex-wrap">
                    <button onClick={() => handleBreadcrumb(-1)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                      <Home className="h-3.5 w-3.5" /> Meu Drive
                    </button>
                    {breadcrumbs.map((crumb, i) => (
                      <span key={crumb.id} className="flex items-center gap-1">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                        <button
                          onClick={() => handleBreadcrumb(i)}
                          className={`${i === breadcrumbs.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'} transition-colors`}
                        >
                          {crumb.name}
                        </button>
                      </span>
                    ))}
                    {breadcrumbs.length > 0 && (
                      <button onClick={() => { const b = [...breadcrumbs]; b.pop(); setBreadcrumbs(b); setCurrentFolderId(b.length > 0 ? b[b.length - 1].id : undefined); }} className="ml-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <ArrowLeft className="h-3 w-3" /> Voltar
                      </button>
                    )}
                  </div>

                  {/* Files grid */}
                  {driveLoading2 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
                    </div>
                  ) : filteredDriveFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Folder className="h-12 w-12 text-muted-foreground/20 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">
                        {currentFolderId ? 'Pasta vazia' : 'Nenhum arquivo na raiz'}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {currentFolderId ? 'Envie arquivos usando o botão acima' : 'Selecione um cliente ou navegue pelas pastas'}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Folders */}
                      {driveFolders.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pastas</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                            {driveFolders.map(folder => (
                              <button
                                key={folder.id}
                                onClick={() => handleFolderClick(folder)}
                                className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/50 hover:border-amber-400/50 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-all text-left group"
                              >
                                <Folder className="h-8 w-8 text-amber-500 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate leading-tight">{folder.name}</p>
                                  <p className="text-[10px] text-muted-foreground/60">Pasta</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Documents */}
                      {driveDocuments.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Arquivos</p>
                          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-border/30 bg-muted/20">
                                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5">Nome</th>
                                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">Tamanho</th>
                                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden lg:table-cell">Modificado</th>
                                  <th className="text-right px-4 py-2.5"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/20">
                                {driveDocuments.map(file => (
                                  <tr key={file.id} className="hover:bg-muted/20 transition-colors group">
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        {getMimeIcon(file.mimeType)}
                                        <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                      <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                      <span className="text-xs text-muted-foreground">
                                        {file.modifiedTime ? format(new Date(file.modifiedTime), 'dd/MM/yy', { locale: ptBR }) : '—'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => window.open(file.webViewLink, '_blank')} title="Abrir no Drive">
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => handleImportFromDrive(file)} title="Importar para o sistema">
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
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* ── LOCAL TAB ── */}
          {activeTab === 'local' && (
            <>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar documentos..." className="pl-9 h-9 rounded-xl bg-card border-border/50" />
                </div>
              </div>

              {localLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-2xl" />)}
                </div>
              ) : filteredLocal.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <HardDrive className="h-12 w-12 text-muted-foreground/20 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum documento local</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo Documento" para adicionar</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/20">
                        <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5">Nome</th>
                        <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden sm:table-cell">Tipo</th>
                        <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">Data</th>
                        <th className="text-right px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {filteredLocal.map(doc => (
                        <tr key={doc.id} className="hover:bg-muted/20 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-primary/60 shrink-0" />
                              <span className="text-sm font-medium truncate max-w-[200px]">{doc.nome}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <Badge variant="outline" className="text-[10px] rounded-md">{doc.tipo}</Badge>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(doc.created_at), 'dd/MM/yy', { locale: ptBR })}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openLocalDoc(doc.arquivo_url)}>
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
            </>
          )}
        </div>
      </div>

      <DocumentoUploadModal open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
    </AppLayout>
  );
}
