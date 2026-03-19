import { useState } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useModelosPeticaoDocx } from '@/hooks/useModelosPeticaoDocx';
import ModelosPeticaoTab from '@/components/peticoes-docx/ModelosPeticaoTab';
import PeticoesGeradasTab from '@/components/peticoes-docx/PeticoesGeradasTab';
import GerarPeticaoModal from '@/components/peticoes-docx/GerarPeticaoModal';
import DocxPreviewModal from '@/components/peticoes-docx/DocxPreviewModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Plus, Scale, FileText, FolderOpen } from 'lucide-react';

export default function PeticoesIniciaisPage() {
  const {
    modelos, peticoesGeradas, loading,
    uploadModelo, deleteModelo, gerarPeticao, downloadPeticao,
  } = useModelosPeticaoDocx();

  const [search, setSearch] = useState('');
  const [mainTab, setMainTab] = useState('geradas');
  const [gerarModalOpen, setGerarModalOpen] = useState(false);
  const [docxPreviewOpen, setDocxPreviewOpen] = useState(false);
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | Blob | null>(null);
  const [docxPreviewTitle, setDocxPreviewTitle] = useState('');

  const handleDocxPreview = (buffer: ArrayBuffer) => {
    setDocxBuffer(buffer);
    setDocxPreviewTitle('Petição Gerada');
    setDocxPreviewOpen(true);
  };

  const handlePreviewFromHistory = async (arquivoUrl: string, nomeCliente: string) => {
    const blob = await downloadPeticao(arquivoUrl, nomeCliente);
    if (blob) {
      setDocxBuffer(blob);
      setDocxPreviewTitle(`Petição - ${nomeCliente}`);
      setDocxPreviewOpen(true);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Petições Iniciais</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gere petições a partir de modelos DOCX
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar petições..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 w-52 h-9 text-sm"
              />
            </div>
            <Button size="sm" onClick={() => setGerarModalOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Nova Petição
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="bg-muted/40">
            <TabsTrigger value="geradas" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Petições Geradas
              {peticoesGeradas.length > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 ml-1">{peticoesGeradas.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="modelos" className="text-xs gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Modelos de Petição
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geradas" className="mt-4">
            <PeticoesGeradasTab
              peticoes={peticoesGeradas}
              onDownload={downloadPeticao}
              onPreview={handlePreviewFromHistory}
            />
          </TabsContent>

          <TabsContent value="modelos" className="mt-4">
            <ModelosPeticaoTab
              modelos={modelos}
              onUpload={uploadModelo}
              onDelete={deleteModelo}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <GerarPeticaoModal
        open={gerarModalOpen}
        onOpenChange={setGerarModalOpen}
        modelos={modelos}
        onGenerate={gerarPeticao}
        onPreview={handleDocxPreview}
      />

      <DocxPreviewModal
        open={docxPreviewOpen}
        onOpenChange={setDocxPreviewOpen}
        docxBuffer={docxBuffer}
        title={docxPreviewTitle}
      />
    </AppLayout>
  );
}
