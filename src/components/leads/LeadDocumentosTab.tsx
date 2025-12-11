import { useState } from 'react';
import { Plus, FileText, Download, Eye, Trash2 } from 'lucide-react';
import { useDocumentos } from '@/hooks/useDocumentos';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentoUploadModal } from '@/components/documentos/DocumentoUploadModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadDocumentosTabProps {
  clienteId: string;
}

const tipoColors: Record<string, string> = {
  'Contrato': 'bg-blue-500/10 text-blue-600',
  'Procuração': 'bg-purple-500/10 text-purple-600',
  'Petição': 'bg-amber-500/10 text-amber-600',
  'Documento Pessoal': 'bg-green-500/10 text-green-600',
  'Comprovante': 'bg-slate-500/10 text-slate-600',
  'Outro': 'bg-gray-500/10 text-gray-600',
};

function formatFileSize(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeadDocumentosTab({ clienteId }: LeadDocumentosTabProps) {
  const { documentos, loading, deleteDocumento } = useDocumentos(undefined, clienteId);
  const [modalOpen, setModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Documentos</h3>
        <Button onClick={() => setModalOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Upload
        </Button>
      </div>

      {documentos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum documento enviado</p>
            <Button variant="outline" className="mt-4" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Enviar primeiro documento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documentos.map((doc) => (
            <Card key={doc.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{doc.nome}</span>
                      <Badge className={tipoColors[doc.tipo] || tipoColors['Outro']}>
                        {doc.tipo}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {doc.arquivo_nome} • {formatFileSize(doc.arquivo_tamanho)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Enviado em {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(doc.arquivo_url, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <a href={doc.arquivo_url} download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteDocumento(doc.id, doc.arquivo_url)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DocumentoUploadModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        clienteId={clienteId}
      />
    </div>
  );
}