import { useState, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useMetaFormLeads, useMetaFormChat } from '@/hooks/useMetaFormLeads';
import { MetaFormLead, MetaFormLeadStatus } from '@/types/metaFormLeads';
import { 
  Search, RefreshCw, Download, ChevronRight, Phone, Mail, 
  Clock, CheckCircle, XCircle, Sparkles, Zap, Users, TrendingUp,
  MessageCircle, Send, ArrowLeft, Target, Megaphone, Bot,
  Filter, Sheet, Loader2, AlertTriangle, Copy, Calendar,
  Activity, Star
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

// ─── PALETA ─────────────────────────────────────────────────────────────────
const C = {
  marrom: '#3d2b1f',
  dourado: '#c9a96e',
  douradoEscuro: '#b8922a',
  marromClaro: '#5a3e2b',
  bg: '#faf8f5',
  card: '#ffffff',
  border: '#e8e0d5',
  textMuted: '#8a7560',
};

const STATUS_CONFIG: Record<MetaFormLeadStatus, { label: string; color: string; bg: string; icon: any }> = {
  novo:          { label: 'Novo',          color: '#1d4ed8', bg: '#dbeafe', icon: Sparkles },
  em_atendimento:{ label: 'Em Atendimento',color: '#b45309', bg: '#fef3c7', icon: Clock },
  concluido:     { label: 'Concluído',     color: '#065f46', bg: '#d1fae5', icon: CheckCircle },
  perdido:       { label: 'Perdido',       color: '#991b1b', bg: '#fee2e2', icon: XCircle },
};

// ─── KPI CARD ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, sub }: any) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
      padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: '0 1px 4px rgba(61,43,31,0.06)',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: C.marrom, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: color, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── LEAD CARD ───────────────────────────────────────────────────────────────
function LeadCard({ lead, selected, onClick }: { lead: MetaFormLead; selected: boolean; onClick: () => void }) {
  const cfg = STATUS_CONFIG[lead.status];
  const Icon = cfg.icon;
  const isTrafego = lead.source === 'meta' || lead.form_id;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 16px',
        cursor: 'pointer',
        borderBottom: `1px solid ${C.border}`,
        background: selected ? '#fdf6ec' : 'transparent',
        borderLeft: selected ? `3px solid ${C.dourado}` : '3px solid transparent',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${C.dourado}20`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0, marginTop: 2,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.douradoEscuro }}>
            {(lead.nome || '?')[0].toUpperCase()}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: C.marrom, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.nome || 'Sem nome'}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              color: cfg.color, background: cfg.bg, flexShrink: 0,
            }}>
              {cfg.label}
            </span>
          </div>
          {lead.telefone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Phone size={11} style={{ color: C.textMuted }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>{lead.telefone}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{
              fontSize: 10, padding: '1px 7px', borderRadius: 20, fontWeight: 600,
              background: isTrafego ? '#f3e8ff' : '#ecfdf5',
              color: isTrafego ? '#7c3aed' : '#065f46',
            }}>
              {isTrafego ? '📋 META' : '📊 Sheets'}
            </span>
            <span style={{ fontSize: 10, color: C.textMuted }}>
              {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
function DetailPanel({ lead, onUpdateStatus, onBack, dispararISA }: {
  lead: MetaFormLead;
  onUpdateStatus: (s: MetaFormLeadStatus) => void;
  onBack: () => void;
  dispararISA: (lead: MetaFormLead, msg?: string) => Promise<any>;
}) {
  const { messages, loading: msgLoading } = useMetaFormChat(lead.id);
  const [disparando, setDisparando] = useState(false);
  const [msgCustom, setMsgCustom] = useState('');
  const [showMsgEditor, setShowMsgEditor] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const cfg = STATUS_CONFIG[lead.status];
  const Icon = cfg.icon;
  const isTrafego = lead.source === 'meta' || !!lead.form_id;
  const primeiroNome = lead.nome?.split(' ')[0] || 'você';

  const handleDisparo = async () => {
    setDisparando(true);
    await dispararISA(lead, msgCustom || undefined);
    setDisparando(false);
    setShowMsgEditor(false);
    setMsgCustom('');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const formFields = lead.form_fields && typeof lead.form_fields === 'object'
    ? Object.entries(lead.form_fields as Record<string, unknown>).filter(([_, v]) => v != null && v !== '')
    : [];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
        background: `linear-gradient(135deg, ${C.marrom} 0%, ${C.marromClaro} 100%)`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onBack} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff', flexShrink: 0,
        }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: `${C.dourado}30`,
          border: `2px solid ${C.dourado}50`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.dourado }}>
            {(lead.nome || '?')[0].toUpperCase()}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.nome || 'Sem nome'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              color: cfg.color, background: cfg.bg,
            }}>
              <Icon size={10} style={{ display: 'inline', marginRight: 3 }} />
              {cfg.label}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
              {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {/* Botão ISA — só para leads de tráfego */}
        {isTrafego && (
          <div style={{
            background: `linear-gradient(135deg, ${C.marrom}10, ${C.dourado}15)`,
            border: `1px solid ${C.dourado}40`,
            borderRadius: 14, padding: 16, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Bot size={16} style={{ color: C.dourado }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: C.marrom }}>Disparo ISA</span>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 20,
                background: '#d1fae5', color: '#065f46', fontWeight: 600,
              }}>WhatsApp Tráfego</span>
            </div>

            {!showMsgEditor ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleDisparo}
                  disabled={disparando || !lead.telefone}
                  style={{
                    flex: 1, padding: '10px 16px', borderRadius: 10,
                    background: `linear-gradient(135deg, ${C.marrom}, ${C.marromClaro})`,
                    border: 'none', color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: disparando || !lead.telefone ? 'not-allowed' : 'pointer',
                    opacity: disparando || !lead.telefone ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {disparando ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
                  {disparando ? 'Enviando...' : 'Disparar ISA agora'}
                </button>
                <button
                  onClick={() => setShowMsgEditor(true)}
                  style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: 'transparent', border: `1px solid ${C.dourado}60`,
                    color: C.douradoEscuro, fontSize: 12, cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  Editar msg
                </button>
              </div>
            ) : (
              <div>
                <textarea
                  value={msgCustom}
                  onChange={e => setMsgCustom(e.target.value)}
                  placeholder={`Olá ${primeiroNome}! 👋 Vi seu contato e estou aqui para te ajudar...`}
                  style={{
                    width: '100%', minHeight: 80, padding: '10px 12px',
                    borderRadius: 10, border: `1px solid ${C.border}`,
                    fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
                    background: C.card, color: C.marrom, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={handleDisparo}
                    disabled={disparando}
                    style={{
                      flex: 1, padding: '9px 16px', borderRadius: 10,
                      background: `linear-gradient(135deg, ${C.marrom}, ${C.marromClaro})`,
                      border: 'none', color: '#fff', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <Send size={13} /> Enviar
                  </button>
                  <button
                    onClick={() => { setShowMsgEditor(false); setMsgCustom(''); }}
                    style={{
                      padding: '9px 14px', borderRadius: 10,
                      background: 'transparent', border: `1px solid ${C.border}`,
                      color: C.textMuted, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {!lead.telefone && (
              <p style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>⚠️ Lead sem telefone cadastrado</p>
            )}
          </div>
        )}

        {/* Contato */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Contato
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {lead.telefone && (
              <div
                onClick={() => copyToClipboard(lead.telefone!, 'Telefone')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={15} style={{ color: '#16a34a' }} />
                </div>
                <span style={{ fontSize: 13, color: C.marrom, fontWeight: 500 }}>{lead.telefone}</span>
                <Copy size={12} style={{ color: C.textMuted, marginLeft: 'auto' }} />
              </div>
            )}
            {lead.email && (
              <div
                onClick={() => copyToClipboard(lead.email!, 'Email')}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={15} style={{ color: '#2563eb' }} />
                </div>
                <span style={{ fontSize: 13, color: C.marrom, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.email}</span>
                <Copy size={12} style={{ color: C.textMuted, marginLeft: 'auto', flexShrink: 0 }} />
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Status
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['novo', 'em_atendimento', 'concluido', 'perdido'] as MetaFormLeadStatus[]).map(s => {
              const c = STATUS_CONFIG[s];
              const active = lead.status === s;
              return (
                <button
                  key={s}
                  onClick={() => onUpdateStatus(s)}
                  style={{
                    padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    border: active ? `2px solid ${c.color}` : `1px solid ${C.border}`,
                    background: active ? c.bg : C.card,
                    color: active ? c.color : C.textMuted,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  <c.icon size={13} /> {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ações */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => navigate(`/chat?lead_id=${lead.linked_lead_id || lead.id}`)}
            style={{
              width: '100%', padding: '11px 16px', borderRadius: 10,
              background: C.card, border: `1px solid ${C.border}`,
              color: C.marrom, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <MessageCircle size={15} style={{ color: C.dourado }} />
            Abrir no Chat Principal
            <ChevronRight size={15} style={{ marginLeft: 'auto', color: C.textMuted }} />
          </button>
        </div>

        {/* Campanha */}
        {(lead.campaign_name || lead.ad_name) && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Campanha
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {lead.campaign_name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
                  <Target size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.textMuted, minWidth: 60 }}>Campanha</span>
                  <span style={{ fontSize: 12, color: C.marrom, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.campaign_name}</span>
                </div>
              )}
              {lead.ad_name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                  <Megaphone size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.textMuted, minWidth: 60 }}>Anúncio</span>
                  <span style={{ fontSize: 12, color: C.marrom, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.ad_name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Histórico mensagens */}
        {messages.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Histórico ({messages.length})
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, maxHeight: 200, overflowY: 'auto' }}>
              {messages.slice(-5).map(msg => (
                <div key={msg.id} style={{ marginBottom: 8, display: 'flex', justifyContent: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '7px 11px', borderRadius: 12, fontSize: 12,
                    background: msg.sender_type === 'agent' ? C.marrom : '#f3f4f6',
                    color: msg.sender_type === 'agent' ? '#fff' : C.marrom,
                  }}>
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── PAGE PRINCIPAL ───────────────────────────────────────────────────────────
export default function MetaLeadsPage() {
  const { leads, loading, syncing, syncError, formIds, fetchLeads, syncFromMeta, updateLeadStatus, dispararISAManual } = useMetaFormLeads();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<MetaFormLeadStatus | 'all'>('all');
  const [filterFormId, setFilterFormId] = useState<string | 'all'>('all');
  const [selectedLead, setSelectedLead] = useState<MetaFormLead | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const { toast } = useToast();

  const filteredLeads = useMemo(() => {
    let result = [...leads];
    if (filterStatus !== 'all') result = result.filter(l => l.status === filterStatus);
    if (filterFormId !== 'all') result = result.filter(l => l.form_id === filterFormId);
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(l =>
        (l.nome?.toLowerCase() || '').includes(s) ||
        (l.email?.toLowerCase() || '').includes(s) ||
        (l.telefone || '').includes(search)
      );
    }
    return result;
  }, [leads, filterStatus, filterFormId, search]);

  const kpis = useMemo(() => ({
    total: leads.length,
    novos: leads.filter(l => l.status === 'novo').length,
    atendimento: leads.filter(l => l.status === 'em_atendimento').length,
    concluidos: leads.filter(l => l.status === 'concluido').length,
    trafego: leads.filter(l => l.source === 'meta' || !!l.form_id).length,
  }), [leads]);

  const handleSelect = (lead: MetaFormLead) => {
    setSelectedLead(lead);
    setShowDetail(true);
  };

  const handleUpdateStatus = async (status: MetaFormLeadStatus) => {
    if (selectedLead) {
      await updateLeadStatus(selectedLead.id, status);
      setSelectedLead(prev => prev ? { ...prev, status } : null);
    }
  };

  const exportCSV = () => {
    if (filteredLeads.length === 0) return;
    const headers = ['Nome', 'Telefone', 'Email', 'Status', 'Fonte', 'Data'];
    const rows = filteredLeads.map(l => [
      l.nome || '', l.telefone || '', l.email || '',
      STATUS_CONFIG[l.status].label,
      l.source === 'meta' ? 'Meta' : 'Sheets',
      format(new Date(l.created_at), 'dd/MM/yyyy HH:mm'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `meta-leads-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: `${filteredLeads.length} leads exportados` });
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, gap: 12, flexDirection: 'column' }}>
          <Loader2 size={28} style={{ color: C.dourado, animation: 'spin 1s linear infinite' }} />
          <span style={{ color: C.textMuted, fontSize: 14 }}>Carregando leads...</span>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: C.bg, overflow: 'hidden' }}>

        {/* ── HEADER ── */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: C.card, flexShrink: 0 }}>
          {syncError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 10, marginBottom: 12,
              background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13,
            }}>
              <AlertTriangle size={15} style={{ color: '#dc2626' }} />
              <span style={{ color: '#dc2626', fontWeight: 600 }}>Erro: </span>
              <span style={{ color: '#7f1d1d' }}>{syncError}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, ${C.marrom}, ${C.marromClaro})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Activity size={18} style={{ color: C.dourado }} />
              </div>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: C.marrom, margin: 0 }}>Leads Meta & Tráfego</h1>
                <span style={{ fontSize: 12, color: C.textMuted }}>{filteredLeads.length} leads</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={exportCSV} style={{
                padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: C.card, color: C.marrom, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Download size={13} /> CSV
              </button>
              <button onClick={syncFromMeta} disabled={syncing} style={{
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: `linear-gradient(135deg, #16a34a, #15803d)`,
                color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.7 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {syncing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sheet size={13} />}
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <button onClick={fetchLeads} style={{
                padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: C.card, color: C.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}>
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
            <KpiCard label="Total de Leads" value={kpis.total} icon={Users} color={C.marrom} />
            <KpiCard label="Novos" value={kpis.novos} icon={Sparkles} color="#2563eb" sub="Aguardando contato" />
            <KpiCard label="Em Atendimento" value={kpis.atendimento} icon={Clock} color="#b45309" />
            <KpiCard label="Convertidos" value={kpis.concluidos} icon={Star} color="#16a34a" />
            <KpiCard label="Leads Tráfego" value={kpis.trafego} icon={Target} color="#7c3aed" sub="Meta/Facebook" />
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar nome, telefone ou email..."
                style={{
                  width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8,
                  border: `1px solid ${C.border}`, background: C.bg, fontSize: 13,
                  color: C.marrom, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'novo', 'em_atendimento', 'concluido', 'perdido'] as const).map(s => {
                const active = filterStatus === s;
                const cfg = s === 'all' ? null : STATUS_CONFIG[s];
                return (
                  <button key={s} onClick={() => setFilterStatus(s)} style={{
                    padding: '6px 12px', borderRadius: 20, border: 'none',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: active ? (cfg ? cfg.bg : `${C.marrom}15`) : 'transparent',
                    color: active ? (cfg ? cfg.color : C.marrom) : C.textMuted,
                  }}>
                    {s === 'all' ? 'Todos' : cfg!.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Lista */}
          <div style={{
            width: showDetail ? 380 : '100%',
            borderRight: `1px solid ${C.border}`,
            overflowY: 'auto',
            display: showDetail ? undefined : 'block',
            flexShrink: 0,
          }}>
            {filteredLeads.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 8 }}>
                <Users size={36} style={{ color: C.border }} />
                <span style={{ color: C.textMuted, fontSize: 14, fontWeight: 600 }}>Nenhum lead encontrado</span>
              </div>
            ) : (
              filteredLeads.map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  selected={selectedLead?.id === lead.id}
                  onClick={() => handleSelect(lead)}
                />
              ))
            )}
          </div>

          {/* Detalhe */}
          {showDetail && selectedLead && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <DetailPanel
                lead={selectedLead}
                onUpdateStatus={handleUpdateStatus}
                onBack={() => setShowDetail(false)}
                dispararISA={dispararISAManual}
              />
            </div>
          )}

          {!showDetail && (
            <div style={{ display: 'none' }} />
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  );
}
