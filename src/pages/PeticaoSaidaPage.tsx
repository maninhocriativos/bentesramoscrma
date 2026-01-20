import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Download, FileText, 
  Loader2, Clock, CheckCircle2, Edit3, FileDown, Sparkles
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { usePeticoes } from '@/hooks/usePeticoes';
import { useOfficeSettings } from '@/hooks/useOfficeSettings';
import { supabase } from '@/integrations/supabase/client';
import { PetitionEditor } from '@/components/peticoes/PetitionEditor';
import { generatePetitionPdf } from '@/lib/pdfPetitionGenerator';
import type { Petition, PetitionDocument } from '@/types/peticoes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function PeticaoSaidaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getPetition, getDocuments, updatePetition } = usePeticoes();
  const { settings: officeSettings } = useOfficeSettings();

  const [petition, setPetition] = useState<Petition | null>(null);
  const [documents, setDocuments] = useState<PetitionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [savingHtml, setSavingHtml] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      
      const [petitionData, docsData] = await Promise.all([
        getPetition(id),
        getDocuments(id),
      ]);

      if (petitionData) {
        setPetition(petitionData);
        setDocuments(docsData);
      } else {
        navigate('/peticoes');
      }
      
      setLoading(false);
    };
    load();
  }, [id, getPetition, getDocuments, navigate]);

  const latestDoc = documents[0];

  const handleGeneratePdf = async () => {
    if (!petition) {
      toast({
        title: 'Erro',
        description: 'Petição não encontrada.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!latestDoc?.html_content) {
      toast({
        title: 'Erro',
        description: 'Nenhum conteúdo HTML disponível. Gere a petição primeiro.',
        variant: 'destructive',
      });
      return;
    }
    
    setGeneratingPdf(true);

    try {
      const pdfBlob = await generatePetitionPdf({
        htmlContent: latestDoc.html_content,
        officeSettings,
        petitionId: petition.id,
        version: latestDoc.version || 1,
      });

      if (pdfBlob.size < 100) {
        throw new Error('PDF gerado está vazio ou corrompido.');
      }

      const fileName = `peticao-${petition.id}-v${latestDoc.version}.pdf`;
      const filePath = `petitions/${petition.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('documentos').upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

      if (uploadError) {
        throw new Error(`Falha no upload: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(filePath);
      
      await supabase.from('petition_documents').update({ pdf_url: urlData.publicUrl }).eq('id', latestDoc.id);

      const docsData = await getDocuments(petition.id);
      setDocuments(docsData);

      await updatePetition(petition.id, { status: 'gerado' });

      toast({
        title: 'PDF gerado com sucesso!',
        description: 'Clique em "Baixar PDF" para fazer o download.',
      });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao gerar PDF',
        description: errorMessage,
        variant: 'destructive',
      });
    }

    setGeneratingPdf(false);
  };

  const handleSaveHtml = async (newHtml: string) => {
    if (!latestDoc) return;
    setSavingHtml(true);

    try {
      const { error } = await supabase
        .from('petition_documents')
        .update({ html_content: newHtml })
        .eq('id', latestDoc.id);

      if (error) throw error;

      setDocuments(prev => prev.map(doc => 
        doc.id === latestDoc.id ? { ...doc, html_content: newHtml } : doc
      ));

      toast({
        title: 'Alterações salvas!',
        description: 'O HTML foi atualizado com sucesso.',
      });

      setEditMode(false);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erro ao salvar',
        description: 'Tente novamente',
        variant: 'destructive',
      });
    }

    setSavingHtml(false);
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <Sparkles className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-muted-foreground">Carregando documento...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <AppHeader title="Documento Final" />
      
      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/peticoes')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para lista
              </Button>
              
              <div className="flex items-center gap-2 flex-wrap">
                {latestDoc?.html_content && !editMode && (
                  <Button
                    variant="outline"
                    onClick={() => setEditMode(true)}
                    className="gap-2"
                  >
                    <Edit3 className="h-4 w-4" />
                    Editar Petição
                  </Button>
                )}
                
                {editMode && (
                  <Button
                    variant="ghost"
                    onClick={() => setEditMode(false)}
                  >
                    Cancelar
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={handleGeneratePdf}
                  disabled={generatingPdf || editMode}
                  className="gap-2"
                >
                  {generatingPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  {latestDoc?.pdf_url ? 'Regerar PDF' : 'Gerar PDF'}
                </Button>
                
                {latestDoc?.pdf_url && (
                  <Button 
                    onClick={() => handleDownload(latestDoc.pdf_url!, `peticao-${petition?.id}.pdf`)}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Baixar PDF
                  </Button>
                )}
              </div>
            </div>

            <div className="grid lg:grid-cols-4 gap-6">
              {/* Preview / Editor */}
              <div className="lg:col-span-3">
                <Card className="border-0 shadow-xl h-[700px] overflow-hidden">
                  <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30 py-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5 text-primary" />
                      {editMode ? 'Editor de Petição' : 'Prévia do Documento'}
                      {latestDoc && (
                        <Badge variant="outline" className="ml-auto">
                          v{latestDoc.version}
                        </Badge>
                      )}
                      {editMode && (
                        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">
                          Modo Edição
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  
                  {editMode && latestDoc?.html_content ? (
                    <PetitionEditor 
                      initialHtml={latestDoc.html_content}
                      onSave={handleSaveHtml}
                      saving={savingHtml}
                    />
                  ) : (
                    <ScrollArea className="h-[calc(100%-52px)]">
                      <CardContent className="p-8">
                        {latestDoc?.html_content ? (
                          <div 
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: latestDoc.html_content }}
                            style={{ 
                              fontFamily: 'Times New Roman, serif',
                              fontSize: '12pt',
                              lineHeight: '1.5',
                            }}
                          />
                        ) : (
                          <div className="text-center py-16">
                            <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-6" />
                            <h3 className="text-lg font-semibold mb-2">Nenhum documento gerado</h3>
                            <p className="text-muted-foreground mb-6">
                              Volte à revisão e clique em "Gerar Petição" para criar o documento.
                            </p>
                            <Button 
                              variant="outline"
                              onClick={() => navigate(`/peticoes/${id}/revisao`)}
                            >
                              Ir para Revisão
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </ScrollArea>
                  )}
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* Info */}
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Informações</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tipo:</span>
                      <span className="font-medium text-right">{petition?.petition_types?.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cliente:</span>
                      <span className="font-medium">{petition?.client_name || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="outline" className="capitalize">{petition?.status}</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Version History */}
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Histórico
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {documents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma versão gerada
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {documents.map((doc, index) => (
                          <li key={doc.id} className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                              index === 0 
                                ? "bg-emerald-500 text-white shadow-lg" 
                                : "bg-muted"
                            )}>
                              {index === 0 ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : (
                                <span className="text-xs font-medium">v{doc.version}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium flex items-center gap-2">
                                Versão {doc.version}
                                {index === 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    Atual
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(doc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                            {doc.pdf_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0"
                                onClick={() => handleDownload(doc.pdf_url!, `peticao-v${doc.version}.pdf`)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </AppLayout>
  );
}
