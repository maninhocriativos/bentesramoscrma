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

  // Add tag to subscriber
  const addTagToSubscriber = useCallback(async (
    subscriberId: string, 
    tagId: string, 
    reason?: string
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

    // Refresh tags for this subscriber
    await loadSubscriberTags([subscriberId]);
    return { error: null };
  }, [loadSubscriberTags, toast]);

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
    const newMap = new Map(subscriberTags);
    const currentTags = newMap.get(subscriberId) || [];
    newMap.set(subscriberId, currentTags.filter(t => t.tag_id !== tagId));
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
export const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-500/20' },
  green: { bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500/20' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20' },
  red: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/20' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', border: 'border-yellow-500/20' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/20' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-600', border: 'border-cyan-500/20' },
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-600', border: 'border-indigo-500/20' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20' },
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-600', border: 'border-pink-500/20' },
  gray: { bg: 'bg-gray-500/10', text: 'text-gray-600', border: 'border-gray-500/20' },
};
