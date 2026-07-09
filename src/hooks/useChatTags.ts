import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ChatTag {
  id: string;
  name: string;
  color: string;
  category: string | null;
  is_system: boolean;
  requires_reason: boolean;
}

export interface SubscriberTag {
  id: string;
  subscriber_id: string;
  tag_id: string;
  reason: string | null;
  tag?: ChatTag;
  created_at: string;
}

// Mapeamento de nome de tag → campos que devem ser atualizados em leads_juridicos
const TAG_LEAD_ACTIONS: Record<string, Record<string, string>> = {
  'Tráfego Pago':        { tipo_origem: 'trafego' },
  'Bentes Ramos':        { tipo_origem: 'whatsapp_direto' },
  'Desistiu':            { status: 'Perdido' },
  'Perdido':             { status: 'Perdido' },
  'Aguardando contrato': { lead_state: 'CONTRACT_SENT', status: 'Aguardando Contrato' },
  'Indicação':           { tipo_origem: 'indicacao' },
  'Enviou documentação': { lead_state: 'DOCS_PENDING' },
  'Bancário':            { case_type: 'bancario' },
  'Família':             { case_type: 'familia' },
  'Previdenciário':      { case_type: 'previdenciario' },
  'Trabalhista':         { case_type: 'trabalhista' },
  'Aéreo':               { case_type: 'aereo' },
};

export function useChatTags() {
  const [tags, setTags] = useState<ChatTag[]>([]);
  const [subscriberTags, setSubscriberTags] = useState<Map<string, SubscriberTag[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load all available tags
  const loadTags = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_tags')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('[useChatTags] Error loading tags:', error);
    } else {
      setTags((data as ChatTag[]) || []);
    }
    setLoading(false);
  }, []);

  // Load tags for specific subscribers
  const loadSubscriberTags = useCallback(async (subscriberIds: string[]) => {
    if (subscriberIds.length === 0) return;

    const { data, error } = await supabase
      .from('subscriber_tags')
      .select(`
        id,
        subscriber_id,
        tag_id,
        reason,
        created_at,
        chat_tags (
          id,
          name,
          color,
          category,
          is_system,
          requires_reason
        )
      `)
      .in('subscriber_id', subscriberIds);

    if (error) {
      console.error('[useChatTags] Error loading subscriber tags:', error);
      return;
    }

    const newMap = new Map<string, SubscriberTag[]>(subscriberTags);
    
    // Clear existing entries for these subscribers
    subscriberIds.forEach(id => newMap.set(id, []));
    
    // Populate with new data
    (data || []).forEach((item: any) => {
      const subTags = newMap.get(item.subscriber_id) || [];
      subTags.push({
        id: item.id,
        subscriber_id: item.subscriber_id,
        tag_id: item.tag_id,
        reason: item.reason,
        tag: item.chat_tags,
        created_at: item.created_at,
      });
      newMap.set(item.subscriber_id, subTags);
    });

    setSubscriberTags(newMap);
  }, [subscriberTags]);

  // Add tag to subscriber (+ aplica efeito real no lead se houver mapeamento)
  const addTagToSubscriber = useCallback(async (
    subscriberId: string,
    tagId: string,
    reason?: string,
    leadId?: string,
  ) => {
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('subscriber_tags')
      .insert({
        subscriber_id: subscriberId,
        tag_id: tagId,
        reason: reason || null,
        added_by: userData.user?.id,
      });

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Tag já adicionada', variant: 'destructive' });
      } else {
        console.error('[useChatTags] Error adding tag:', error);
        toast({ title: 'Erro ao adicionar tag', variant: 'destructive' });
      }
      return { error };
    }

    // Aplicar efeito real no lead se houver mapeamento
    if (leadId) {
      const tagName = tags.find(t => t.id === tagId)?.name;
      const action = tagName ? TAG_LEAD_ACTIONS[tagName] : null;
      if (action) {
        const { error: leadError } = await (supabase as any)
          .from('leads_juridicos')
          .update(action)
          .eq('id', leadId);
        if (leadError) {
          console.error('[useChatTags] Erro ao aplicar ação da tag no lead:', leadError);
        } else {
          console.log(`[useChatTags] Tag "${tagName}" aplicou: ${JSON.stringify(action)} em lead ${leadId}`);
        }
      }
    }

    await loadSubscriberTags([subscriberId]);
    return { error: null };
  }, [loadSubscriberTags, tags, toast]);

  // Remove tag from subscriber
  const removeTagFromSubscriber = useCallback(async (
    subscriberId: string, 
    tagId: string
  ) => {
    const { error } = await supabase
      .from('subscriber_tags')
      .delete()
      .eq('subscriber_id', subscriberId)
      .eq('tag_id', tagId);

    if (error) {
      console.error('[useChatTags] Error removing tag:', error);
      toast({ title: 'Erro ao remover tag', variant: 'destructive' });
      return { error };
    }

    // Update local state
    const newMap = new Map<string, SubscriberTag[]>(subscriberTags);
    const currentTags = newMap.get(subscriberId) || [];
    newMap.set(subscriberId, currentTags.filter((t: SubscriberTag) => t.tag_id !== tagId));
    setSubscriberTags(newMap);

    return { error: null };
  }, [subscriberTags, toast]);

  // Create new custom tag
  const createTag = useCallback(async (name: string, color: string = 'gray', category?: string) => {
    const { data, error } = await supabase
      .from('chat_tags')
      .insert({
        name,
        color,
        category: category || 'custom',
        is_system: false,
        requires_reason: false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Tag já existe', variant: 'destructive' });
      } else {
        console.error('[useChatTags] Error creating tag:', error);
        toast({ title: 'Erro ao criar tag', variant: 'destructive' });
      }
      return { error, data: null };
    }

    setTags(prev => [...prev, data as ChatTag]);
    toast({ title: 'Tag criada!' });
    return { error: null, data: data as ChatTag };
  }, [toast]);

  // Get tags for a specific subscriber
  const getSubscriberTags = useCallback((subscriberId: string): SubscriberTag[] => {
    return subscriberTags.get(subscriberId) || [];
  }, [subscriberTags]);

  // Check if subscriber has specific tag
  const hasTag = useCallback((subscriberId: string, tagId: string): boolean => {
    const subTags = subscriberTags.get(subscriberId) || [];
    return subTags.some(t => t.tag_id === tagId);
  }, [subscriberTags]);

  // Initial load
  useEffect(() => {
    loadTags();
  }, [loadTags]);

  return {
    tags,
    subscriberTags,
    loading,
    loadTags,
    loadSubscriberTags,
    addTagToSubscriber,
    removeTagFromSubscriber,
    createTag,
    getSubscriberTags,
    hasTag,
  };
}

