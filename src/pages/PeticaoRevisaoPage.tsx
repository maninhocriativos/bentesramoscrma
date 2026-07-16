import { useState, useEffect } from 'react';
import { DetailSkeleton } from '@/components/ui/PageSkeleton';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, FileText, Loader2, CheckCircle2, Edit3,
  Sparkles, Clock, User, DollarSign, Copy, Archive, Eye
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBlobUrl(base64: string, mime: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

interface PetitionData {
  id: string;
  status: string;
  form_data_json: Record<string, unknown>;
  generated_docx_url: string | null;
  generated_pdf_url: string | null;
  created_at: string;
  updated_at: string;
  action_types?: { nome: string };
  petition_models_v2?: { nome: string; slug: string; tags: string[] };
}

interface VersionData {
  id: string;
  version_number: number;
  generated_docx_url: string | null;
  created_at: string;
}

export default function PeticaoRevisaoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [petition, setPetition] = useState<PetitionData | null>(null);
  const [versions, setVersions] = useState<VersionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      const [{ data: petData }, { data: versData }] = await Promise.all([
        supabase.from('petitions_v2').select('*, action_types(nome), petition_models_v2(nome, slug, tags)').eq('id', id).single(),
        supabase.from('petition_versions').select('*').eq('petition_id', id).order('version_number', { ascending: false }),
      ]);
      setPetition((petData as unknown as PetitionData) || null);
      setVersions((versData as unknown as VersionData[]) || []);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleMarkFiled = async () => {
    if (!id) return;
    const { error } = await supabase.from('petitions_v2').update({ status: 'filed', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível marcar como protocolada', variant: 'destructive' });
      return;
    }
    toast({ title: 'Protocolado', description: 'Petição marcada como protocolada' });
    setPetition(prev => prev ? { ...prev, status: 'filed' } : prev);
  };

  const handleArchive = async () => {
    if (!id) return;
    const { error } = await supabase.from('petitions_v2').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível arquivar a petição', variant: 'destructive' });
      return;
    }
    toast({ title: 'Arquivado', description: 'Petição arquivada' });
    navigate('/peticoes');
  };

  // Converte via CloudConvert (docx-to-pdf) em vez de mammoth: mammoth ignora
  // cabeçalho/rodapé, então a prévia saía sem o timbre do escritório. A conversão
  // real preserva logo, cabeçalho e rodapé exatamente como o documento imprime.
  const handlePreview = async (docxUrl: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewPdfUrl(null);
    try {
      const resp = await fetch(docxUrl);
      if (!resp.ok) throw new Error('Falha ao baixar o documento');
      const arrayBuffer = await resp.arrayBuffer();
      const base64_docx = arrayBufferToBase64(arrayBuffer);

      const { data, error } = await supabase.functions.invoke('docx-to-pdf', { body: { base64_docx } });
      if (error) throw error;
      if (!data?.base64_pdf) throw new Error(data?.error?.message || 'PDF não retornado');

      setPreviewPdfUrl(base64ToBlobUrl(data.base64_pdf, 'application/pdf'));
    } catch (err) {
      console.error('[PeticaoRevisaoPage] Erro ao gerar pré-visualização:', err);
      toast({ title: 'Erro', description: 'Não foi possível gerar a pré-visualização', variant: 'destructive' });
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout><AppHeader title="Carregando..." />
        <DetailSkeleton />
      </AppLayout>
    );
  }

  if (!petition) {
    return (
      <AppLayout><AppHeader title="Petição não encontrada" />
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <p className="text-muted-foreground">Petição não encontrada</p>
          <Button onClick={() => navigate('/peticoes')}>Voltar</Button>
        </div>
      </AppLayout>
    );
  }

  // form_data_json é um objeto "chato" (uma chave por campo, ex: nome_completo, cpf,
  // valor_causa) — não aninhado em cliente/endereco/banco/valores como este card
  // assumia antes. Também cobre a variante em MAIÚSCULAS que o docxtemplater usa
  // como alias (NOME_COMPLETO, CPF...), presente em alguns registros mais antigos.
  const fd = (petition.form_data_json || {}) as Record<string, unknown>;
  const campo = (...chaves: string[]): string => {
    for (const chave of chaves) {
      const v = fd[chave] ?? fd[chave.toUpperCase()];
      if (v !== undefined && v !== null && String(v).trim()) return String(v);
    }
    return '';
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    draft: { label: 'Rascunho', color: 'bg-amber-100 text-amber-700' },
    review: { label: 'Em Revisão', color: 'bg-yellow-100 text-yellow-700' },
    generated: { label: 'Gerado', color: 'bg-emerald-100 text-emerald-700' },
    filed: { label: 'Protocolado', color: 'bg-violet-100 text-violet-700' },
    archived: { label: 'Arquivado', color: 'bg-gray-100 text-gray-600' },
  };
  const statusCfg = statusMap[petition.status] || statusMap.draft;

  return (
    <AppLayout>
      <AppHeader title="Revisão da Petição" />
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 max-w-[1000px] mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate('/peticoes')} className="gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <div className="flex items-center gap-2">
              {petition.status === 'generated' && (
                <Button onClick={handleMarkFiled} className="gap-2 rounded-xl" size="sm">
                  <CheckCircle2 className="h-4 w-4" /> Marcar Protocolado
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate(`/peticoes/${id}/editar`)} className="gap-2 rounded-xl" size="sm">
                <Edit3 className="h-4 w-4" /> Editar Dados
              </Button>
              <Button variant="outline" onClick={handleArchive} className="gap-2 rounded-xl" size="sm">
                <Archive className="h-4 w-4" /> Arquivar
              </Button>
            </div>
          </div>

          {/* Petition info */}
          <Card className="rounded-xl border border-border/50 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{petition.action_types?.nome || 'Petição'}</h2>
                  <p className="text-sm text-muted-foreground">{petition.petition_models_v2?.nome}</p>
                </div>
                <Badge className={cn("text-xs", statusCfg.color)}>{statusCfg.label}</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Card className="rounded-xl border border-border/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" /> Cliente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Nome:</span> {campo('nome_completo', 'nome_maiusculo') || '—'}</p>
                    <p><span className="text-muted-foreground">CPF:</span> {campo('cpf') || '—'}</p>
                    <p><span className="text-muted-foreground">RG:</span> {campo('rg') || '—'}</p>
                    <p><span className="text-muted-foreground">Estado Civil:</span> {campo('estado_civil') || '—'}</p>
                    <p><span className="text-muted-foreground">Profissão:</span> {campo('profissao') || '—'}</p>
                  </CardContent>
                </Card>

                <Card className="rounded-xl border border-border/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" /> Valores e Réu
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Banco/Réu:</span> {campo('reu_nome', 'banco_nome') || '—'}</p>
                    <p><span className="text-muted-foreground">Nº do Contrato:</span> {campo('numero_contrato') || '—'}</p>
                    <p><span className="text-muted-foreground">Valor do Empréstimo:</span> {campo('valor_emprestimo') ? `R$ ${campo('valor_emprestimo')}` : '—'}</p>
                    <p><span className="text-muted-foreground">Valor da Causa:</span> {campo('valor_causa') ? `R$ ${campo('valor_causa')}` : '—'}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Download / preview buttons */}
              {petition.generated_docx_url && (
                <>
                  <Separator className="my-4" />
                  <div className="flex items-center gap-3">
                    <Button variant="outline" className="gap-2 rounded-xl" onClick={() => handlePreview(petition.generated_docx_url!)}>
                      <Eye className="h-4 w-4" /> Pré-visualizar
                    </Button>
                    <Button asChild className="gap-2 rounded-xl">
                      <a href={petition.generated_docx_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" /> Baixar DOCX
                      </a>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Version History */}
          {versions.length > 0 && (
            <Card className="rounded-xl border border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Histórico de Versões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {versions.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-xl border border-border/30 hover:border-border/60 transition-colors">
                      <div>
                        <p className="text-sm font-medium">Versão {v.version_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(v.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      {v.generated_docx_url && (
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="gap-2 rounded-lg" onClick={() => handlePreview(v.generated_docx_url!)}>
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </Button>
                          <Button asChild variant="outline" size="sm" className="gap-2 rounded-lg">
                            <a href={v.generated_docx_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-3.5 w-3.5" /> DOCX
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      <Dialog open={previewOpen} onOpenChange={(o) => { setPreviewOpen(o); if (!o && previewPdfUrl) { URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null); } }}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-3 border-b border-border/50">
            <DialogTitle className="text-base">Pré-visualização</DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-muted/20">
            {previewLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando pré-visualização...
              </div>
            ) : previewPdfUrl ? (
              <iframe src={previewPdfUrl} title="Pré-visualização da petição" className="w-full h-full border-0" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Não foi possível carregar a pré-visualização.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
