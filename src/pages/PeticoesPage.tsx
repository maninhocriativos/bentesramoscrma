// Tela de Petições — backend Cloudflare (Worker + D1 + R2), única versão em
// uso. O sistema antigo (Supabase) foi desativado e os dados zerados.
// Layout redesenhado a partir do Figma real (SISTEMA-BENTES-E-RAMOS, nodes
// peticoes-dashboard-desktop / nova-peticao-modal-desktop, 2026-09-10).
import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, MoreHorizontal, Eye, Copy, Archive, Trash2,
  FileText, Scale,
  Plane, CreditCard, TrendingUp, AlertTriangle, Ban,
  ShoppingCart, Package, X, ChevronRight,
  ChevronDown, Sparkles, Gavel, FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { usePeticoesV2Client, type ActionType, type PetitionModelV2 } from '@/hooks/usePeticoesV2Client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificacoesBell } from '@/components/NotificacoesBell';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { LogOut } from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Plane, CreditCard, TrendingUp, AlertTriangle, Ban,
  ShoppingCart, Package, FileText, Scale, Gavel,
};

function ActionIcon({ icone, className }: { icone: string; className?: string }) {
  const Icon = ICON_MAP[icone] ?? FileText;
  return <Icon className={className ?? 'h-4 w-4'} />;
}

