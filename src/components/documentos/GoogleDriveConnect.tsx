import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { Loader2, FolderOpen, Link2Off, CloudUpload } from 'lucide-react';

interface GoogleDriveConnectProps {
  onOpenDriveModal?: () => void;
}

export function GoogleDriveConnect({ onOpenDriveModal }: GoogleDriveConnectProps) {
  const {
    isConnected,
    isLoading,
    isOperating,
    connect,
    disconnect,
  } = useGoogleDrive();

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Carregando...
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={isConnected ? 'default' : 'outline'}
          size="sm"
          className="gap-2"
        >
          <FolderOpen className="h-4 w-4" />
          Google Drive
          {isConnected && (
            <span className="h-2 w-2 rounded-full bg-green-400" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-1">Google Drive</h4>
            <p className="text-sm text-muted-foreground">
              {isConnected
                ? 'Conectado! Acesse arquivos e pastas de clientes.'
                : 'Conecte para sincronizar documentos com o Drive.'}
            </p>
          </div>

          {isConnected ? (
            <div className="space-y-2">
              <Button
                onClick={onOpenDriveModal}
                className="w-full gap-2"
                disabled={isOperating}
              >
                {isOperating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
                Ver Arquivos do Drive
              </Button>
              <Button
                variant="outline"
                onClick={disconnect}
                className="w-full gap-2"
              >
                <Link2Off className="h-4 w-4" />
                Desconectar
              </Button>
            </div>
          ) : (
            <Button onClick={connect} className="w-full gap-2">
              <FolderOpen className="h-4 w-4" />
              Conectar Google Drive
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
