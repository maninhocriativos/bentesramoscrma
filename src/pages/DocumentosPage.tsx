import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, FileText, Download, Trash2, Eye, Cloud, CloudOff, RefreshCw, Loader2, FolderSearch, Settings2, Timer, CheckCircle, Clock, AlertTriangle, ArrowUpFromLine, ArrowDownToLine, Play } from 'lucide-react';
import { useDocumentos } from '@/hooks/useDocumentos';
import { useDriveSync } from '@/hooks/useDriveSync';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { useAuth } from '@/hooks/useAuth';
import { DocumentoUploadModal } from '@/components/documentos/DocumentoUploadModal';
import { GoogleDriveConnect } from '@/components/documentos/GoogleDriveConnect';
import { GoogleDriveModal } from '@/components/documentos/GoogleDriveModal';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layouts/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const tipoColors: Record<string, string> = {
  'Petição': 'bg-primary/10 text-primary border border-primary/20',
  'Contrato': 'bg-success/10 text-success border border-success/20',
  'Procuração': 'bg-secondary/30 text-secondary-foreground border border-secondary/40',
  'Documento Pessoal': 'bg-accent/25 text-accent-foreground border border-accent/40',
  'Comprovante': 'bg-muted text-muted-foreground border border-border',
  'Outros': 'bg-muted/60 text-muted-foreground border border-border',
};

interface SyncJob {
  id: string;
  direction: string;
  kind: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  document_id: string | null;
  drive_file_id: string | null;
}

interface SyncConfig {
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  last_auto_sync_at: string | null;
}

interface SyncStats {
  total: number;
  synced: number;
  pending: number;
  syncing: number;
  error: number;
}

