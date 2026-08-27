// Revisão + histórico de versões — backend Cloudflare. Sem prévia em PDF
// ainda (o Worker não tem conversão docx-to-pdf) — os botões baixam o .docx
// direto do R2 via peticoesAuthBridge.
import { useState, useEffect } from 'react';
import { DetailSkeleton } from '@/components/ui/PageSkeleton';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, FileText, Loader2, CheckCircle2, Edit3,
  Clock, User, DollarSign, Archive,
} from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as api from '@/lib/peticoesV2Client';
import type { PetitionV2, PetitionVersion } from '@/lib/peticoesV2Client';

export default function PeticaoRevisaoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [petition, setPetition] = useState<PetitionV2 | null>(null);
  const [versions, setVersions] = useState<PetitionVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [pet, vers] = await Promise.all([api.fetchPetition(id), api.fetchVersions(id)]);
        setPetition(pet);
        setVersions(vers);
      } catch (err) {
        toast({ title: 'Erro ao carregar petição', description: err instanceof Error ? err.message : 'Erro desconhecido', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, toast]);

  const handleMarkFiled = async () => {
    if (!id) return;
    try {
      await api.markPetitionFiled(id);
      toast({ title: 'Protocolado', description: 'Petição marcada como protocolada' });
      setPetition(prev => prev ? { ...prev, status: 'filed' } : prev);
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Não foi possível marcar como protocolada', variant: 'destructive' });
    }
  };

  const handleArchive = async () => {
    if (!id) return;
    try {
      await api.archivePetition(id);
      toast({ title: 'Arquivado', description: 'Petição arquivada' });
      navigate('/peticoes');
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Não foi possível arquivar a petição', variant: 'destructive' });
    }
  };

  const handleDownload = async (r2Key: string, versionLabel: string) => {
    setDownloadingKey(r2Key);
    try {
      const blob = await api.downloadPetitionFile(r2Key);
      const clienteNome = (petition?.form_data_json?.nome_completo as string) || (petition?.form_data_json?.nome_maiusculo as string) || 'documento';
      saveAs(blob, `Peticao_${clienteNome.replace(/\s+/g, '_')}_${versionLabel}.docx`);
    } catch (err) {
      toast({ title: 'Erro ao baixar', description: err instanceof Error ? err.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setDownloadingKey(null);
    }
  };

  if (loading) {
    return (<><AppHeader title="Carregando..." /><DetailSkeleton /></>);
  }

  if (!petition) {
    return (
      <><AppHeader title="Petição não encontrada" />
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <p className="text-muted-foreground">Petição não encontrada</p>
          <Button onClick={() => navigate('/peticoes')}>Voltar</Button>
        </div>
      </>
    );
  }

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
    <>
      <AppHeader title="Revisão da Petição" />
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 max-w-[1000px] mx-auto space-y-6">
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

          <Card className="rounded-xl border border-border/50 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{petition.action_types?.nome || 'Petição'}</h2>
                  <p className="text-sm text-muted-foreground">{petition.petition_models?.nome}</p>
                </div>
                <Badge className={cn('text-xs', statusCfg.color)}>{statusCfg.label}</Badge>
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

              {petition.generated_r2_key && (
                <>
                  <Separator className="my-4" />
                  <Button className="gap-2 rounded-xl" disabled={downloadingKey === petition.generated_r2_key}
                    onClick={() => handleDownload(petition.generated_r2_key!, 'atual')}>
                    {downloadingKey === petition.generated_r2_key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar DOCX
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

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
                        <p className="text-xs text-muted-foreground">{format(new Date(v.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                      </div>
                      {v.generated_r2_key && (
                        <Button variant="outline" size="sm" className="gap-2 rounded-lg" disabled={downloadingKey === v.generated_r2_key}
                          onClick={() => handleDownload(v.generated_r2_key, `v${v.version_number}`)}>
                          {downloadingKey === v.generated_r2_key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} DOCX
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
