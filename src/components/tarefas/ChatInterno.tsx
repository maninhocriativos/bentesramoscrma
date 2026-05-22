import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, X, Send, ChevronDown, AtSign, Bell, Paperclip, FileText } from 'lucide-react';
import { useChatInterno, decodeMencoes, decodeAnexo, type ChatAnexo } from '@/hooks/useChatInterno';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BROWN = '#3d2b1f';
const GOLD  = '#c9a96e';

interface OnlineUser { id: string; nome: string; }
interface PerfilItem { id: string; nome: string; sobrenome: string | null; }
interface MencaoInfo { id: string; nome: string; }

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

// Highlights @word patterns already embedded in message text
function MsgText({ content }: { content: string }) {
  const { text } = decodeMencoes(content);
  const parts = text.split(/(@\S+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^@\S/.test(part)) {
          return (
            <span key={i}
              className="font-bold rounded px-0.5"
              style={{ color: '#c9a96e', background: 'rgba(201,169,110,0.15)' }}>
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function ChatInterno() {
  const [open,         setOpen]        = useState(false);
  const [texto,        setTexto]       = useState('');
  const [onlineUsers,  setOnlineUsers] = useState<OnlineUser[]>([]);
  const [perfis,       setPerfis]      = useState<PerfilItem[]>([]);
  const [mencoes,      setMencoes]     = useState<MencaoInfo[]>([]);
  const [showAt,       setShowAt]      = useState(false);
  const [atQuery,      setAtQuery]     = useState('');
  const [pendingFile,  setPendingFile] = useState<{ file: File; name: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const { mensagens, loading, unread, enviar, marcarLido, mencaoNotif, dismissMencao, setChatOpenState } =
    useChatInterno();
  const { user }    = useAuth();
  const { perfil }  = usePerfil();
  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all perfis including current user — needed to resolve names when RLS blocks the join
  const fetchPerfis = useCallback(async () => {
    const { data } = await supabase
      .from('perfis')
      .select('id, nome, sobrenome')
      .order('nome');
    if (data) setPerfis(data as PerfilItem[]);
  }, []);

  useEffect(() => { fetchPerfis(); }, [fetchPerfis]);

  // Map id → PerfilItem for O(1) name lookup when join is blocked by RLS
  const perfilById = useMemo(() => {
    const map = new Map<string, PerfilItem>();
    perfis.forEach(p => map.set(p.id, p));
    return map;
  }, [perfis]);

  // Build dropdown candidates from: perfis table + message senders + online users
  const dropdownCandidates = useMemo<PerfilItem[]>(() => {
    const seen = new Set<string>();
    const result: PerfilItem[] = [];

    perfis.forEach(p => { seen.add(p.id); result.push(p); });

    mensagens.forEach(m => {
      if (!seen.has(m.sender_id) && m.sender_id !== user?.id && m.perfis) {
        seen.add(m.sender_id);
        result.push({ id: m.sender_id, nome: m.perfis.nome, sobrenome: m.perfis.sobrenome });
      }
    });

    onlineUsers.forEach(u => {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        const parts = u.nome.split(' ');
        result.push({ id: u.id, nome: parts[0], sobrenome: parts.slice(1).join(' ') || null });
      }
    });

    return result;
  }, [perfis, mensagens, onlineUsers, user?.id]);

  // Presence channel
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

  useEffect(() => {
    setChatOpenState(open);
    if (open) {
      marcarLido();
      setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 80);
      inputRef.current?.focus();
    }
  }, [open, mensagens.length]);

  const resetTextareaHeight = () => {
    if (inputRef.current) inputRef.current.style.height = '36px';
  };

  const handleFileSelect = (e: { target: HTMLInputElement }) => {
    const f = e.target.files?.[0];
    if (f) setPendingFile({ file: f, name: f.name });
    e.target.value = '';
  };

  const handleSend = async () => {
    const t = texto.trim();
    if (!t && !pendingFile) return;

    let anexo: ChatAnexo | undefined;
    if (pendingFile) {
      setUploadingFile(true);
      const path = `chat/${user?.id}/${Date.now()}_${pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, pendingFile.file);
      setUploadingFile(false);
      if (upErr) {
        // toast not wired here — just return silently; file stays pending
        return;
      }
      anexo = { name: pendingFile.name, path, mime: pendingFile.file.type, size: pendingFile.file.size };
    }

    setTexto('');
    setMencoes([]);
    setPendingFile(null);
    setShowAt(false);
    resetTextareaHeight();
    await enviar(t, mencoes.map(m => m.id), anexo);
  };

  const adjustTextareaHeight = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 90)}px`;
  };

  const handleInputChange = (val: string) => {
    setTexto(val);
    setTimeout(adjustTextareaHeight, 0);
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
      setAtQuery(val.slice(lastAt + 1).toLowerCase());
      setShowAt(true);
    } else {
      setShowAt(false);
    }
  };

  // Insert @Nome into texto; track UUID separately for notification payload
  const selectMention = (p: PerfilItem) => {
    const nome = `${p.nome}${p.sobrenome ? ` ${p.sobrenome.split(' ')[0]}` : ''}`;
    const lastAt = texto.lastIndexOf('@');
    const before = texto.slice(0, lastAt);
    setTexto(`${before}@${nome} `);
    setMencoes(prev => prev.some(m => m.id === p.id) ? prev : [...prev, { id: p.id, nome }]);
    setShowAt(false);
    inputRef.current?.focus();
  };

  const filteredCandidates = dropdownCandidates.filter(p => {
    const full = `${p.nome} ${p.sobrenome || ''}`.toLowerCase();
    return full.includes(atQuery);
  });

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
                      const fallback  = perfilById.get(m.sender_id);
                      const nome      = m.perfis?.nome || fallback?.nome || '?';
                      const sobrenome = m.perfis?.sobrenome ?? fallback?.sobrenome ?? null;
                      const prevMsg   = i > 0 ? group.msgs[i - 1] : null;
                      const sameAsPrev = prevMsg?.sender_id === m.sender_id;
                      const { ids: mentionIds } = decodeMencoes(m.conteudo);
                      const mentionsMe = mentionIds.includes(user?.id || '');

                      const msgAnexo = decodeAnexo(m.conteudo);
                      const { text: msgText } = decodeMencoes(m.conteudo);

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
                                whiteSpace: 'pre-wrap',
                              }}>
                              {msgText && <MsgText content={m.conteudo} />}
                              {mentionsMe && !isMe && (
                                <span style={{ fontSize: 9, color: GOLD, marginLeft: 4, fontWeight: 700 }}>
                                  • você
                                </span>
                              )}
                              {msgAnexo && (
                                <button
                                  onClick={async () => {
                                    const { data } = await supabase.storage.from('documentos').createSignedUrl(msgAnexo.path, 300);
                                    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                  }}
                                  className="flex items-center gap-2 mt-1.5 rounded-xl px-2.5 py-2 w-full text-left transition-all hover:opacity-80"
                                  style={{
                                    background: isMe ? 'rgba(255,255,255,0.1)' : `${BROWN}0d`,
                                    border: `1px solid ${GOLD}35`,
                                  }}
                                >
                                  <FileText style={{ width: 14, height: 14, color: GOLD, flexShrink: 0 }} />
                                  <div className="min-w-0">
                                    <p style={{ fontSize: 11, fontWeight: 600, color: isMe ? GOLD : BROWN }} className="truncate">
                                      {msgAnexo.name}
                                    </p>
                                    <p style={{ fontSize: 9, opacity: 0.5 }}>
                                      {msgAnexo.size < 1048576
                                        ? `${(msgAnexo.size / 1024).toFixed(0)} KB`
                                        : `${(msgAnexo.size / 1048576).toFixed(1)} MB`}
                                    </p>
                                  </div>
                                </button>
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

            {/* Menções selecionadas + arquivo pendente */}
            {(mencoes.length > 0 || pendingFile) && (
              <div className="px-3 pt-2 flex flex-wrap gap-1 shrink-0" style={{ background: 'white' }}>
                {mencoes.map(m => (
                  <span key={m.id}
                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${GOLD}20`, color: BROWN }}>
                    @{m.nome}
                    <button onClick={() => setMencoes(prev => prev.filter(x => x.id !== m.id))}
                      className="hover:opacity-60">
                      <X style={{ width: 10, height: 10 }} />
                    </button>
                  </span>
                ))}
                {pendingFile && (
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${GOLD}18`, color: BROWN, border: `1px solid ${GOLD}35` }}>
                    <FileText style={{ width: 10, height: 10 }} />
                    <span className="max-w-[140px] truncate">{pendingFile.name}</span>
                    <button onClick={() => setPendingFile(null)} className="hover:opacity-60 shrink-0">
                      <X style={{ width: 10, height: 10 }} />
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Input area */}
            <div className="px-3 py-2.5 shrink-0 relative"
              style={{ borderTop: `0.5px solid ${GOLD}25`, background: 'white' }}>

              {/* @ dropdown */}
              {showAt && filteredCandidates.length > 0 && (
                <div
                  className="absolute bottom-full left-3 right-3 mb-1 rounded-xl overflow-hidden shadow-lg"
                  style={{ background: BROWN, border: `1px solid ${GOLD}30`, maxHeight: 160, overflowY: 'auto' }}>
                  {filteredCandidates.map(p => (
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

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
              />

              <div className="flex gap-2 items-end">
                <button
                  onClick={() => {
                    setTexto(t => t.endsWith(' ') || t === '' ? t + '@' : t + ' @');
                    setAtQuery('');
                    setShowAt(true);
                    inputRef.current?.focus();
                  }}
                  title="Mencionar alguém"
                  className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80 shrink-0"
                  style={{ background: `${BROWN}12`, border: `1px solid ${GOLD}25` }}>
                  <AtSign style={{ width: 14, height: 14, color: BROWN }} />
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Anexar arquivo"
                  className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80 shrink-0"
                  style={{
                    background: pendingFile ? `${GOLD}25` : `${BROWN}12`,
                    border: `1px solid ${pendingFile ? GOLD : `${GOLD}25`}`,
                  }}>
                  <Paperclip style={{ width: 14, height: 14, color: pendingFile ? GOLD : BROWN }} />
                </button>

                <textarea
                  ref={inputRef}
                  value={texto}
                  rows={1}
                  onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setShowAt(false); return; }
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder="Mensagem para a equipe..."
                  style={{
                    flex: 1,
                    minHeight: 36,
                    maxHeight: 90,
                    borderRadius: 12,
                    border: `1px solid ${GOLD}35`,
                    padding: '8px 12px',
                    fontSize: 13,
                    outline: 'none',
                    background: '#faf9f7',
                    color: '#1c1917',
                    resize: 'none',
                    lineHeight: 1.45,
                    overflowY: 'auto',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!texto.trim() && !pendingFile || uploadingFile}
                  className="h-9 w-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 shrink-0"
                  style={{ background: BROWN }}>
                  {uploadingFile
                    ? <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: `${GOLD}40`, borderTopColor: GOLD }} />
                    : <Send style={{ width: 14, height: 14, color: GOLD }} />
                  }
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
