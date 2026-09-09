import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Check, Tag, MapPin, AlertCircle, Scale, Sparkles, ChevronDown,
  History, Loader2, X as XIcon,
  type LucideIcon,
} from 'lucide-react';
import { ChatTag, SubscriberTag, TAG_COLORS } from '@/hooks/useChatTags';
import { getTagIcon } from './TagBadge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TagChangeLogEntry {
  id: string;
  action: 'added' | 'removed';
  reason: string | null;
  created_at: string;
  chat_tags: { name: string; color: string } | null;
  perfis: { nome: string | null; sobrenome: string | null } | null;
}

interface TagSelectorProps {
  subscriberId: string;
  availableTags: ChatTag[];
  currentTags: SubscriberTag[];
  onAddTag: (tagId: string, reason?: string) => Promise<{ error: any }>;
  onRemoveTag: (tagId: string) => Promise<{ error: any }>;
  onCreateTag?: (name: string, color: string) => Promise<{ error: any; data: ChatTag | null }>;
  /** Rótulo do gatilho quando não há tag selecionada dentre as `availableTags`
   * passadas (ex.: "Tarja de lead"). Quando informado, o gatilho mostra um
   * pill de seleção única (nome + cor da tag ativa, ou o rótulo em cinza) em
   * vez do botão padrão "+ Tag" — usado pra categorias de troca única
   * (origem/triagem/area) exibidas fora da fileira de badges. */
  triggerLabel?: string;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  origem:  MapPin,
  triagem: AlertCircle,
  area:    Scale,
  custom:  Sparkles,
  outros:  Tag,
};

const CATEGORY_LABELS: Record<string, string> = {
  origem:  'Origem / Status',
  triagem: 'Triagem',
  area:    'Área do Direito',
  custom:  'Personalizadas',
  outros:  'Outros',
};

