import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useMetaFormLeads, useMetaFormChat } from '@/hooks/useMetaFormLeads';
import { MetaFormLead, MetaFormLeadStatus } from '@/types/metaFormLeads';
import {
  Search, RefreshCw, Download, ChevronRight, Phone, Mail,
  Clock, CheckCircle, XCircle, Sparkles, Zap, Users,
  MessageCircle, Send, ArrowLeft, Target, Megaphone, Bot,
  Sheet, Loader2, AlertTriangle, Copy, Calendar, Activity,
  Star, Hash, User
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const C = {
  marrom: '#3d2b1f',
  marromMedio: '#5a3e2b',
  marromClaro: '#7a5c43',
  dourado: '#c9a96e',
  douradoEscuro: '#b8922a',
  bg: '#f9f6f2',
  bgCard: '#ffffff',
  bgMuted: '#f3ede6',
  border: '#e4d9cc',
  borderLight: '#efe8df',
  text: '#2c1810',
  textMuted: '#8a7260',
  textLight: '#b09880',
};

const STATUS_CFG: Record<MetaFormLeadStatus, { label: string; color: string; bg: string; border: string; Icon: any }> = {
  novo:           { label: 'Novo',           color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', Icon: Sparkles },
  em_atendimento: { label: 'Em Atendimento', color: '#92400e', bg: '#fffbeb', border: '#fcd34d', Icon: Clock },
  concluido:      { label: 'Concluído',      color: '#065f46', bg: '#ecfdf5', border: '#6ee7b7', Icon: CheckCircle },
  perdido:        { label: 'Perdido',        color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', Icon: XCircle },
};

// ── Helper: iniciais seguras ──────────────────────────────────────────────────
function getInitials(nome: string | null): string {
  if (!nome || nome.trim() === '' || nome === '..') return '?';
  const parts = nome.trim().split(' ').filter(p => p.length > 0);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── KPI ───────────────────────────────────────────────────────────────────────
function Kpi({ label, value, Icon, accent, sub }: any) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 2px 8px rgba(61,43,31,0.05)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: accent, borderRadius: '14px 14px 0 0',
      }} />
      <div style={{
        width: 44, height: 44, borderRadius: 11, background: `${accent}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} style={{ color: accent }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.marrom, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: accent, marginTop: 1, fontWeight: 700 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── LEAD ROW ──────────────────────────────────────────────────────────────────
function LeadRow({ lead, selected, onClick }: { lead: MetaFormLead; selected: boolean; onClick: () => void }) {
  const cfg = STATUS_CFG[lead.status];
  const isMeta = lead.source === 'meta' || !!lead.form_id;
  const initials = getInitials(lead.nome);
  const displayName = lead.nome && lead.nome.trim() !== '' && lead.nome !== '..' ? lead.nome : 'Sem nome';

  return (
    <div onClick={onClick} style={{
      padding: '12px 16px', cursor: 'pointer',
      borderBottom: `1px solid ${C.borderLight}`,
      background: selected ? `${C.dourado}10` : 'transparent',
      borderLeft: selected ? `3px solid ${C.dourado}` : '3px solid transparent',
      transition: 'all 0.12s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: selected
            ? `linear-gradient(135deg, ${C.marrom}, ${C.marromMedio})`
            : C.bgMuted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {initials === '?' ? (
            <User size={16} style={{ color: selected ? C.dourado : C.textMuted }} />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 700, color: selected ? C.dourado : C.textMuted }}>
              {initials}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={{
              fontWeight: 700, fontSize: 13, color: C.marrom,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {displayName}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
              color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              {cfg.label}
            </span>
          </div>

          {lead.telefone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Phone size={10} style={{ color: C.textMuted, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lead.telefone}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
              background: isMeta ? '#f5f3ff' : '#f0fdf4',
              color: isMeta ? '#6d28d9' : '#166534',
              border: `1px solid ${isMeta ? '#ddd6fe' : '#bbf7d0'}`,
            }}>
              {isMeta ? '📋 META' : '📊 Sheets'}
            </span>
            <span style={{ fontSize: 10, color: C.textLight }}>
              {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DETALHE ───────────────────────────────────────────────────────────────────
function Detalhe({ lead, onStatus, onBack, dispararISA }: {
  lead: MetaFormLead;
  onStatus: (s: MetaFormLeadStatus) => void;
  onBack: () => void;
  dispararISA: (lead: MetaFormLead, msg?: string) => Promise<any>;
}) {
  const { messages } = useMetaFormChat(lead.id);
  const [disparando, setDisparando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [msgCustom, setMsgCustom] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const cfg = STATUS_CFG[lead.status];
  const initials = getInitials(lead.nome);
  const displayName = lead.nome && lead.nome.trim() !== '' && lead.nome !== '..' ? lead.nome : 'Sem nome';
  const primeiroNome = displayName === 'Sem nome' ? 'você' : displayName.split(' ')[0];
  const isMeta = lead.source === 'meta' || !!lead.form_id;
  const msgPadrao = `Olá ${primeiroNome}! 👋 Recebi seu contato e estou aqui para te ajudar com suas dúvidas jurídicas. Me conta um pouco mais sobre o que você precisa! 😊`;

  const handleDisparar = async () => {
    if (!lead.telefone) { toast({ title: 'Lead sem telefone', variant: 'destructive' }); return; }
    setDisparando(true);
    await dispararISA(lead, editando && msgCustom.trim() ? msgCustom : msgPadrao);
    setDisparando(false);
    setEditando(false);
    setMsgCustom('');
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const formFields = lead.form_fields && typeof lead.form_fields === 'object'
    ? Object.entries(lead.form_fields as Record<string, unknown>).filter(([_, v]) => v != null && v !== '')
    : [];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflowY: 'auto' }}>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${C.marrom} 0%, ${C.marromMedio} 100%)`,
        padding: '16px 20px 20px', position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: -20, right: -20, width: 100, height: 100,
          borderRadius: '50%', background: `${C.dourado}12`,
        }} />

        <button onClick={onBack} style={{
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          flexShrink: 0,
        }}>
          <ArrowLeft size={15} />
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 50, height: 50, borderRadius: 14, flexShrink: 0,
            background: `${C.dourado}25`, border: `2px solid ${C.dourado}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {initials === '?' ? (
              <User size={22} style={{ color: C.dourado }} />
            ) : (
              <span style={{ fontSize: 18, fontWeight: 800, color: C.dourado }}>{initials}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.2,
              wordBreak: 'break-word',
            }}>
              {displayName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                color: cfg.color, background: cfg.bg,
              }}>
                {cfg.label}
              </span>
              <span style={{
                fontSize: 10, padding: '3px 10px', borderRadius: 99, fontWeight: 600,
                background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)',
              }}>
                {isMeta ? '📋 META' : '📊 Sheets'}
              </span>
            </div>
          </div>
        </div>

        {/* Contatos no header */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {lead.telefone && (
            <div onClick={() => copy(lead.telefone!, 'Telefone')} style={{
              flex: 1, minWidth: 140,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
            }}>
              <Phone size={13} style={{ color: C.dourado, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{lead.telefone}</span>
              <Copy size={10} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            </div>
          )}
          {lead.email && (
            <div onClick={() => copy(lead.email!, 'Email')} style={{
              flex: 1, minWidth: 140,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
            }}>
              <Mail size={13} style={{ color: C.dourado, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{lead.email}</span>
              <Copy size={10} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* BLOCO ISA */}
        <div style={{
          background: `${C.dourado}08`,
          border: `1px solid ${C.dourado}35`, borderRadius: 14, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: `linear-gradient(135deg, ${C.marrom}, ${C.marromMedio})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Bot size={16} style={{ color: C.dourado }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.marrom }}>Disparo ISA</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>WhatsApp · instância tráfego</div>
            </div>
            {!lead.telefone && (
              <span style={{
                marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '3px 8px',
                borderRadius: 99, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                flexShrink: 0,
              }}>⚠️ Sem telefone</span>
            )}
          </div>

          {!editando ? (
            <div style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '10px 13px', marginBottom: 12, fontSize: 13, color: C.marromClaro,
              lineHeight: 1.6, fontStyle: 'italic',
            }}>
              "{msgPadrao}"
            </div>
          ) : (
            <textarea
              value={msgCustom}
              onChange={e => setMsgCustom(e.target.value)}
              placeholder={msgPadrao}
              autoFocus
              style={{
                width: '100%', minHeight: 90, padding: '10px 12px', marginBottom: 10,
                borderRadius: 10, border: `1px solid ${C.dourado}50`,
                fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
                background: C.bgCard, color: C.marrom, outline: 'none',
                boxSizing: 'border-box', lineHeight: 1.5,
              }}
            />
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleDisparar}
              disabled={disparando || !lead.telefone}
              style={{
                flex: 1, padding: '11px 16px', borderRadius: 10, border: 'none',
                background: disparando || !lead.telefone
                  ? '#d1c4b8'
                  : `linear-gradient(135deg, ${C.marrom}, ${C.marromMedio})`,
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: disparando || !lead.telefone ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: disparando || !lead.telefone ? 'none' : `0 3px 10px ${C.marrom}40`,
              }}
            >
              {disparando
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</>
                : <><Zap size={14} /> {editando ? 'Enviar mensagem' : 'Disparar ISA'}</>
              }
            </button>
            <button
              onClick={() => { setEditando(!editando); if (editando) setMsgCustom(''); }}
              style={{
                padding: '11px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: editando ? '#fef2f2' : C.bgCard,
                border: `1px solid ${editando ? '#fca5a5' : C.border}`,
                color: editando ? '#dc2626' : C.textMuted,
              }}
            >
              {editando ? 'Cancelar' : 'Editar'}
            </button>
          </div>
        </div>

        {/* STATUS */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Alterar Status
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(Object.entries(STATUS_CFG) as [MetaFormLeadStatus, typeof STATUS_CFG[MetaFormLeadStatus]][]).map(([s, c]) => {
              const active = lead.status === s;
              return (
                <button key={s} onClick={() => onStatus(s)} style={{
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  border: active ? `2px solid ${c.color}50` : `1px solid ${C.border}`,
                  background: active ? c.bg : C.bgCard,
                  color: active ? c.color : C.textMuted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.12s',
                  boxShadow: active ? `0 2px 8px ${c.color}20` : 'none',
                }}>
                  <c.Icon size={13} /> {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* CHAT */}
        <button
          onClick={() => navigate(`/chat?lead_id=${lead.linked_lead_id || lead.id}`)}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 12,
            background: C.bgCard, border: `1px solid ${C.border}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: `${C.dourado}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageCircle size={16} style={{ color: C.douradoEscuro }} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.marrom }}>Abrir no Chat Principal</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Ver histórico completo</div>
          </div>
          <ChevronRight size={15} style={{ color: C.textLight, marginLeft: 'auto' }} />
        </button>

        {/* CAMPANHA */}
        {(lead.campaign_name || lead.ad_name || lead.adset_name) && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Campanha
            </div>
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {[
                { Icon: Target, label: 'Campanha', value: lead.campaign_name },
                { Icon: Megaphone, label: 'Anúncio', value: lead.ad_name },
                { Icon: Hash, label: 'Conjunto', value: lead.adset_name },
              ].filter(x => x.value).map((item, idx, arr) => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderBottom: idx < arr.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                }}>
                  <item.Icon size={13} style={{ color: C.textLight, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.textMuted, minWidth: 55, fontWeight: 600 }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: C.marrom, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FORM FIELDS */}
        {formFields.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Dados do Formulário
            </div>
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {formFields.map(([key, value], idx) => (
                <div key={key} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 14px',
                  borderBottom: idx < formFields.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                }}>
                  <span style={{ fontSize: 11, color: C.textMuted, minWidth: 90, paddingTop: 1, fontWeight: 600, flexShrink: 0 }}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span style={{ fontSize: 12, color: C.marrom, fontWeight: 500, wordBreak: 'break-word' }}>
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MENSAGENS */}
        {messages.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Últimas mensagens ({messages.length})
            </div>
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.slice(-4).map(msg => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '82%', padding: '8px 12px', borderRadius: 12, fontSize: 12,
                    background: msg.sender_type === 'agent'
                      ? `linear-gradient(135deg, ${C.marrom}, ${C.marromMedio})`
                      : C.bgMuted,
                    color: msg.sender_type === 'agent' ? '#fff' : C.marrom,
                  }}>
                    {msg.sender_name && (
                      <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>{msg.sender_name}</div>
                    )}
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', paddingBottom: 4 }}>
          <Calendar size={11} style={{ color: C.textLight }} />
          <span style={{ fontSize: 11, color: C.textLight }}>
            {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function MetaLeadsPage() {
  const { leads, loading, syncing, syncError, fetchLeads, syncFromMeta, updateLeadStatus, dispararISAManual } = useMetaFormLeads();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<MetaFormLeadStatus | 'all'>('all');
  const [selectedLead, setSelectedLead] = useState<MetaFormLead | null>(null);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    let r = [...leads];
    if (filterStatus !== 'all') r = r.filter(l => l.status === filterStatus);
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter(l =>
        (l.nome?.toLowerCase() || '').includes(s) ||
        (l.email?.toLowerCase() || '').includes(s) ||
        (l.telefone || '').includes(search)
      );
    }
    return r;
  }, [leads, filterStatus, search]);

  const kpis = useMemo(() => ({
    total: leads.length,
    novos: leads.filter(l => l.status === 'novo').length,
    atendimento: leads.filter(l => l.status === 'em_atendimento').length,
    concluidos: leads.filter(l => l.status === 'concluido').length,
    trafego: leads.filter(l => l.source === 'meta' || !!l.form_id).length,
  }), [leads]);

  const handleStatus = async (status: MetaFormLeadStatus) => {
    if (!selectedLead) return;
    await updateLeadStatus(selectedLead.id, status);
    setSelectedLead(prev => prev ? { ...prev, status } : null);
  };

  const exportCSV = () => {
    if (!filtered.length) return;
    const rows = filtered.map(l => [
      l.nome || '', l.telefone || '', l.email || '',
      STATUS_CFG[l.status].label,
      l.source === 'meta' ? 'Meta' : 'Sheets',
      format(new Date(l.created_at), 'dd/MM/yyyy HH:mm'),
    ]);
    const csv = [['Nome', 'Telefone', 'Email', 'Status', 'Fonte', 'Data'], ...rows]
      .map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: `${filtered.length} leads exportados` });
  };

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 10 }}>
        <Loader2 size={28} style={{ color: C.dourado, animation: 'spin 1s linear infinite' }} />
        <span style={{ color: C.textMuted, fontSize: 14 }}>Carregando leads...</span>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: C.bg, overflow: 'hidden' }}>

        {/* HEADER */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: C.bgCard, flexShrink: 0 }}>

          {syncError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, marginBottom: 12,
              background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13,
            }}>
              <AlertTriangle size={14} style={{ color: '#dc2626' }} />
              <span style={{ color: '#991b1b' }}>{syncError}</span>
            </div>
          )}

          {/* Título + botões */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: `linear-gradient(135deg, ${C.marrom}, ${C.marromMedio})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Activity size={18} style={{ color: C.dourado }} />
              </div>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 800, color: C.marrom, margin: 0, letterSpacing: '-0.02em' }}>
                  Leads Meta & Tráfego
                </h1>
                <span style={{ fontSize: 12, color: C.textMuted }}>{filtered.length} de {leads.length} leads</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={exportCSV} style={{
                padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: C.bgCard, color: C.marromClaro, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Download size={13} /> CSV
              </button>
              <button onClick={syncFromMeta} disabled={syncing} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: syncing ? '#d1d5db' : 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: syncing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                boxShadow: syncing ? 'none' : '0 2px 8px rgba(22,163,74,0.3)',
              }}>
                {syncing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sheet size={13} />}
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <button onClick={fetchLeads} style={{
                padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: C.bgCard, color: C.textMuted, cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}>
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
            <Kpi label="Total" value={kpis.total} Icon={Users} accent={C.marrom} />
            <Kpi label="Novos" value={kpis.novos} Icon={Sparkles} accent="#2563eb" sub="Sem contato" />
            <Kpi label="Em Atendimento" value={kpis.atendimento} Icon={Clock} accent="#d97706" />
            <Kpi label="Convertidos" value={kpis.concluidos} Icon={Star} accent="#16a34a" />
            <Kpi label="Leads Tráfego" value={kpis.trafego} Icon={Target} accent="#7c3aed" sub="Meta/Facebook" />
          </div>

          {/* Busca */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou email..."
              style={{
                width: '100%', padding: '9px 10px 9px 32px', borderRadius: 9,
                border: `1px solid ${C.border}`, background: C.bg, fontSize: 13,
                color: C.marrom, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Filtros de status — linha separada para não sumir */}
          <div style={{ display: 'flex', gap: 6, background: C.bgMuted, borderRadius: 10, padding: '4px 6px' }}>
            {(['all', 'novo', 'em_atendimento', 'concluido', 'perdido'] as const).map(s => {
              const active = filterStatus === s;
              const cfg = s !== 'all' ? STATUS_CFG[s] : null;
              return (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  flex: 1, padding: '6px 8px', borderRadius: 7, border: 'none',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: active ? C.bgCard : 'transparent',
                  color: active ? (cfg ? cfg.color : C.marrom) : C.textMuted,
                  boxShadow: active ? '0 1px 4px rgba(61,43,31,0.1)' : 'none',
                  transition: 'all 0.12s', whiteSpace: 'nowrap',
                }}>
                  {s === 'all' ? 'Todos' : cfg!.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Lista */}
          <div style={{
            width: selectedLead ? 340 : '100%',
            borderRight: selectedLead ? `1px solid ${C.border}` : 'none',
            overflowY: 'auto', flexShrink: 0,
          }}>
            {filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 10 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: C.bgMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={24} style={{ color: C.textLight }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, color: C.marrom }}>Nenhum lead encontrado</span>
                <span style={{ fontSize: 13, color: C.textMuted }}>Ajuste os filtros ou sincronize</span>
              </div>
            ) : filtered.map(lead => (
              <LeadRow
                key={lead.id}
                lead={lead}
                selected={selectedLead?.id === lead.id}
                onClick={() => setSelectedLead(lead)}
              />
            ))}
          </div>

          {/* Detalhe */}
          {selectedLead ? (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Detalhe
                lead={selectedLead}
                onStatus={handleStatus}
                onBack={() => setSelectedLead(null)}
                dispararISA={dispararISAManual}
              />
            </div>
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10,
              color: C.textMuted,
            }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: C.bgMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={28} style={{ color: C.textLight }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: C.marrom }}>Selecione um lead</span>
              <span style={{ fontSize: 13 }}>Clique em um lead para ver os detalhes</span>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </AppLayout>
  );
}
