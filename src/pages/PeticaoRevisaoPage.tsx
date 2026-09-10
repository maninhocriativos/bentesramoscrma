// Revisão + histórico de versões — backend Cloudflare. Sem prévia em PDF
// ainda (o Worker não tem conversão docx-to-pdf) — os botões baixam o .docx
// direto do R2 via peticoesAuthBridge.
// Sem frame próprio no Figma (os 9 frames cobrem só dashboard/modal/wizard)
// — segue a mesma paleta e padrão de cards das outras telas de Petições.
import { useState, useEffect } from 'react';
import { DetailSkeleton } from '@/components/ui/PageSkeleton';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, Loader2, CheckCircle2, Edit3,
  Clock, User, DollarSign, Archive, LogOut,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as api from '@/lib/peticoesV2Client';
import type { PetitionV2, PetitionVersion } from '@/lib/peticoesV2Client';
import { NotificacoesBell } from '@/components/NotificacoesBell';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  draft:     { label: 'Rascunho',    bg: '#fef3c7', fg: '#92400e' },
  review:    { label: 'Em Revisão',  bg: '#e8f0fe', fg: '#1565c0' },
  generated: { label: 'Gerado',      bg: '#dcfce7', fg: '#15803d' },
  filed:     { label: 'Protocolado', bg: '#f3e5f5', fg: '#6a1b9a' },
  archived:  { label: 'Arquivado',   bg: '#f5efe6', fg: '#6e5e5a' },
};