// Color mapping for tailwind classes
// Estilo translúcido. O chat tem tema próprio (useChatTheme), independente do
// `dark` class do app — por isso NÃO dá para usar `dark:` aqui. Guardamos o tom
// claro (`text`) e o escuro (`textDark`) e o componente escolhe conforme o tema.
export const TAG_COLORS: Record<string, { bg: string; text: string; textDark: string; border: string; dot: string }> = {
  orange:  { bg: 'bg-orange-500/15',  text: 'text-orange-700',  textDark: 'text-orange-300',  border: 'border-orange-500/30',  dot: 'bg-orange-500' },
  green:   { bg: 'bg-green-500/15',   text: 'text-green-700',   textDark: 'text-green-300',   border: 'border-green-500/30',   dot: 'bg-green-500' },
  blue:    { bg: 'bg-blue-500/15',    text: 'text-blue-700',    textDark: 'text-blue-300',    border: 'border-blue-500/30',    dot: 'bg-blue-500' },
  red:     { bg: 'bg-red-500/15',     text: 'text-red-700',     textDark: 'text-red-300',     border: 'border-red-500/30',     dot: 'bg-red-500' },
  yellow:  { bg: 'bg-yellow-500/15',  text: 'text-yellow-700',  textDark: 'text-yellow-300',  border: 'border-yellow-500/30',  dot: 'bg-yellow-500' },
  purple:  { bg: 'bg-purple-500/15',  text: 'text-purple-700',  textDark: 'text-purple-300',  border: 'border-purple-500/30',  dot: 'bg-purple-500' },
  cyan:    { bg: 'bg-cyan-500/15',    text: 'text-cyan-700',    textDark: 'text-cyan-300',    border: 'border-cyan-500/30',    dot: 'bg-cyan-500' },
  indigo:  { bg: 'bg-indigo-500/15',  text: 'text-indigo-700',  textDark: 'text-indigo-300',  border: 'border-indigo-500/30',  dot: 'bg-indigo-500' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-700', textDark: 'text-emerald-300', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-700',   textDark: 'text-amber-300',   border: 'border-amber-500/30',   dot: 'bg-amber-500' },
  pink:    { bg: 'bg-pink-500/15',    text: 'text-pink-700',    textDark: 'text-pink-300',    border: 'border-pink-500/30',    dot: 'bg-pink-500' },
  gray:    { bg: 'bg-gray-500/15',    text: 'text-gray-700',    textDark: 'text-gray-300',    border: 'border-gray-500/30',    dot: 'bg-gray-400' },
};