export function TagSelector({
  subscriberId,
  availableTags,
  currentTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  triggerLabel,
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [reasonDialog, setReasonDialog] = useState<{ tag: ChatTag; open: boolean }>({
    tag: null as any,
    open: false,
  });
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [newTagDialog, setNewTagDialog] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('gray');
  const [history, setHistory] = useState<TagChangeLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Histórico de quem adicionou/removeu cada tag — busca só quando abre o
  // popover (não precisa manter isso carregado o tempo todo pra cada
  // conversa da lista).
  useEffect(() => {
    if (!open) return;
    setHistoryLoading(true);
    supabase
      .from('tag_change_log' as any)
      .select('id, action, reason, created_at, chat_tags(name, color), perfis(nome, sobrenome)')
      .eq('subscriber_id', subscriberId)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data, error }) => {
        if (error) console.error('[TagSelector] Erro ao carregar histórico de tags:', error);
        setHistory((data as any as TagChangeLogEntry[]) || []);
        setHistoryLoading(false);
      });
  }, [open, subscriberId]);

  const currentTagIds = new Set(currentTags.map(t => t.tag_id));
  // Modo triggerLabel: qual das currentTags está dentre as availableTags
  // passadas (já filtradas pelo chamador, ex.: só categoria "origem").
  const activeInScope = triggerLabel
    ? currentTags.find(st => availableTags.some(t => t.id === st.tag_id))
    : undefined;

  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const groupedTags = filteredTags.reduce((acc, tag) => {
    const category = tag.category || 'outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(tag);
    return acc;
  }, {} as Record<string, ChatTag[]>);

  // Categorias estruturadas: só uma tag por vez (swap ao clicar em outra)
  const SWAP_CATEGORIES = ['origem', 'triagem', 'area'];

  const handleTagClick = async (tag: ChatTag) => {
    if (currentTagIds.has(tag.id)) {
      setLoading(true);
      await onRemoveTag(tag.id);
      setLoading(false);
    } else if (tag.requires_reason) {
      setReasonDialog({ tag, open: true });
    } else {
      setLoading(true);
      // Para categorias estruturadas: remove a tag existente da mesma categoria antes de adicionar
      if (tag.category && SWAP_CATEGORIES.includes(tag.category)) {
        const sameCatIds = new Set(
          availableTags.filter(t => t.category === tag.category && t.id !== tag.id).map(t => t.id)
        );
        const toRemove = currentTags.filter(st => sameCatIds.has(st.tag_id));
        for (const st of toRemove) {
          await onRemoveTag(st.tag_id);
        }
      }
      await onAddTag(tag.id);
      setLoading(false);
    }
  };

  const handleReasonSubmit = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    await onAddTag(reasonDialog.tag.id, reason.trim());
    setReason('');
    setReasonDialog({ tag: null as any, open: false });
    setLoading(false);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !onCreateTag) return;
    setLoading(true);
    const { data } = await onCreateTag(newTagName.trim(), newTagColor);
    if (data) await onAddTag(data.id);
    setNewTagName('');
    setNewTagColor('gray');
    setNewTagDialog(false);
    setLoading(false);
  };

  const categoryOrder = ['origem', 'triagem', 'area', 'custom', 'outros'];
  const sortedCategories = Object.keys(groupedTags).sort(
    (a, b) => (categoryOrder.indexOf(a) ?? 99) - (categoryOrder.indexOf(b) ?? 99)
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {triggerLabel ? (
            <button
              className={cn(
                'inline-flex items-center gap-1 h-6 px-2.5 text-[11px] rounded-full font-semibold transition-all duration-150 shrink-0 max-w-[160px]',
                activeInScope?.tag
                  ? cn(TAG_COLORS[activeInScope.tag.color]?.bg, TAG_COLORS[activeInScope.tag.color]?.text, 'hover:shadow-sm')
                  : 'bg-[#d9d9d9] text-[#1e2930] hover:bg-[#c7c7c7]',
              )}
            >
              <span className="truncate">{activeInScope?.tag?.name || triggerLabel}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-1 h-6 px-2.5 text-[11px] rounded-full font-semibold bg-[#d9d9d9] text-[#1e2930] hover:bg-[#c7c7c7] transition-all duration-150 shrink-0"
            >
              Adicionar tag
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3 z-[200]" align="start" side="bottom" sideOffset={6}>
          <Input
            placeholder="Buscar tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm mb-3"
            autoFocus
          />

          <div className="max-h-72 overflow-y-auto space-y-1 pr-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            {sortedCategories.map((category, catIdx) => {
              const CatIcon = CATEGORY_ICONS[category] || Tag;
              return (
                <div key={category} className={cn(catIdx > 0 && 'pt-2 mt-1 border-t border-border/60')}>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest px-0.5 pb-2">
                    <CatIcon className="h-3 w-3" />
                    {CATEGORY_LABELS[category] || category}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {groupedTags[category].map((tag) => {
                      const isSelected = currentTagIds.has(tag.id);
                      const colors = TAG_COLORS[tag.color] || TAG_COLORS.gray;
                      const Icon = getTagIcon(tag);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => handleTagClick(tag)}
                          disabled={loading}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all duration-150',
                            colors.bg,
                            colors.text,
                            colors.border,
                            isSelected
                              ? 'ring-2 ring-offset-1 ring-primary/70 shadow-sm scale-105'
                              : 'opacity-75 hover:opacity-100 hover:scale-105',
                            'disabled:opacity-40 cursor-pointer',
                          )}
                        >
                          {isSelected
                            ? <Check className="h-2.5 w-2.5 shrink-0" />
                            : <Icon className="h-2.5 w-2.5 shrink-0" />
                          }
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {sortedCategories.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma tag encontrada
              </p>
            )}
          </div>

          {onCreateTag && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-xs gap-1"
              onClick={() => setNewTagDialog(true)}
            >
              <Plus className="h-3 w-3" />
              Criar nova tag
            </Button>
          )}

          {/* Histórico: quem adicionou/removeu cada tag desse lead e quando —
              já era gravado em tag_change_log a cada ação, só nunca tinha
              tela pra mostrar. */}
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest px-0.5 pb-2">
              <History className="h-3 w-3" />
              Histórico
            </div>
            {historyLoading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/60 text-center py-2">
                Nenhuma alteração registrada
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                {history.map((entry) => {
                  const colors = TAG_COLORS[entry.chat_tags?.color || 'gray'] || TAG_COLORS.gray;
                  const nome = [entry.perfis?.nome, entry.perfis?.sobrenome].filter(Boolean).join(' ') || 'Sistema';
                  return (
                    <div key={entry.id} className="flex items-start gap-1.5 text-[11px]">
                      {entry.action === 'added'
                        ? <Plus className="h-3 w-3 shrink-0 mt-0.5 text-emerald-500" />
                        : <XIcon className="h-3 w-3 shrink-0 mt-0.5 text-red-500" />}
                      <div className="min-w-0 flex-1">
                        <span className={cn('font-medium', colors.text)}>{entry.chat_tags?.name || 'tag removida'}</span>
                        <span className="text-muted-foreground/70"> — {entry.action === 'added' ? 'adicionada' : 'removida'} por {nome}</span>
                        {entry.reason && <p className="text-muted-foreground/60 italic truncate" title={entry.reason}>{entry.reason}</p>}
                      </div>
                      <span className="text-muted-foreground/50 shrink-0 whitespace-nowrap">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={reasonDialog.open} onOpenChange={(o) => {
        if (!o) setReasonDialog({ tag: null as any, open: false });
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar motivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A tag "{reasonDialog.tag?.name}" requer um motivo.
            </p>
            <Textarea
              placeholder="Digite o motivo..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialog({ tag: null as any, open: false })}>
              Cancelar
            </Button>
            <Button onClick={handleReasonSubmit} disabled={!reason.trim() || loading}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newTagDialog} onOpenChange={(o) => { setNewTagDialog(o); if (!o) { setNewTagName(''); setNewTagColor('blue'); } }}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-5 py-4 border-b border-border/60">
            <DialogTitle className="flex items-center gap-3 text-[15px] font-semibold leading-tight">
              <div className="h-9 w-9 rounded-full bg-primary/12 flex items-center justify-center shrink-0">
                <Tag className="h-[18px] w-[18px] text-primary" />
              </div>
              Nova tag personalizada
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 pt-4 pb-2 space-y-4">
            {/* Preview ao vivo */}
            <div className="flex items-center justify-center py-3 rounded-xl bg-muted/40 border border-border/50">
              {newTagName.trim() ? (
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold border',
                  TAG_COLORS[newTagColor]?.bg,
                  TAG_COLORS[newTagColor]?.text,
                  TAG_COLORS[newTagColor]?.border,
                )}>
                  <Sparkles className="h-3 w-3" />
                  {newTagName}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/50">pré-visualização da tag</span>
              )}
            </div>

            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="tag-name" className="text-xs font-medium text-muted-foreground">Nome</Label>
              <Input
                id="tag-name"
                placeholder="Ex: Cliente VIP"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newTagName.trim()) handleCreateTag(); }}
                className="rounded-xl h-9 text-sm"
                autoFocus
              />
            </div>

            {/* Cor */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Cor</Label>
              <div className="grid grid-cols-6 gap-2">
                {Object.entries(TAG_COLORS).map(([color, classes]) => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={cn(
                      'h-8 rounded-lg border-2 transition-all duration-150 hover:scale-105',
                      classes.bg,
                      classes.border,
                      newTagColor === color
                        ? 'ring-2 ring-primary ring-offset-1 scale-105 shadow-sm'
                        : 'opacity-60 hover:opacity-100',
                    )}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="px-5 py-3 border-t border-border/40 gap-2">
            <Button variant="outline" size="sm" onClick={() => setNewTagDialog(false)} className="rounded-xl flex-1">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || loading}
              className="rounded-xl flex-1"
            >
              {loading ? 'Criando…' : 'Criar tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