export default function PeticaoRevisaoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const { cargo, fullName } = usePerfil();

  const [petition, setPetition] = useState<PetitionV2 | null>(null);
  const [versions, setVersions] = useState<PetitionVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const handleSignOut = async () => { await signOut(); navigate('/auth'); };

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
    return <DetailSkeleton />;
  }

  if (!petition) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4 bg-[#f9f6f0] h-full">
        <p className="text-[#6e5e5a] text-sm">Petição não encontrada</p>
        <button onClick={() => navigate('/peticoes')} className="px-5 py-2.5 rounded-xl bg-[#3e2f2b] text-white text-sm font-semibold hover:bg-[#2d211d] transition-colors">
          Voltar
        </button>
      </div>
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

  const statusCfg = STATUS[petition.status] || STATUS.draft;

  return (
    <div className="flex flex-col h-full bg-[#f9f6f0]">
      <div className="bg-white border-b border-[#efebe4] px-6 sm:px-10 py-5 flex items-center justify-between shrink-0 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl text-[#29201e] truncate">Revisão da Petição</h1>
          <p className="text-sm text-[#6e5e5a] mt-1 truncate">{petition.action_types?.nome} · {petition.petition_models?.nome}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <NotificacoesBell />
          {user && (
            <>
              <span className="hidden lg:inline text-sm text-[#6e5e5a]">{fullName || user.email}</span>
              <span className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#f5efe6] text-[#6e5e5a]">{cargo}</span>
              <button onClick={handleSignOut} title="Sair" className="h-9 w-9 rounded-full border border-[#efebe4] flex items-center justify-center text-[#6e5e5a] hover:bg-[#f5efe6] transition-colors">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 sm:p-10">
        <div className="max-w-[1000px] mx-auto space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button onClick={() => navigate('/peticoes')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#6e5e5a] hover:bg-[#f5efe6] transition-colors">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="flex items-center gap-2">
              {petition.status === 'generated' && (
                <button onClick={handleMarkFiled} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3e2f2b] hover:bg-[#2d211d] text-white text-sm font-semibold transition-colors">
                  <CheckCircle2 className="h-4 w-4" /> Marcar Protocolado
                </button>
              )}
              <button onClick={() => navigate(`/peticoes/${id}/editar`)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#efebe4] text-sm font-semibold text-[#29201e] hover:bg-[#f5efe6] transition-colors">
                <Edit3 className="h-4 w-4" /> Editar Dados
              </button>
              <button onClick={handleArchive} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#efebe4] text-sm font-semibold text-[#29201e] hover:bg-[#f5efe6] transition-colors">
                <Archive className="h-4 w-4" /> Arquivar
              </button>
            </div>
          </div>

          <div className="bg-white border border-[#efebe4] rounded-2xl p-6 sm:p-8">
            <div className="flex items-start justify-between mb-5 gap-3">
              <div>
                <h2 className="text-lg text-[#29201e]">{petition.action_types?.nome || 'Petição'}</h2>
                <p className="text-sm text-[#6e5e5a] mt-0.5">{petition.petition_models?.nome}</p>
              </div>
              <span className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: statusCfg.bg, color: statusCfg.fg }}>
                {statusCfg.label}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-[#efebe4] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-[#3e2f2b]" />
                  <span className="text-sm font-semibold text-[#29201e]">Cliente</span>
                </div>
                <div className="space-y-1.5 text-sm text-[#29201e]">
                  <p><span className="text-[#6e5e5a]">Nome:</span> {campo('nome_completo', 'nome_maiusculo') || '—'}</p>
                  <p><span className="text-[#6e5e5a]">CPF:</span> {campo('cpf') || '—'}</p>
                  <p><span className="text-[#6e5e5a]">RG:</span> {campo('rg') || '—'}</p>
                  <p><span className="text-[#6e5e5a]">Estado Civil:</span> {campo('estado_civil') || '—'}</p>
                  <p><span className="text-[#6e5e5a]">Profissão:</span> {campo('profissao') || '—'}</p>
                </div>
              </div>

              <div className="border border-[#efebe4] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-[#3e2f2b]" />
                  <span className="text-sm font-semibold text-[#29201e]">Valores e Réu</span>
                </div>
                <div className="space-y-1.5 text-sm text-[#29201e]">
                  <p><span className="text-[#6e5e5a]">Banco/Réu:</span> {campo('reu_nome', 'banco_nome') || '—'}</p>
                  <p><span className="text-[#6e5e5a]">Nº do Contrato:</span> {campo('numero_contrato') || '—'}</p>
                  <p><span className="text-[#6e5e5a]">Valor do Empréstimo:</span> {campo('valor_emprestimo') ? `R$ ${campo('valor_emprestimo')}` : '—'}</p>
                  <p><span className="text-[#6e5e5a]">Valor da Causa:</span> {campo('valor_causa') ? `R$ ${campo('valor_causa')}` : '—'}</p>
                </div>
              </div>
            </div>

            {petition.generated_r2_key && (
              <>
                <div className="h-px bg-[#efebe4] my-5" />
                <button
                  disabled={downloadingKey === petition.generated_r2_key}
                  onClick={() => handleDownload(petition.generated_r2_key!, 'atual')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3e2f2b] hover:bg-[#2d211d] text-white text-sm font-semibold transition-colors disabled:opacity-60">
                  {downloadingKey === petition.generated_r2_key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar DOCX
                </button>
              </>
            )}
          </div>

          {versions.length > 0 && (
            <div className="bg-white border border-[#efebe4] rounded-2xl p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-[#3e2f2b]" />
                <span className="text-sm font-semibold text-[#29201e]">Histórico de Versões</span>
              </div>
              <div className="space-y-3">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3.5 rounded-xl border border-[#efebe4] hover:border-[#c5a47e] transition-colors">
                    <div>
                      <p className="text-sm font-medium text-[#29201e]">Versão {v.version_number}</p>
                      <p className="text-xs text-[#6e5e5a] mt-0.5">{format(new Date(v.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                    {v.generated_r2_key && (
                      <button
                        disabled={downloadingKey === v.generated_r2_key}
                        onClick={() => handleDownload(v.generated_r2_key, `v${v.version_number}`)}
                        className={cn('flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#efebe4] text-xs font-semibold text-[#29201e] hover:bg-[#f5efe6] transition-colors', downloadingKey === v.generated_r2_key && 'opacity-60')}>
                        {downloadingKey === v.generated_r2_key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} DOCX
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