export default function DocumentosPage() {
  const { toast: toastHook } = useToast();
  const { user } = useAuth();
  const { documentos, loading, deleteDocumento, fetchDocumentos } = useDocumentos();
  const { syncDocument, syncAll, isSyncing, syncStats, refreshStats } = useDriveSync();
  const { isConnected: isDriveConnected, isLoading: driveLoading } = useGoogleDrive();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sync management state
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Fetch sync stats on mount
  useEffect(() => {
    if (isDriveConnected) {
      refreshStats();
    }
  }, [isDriveConnected, refreshStats]);

  const fetchJobs = useCallback(async () => {
    if (!user) return;
    setJobsLoading(true);
    try {
      const { data, error } = await supabase
        .from('drive_sync_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setJobs((data || []) as SyncJob[]);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setJobsLoading(false);
    }
  }, [user]);

  const fetchSyncStats = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke('drive-sync', {
        body: { action: 'get_status', user_id: user.id }
      });

      if (error) throw error;
      if (data?.stats) {
        setStats(data.stats as SyncStats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [user]);

  const fetchConfig = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke('drive-sync', {
        body: { action: 'get_config', user_id: user.id }
      });

      if (error) throw error;
      if (data?.config) {
        setConfig(data.config as SyncConfig);
      } else {
        // Criar configuração padrão automaticamente
        const defaultConfig = { auto_sync_enabled: false, sync_interval_minutes: 30, last_auto_sync_at: null };
        setConfig(defaultConfig);
        
        // Salvar configuração padrão no banco
        await supabase.functions.invoke('drive-sync', {
          body: { 
            action: 'update_config', 
            user_id: user.id,
            auto_sync_enabled: false,
            interval_minutes: 30
          }
        });
        console.log('Configuração padrão criada automaticamente');
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  }, [user]);

  useEffect(() => {
    if (isDriveConnected && user) {
      fetchJobs();
      fetchSyncStats();
      fetchConfig();
    }
  }, [isDriveConnected, user, fetchJobs, fetchSyncStats, fetchConfig]);

  const handleUpdateConfig = async (autoEnabled: boolean, interval: number) => {
    if (!user) return;
    setSavingConfig(true);
    try {
      const { data, error } = await supabase.functions.invoke('drive-sync', {
        body: { 
          action: 'update_config', 
          user_id: user.id,
          auto_sync_enabled: autoEnabled,
          interval_minutes: interval
        }
      });

      if (error) throw error;

      if (data?.success) {
        setConfig(prev => prev ? { ...prev, auto_sync_enabled: autoEnabled, sync_interval_minutes: interval } : null);
        toast.success(autoEnabled ? 'Sync automático ativado!' : 'Sync automático desativado');
      }
    } catch (err) {
      console.error('Config error:', err);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleScanDrive = async () => {
    if (!user) return;
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('drive-sync', {
        body: { action: 'scan_drive', user_id: user.id }
      });

      if (error) throw error;

      if (data?.found > 0) {
        toast.success(`${data.found} arquivo(s) encontrado(s) no Drive. ${data.imported} importado(s).`);
      } else {
        toast.info('Nenhum arquivo novo encontrado no Drive');
      }

      await fetchJobs();
      await fetchSyncStats();
      await fetchDocumentos();
    } catch (err) {
      console.error('Scan error:', err);
      toast.error('Erro ao escanear o Drive');
    } finally {
      setScanning(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.functions.invoke('drive-sync', {
        body: { action: 'retry_job', user_id: user.id, job_id: jobId }
      });

      if (error) throw error;
      toast.success('Job reagendado');
      await fetchJobs();
    } catch (err) {
      console.error('Retry error:', err);
      toast.error('Erro ao reagendar job');
    }
  };

  const getSyncStatusIcon = (status: string | null | undefined) => {
    switch (status) {
      case 'synced':
        return <Cloud className="h-4 w-4 text-green-500" />;
      case 'syncing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <CloudOff className="h-4 w-4 text-destructive" />;
      default:
        return <CloudOff className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSyncStatusLabel = (status: string | null | undefined) => {
    switch (status) {
      case 'synced':
        return 'Sincronizado';
      case 'syncing':
        return 'Sincronizando...';
      case 'error':
        return 'Erro no sync';
      default:
        return 'Pendente';
    }
  };

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" /> Sucesso</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processando</Badge>;
      case 'error':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30"><AlertTriangle className="h-3 w-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-border"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
    }
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'push' 
      ? <ArrowUpFromLine className="h-4 w-4 text-primary" />
      : <ArrowDownToLine className="h-4 w-4 text-success" />;
  };

  const handleSyncDocument = async (docId: string) => {
    const success = await syncDocument(docId);
    if (success) {
      fetchDocumentos();
    }
  };

  const handleSyncAll = async () => {
    await syncAll();
    fetchDocumentos();
    fetchJobs();
    fetchSyncStats();
  };

  const getStoragePath = (value: string) => {
    if (!value) return '';
    if (value.includes('/documentos/')) return value.split('/documentos/')[1].split('?')[0];
    return value.split('?')[0];
  };

  const openDocumento = async (arquivoUrl: string) => {
    const filePath = getStoragePath(arquivoUrl);
    if (!filePath) return;

    const { data, error } = await supabase.storage
      .from('documentos')
      .createSignedUrl(filePath, 60);

    if (error || !data?.signedUrl) {
      toastHook({
        title: 'Não foi possível abrir o documento',
        description: error?.message || 'Erro ao gerar link seguro',
        variant: 'destructive',
      });
      return;
    }

    window.open(data.signedUrl, '_blank');
  };

  const filteredDocumentos = documentos.filter((doc) =>
    doc.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <AppLayout>
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground">Gestão de documentos e sincronização com Google Drive</p>
        </div>
        <div className="flex gap-2">
          {isDriveConnected && (
            <>
              <Button 
                variant="outline" 
                onClick={handleScanDrive} 
                disabled={scanning}
              >
                {scanning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FolderSearch className="h-4 w-4 mr-2" />
                )}
                Escanear Drive
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSyncAll} 
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar Tudo
              </Button>
            </>
          )}
          <GoogleDriveConnect onOpenDriveModal={() => setDriveModalOpen(true)} />
          <Button onClick={() => setUploadModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Documento
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{documentos.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{documentos.filter(d => d.tipo === 'Petição').length}</p>
                <p className="text-sm text-muted-foreground">Petições</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <FileText className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{documentos.filter(d => d.tipo === 'Contrato').length}</p>
                <p className="text-sm text-muted-foreground">Contratos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <FileText className="h-8 w-8 text-secondary" />
              <div>
                <p className="text-2xl font-bold">{documentos.filter(d => d.tipo === 'Procuração').length}</p>
                <p className="text-sm text-muted-foreground">Procurações</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {isDriveConnected && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Cloud className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">
                    {documentos.filter((d: any) => d.sync_status === 'synced').length}/{documentos.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Sincronizados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="documentos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          {isDriveConnected && <TabsTrigger value="sincronizacao">Sincronização Drive</TabsTrigger>}
        </TabsList>

        <TabsContent value="documentos" className="space-y-4">
          {/* Search and Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Todos os Documentos</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar documentos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredDocumentos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum documento encontrado</p>
                </div>
              ) : (
                <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Data</TableHead>
                      {isDriveConnected && <TableHead>Sync</TableHead>}
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocumentos.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.nome}</TableCell>
                        <TableCell>
                          <Badge className={tipoColors[doc.tipo] || tipoColors['Outros']}>
                            {doc.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatFileSize(doc.arquivo_tamanho)}</TableCell>
                        <TableCell>
                          {format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        {isDriveConnected && (
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => (doc as any).sync_status !== 'synced' && handleSyncDocument(doc.id)}
                                  disabled={isSyncing || (doc as any).sync_status === 'syncing'}
                                >
                                  {getSyncStatusIcon((doc as any).sync_status)}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{getSyncStatusLabel((doc as any).sync_status)}</p>
                                {(doc as any).sync_status !== 'synced' && (
                                  <p className="text-xs text-muted-foreground">Clique para sincronizar</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDocumento(doc.arquivo_url)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                const filePath = getStoragePath(doc.arquivo_url);
                                const { data, error } = await supabase.storage
                                  .from('documentos')
                                  .createSignedUrl(filePath, 60);

                                if (error || !data?.signedUrl) {
                                  toastHook({
                                    title: 'Não foi possível baixar o documento',
                                    description: error?.message || 'Erro ao gerar link seguro',
                                    variant: 'destructive',
                                  });
                                  return;
                                }

                                const link = document.createElement('a');
                                link.href = data.signedUrl;
                                link.download = doc.arquivo_nome;
                                link.click();
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteDocumento(doc.id, doc.arquivo_url)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isDriveConnected && (
          <TabsContent value="sincronizacao" className="space-y-4">
            {/* Auto-Sync Configuration */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Settings2 className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">Sincronização Automática</CardTitle>
                    <CardDescription>Configure o polling periódico para sincronizar automaticamente</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="auto-sync"
                      checked={config?.auto_sync_enabled ?? false}
                      onCheckedChange={(checked) => handleUpdateConfig(checked, config?.sync_interval_minutes ?? 30)}
                      disabled={savingConfig}
                    />
                    <Label htmlFor="auto-sync" className="font-medium">
                      {config?.auto_sync_enabled ? 'Ativado' : 'Desativado'}
                    </Label>
                    {savingConfig && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>

                  <div className="flex items-center gap-3">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm text-muted-foreground">Intervalo:</Label>
                    <Select
                      value={String(config?.sync_interval_minutes ?? 30)}
                      onValueChange={(val) => handleUpdateConfig(config?.auto_sync_enabled ?? false, parseInt(val))}
                      disabled={savingConfig || !config?.auto_sync_enabled}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="120">2 horas</SelectItem>
                        <SelectItem value="360">6 horas</SelectItem>
                        <SelectItem value="720">12 horas</SelectItem>
                        <SelectItem value="1440">24 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {config?.last_auto_sync_at && (
                    <div className="text-sm text-muted-foreground">
                      Último sync automático: {format(new Date(config.last_auto_sync_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sync Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Cloud className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.total || documentos.length}</p>
                      <p className="text-xs text-muted-foreground">Total Docs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.synced || documentos.filter((d: any) => d.sync_status === 'synced').length}</p>
                      <p className="text-xs text-muted-foreground">Sincronizados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.pending || documentos.filter((d: any) => d.sync_status === 'pending').length}</p>
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.syncing || 0}</p>
                      <p className="text-xs text-muted-foreground">Em Progresso</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.error || documentos.filter((d: any) => d.sync_status === 'error').length}</p>
                      <p className="text-xs text-muted-foreground">Com Erro</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Jobs Table */}
            <Card>
              <CardHeader>
                <CardTitle>Fila de Sincronização</CardTitle>
                <CardDescription>Histórico de jobs de sincronização com tentativas e erros detalhados</CardDescription>
              </CardHeader>
              <CardContent>
                {jobsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Cloud className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum job de sincronização encontrado</p>
                    <p className="text-sm">Faça upload de documentos ou escaneie o Drive</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">Dir</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tentativas</TableHead>
                        <TableHead>Criado</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell>{getDirectionIcon(job.direction)}</TableCell>
                          <TableCell className="font-medium">{job.kind}</TableCell>
                          <TableCell>{getJobStatusBadge(job.status)}</TableCell>
                          <TableCell>
                            <span className={job.attempts >= job.max_attempts ? 'text-destructive font-medium' : ''}>
                              {job.attempts}/{job.max_attempts}
                            </span>
                          </TableCell>
                          <TableCell>
                            {format(new Date(job.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={job.last_error || ''}>
                            {job.last_error || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {job.status === 'error' && job.attempts < job.max_attempts && (
                              <Button variant="ghost" size="sm" onClick={() => handleRetryJob(job.id)}>
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <DocumentoUploadModal open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
      <GoogleDriveModal open={driveModalOpen} onOpenChange={setDriveModalOpen} />
    </div>
    </AppLayout>
  );
}