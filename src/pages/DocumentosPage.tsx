import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, FileText, Download, Trash2, Eye, Cloud, CloudOff, RefreshCw, Loader2 } from 'lucide-react';
import { useDocumentos } from '@/hooks/useDocumentos';
import { useDriveSync } from '@/hooks/useDriveSync';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { DocumentoUploadModal } from '@/components/documentos/DocumentoUploadModal';
import { GoogleDriveConnect } from '@/components/documentos/GoogleDriveConnect';
import { GoogleDriveModal } from '@/components/documentos/GoogleDriveModal';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layouts/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

export default function DocumentosPage() {
  const { toast } = useToast();
  const { documentos, loading, deleteDocumento, fetchDocumentos } = useDocumentos();
  const { syncDocument, syncAll, isSyncing, syncStats, refreshStats } = useDriveSync();
  const { isConnected: isDriveConnected } = useGoogleDrive();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch sync stats on mount
  useEffect(() => {
    if (isDriveConnected) {
      refreshStats();
    }
  }, [isDriveConnected, refreshStats]);

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

  const handleSyncDocument = async (docId: string) => {
    const success = await syncDocument(docId);
    if (success) {
      fetchDocumentos();
    }
  };

  const handleSyncAll = async () => {
    await syncAll();
    fetchDocumentos();
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
      toast({
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
          <p className="text-muted-foreground">Gestão de documentos e arquivos</p>
        </div>
        <div className="flex gap-2">
          {isDriveConnected && (
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
                              toast({
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

      <DocumentoUploadModal open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
      <GoogleDriveModal open={driveModalOpen} onOpenChange={setDriveModalOpen} />
    </div>
    </AppLayout>
  );
}
