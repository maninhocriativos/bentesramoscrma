import { useState, useMemo } from 'react';
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
import {
  Search, Plus, Scale, FileText, FolderOpen, Sparkles,
} from 'lucide-react';

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

  const filteredPeticoes = useMemo(() => {
    if (!search) return peticoesGeradas;
    const q = search.toLowerCase();
    return peticoesGeradas.filter(p =>
      (p.nome_completo || p.cliente_nome || '').toLowerCase().includes(q) ||
      (p.reu_nome || p.parte_contraria || '').toLowerCase().includes(q) ||
      (p.modelos_peticao?.nome || '').toLowerCase().includes(q)
    );
  }, [peticoesGeradas, search]);

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
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Petições Iniciais</h1>
              <p className="text-xs text-muted-foreground">
                {modelos.length} modelos • {peticoesGeradas.length} petições geradas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 w-48 h-8 text-xs"
              />
            </div>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setGerarModalOpen(true)}>
              <Sparkles className="h-3.5 w-3.5" />
              Nova Petição
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="h-9 bg-muted/50 p-0.5">
            <TabsTrigger value="geradas" className="text-xs gap-1.5 h-8 px-4">
              <FileText className="h-3.5 w-3.5" />
              Petições Geradas
              {peticoesGeradas.length > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 ml-0.5 font-semibold">
                  {peticoesGeradas.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="modelos" className="text-xs gap-1.5 h-8 px-4">
              <FolderOpen className="h-3.5 w-3.5" />
              Modelos
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 ml-0.5 font-semibold">
                {modelos.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geradas" className="mt-4">
            <PeticoesGeradasTab
              peticoes={filteredPeticoes}
              onDownload={downloadPeticao}
              onPreview={handlePreviewFromHistory}
              onNewPeticao={() => setGerarModalOpen(true)}
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