// Cores do status — mesma paleta usada no dashboard de Documentos/Sheets
// (amber/blue/green/purple do design), com "arquivado" em tom neutro (o
// Figma não tinha exemplo pra esse status).
const STATUS: Record<string, { label: string; text: string; bg: string; dot: string }> = {
  draft:     { label: 'Rascunho',    text: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  review:    { label: 'Em Revisão',  text: '#1565c0', bg: '#e8f0fe', dot: '#1565c0' },
  generated: { label: 'Gerado',      text: '#15803d', bg: '#dcfce7', dot: '#15803d' },
  filed:     { label: 'Protocolado', text: '#6a1b9a', bg: '#f3e5f5', dot: '#6a1b9a' },
  archived:  { label: 'Arquivado',   text: '#6e5e5a', bg: '#f5efe6', dot: '#6e5e5a' },
};

function NovaPeticaoModal({
  open, onClose, actionTypes, getModelsForAction, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  actionTypes: ActionType[];
  getModelsForAction: (id: string) => PetitionModelV2[];
  onConfirm: (actionId: string, modelId: string) => void;
}) {
  const [step, setStep]                     = useState<1 | 2>(1);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [search, setSearch]                 = useState('');

  function reset() { setStep(1); setSelectedAction(null); setSearch(''); }
  function handleClose() { reset(); onClose(); }

  function pickAction(action: ActionType) {
    const mods = getModelsForAction(action.id);
    if (!mods.length) return;
    if (mods.length === 1) { onConfirm(action.id, mods[0].id); handleClose(); return; }
    setSelectedAction(action); setSearch(''); setStep(2);
  }
  function pickModel(model: PetitionModelV2) {
    if (!selectedAction) return;
    onConfirm(selectedAction.id, model.id);
    handleClose();
  }

  const filteredActions = useMemo(() => {
    const q = search.toLowerCase();
    return q ? actionTypes.filter(a =>
      a.nome.toLowerCase().includes(q) || (a.descricao ?? '').toLowerCase().includes(q)
    ) : actionTypes;
  }, [actionTypes, search]);

  const actionModels = selectedAction ? getModelsForAction(selectedAction.id) : [];

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent hideCloseButton className="max-w-[600px] p-8 gap-6 rounded-[20px] border-0 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] text-[#29201e]">{step === 1 ? 'Selecione a categoria jurídica' : selectedAction?.nome}</h2>
          <button onClick={handleClose} className="text-[#6e5e5a] hover:text-[#29201e] transition-colors"><X className="h-[18px] w-[18px]" /></button>
        </div>

        <div className="flex items-center gap-4">
          {[{ n: 1, l: 'Tipo de Ação' }, { n: 2, l: 'Modelo' }].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={cn('h-6 w-6 rounded-xl flex items-center justify-center text-xs font-semibold',
                step >= s.n ? 'bg-[#3e2f2b] text-white' : 'bg-[#f5efe6] text-[#6e5e5a]')}>
                {step > s.n ? <FileText className="h-3 w-3" /> : s.n}
              </div>
              <span className={cn('text-sm', step === s.n ? 'font-semibold text-[#29201e]' : 'text-[#6e5e5a]')}>{s.l}</span>
              {i < 1 && <div className="h-px w-8 bg-[#efebe4]" />}
            </div>
          ))}
        </div>

        {step === 1 ? (
          <>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6e5e5a]" />
              <Input autoFocus placeholder="Buscar tipo de ação..." value={search} onChange={e => setSearch(e.target.value)} className="pl-11 h-11 rounded-xl border-[#efebe4]" />
            </div>
            <div className="w-full max-h-[340px] overflow-y-auto space-y-2">
              {filteredActions.length === 0 ? (
                <div className="text-center py-12 text-[#6e5e5a]">
                  <Scale className="h-10 w-10 mx-auto mb-3 opacity-15" />
                  <p className="text-sm font-medium">Nenhum tipo encontrado</p>
                </div>
              ) : filteredActions.map(action => {
                const count = getModelsForAction(action.id).length;
                return (
                  <button key={action.id} disabled={count === 0} onClick={() => pickAction(action)}
                    className="group w-full flex items-center gap-4 p-5 rounded-2xl border border-[#efebe4] hover:border-[#c5a47e] hover:bg-[#f5efe6] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed">
                    <div className="h-11 w-11 rounded-[10px] bg-[#3e2f2b] flex items-center justify-center shrink-0"><ActionIcon icone={action.icone} className="h-5 w-5 text-white" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base text-[#29201e]">{action.nome}</p>
                      {action.descricao && <p className="text-[13px] text-[#6e5e5a] mt-0.5 line-clamp-2">{action.descricao}</p>}
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#c5a47e] text-white text-[11px] font-semibold shrink-0">{count} {count === 1 ? 'Modelo' : 'Modelos'}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="w-full max-h-[340px] overflow-y-auto space-y-2">
            {actionModels.length === 0 ? (
              <div className="text-center py-12 text-[#6e5e5a]">
                <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-15" />
                <p className="text-sm font-medium">Nenhum modelo disponível</p>
              </div>
            ) : actionModels.map(model => (
              <button key={model.id} onClick={() => pickModel(model)}
                className="group w-full flex items-center gap-4 p-4 rounded-2xl border border-[#efebe4] hover:border-[#c5a47e] hover:bg-[#f5efe6] transition-colors text-left">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-[#29201e]">{model.nome}</span>
                    {model.is_default && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#c5a47e]/15 text-[#8a6d47] text-[10px] font-bold"><Sparkles className="h-2.5 w-2.5" /> Padrão</span>}
                  </div>
                  {model.descricao && <p className="text-xs text-[#6e5e5a] mt-0.5 line-clamp-2">{model.descricao}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-[#6e5e5a] group-hover:text-[#3e2f2b] transition-colors shrink-0" />
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 w-full">
          {step === 2 && (
            <button onClick={() => { setStep(1); setSearch(''); }} className="px-6 py-3 rounded-xl border border-[#efebe4] text-sm font-semibold text-[#6e5e5a] hover:bg-[#f5efe6] transition-colors">Voltar</button>
          )}
          <button onClick={handleClose} className="px-6 py-3 rounded-xl border border-[#efebe4] text-sm font-semibold text-[#6e5e5a] hover:bg-[#f5efe6] transition-colors">Cancelar</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModelsSidePanel({
  actionTypes, getModelsForAction, onSelectModel,
}: {
  actionTypes: ActionType[];
  getModelsForAction: (id: string) => PetitionModelV2[];
  onSelectModel: (actionId: string, modelId: string) => void;
}) {
  const [search, setSearch]     = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const totalModels = useMemo(() => actionTypes.reduce((acc, a) => acc + getModelsForAction(a.id).length, 0), [actionTypes, getModelsForAction]);
  const visible = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return actionTypes;
    return actionTypes.filter(a => a.nome.toLowerCase().includes(q) || getModelsForAction(a.id).some(m => m.nome.toLowerCase().includes(q)));
  }, [actionTypes, search, getModelsForAction]);
  const didInit = useRef(false);
  useEffect(() => {
    if (visible.length === 0) return;
    if (!didInit.current) { didInit.current = true; setExpanded(visible[0].id); }
  }, [visible]);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#efebe4] bg-white p-5 w-[300px] shrink-0">
      <div>
        <h2 className="text-base text-[#29201e]">Biblioteca de Modelos</h2>
        <p className="text-[13px] text-[#6e5e5a] mt-0.5">{totalModels} {totalModels === 1 ? 'modelo disponível' : 'modelos disponíveis'} em {actionTypes.length} {actionTypes.length === 1 ? 'categoria' : 'categorias'}</p>
      </div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6e5e5a]" />
        <Input placeholder="Buscar modelo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10 text-[13px] rounded-xl border-[#efebe4]" />
      </div>
      <div className="space-y-2 max-h-[420px] overflow-y-auto">
        {visible.length === 0 ? (
          <div className="text-center py-10 text-[#6e5e5a]"><FileText className="h-7 w-7 mx-auto mb-2 opacity-15" /><p className="text-xs">Nenhum resultado</p></div>
        ) : visible.map(action => {
          const mods = getModelsForAction(action.id);
          const isOpen = expanded === action.id;
          return (
            <div key={action.id}>
              <button onClick={() => setExpanded(isOpen ? null : action.id)}
                className={cn('w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left',
                  isOpen ? 'border-[#e3d9cd] bg-[#f5efe6]' : 'border-[#efebe4] hover:bg-[#f5efe6]/60')}>
                <div className="h-9 w-9 rounded-lg bg-[#3e2f2b] flex items-center justify-center shrink-0"><ActionIcon icone={action.icone} className="h-4 w-4 text-white" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#29201e] truncate">{action.nome}</p>
                  <p className="text-[11px] text-[#6e5e5a]">{mods.length} {mods.length === 1 ? 'modelo cadastrado' : 'modelos cadastrados'}</p>
                </div>
                <ChevronDown className={cn('h-3.5 w-3.5 text-[#6e5e5a] shrink-0 transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && mods.length > 0 && (
                <div className="mt-1 ml-1 space-y-1">
                  {mods.map(model => (
                    <button key={model.id} onClick={() => onSelectModel(action.id, model.id)}
                      className="group w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#f5efe6] transition-colors">
                      <div className="w-1 self-stretch rounded-full bg-[#c5a47e] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#29201e] group-hover:text-[#3e2f2b] truncate">{model.nome}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-[#c5a47e] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PeticoesPage() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { cargo, fullName } = usePerfil();
  const { actionTypes, petitions, loading, duplicatePetition, archivePetition, deletePetition, getModelsForAction } = usePeticoesV2Client();

  const handleSignOut = async () => { await signOut(); navigate('/auth'); };
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen]       = useState(false);

  const stats = useMemo(() => ({
    draft: petitions.filter(p => p.status === 'draft').length,
    review: petitions.filter(p => p.status === 'review').length,
    generated: petitions.filter(p => p.status === 'generated').length,
    filed: petitions.filter(p => p.status === 'filed').length,
  }), [petitions]);

  const filtered = useMemo(() => petitions.filter(p => {
    const q = searchTerm.toLowerCase();
    const nome = getClientName(p).toLowerCase();
    const acao = p.action_types?.nome?.toLowerCase() ?? '';
    const modelo = p.petition_models?.nome?.toLowerCase() ?? '';
    const okS = !q || nome.includes(q) || acao.includes(q) || modelo.includes(q);
    const okF = statusFilter === 'all' || p.status === statusFilter;
    return okS && okF;
  }), [petitions, searchTerm, statusFilter]);

  function getClientName(p: typeof petitions[0]) {
    const fd = p.form_data_json as Record<string, unknown>;
    return (fd.nome_completo as string) || (fd.nome_maiusculo as string) || 'Sem cliente informado';
  }
  function handleOpen(id: string, status: string) {
    navigate(status === 'generated' || status === 'filed' ? `/peticoes/${id}/revisao` : `/peticoes/${id}/editar`);
  }

  const STAT_ITEMS = [
    { label: 'Rascunhos', value: stats.draft, bg: '#fef3c7', text: '#92400e', filter: 'draft' },
    { label: 'Em Revisão', value: stats.review, bg: '#e8f0fe', text: '#1565c0', filter: 'review' },
    { label: 'Gerados', value: stats.generated, bg: '#dcfce7', text: '#15803d', filter: 'generated' },
    { label: 'Protocolados', value: stats.filed, bg: '#f3e5f5', text: '#6a1b9a', filter: 'filed' },
  ];
  const FILTER_TABS = [
    { v: 'all', l: 'Todos' }, { v: 'draft', l: 'Rascunho' }, { v: 'review', l: 'Revisão' },
    { v: 'generated', l: 'Gerado' }, { v: 'filed', l: 'Protocolado' }, { v: 'archived', l: 'Arquivado' },
  ];

  return (
    <>
      <div className="flex flex-col h-full bg-[#f9f6f0] relative">
        <div className="bg-white border-b border-[#efebe4] px-6 sm:px-10 py-5 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl text-[#29201e]">Gerador de Petições</h1>
            <p className="text-sm text-[#6e5e5a] mt-1">Crie e gerencie suas petições iniciais de forma automatizada</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-[#dcfce7] border-[#15803d] text-[#15803d]">
              <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
              Google Drive Conectado
            </div>
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

        <div className="flex-1 overflow-auto px-6 sm:px-10 py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {STAT_ITEMS.map(s => {
              const isActive = statusFilter === s.filter;
              return (
                <button key={s.label} onClick={() => setStatusFilter(isActive ? 'all' : s.filter)}
                  className={cn('flex items-center gap-3 p-4 rounded-2xl border bg-white text-left transition-colors',
                    isActive ? 'border-[#c5a47e]' : 'border-[#efebe4] hover:border-[#e3d9cd]')}>
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-lg" style={{ background: s.bg, color: s.text }}>{s.value}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#6e5e5a] uppercase tracking-wide">{s.label}</p>
                    <p className="text-sm text-[#29201e]">Petições Ativas</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-6 items-start">
            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative w-full sm:w-[280px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6e5e5a]" />
                  <Input placeholder="Buscar petições..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-11 h-10 rounded-xl border-[#efebe4] bg-white" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {FILTER_TABS.map(f => (
                    <button key={f.v} onClick={() => setStatusFilter(f.v)}
                      className={cn('px-4 py-2 rounded-full text-[13px] font-semibold transition-colors',
                        statusFilter === f.v ? 'bg-[#3e2f2b] text-white' : 'bg-white border border-[#efebe4] text-[#6e5e5a] hover:bg-[#f5efe6]')}>
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#efebe4] bg-white overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f5efe6] border-b border-[#efebe4] hover:bg-[#f5efe6]">
                      <TableHead className="text-[13px] uppercase tracking-wide text-[#6e5e5a] font-semibold py-3.5">Ação / Modelo</TableHead>
                      <TableHead className="text-[13px] uppercase tracking-wide text-[#6e5e5a] font-semibold py-3.5 w-[220px]">Cliente</TableHead>
                      <TableHead className="text-[13px] uppercase tracking-wide text-[#6e5e5a] font-semibold py-3.5 w-[120px]">Status</TableHead>
                      <TableHead className="text-[13px] uppercase tracking-wide text-[#6e5e5a] font-semibold py-3.5 w-[140px]">Atualizado em</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i} className="border-b border-[#efebe4]">
                          {Array.from({ length: 5 }).map((_, j) => <TableCell key={j} className="py-4"><Skeleton className="h-4 w-24 rounded-lg" /></TableCell>)}
                        </TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-20">
                          <div className="flex flex-col items-center gap-4">
                            <div className="h-16 w-16 rounded-2xl bg-[#f5efe6] flex items-center justify-center"><Scale className="h-8 w-8 text-[#6e5e5a]/30" /></div>
                            <div>
                              <p className="text-sm font-semibold text-[#29201e]">{petitions.length === 0 ? 'Nenhuma petição ainda' : 'Nenhum resultado'}</p>
                              <p className="text-xs text-[#6e5e5a] mt-1">{petitions.length === 0 ? 'Clique em "Nova Petição" para começar' : 'Tente ajustar os filtros'}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filtered.map(p => {
                      const sc = STATUS[p.status] ?? STATUS.draft;
                      return (
                        <TableRow key={p.id} className="cursor-pointer hover:bg-[#f5efe6]/50 transition-colors border-b border-[#efebe4] last:border-0 group" onClick={() => handleOpen(p.id, p.status)}>
                          <TableCell className="py-4">
                            <p className="text-sm font-semibold text-[#29201e]">{p.action_types?.nome ?? '—'}</p>
                            {p.petition_models?.nome && <p className="text-xs text-[#6e5e5a] mt-0.5">{p.petition_models.nome}</p>}
                          </TableCell>
                          <TableCell className="py-4 text-sm text-[#6e5e5a]">{getClientName(p)}</TableCell>
                          <TableCell className="py-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                          </TableCell>
                          <TableCell className="py-4 text-sm text-[#6e5e5a]">{format(new Date(p.updated_at), "dd/MM HH:mm", { locale: ptBR })}</TableCell>
                          <TableCell className="py-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                <button className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-[#6e5e5a] hover:bg-[#f5efe6] md:opacity-0 md:group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl w-44">
                                <DropdownMenuItem className="gap-2" onClick={e => { e.stopPropagation(); handleOpen(p.id, p.status); }}><Eye className="h-4 w-4" /> Abrir</DropdownMenuItem>
                                <DropdownMenuItem className="gap-2" onClick={e => { e.stopPropagation(); duplicatePetition(p.id); }}><Copy className="h-4 w-4" /> Duplicar</DropdownMenuItem>
                                <DropdownMenuItem className="gap-2" onClick={e => { e.stopPropagation(); archivePetition(p.id); }}><Archive className="h-4 w-4" /> Arquivar</DropdownMenuItem>
                                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={e => {
                                  e.stopPropagation();
                                  if (window.confirm(`Excluir a petição "${p.action_types?.nome || 'sem título'}"? Essa ação não pode ser desfeita.`)) deletePetition(p.id);
                                }}><Trash2 className="h-4 w-4" /> Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="hidden xl:block">
              <ModelsSidePanel actionTypes={actionTypes} getModelsForAction={getModelsForAction} onSelectModel={(actionId, modelId) => navigate(`/peticoes/nova?action=${actionId}&model=${modelId}`)} />
            </div>
          </div>
        </div>

        <button onClick={() => setModalOpen(true)}
          className="absolute bottom-10 right-10 h-12 px-6 rounded-full bg-[#3e2f2b] hover:bg-[#2d211d] text-white flex items-center gap-2 font-semibold text-sm shadow-lg transition-colors">
          <Plus className="h-4 w-4" /> Nova Petição
        </button>
      </div>

      <NovaPeticaoModal open={modalOpen} onClose={() => setModalOpen(false)} actionTypes={actionTypes} getModelsForAction={getModelsForAction}
        onConfirm={(actionId, modelId) => navigate(`/peticoes/nova?action=${actionId}&model=${modelId}`)} />
    </>
  );
}
