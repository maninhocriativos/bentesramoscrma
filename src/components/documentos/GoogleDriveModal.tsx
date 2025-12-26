import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { useLeads } from '@/hooks/useLeads';
import { useDocumentos } from '@/hooks/useDocumentos';
import { 
  Folder, 
  File, 
  Download, 
  Upload, 
  ArrowLeft, 
  Search,
  Loader2,
  Plus,
  User,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
}

interface GoogleDriveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoogleDriveModal({ open, onOpenChange }: GoogleDriveModalProps) {
  const { isConnected, listFiles, findOrCreateClientFolder, uploadFile, downloadFile, isOperating } = useGoogleDrive();
  const { leads } = useLeads();
  const { uploadDocumento } = useDocumentos();
  
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>();
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [uploadingFile, setUploadingFile] = useState(false);

  // Load files when modal opens
  useEffect(() => {
    if (open && isConnected) {
      console.log('GoogleDriveModal: Loading files, connected:', isConnected, 'folderId:', currentFolderId);
      loadFiles();
    } else if (open && !isConnected) {
      console.log('GoogleDriveModal: Not connected to Google Drive');
      setFiles([]);
    }
  }, [open, isConnected, currentFolderId]);

  const loadFiles = async () => {
    setLoading(true);
    console.log('GoogleDriveModal: Starting to load files...');
    try {
      const result = await listFiles(currentFolderId);
      console.log('GoogleDriveModal: Files loaded:', result.length);
      setFiles(result);
    } catch (error) {
      console.error('GoogleDriveModal: Error loading files:', error);
      toast.error('Erro ao carregar arquivos do Drive');
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folder: DriveFile) => {
    setFolderStack([...folderStack, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  };

  const handleBack = () => {
    const newStack = [...folderStack];
    newStack.pop();
    setFolderStack(newStack);
    setCurrentFolderId(newStack.length > 0 ? newStack[newStack.length - 1].id : undefined);
  };

  const handleGoToRoot = () => {
    setFolderStack([]);
    setCurrentFolderId(undefined);
  };

  const handleOpenClientFolder = async () => {
    if (!selectedClient) {
      toast.error('Selecione um cliente');
      return;
    }

    const client = leads.find(l => l.id === selectedClient);
    if (!client || !client.nome) {
      toast.error('Cliente não encontrado');
      return;
    }

    const result = await findOrCreateClientFolder(client.nome, client.id);
    if (result) {
      setFolderStack([{ id: result.folderId, name: result.folderName }]);
      setCurrentFolderId(result.folderId);
      toast.success(`Pasta "${result.folderName}" ${result.folderId ? 'aberta' : 'criada'}`);
    }
  };

  const handleUploadToDrive = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentFolderId) {
      toast.error('Selecione uma pasta primeiro');
      return;
    }

    setUploadingFile(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        const result = await uploadFile(currentFolderId, file.name, base64, file.type);
        if (result) {
          loadFiles();
        }
        setUploadingFile(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading:', error);
      setUploadingFile(false);
    }
    
    // Reset input
    event.target.value = '';
  };

  const handleDownloadAndSave = async (driveFile: DriveFile) => {
    try {
      const result = await downloadFile(driveFile.id);
      if (!result) return;

      // Convert base64 to blob
      const binaryString = atob(result.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: result.mimeType });
      const fileToUpload = new window.File([blob], result.name, { type: result.mimeType });

      // Get current client if in a client folder
      const currentClient = leads.find(l => 
        folderStack.some(f => f.name.includes(l.nome || ''))
      );

      // Upload to local storage
      await uploadDocumento(fileToUpload, {
        nome: result.name,
        tipo: 'Outros',
        cliente_id: currentClient?.id,
      });
      toast.success('Arquivo importado para o sistema!');
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Erro ao importar arquivo');
    }
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const folders = filteredFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
  const documents = filteredFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') {
      return <Folder className="h-5 w-5 text-amber-500" />;
    }
    return <File className="h-5 w-5 text-blue-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Google Drive
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client Folder Quick Access */}
          <div className="flex gap-2 items-center p-3 bg-muted/50 rounded-lg">
            <User className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {leads.filter(l => l.nome).map(lead => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleOpenClientFolder} disabled={!selectedClient || isOperating}>
              {isOperating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-2">Abrir/Criar Pasta</span>
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoToRoot}
              disabled={folderStack.length === 0}
            >
              Raiz
            </Button>
            {folderStack.map((folder, index) => (
              <div key={folder.id} className="flex items-center">
                <span className="text-muted-foreground">/</span>
                <Badge variant="secondary" className="ml-1">
                  {folder.name}
                </Badge>
              </div>
            ))}
            {folderStack.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar arquivos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon" onClick={loadFiles} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <div className="relative">
              <input
                type="file"
                id="drive-upload"
                className="hidden"
                onChange={handleUploadToDrive}
                disabled={!currentFolderId || uploadingFile}
              />
              <Button
                variant="default"
                onClick={() => document.getElementById('drive-upload')?.click()}
                disabled={!currentFolderId || uploadingFile}
              >
                {uploadingFile ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Enviar para Drive
              </Button>
            </div>
          </div>

          {/* File List */}
          <ScrollArea className="h-[400px] border rounded-lg">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum arquivo encontrado</p>
                {!currentFolderId && (
                  <p className="text-sm mt-2">
                    Selecione um cliente para abrir/criar sua pasta
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {folders.map(folder => (
                  <div
                    key={folder.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleFolderClick(folder)}
                  >
                    {getFileIcon(folder.mimeType)}
                    <span className="flex-1 font-medium">{folder.name}</span>
                    <Badge variant="outline">Pasta</Badge>
                  </div>
                ))}
                {documents.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50"
                  >
                    {getFileIcon(file.mimeType)}
                    <span className="flex-1">{file.name}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(file.webViewLink, '_blank')}
                        title="Abrir no Drive"
                      >
                        <File className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownloadAndSave(file)}
                        title="Importar para o sistema"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
