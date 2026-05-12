import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, ChevronDown, AtSign, Bell } from 'lucide-react';
import { useChatInterno, decodeMencoes } from '@/hooks/useChatInterno';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BROWN = '#3d2b1f';
const GOLD  = '#c9a96e';

interface OnlineUser { id: string; nome: string; }
interface PerfilItem { id: string; nome: string; sobrenome: string | null; }

function getInitials(nome: string | null, sobrenome: string | null): string {
  const parts = [nome, sobrenome].filter(Boolean) as string[];
  return parts.map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  if (isToday(d))     return format(d, 'HH:mm');
  if (isYesterday(d)) return `Ontem ${format(d, 'HH:mm')}`;
  return format(d, "dd/MM HH:mm", { locale: ptBR });
}

// ── Render message text with mention highlights ───────────────────────────────
function MsgText({ content, perfilMap }: { content: string; perfilMap: Record<string, string> }) {
  const { text } = decodeMencoes(content);
  // Replace @[uuid] markers with highlighted spans
  const parts = text.split(/(@\[[a-f0-9-]{36}\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^@\[([a-f0-9-]{36})\]$/);
        if (m) {
          const nome = perfilMap[m[1]] || 'alguém';
          return (
            <span key={i}
              className="font-bold rounded px-0.5"
              style={{ color: '#c9a96e', background: 'rgba(201,169,110,0.15)' }}>
              @{nome}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function ChatInterno() {
  const [open,        setOpen]        = useState(false);
  const [texto,       setTexto]       = useState('');
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [perfis,      setPerfis]      = useState<PerfilItem[]>([]);
  const [perfilMap,   setPerfilMap]   = useState<Record<string, string>>({});
  const [mencoes,     setMencoes]     = useState<string[]>([]);      // selected mention IDs
  const [showAt,      setShowAt]      = useState(false);             // @ dropdown visible
  const [atQuery,     setAtQuery]     = useState('');                // filter in @ dropdown

  const { mensagens, loading, unread, enviar, marcarLido, mencaoNotif, dismissMencao, setChatOpenState } =
    useChatInterno();
  const { user }   = useAuth();
  const { perfil } = usePerfil();
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  // ── Carregar perfis para @ dropdown ─────────────────────────────────────────
  const fetchPerfis = useCallback(async () => {
    const { data } = await supabase
      .from('perfis')
      .select('id, nome, sobrenome')
      .order('nome');
    if (data) {
      const items = (data as PerfilItem[]).filter(p => p.id !== user?.id);
      setPerfis(items);
      const map: Record<string, string> = {};
      items.forEach(p => {
        map[p.id] = `${p.nome}${p.sobrenome ? ` ${p.sobrenome.split(' ')[0]}` : ''}`;
      });
      setPerfilMap(map);
    }
  }, [user?.id]);

  useEffect(() => { fetchPerfis(); }, [fetchPerfis]);

  // ── Presença online ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const nome = [perfil?.nome, perfil?.sobrenome].filter(Boolean).join(' ') || user.email || 'Usuário';
    const ch = supabase.channel('chat-presence-global', { config: { presence: { key: user.id } } });
    const syncOnline = () => {
      const state = ch.presenceState();
      const online: OnlineUser[] = Object.entries(state)
        .filter(([key]) => key !== user.id)
        .map(([, pArr]) => ({ id: (pArr[0] as any)?.userId || '', nome: (pArr[0] as any)?.nome || 'Usuário' }))
        .filter(u => u.id);
      setOnlineUsers(online);
    };
    ch.on('presence', { event: 'sync' }, syncOnline)
      .on('presence', { event: 'join' }, syncOnline)
      .on('presence', { event: 'leave' }, syncOnline)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await ch.track({ userId: user.id, nome });
      });
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, perfil?.nome, perfil?.sobrenome]);

  // ── Sync open state to hook ──────────────────────────────────────────────────
  useEffect(() => {
    setChatOpenState(open);
    if (open) {
      marcarLido();
      setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 80);
      inputRef.current?.focus();
    }
  }, [open, mensagens.length]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    setMencoes([]);
    setShowAt(false);
    await enviar(t, mencoes);
  };

  // ── Input key handler + @ detection ──────────────────────────────────────────
  const handleInputChange = (val: string) => {
    setTexto(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
      const query = val.slice(lastAt + 1).toLowerCase();
      setAtQuery(query);
      setShowAt(true);
    } else {
      setShowAt(false);
    }
  };

  // ── Select mention from dropdown ─────────────────────────────────────────────
  const selectMention = (p: PerfilItem) => {
    const nome = `${p.nome}${p.sobrenome ? ` ${p.sobrenome.split(' ')[0]}` : ''}`;
    // Replace the partial @query at the end with @[uuid]
    const lastAt = texto.lastIndexOf('@');
    const before = texto.slice(0, lastAt);
    setTexto(`${before}@[${p.id}] `);
    setMencoes(prev => prev.includes(p.id) ? prev : [...prev, p.id]);
    setShowAt(false);
    inputRef.current?.focus();
  };

  // ── Filtered perfis for dropdown ─────────────────────────────────────────────
  const filteredPerfis = perfis.filter(p => {
    const full = `${p.nome} ${p.sobrenome || ''}`.toLowerCase();
    return full.includes(atQuery);
  });

  // ── Group messages by day ────────────────────────────────────────────────────
  type MsgGroup = { date: string; msgs: typeof mensagens };
  const groups: MsgGroup[] = [];
  mensagens.forEach(m => {
    const d = m.created_at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.date === d) last.msgs.push(m);
    else groups.push({ date: d, msgs: [m] });
  });

  function dayLabel(iso: string) {
    const d = new Date(iso + 'T12:00:00');
    if (isToday(d))     return 'Hoje';
    if (isYesterday(d)) return 'Ontem';
    return format(d, "dd 'de' MMMM", { locale: ptBR });
  }

  return (
    <>
      {/* ── Pop-up de menção ── */}
      {mencaoNotif && (
        <div
          className="fixed z-[200] bottom-24 right-5 w-80 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: BROWN,
            border: `1px solid ${GOLD}40`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 2px 8px ${GOLD}20`,
          }}
        >
          {/* Barra dourada */}
          <div style={{ height: 3, background: `linear-gradient(90deg, ${BROWN}, ${GOLD}, ${BROWN})` }} />

          <div className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${GOLD}25` }}>
                <Bell style={{ width: 15, height: 15, color: GOLD }} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 11, fontWeight: 800, color: GOLD, lineHeight: 1, marginBottom: 4 }}>
                  Você foi mencionado
                </p>
                <p style={{ fontSize: 12, fontWeight: 700, color: `${GOLD}cc` }}>
                  {mencaoNotif.remetente}
                </p>
                <p style={{ fontSize: 12, color: '#d1c8b8', marginTop: 2, lineHeight: 1.4 }}
                  className="truncate">
                  {mencaoNotif.preview}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { dismissMencao(); setOpen(true); }}
                className="flex-1 rounded-xl py-2 text-xs font-black transition-all hover:opacity-90"
                style={{ background: `linear-gradient(90deg, ${GOLD}, #e8c07d)`, color: BROWN }}>
                Responder agora
              </button>
              <button
                onClick={dismissMencao}
                className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:opacity-70 shrink-0"
                style={{ background: `${GOLD}20` }}>
                <X style={{ width: 14, height: 14, color: GOLD }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Widget principal ── */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">

        {/* ── Painel ── */}
        {open && (
          <div
            className="flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{
              width: 360, height: 520,
              background: 'white',
              border: `1px solid ${GOLD}40`,
              boxShadow: `0 20px 60px rgba(0,0,0,0.18), 0 4px 16px ${GOLD}20`,
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-3 shrink-0"
              style={{ background: BROWN, borderBottom: `2px solid ${GOLD}30` }}>
              <div className="h-8 w-8 rounded-xl flex items-center justify-center"
                style={{ background: `${GOLD}25` }}>
                <MessageSquare style={{ width: 15, height: 15, color: GOLD }} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 13, fontWeight: 800, color: GOLD, lineHeight: 1 }}>Chat da Equipe</p>
                <p style={{ fontSize: 10, color: `${GOLD}80`, marginTop: 2 }}>
                  {onlineUsers.length > 0 ? `${onlineUsers.length} online agora` : 'Você está sozinho agora'}
                </p>
              </div>

              {onlineUsers.length > 0 && (
                <div className="flex -space-x-2 mr-1">
                  {onlineUsers.slice(0, 4).map(u => (
                    <div key={u.id} title={u.nome}
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-black border-2 shrink-0"
                      style={{ background: `${GOLD}35`, color: GOLD, borderColor: BROWN }}>
                      {u.nome.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {onlineUsers.length > 4 && (
                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-black border-2"
                      style={{ background: `${GOLD}20`, color: GOLD, borderColor: BROWN }}>
                      +{onlineUsers.length - 4}
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => setOpen(false)}
                className="h-7 w-7 rounded-xl flex items-center justify-center transition-all hover:opacity-70"
                style={{ background: `${GOLD}20` }}>
                <ChevronDown style={{ width: 14, height: 14, color: GOLD }} />
              </button>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1" style={{ background: '#faf9f7' }}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: `${GOLD}30`, borderTopColor: GOLD }} />
                </div>
              ) : mensagens.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: '#d1d5db' }}>
                  <MessageSquare style={{ width: 28, height: 28 }} />
                  <p style={{ fontSize: 12 }}>Nenhuma mensagem ainda</p>
                </div>
              ) : (
                groups.map(group => (
                  <div key={group.date}>
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px" style={{ background: `${GOLD}25` }} />
                      <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{dayLabel(group.date)}</span>
                      <div className="flex-1 h-px" style={{ background: `${GOLD}25` }} />
                    </div>

                    {group.msgs.map((m, i) => {
                      const isMe      = m.sender_id === user?.id;
                      const nome      = m.perfis?.nome || '?';
                      const sobrenome = m.perfis?.sobrenome || null;
                      const prevMsg   = i > 0 ? group.msgs[i - 1] : null;
                      const sameAsPrev = prevMsg?.sender_id === m.sender_id;
                      const { ids: mentionIds } = decodeMencoes(m.conteudo);
                      const mentionsMe = mentionIds.includes(user?.id || '');

                      return (
                        <div key={m.id}
                          className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} ${sameAsPrev ? 'mt-0.5' : 'mt-2'}`}>
                          {!isMe && (
                            <div
                              className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black self-end ${sameAsPrev ? 'invisible' : ''}`}
                              style={{ background: `${BROWN}15`, color: BROWN }}>
                              {getInitials(nome, sobrenome)}
                            </div>
                          )}
                          <div className={`max-w-[230px] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                            {!sameAsPrev && !isMe && (
                              <p style={{ fontSize: 10, fontWeight: 700, color: BROWN, marginBottom: 2, marginLeft: 4 }}>
                                {nome}{sobrenome ? ` ${sobrenome.split(' ')[0]}` : ''}
                              </p>
                            )}
                            <div className="px-3 py-2 rounded-2xl"
                              style={{
                                background: mentionsMe
                                  ? `${GOLD}22`
                                  : isMe ? BROWN : 'white',
                                color: isMe ? GOLD : '#1c1917',
                                fontSize: 13,
                                lineHeight: 1.45,
                                border: mentionsMe
                                  ? `1.5px solid ${GOLD}60`
                                  : isMe ? 'none' : `0.5px solid ${GOLD}25`,
                                borderBottomRightRadius: isMe ? 4 : 16,
                                borderBottomLeftRadius:  isMe ? 16 : 4,
                                wordBreak: 'break-word',
                              }}>
                              <MsgText content={m.conteudo} perfilMap={perfilMap} />
                              {mentionsMe && !isMe && (
                                <span style={{ fontSize: 9, color: GOLD, marginLeft: 4, fontWeight: 700 }}>
                                  • você
                                </span>
                              )}
                            </div>
                            <p style={{
                              fontSize: 9, color: '#9ca3af', marginTop: 2,
                              paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0,
                              textAlign: isMe ? 'right' : 'left',
                            }}>
                              {formatMsgTime(m.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Menções selecionadas */}
            {mencoes.length > 0 && (
              <div className="px-3 pt-2 flex flex-wrap gap-1 shrink-0" style={{ background: 'white' }}>
                {mencoes.map(id => (
                  <span key={id}
                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${GOLD}20`, color: BROWN }}>
                    @{perfilMap[id] || id.slice(0, 8)}
                    <button onClick={() => setMencoes(prev => prev.filter(i => i !== id))}
                      className="hover:opacity-60">
                      <X style={{ width: 10, height: 10 }} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Input area */}
            <div className="px-3 py-2.5 shrink-0 relative"
              style={{ borderTop: `0.5px solid ${GOLD}25`, background: 'white' }}>

              {/* @ dropdown */}
              {showAt && filteredPerfis.length > 0 && (
                <div
                  className="absolute bottom-full left-3 right-3 mb-1 rounded-xl overflow-hidden shadow-lg"
                  style={{ background: BROWN, border: `1px solid ${GOLD}30`, maxHeight: 160, overflowY: 'auto' }}>
                  {filteredPerfis.map(p => (
                    <button key={p.id}
                      onClick={() => selectMention(p)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 transition-all hover:opacity-80 text-left"
                      style={{ borderBottom: `0.5px solid ${GOLD}15` }}>
                      <div className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                        style={{ background: `${GOLD}30`, color: GOLD }}>
                        {getInitials(p.nome, p.sobrenome)}
                      </div>
                      <span style={{ fontSize: 12, color: GOLD, fontWeight: 600 }}>
                        {p.nome}{p.sobrenome ? ` ${p.sobrenome.split(' ')[0]}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-center">
                {/* @ button */}
                <button
                  onClick={() => {
                    setTexto(t => t + '@');
                    setAtQuery('');
                    setShowAt(true);
                    inputRef.current?.focus();
                  }}
                  title="Mencionar alguém"
                  className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80 shrink-0"
                  style={{ background: `${BROWN}12`, border: `1px solid ${GOLD}25` }}>
                  <AtSign style={{ width: 14, height: 14, color: BROWN }} />
                </button>

                <input
                  ref={inputRef}
                  value={(() => {
                    // Display @[uuid] markers as @Nome for readability
                    return texto.replace(/@\[([a-f0-9-]{36})\]/g, (_, id) => `@${perfilMap[id] || id.slice(0, 8)}`);
                  })()}
                  onChange={e => {
                    // Store raw format — if user types normally we track @[uuid] separately
                    // Simple approach: use actual text but let selectMention inject @[uuid]
                    handleInputChange(e.target.value);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setShowAt(false); return; }
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder="Mensagem para a equipe..."
                  style={{
                    flex: 1, height: 36, borderRadius: 12,
                    border: `1px solid ${GOLD}35`, padding: '0 12px',
                    fontSize: 13, outline: 'none', background: '#faf9f7', color: '#1c1917',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!texto.trim()}
                  className="h-9 w-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 shrink-0"
                  style={{ background: BROWN }}>
                  <Send style={{ width: 14, height: 14, color: GOLD }} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Botão de toggle ── */}
        <button
          onClick={() => setOpen(v => !v)}
          className="relative rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{
            width: 52, height: 52,
            background: open ? `${BROWN}cc` : BROWN,
            boxShadow: `0 4px 16px rgba(61,43,31,0.35)`,
          }}
        >
          {open
            ? <X style={{ width: 20, height: 20, color: GOLD }} />
            : <MessageSquare style={{ width: 20, height: 20, color: GOLD }} />
          }
          {!open && unread > 0 && (
            <span
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full flex items-center justify-center text-white font-black"
              style={{ fontSize: 10, background: '#dc2626', pointerEvents: 'none' }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
          {!open && unread === 0 && onlineUsers.length > 0 && (
            <span
              className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2"
              style={{ background: '#22c55e', borderColor: BROWN, pointerEvents: 'none' }} />
          )}
        </button>
      </div>
    </>
  );
}
