import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Download, FileText, RefreshCw, 
  Loader2, Clock, CheckCircle2 
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { usePeticoes } from '@/hooks/usePeticoes';
import { supabase } from '@/integrations/supabase/client';
import type { Petition, PetitionDocument } from '@/types/peticoes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PeticaoSaidaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getPetition, getDocuments, updatePetition } = usePeticoes();

  const [petition, setPetition] = useState<Petition | null>(null);
  const [documents, setDocuments] = useState<PetitionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

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

  const handleGeneratePdf = async () => {
    if (!petition) return;
    setGeneratingPdf(true);

    try {
      const { data, error } = await supabase.functions.invoke('petition-pdf', {
        body: { petitionId: petition.id },
      });

      if (error) throw error;

      // Recarregar documentos
      const docsData = await getDocuments(petition.id);
      setDocuments(docsData);

      await updatePetition(petition.id, { status: 'gerado' });

      toast({
        title: 'PDF gerado!',
        description: 'Você pode baixar o documento agora.',
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Tente novamente',
        variant: 'destructive',
      });
    }

    setGeneratingPdf(false);
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

  const latestDoc = documents[0];

  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <AppHeader title="Documento Final" />
      
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back button */}
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/peticoes')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para lista
            </Button>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
              >
                {generatingPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {latestDoc ? 'Gerar Nova Versão' : 'Gerar PDF'}
              </Button>
              
              {latestDoc?.pdf_url && (
                <Button onClick={() => handleDownload(latestDoc.pdf_url!, `peticao-${petition?.id}.pdf`)}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar PDF
                </Button>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Preview */}
            <div className="lg:col-span-2">
              <Card className="h-[600px] overflow-hidden">
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5" />
                    Prévia do Documento
                    {latestDoc && (
                      <Badge variant="outline" className="ml-auto">
                        v{latestDoc.version}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <ScrollArea className="h-[calc(100%-60px)]">
                  <CardContent className="p-6">
                    {latestDoc?.html_content ? (
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: latestDoc.html_content }}
                      />
                    ) : (
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          Nenhum documento gerado ainda.
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Clique em "Gerar PDF" para criar o documento.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </ScrollArea>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Informações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="font-medium">{petition?.petition_types?.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="font-medium">{petition?.client_name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="outline">{petition?.status}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Version History */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Histórico de Versões
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
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            index === 0 ? 'bg-success text-white' : 'bg-muted'
                          }`}>
                            {index === 0 ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <span className="text-xs">v{doc.version}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              Versão {doc.version}
                              {index === 0 && (
                                <Badge variant="outline" className="ml-2 text-xs">
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
    </AppLayout>
  );
}
