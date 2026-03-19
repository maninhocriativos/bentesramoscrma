import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus, FileText, Trash2, Landmark, Building2, Plane, Shield,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import type { ModeloPeticao } from '@/hooks/useModelosPeticaoDocx';
import ModeloUploadModal from './ModeloUploadModal';
import type { VariavelMapping } from '@/hooks/useModelosPeticaoDocx';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const CATEGORY_CONFIG: Record<string, { icon: typeof Landmark; label: string }> = {
  'Bancário': { icon: Landmark, label: 'Bancário' },
  'INSS': { icon: Shield, label: 'INSS' },
  'Servidor Público': { icon: Building2, label: 'Servidor Público' },
  'Aviação': { icon: Plane, label: 'Aviação' },
};

interface ModelosPeticaoTabProps {
  modelos: ModeloPeticao[];
  onUpload: (nome: string, file: File, variaveis: VariavelMapping[]) => Promise<void>;
  onDelete: (id: string, arquivoUrl: string) => Promise<void>;
  onSelectModel?: (modeloId: string) => void;
}

export default function ModelosPeticaoTab({ modelos, onUpload, onDelete, onSelectModel }: ModelosPeticaoTabProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ModeloPeticao | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const groups: Record<string, ModeloPeticao[]> = {};
    modelos.forEach(m => {
      const cat = m.categoria || 'Outros';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    });
    // Sort categories by config order
    const order = Object.keys(CATEGORY_CONFIG);
    return Object.entries(groups).sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [modelos]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  if (modelos.length === 0) {
    return (
      <>
        <Card className="border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-semibold text-foreground/70">Nenhum modelo cadastrado</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
              Adicione seus modelos de petição em .docx para começar a gerar documentos.
            </p>
            <Button size="sm" className="mt-4" onClick={() => setUploadOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Adicionar Modelo
            </Button>
          </CardContent>
        </Card>
        <ModeloUploadModal open={uploadOpen} onOpenChange={setUploadOpen} onSave={onUpload} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {modelos.length} modelo{modelos.length !== 1 ? 's' : ''} em {grouped.length} categoria{grouped.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setUploadOpen(true)}>
          <Plus className="h-3 w-3" />
          Adicionar Modelo
        </Button>
      </div>

      {/* Grouped models */}
      <div className="space-y-3">
        {grouped.map(([cat, items]) => {
          const config = CATEGORY_CONFIG[cat] || { icon: FileText, label: cat };
          const CatIcon = config.icon;
          const isOpen = !collapsedCategories.has(cat);

          return (
            <Collapsible key={cat} open={isOpen} onOpenChange={() => toggleCategory(cat)}>
              <Card className="overflow-hidden border-border/50">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
                    <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                      <CatIcon className="h-4 w-4 text-primary/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold">{config.label}</span>
                      <span className="text-[11px] text-muted-foreground ml-2">
                        {items.length} modelo{items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    }
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border/30">
                    {items.map((modelo, idx) => (
                      <div
                        key={modelo.id}
                        className={`flex items-center gap-3 px-4 py-2.5 group hover:bg-muted/20 transition-colors ${
                          idx < items.length - 1 ? 'border-b border-border/20' : ''
                        }`}
                      >
                        <FileText className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">{modelo.nome}</p>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {modelo.marcadores.slice(0, 4).map((m, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] px-1 py-0 h-[18px] font-mono text-muted-foreground/70 border-border/40">
                                {m}
                              </Badge>
                            ))}
                            {modelo.marcadores.length > 4 && (
                              <span className="text-[9px] text-muted-foreground/50">
                                +{modelo.marcadores.length - 4}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive hover:bg-destructive/5"
                          onClick={() => setDeleteTarget(modelo)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      <ModeloUploadModal open={uploadOpen} onOpenChange={setUploadOpen} onSave={onUpload} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              O modelo "{deleteTarget?.nome}" será removido permanentemente.
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
