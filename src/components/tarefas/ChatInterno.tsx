import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, ChevronDown } from 'lucide-react';
import { useChatInterno } from '@/hooks/useChatInterno';
import { useAuth } from '@/hooks/useAuth';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BROWN = '#3d2b1f';
const GOLD  = '#c9a96e';

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

export function ChatInterno() {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState('');
  const { mensagens, loading, unread, enviar, marcarLido } = useChatInterno();
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      marcarLido();
      setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 80);
      inputRef.current?.focus();
    }
  }, [open, mensagens.length]);

  const handleSend = async () => {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    await enviar(t);
  };

  // Agrupa mensagens por dia
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
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {/* Panel */}
      {open && (
        <div
          className="flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{
            width: 340, height: 480,
            background: 'white',
            border: `1px solid ${GOLD}40`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.18), 0 4px 16px ${GOLD}20`,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 shrink-0"
            style={{ background: BROWN, borderBottom: `2px solid ${GOLD}40` }}>
            <div className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: `${GOLD}25` }}>
              <MessageSquare style={{ width: 15, height: 15, color: GOLD }} />
            </div>
            <div className="flex-1">
              <p style={{ fontSize: 13, fontWeight: 800, color: GOLD, lineHeight: 1 }}>Chat da Equipe</p>
              <p style={{ fontSize: 10, color: `${GOLD}80`, marginTop: 2 }}>{mensagens.length} mensagens</p>
            </div>
            <button onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-xl flex items-center justify-center transition-all hover:opacity-70"
              style={{ background: `${GOLD}20` }}>
              <ChevronDown style={{ width: 14, height: 14, color: GOLD }} />
            </button>
          </div>

          {/* Messages */}
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
                  {/* Day separator */}
                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px" style={{ background: `${GOLD}25` }} />
                    <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{dayLabel(group.date)}</span>
                    <div className="flex-1 h-px" style={{ background: `${GOLD}25` }} />
                  </div>
                  {group.msgs.map((m, i) => {
                    const isMe = m.sender_id === user?.id;
                    const nome = m.perfis?.nome || '?';
                    const sobrenome = m.perfis?.sobrenome || null;
                    const prevMsg = i > 0 ? group.msgs[i - 1] : null;
                    const sameAsPrev = prevMsg?.sender_id === m.sender_id;
                    return (
                      <div key={m.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} ${sameAsPrev ? 'mt-0.5' : 'mt-2'}`}>
                        {/* Avatar — só mostra no primeiro da sequência */}
                        {!isMe && (
                          <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black self-end ${sameAsPrev ? 'invisible' : ''}`}
                            style={{ background: `${BROWN}15`, color: BROWN }}>
                            {getInitials(nome, sobrenome)}
                          </div>
                        )}
                        <div className={`max-w-[220px] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                          {!sameAsPrev && !isMe && (
                            <p style={{ fontSize: 10, fontWeight: 700, color: BROWN, marginBottom: 2, marginLeft: 4 }}>
                              {nome}{sobrenome ? ` ${sobrenome.split(' ')[0]}` : ''}
                            </p>
                          )}
                          <div className="px-3 py-2 rounded-2xl"
                            style={{
                              background: isMe ? BROWN : 'white',
                              color: isMe ? GOLD : '#1c1917',
                              fontSize: 13,
                              lineHeight: 1.45,
                              border: isMe ? 'none' : `0.5px solid ${GOLD}25`,
                              borderBottomRightRadius: isMe ? 4 : 16,
                              borderBottomLeftRadius: isMe ? 16 : 4,
                              wordBreak: 'break-word',
                            }}>
                            {m.conteudo}
                          </div>
                          <p style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0, textAlign: isMe ? 'right' : 'left' }}>
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

          {/* Input */}
          <div className="px-3 py-2.5 shrink-0"
            style={{ borderTop: `0.5px solid ${GOLD}25`, background: 'white' }}>
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Mensagem..."
                style={{
                  flex: 1, height: 36, borderRadius: 12,
                  border: `1px solid ${GOLD}35`, padding: '0 12px',
                  fontSize: 13, outline: 'none', background: '#faf9f7',
                  color: '#1c1917',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!texto.trim()}
                className="h-9 w-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: BROWN, flexShrink: 0 }}>
                <Send style={{ width: 14, height: 14, color: GOLD }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="h-13 w-13 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{
          width: 52, height: 52,
          background: open ? `${BROWN}dd` : BROWN,
          boxShadow: `0 4px 16px rgba(61,43,31,0.35)`,
        }}
      >
        {open
          ? <X style={{ width: 20, height: 20, color: GOLD }} />
          : <MessageSquare style={{ width: 20, height: 20, color: GOLD }} />
        }
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full flex items-center justify-center text-white font-black"
            style={{ fontSize: 10, background: '#dc2626', pointerEvents: 'none' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
