import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Trash2, Calendar, Variable } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ModeloPeticao } from '@/hooks/useModelosPeticaoDocx';
import ModeloUploadModal from './ModeloUploadModal';
import type { VariavelMapping } from '@/hooks/useModelosPeticaoDocx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ModelosPeticaoTabProps {
  modelos: ModeloPeticao[];
  onUpload: (nome: string, file: File, variaveis: VariavelMapping[]) => Promise<void>;
  onDelete: (id: string, arquivoUrl: string) => Promise<void>;
}

export default function ModelosPeticaoTab({ modelos, onUpload, onDelete }: ModelosPeticaoTabProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ModeloPeticao | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Modelos Cadastrados</h3>
          <p className="text-xs text-muted-foreground">{modelos.length} modelo(s) disponíveis</p>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Adicionar Modelo
        </Button>
      </div>

      {modelos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-semibold text-foreground/70">Nenhum modelo cadastrado</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
              Adicione seus modelos de petição em .docx para começar a gerar documentos automaticamente.
            </p>
            <Button size="sm" className="mt-4" onClick={() => setUploadOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Adicionar Primeiro Modelo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {modelos.map(modelo => (
            <Card key={modelo.id} className="group hover:shadow-md transition-all duration-200 border-border/50 hover:border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0 ring-1 ring-primary/10">
                      <FileText className="h-4.5 w-4.5 text-primary/70" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{modelo.nome}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Calendar className="h-3 w-3 text-muted-foreground/50" />
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(modelo.created_at), "dd MMM yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(modelo)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {modelo.variaveis.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    <Variable className="h-3 w-3 text-muted-foreground/50" />
                    {modelo.variaveis.slice(0, 3).map((v, i) => (
                      <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-mono">
                        {v.variavel}
                      </Badge>
                    ))}
                    {modelo.variaveis.length > 3 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                        +{modelo.variaveis.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ModeloUploadModal open={uploadOpen} onOpenChange={setUploadOpen} onSave={onUpload} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              O modelo "{deleteTarget?.nome}" será removido permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  onDelete(deleteTarget.id, deleteTarget.arquivo_url);
                  setDeleteTarget(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
