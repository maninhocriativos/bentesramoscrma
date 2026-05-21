import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ChatMensagem {
  id: string;
  sender_id: string;
  conteudo: string;
  created_at: string;
  perfis: { nome: string; sobrenome: string | null } | null;
}

export interface MencaoNotif {
  id: string;
  remetente: string;
  preview: string;
}

export interface ChatAnexo {
  name: string;
  path: string;
  mime: string;
  size: number;
}

// ── Mention + attachment encoding ────────────────────────────────────────────
// Text stored as-is. UUIDs appended as "@@[uuid1,uuid2]" for notifications.
// File attachments appended as " %%ANEXO%%{...json...}" at the very end.
export function encodeMencoes(text: string, ids: string[], anexo?: ChatAnexo): string {
  let base = ids.length === 0 ? text.trim() : `${text.trim()} @@[${ids.join(',')}]`;
  if (anexo) base += ` %%ANEXO%%${JSON.stringify(anexo)}`;
  return base;
}

export function decodeMencoes(content: string): { text: string; ids: string[] } {
  // Strip file annotation before decoding
  const stripped = content.replace(/ %%ANEXO%%\{[\s\S]*\}$/, '').trim();
  const m = stripped.match(/^([\s\S]*?)\s*@@\[([^\]]*)\]$/);
  if (m) return { text: m[1].trim(), ids: m[2].split(',').filter(Boolean) };
  return { text: stripped, ids: [] };
}

export function decodeAnexo(content: string): ChatAnexo | undefined {
  const m = content.match(/ %%ANEXO%%(\{[\s\S]*\})$/);
  if (!m) return undefined;
  try { return JSON.parse(m[1]) as ChatAnexo; } catch { return undefined; }
}

// ── Web Audio notification sound ──────────────────────────────────────────────
export function playSound(type: 'message' | 'mention') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';

    if (type === 'mention') {
      osc.frequency.setValueAtTime(880,  ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.09);
      osc.frequency.setValueAtTime(880,  ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } else {
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
    setTimeout(() => ctx.close(), 600);
  } catch { /* audio not supported */ }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useChatInterno() {
  const [mensagens,   setMensagens]   = useState<ChatMensagem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [unread,      setUnread]      = useState(0);
  const [mencaoNotif, setMencaoNotif] = useState<MencaoNotif | null>(null);

  const lastSeenRef = useRef<string>(
    typeof window !== 'undefined' ? (localStorage.getItem('chat_last_seen') || '') : ''
  );
  const chatOpenRef = useRef(false);
  const { user } = useAuth();

  // Refs para evitar closure stale no handler do realtime
  const userRef   = useRef(user);
  const myNomeRef = useRef<string>('');
  useEffect(() => { userRef.current = user; }, [user]);

  // Busca o primeiro nome do usuário logado para detecção por nome
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('perfis').select('nome').eq('id', user.id).single()
      .then(({ data }) => { if (data?.nome) myNomeRef.current = data.nome; });
  }, [user?.id]);

  const fetchMensagens = useCallback(async () => {
    const { data } = await supabase
      .from('chat_mensagens')
      .select('*, perfis(nome, sobrenome)')
      .order('created_at', { ascending: true })
      .limit(120);
    const msgs = (data || []) as ChatMensagem[];
    setMensagens(msgs);
    const unseen = msgs.filter(m => m.created_at > lastSeenRef.current && m.sender_id !== user?.id).length;
    setUnread(unseen);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchMensagens(); }, [fetchMensagens]);

  useEffect(() => {
    const ch = supabase
      .channel(`chat-interno-${Math.random()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens' },
        async (payload) => {
          const { data } = await supabase
            .from('chat_mensagens')
            .select('*, perfis(nome, sobrenome)')
            .eq('id', payload.new.id)
            .single();
          if (!data) return;
          const msg = data as ChatMensagem;

          setMensagens(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          // Skip own messages
          if (msg.sender_id === userRef.current?.id) return;

          const { ids, text } = decodeMencoes(msg.conteudo);
          const uid  = userRef.current?.id || '';
          const nome = myNomeRef.current;
          const mencionadoPorUUID = !!uid && ids.includes(uid);
          const mencionadoPorNome = !!nome && new RegExp(`@${nome}\\b`, 'i').test(text);
          const mencionado = mencionadoPorUUID || mencionadoPorNome;
          const remetente = msg.perfis
            ? `${msg.perfis.nome}${msg.perfis.sobrenome ? ` ${msg.perfis.sobrenome.split(' ')[0]}` : ''}`
            : 'Alguém';

          if (mencionado) {
            playSound('mention');
            setMencaoNotif({
              id: msg.id,
              remetente,
              preview: decodeMencoes(msg.conteudo).text.slice(0, 80),
            });
          } else if (!chatOpenRef.current) {
            playSound('message');
          }

          if (!chatOpenRef.current) setUnread(n => n + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const enviar = async (conteudo: string, mencoes: string[] = [], anexo?: ChatAnexo) => {
    if (!user || (!conteudo.trim() && !anexo)) return;
    const raw = encodeMencoes(conteudo, mencoes, anexo);
    const { data, error } = await supabase
      .from('chat_mensagens')
      .insert({ sender_id: user.id, conteudo: raw })
      .select('*, perfis(nome, sobrenome)')
      .single();
    if (data && !error) {
      setMensagens(prev => {
        if (prev.some(m => m.id === (data as ChatMensagem).id)) return prev;
        return [...prev, data as ChatMensagem];
      });
    }
  };

  const marcarLido = () => {
    const now = new Date().toISOString();
    lastSeenRef.current = now;
    if (typeof window !== 'undefined') localStorage.setItem('chat_last_seen', now);
    setUnread(0);
  };

  const setChatOpenState = (open: boolean) => { chatOpenRef.current = open; };
  const dismissMencao    = () => setMencaoNotif(null);

  return { mensagens, loading, unread, enviar, marcarLido, mencaoNotif, dismissMencao, setChatOpenState };
}
