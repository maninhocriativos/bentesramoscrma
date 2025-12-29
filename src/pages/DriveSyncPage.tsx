import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { GoogleDriveConnect } from '@/components/documentos/GoogleDriveConnect';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, RefreshCw, Cloud, CloudOff, AlertTriangle, CheckCircle, Clock, Play, FolderSearch, ArrowDownToLine, ArrowUpFromLine, Settings2, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

interface SyncStats {
  total: number;
  synced: number;
  pending: number;
  syncing: number;
  error: number;
}

interface SyncConfig {
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  last_auto_sync_at: string | null;
}

export default function DriveSyncPage() {
  const { user } = useAuth();
  const { isConnected, isLoading: driveLoading } = useGoogleDrive();
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchJobs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
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
      setLoading(false);
    }
  }, [user]);

  const fetchStats = useCallback(async () => {
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
        // Default config
        setConfig({ auto_sync_enabled: false, sync_interval_minutes: 30, last_auto_sync_at: null });
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  }, [user]);

  useEffect(() => {
    if (isConnected && user) {
      fetchJobs();
      fetchStats();
      fetchConfig();
    }
  }, [isConnected, user, fetchJobs, fetchStats, fetchConfig]);

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

  const handleSyncAll = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('drive-sync', {
        body: { action: 'sync_all', user_id: user.id }
      });

      if (error) throw error;

      if (data?.synced > 0) {
        toast.success(`${data.synced} documento(s) sincronizado(s)!`);
      }
      if (data?.errors > 0) {
        toast.error(`${data.errors} erro(s) na sincronização`);
      }
      if (data?.synced === 0 && data?.errors === 0) {
        toast.info('Nenhum documento pendente');
      }

      await fetchJobs();
      await fetchStats();
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Erro ao sincronizar');
    } finally {
      setSyncing(false);
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
      await fetchStats();
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

  const getStatusBadge = (status: string) => {
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

  if (driveLoading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!isConnected) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sincronização Drive</h1>
            <p className="text-muted-foreground">Conecte ao Google Drive para gerenciar a sincronização</p>
          </div>
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center space-y-4">
              <CloudOff className="h-16 w-16 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Você precisa conectar ao Google Drive primeiro.</p>
              <GoogleDriveConnect onOpenDriveModal={() => {}} />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sincronização Drive</h1>
            <p className="text-muted-foreground">Gerencie a fila de sincronização Drive ↔ Storage</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleScanDrive} disabled={scanning}>
              {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderSearch className="h-4 w-4 mr-2" />}
              Escanear Drive
            </Button>
            <Button onClick={handleSyncAll} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sincronizar Todos
            </Button>
          </div>
        </div>

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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Cloud className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
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
                  <p className="text-2xl font-bold">{stats?.synced || 0}</p>
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
                  <p className="text-2xl font-bold">{stats?.pending || 0}</p>
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
                  <p className="text-2xl font-bold">{stats?.error || 0}</p>
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
            {loading ? (
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
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
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
      </div>
    </AppLayout>
  );
}
