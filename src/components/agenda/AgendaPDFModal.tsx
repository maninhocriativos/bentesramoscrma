import { useState, useRef, useCallback, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, addMonths, isToday, isPast, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, FileText, ChevronLeft, ChevronRight, Download, Loader2, Filter } from 'lucide-react';
import { Compromisso } from '@/types/compromissos';

interface Props {
  onClose: () => void;
  compromissos: Compromisso[];
}

type RangeMode = '1' | '3' | '6' | '12';

const TIPO_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  'Audiência': { bg: '#fce7f3', text: '#be185d', dot: '#db2777' },
  'Reunião':   { bg: '#fef3c7', text: '#92400e', dot: '#d97706' },
  'Prazo':     { bg: '#fef9c3', text: '#713f12', dot: '#ca8a04' },
  'Tarefa':    { bg: '#dcfce7', text: '#14532d', dot: '#16a34a' },
  'Intimação': { bg: '#fee2e2', text: '#7f1d1d', dot: '#dc2626' },
  'Outro':     { bg: '#f1f5f9', text: '#475569', dot: '#64748b' },
};

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  pendente:   { text: 'Pendente',   color: '#d97706' },
  confirmado: { text: 'Confirmado', color: '#16a34a' },
  cancelado:  { text: 'Cancelado',  color: '#dc2626' },
  remarcado:  { text: 'Remarcado',  color: '#2563eb' },
};

const ALL_TIPOS = ['Audiência', 'Reunião', 'Prazo', 'Tarefa', 'Intimação', 'Outro'];

export function AgendaPDFModal({ onClose, compromissos }: Props) {
  const today = new Date();
  const [year, setYear]         = useState(today.getFullYear());
  const [month, setMonth]       = useState(today.getMonth());
  const [rangeMode, setRangeMode]     = useState<RangeMode>('1');
  const [selectedTipos, setSelectedTipos] = useState<string[]>(ALL_TIPOS);
  const [generating, setGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const toggleTipo = (t: string) => setSelectedTipos(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    const base  = new Date(year, month, 1);
    const n     = parseInt(rangeMode);
    const start = startOfMonth(base);
    const end   = endOfMonth(addMonths(base, n - 1));
    const sl    = format(start, "MMMM 'de' yyyy", { locale: ptBR });
    const el    = n === 1 ? null : format(end, "MMMM 'de' yyyy", { locale: ptBR });
    const lbl   = el
      ? `${sl.charAt(0).toUpperCase() + sl.slice(1)} — ${el.charAt(0).toUpperCase() + el.slice(1)}`
      : sl.charAt(0).toUpperCase() + sl.slice(1);
    return { rangeStart: start, rangeEnd: end, rangeLabel: lbl };
  }, [year, month, rangeMode]);

  const rangeCompromissos = useMemo(() =>
    compromissos
      .filter(c => {
        const d = new Date(c.data_inicio);
        return d >= rangeStart && d <= rangeEnd && selectedTipos.includes(c.tipo);
      })
      .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime()),
    [compromissos, rangeStart, rangeEnd, selectedTipos]
  );

  const byDay: Record<string, Compromisso[]> = {};
  for (const c of rangeCompromissos) {
    const key = format(new Date(c.data_inicio), 'yyyy-MM-dd');
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(c);
  }
  const days = Object.keys(byDay).sort();

  const stats = useMemo(() => {
    const total       = rangeCompromissos.length;
    const byTipo: Record<string, number> = {};
    for (const t of ALL_TIPOS) byTipo[t] = rangeCompromissos.filter(c => c.tipo === t).length;
    const confirmados = rangeCompromissos.filter(c => c.confirmacao_status === 'confirmado').length;
    const pendentes   = rangeCompromissos.filter(c => (c.confirmacao_status || 'pendente') === 'pendente').length;
    const cancelados  = rangeCompromissos.filter(c => c.confirmacao_status === 'cancelado').length;
    const taxa        = total > 0 ? Math.round((confirmados / total) * 100) : 0;
    return { total, byTipo, confirmados, pendentes, cancelados, taxa };
  }, [rangeCompromissos]);

  const filteredTiposForStats = ALL_TIPOS.filter(t => selectedTipos.includes(t));

  const handleGeneratePDF = useCallback(async () => {
    if (!printRef.current) return;
    setGenerating(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas  = await html2canvas(printRef.current, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pageW   = 210;
      const pageH   = 297;
      const imgW    = pageW;
      const imgH    = (canvas.height * pageW) / canvas.width;
      const totalPages = Math.ceil(imgH / pageH);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let posY = 0, remaining = imgH;
      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 0, -posY, imgW, imgH);
        remaining -= pageH; posY += pageH;
        if (remaining > 0) pdf.addPage();
      }

      // Add page numbers at jsPDF level
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(180, 140, 80);
        pdf.text(`Página ${i} de ${totalPages}`, pageW - 10, pageH - 4, { align: 'right' });
        pdf.setTextColor(160, 140, 120);
        pdf.text('Bentes Ramos — Advocacia & Consultoria Jurídica', 10, pageH - 4);
      }

      const n = parseInt(rangeMode);
      const fileName = n === 1
        ? `agenda-${format(rangeStart, 'MMMM-yyyy', { locale: ptBR })}.pdf`
        : `agenda-${format(rangeStart, 'MMM-yyyy', { locale: ptBR })}-${format(rangeEnd, 'MMM-yyyy', { locale: ptBR })}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }, [rangeMode, rangeStart, rangeEnd]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 12px', overflow: 'auto', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#faf7f2', borderRadius: 20, width: '100%', maxWidth: 860, boxShadow: '0 40px 100px rgba(20,10,0,0.45)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{ background: 'linear-gradient(135deg, #1e1008, #3d2010)', padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={18} style={{ color: '#c9943a' }} />
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Relatório de Agenda — PDF</span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        {/* Controls */}
        <div style={{ padding: '14px 22px', background: '#fff', borderBottom: '1px solid #e8ddd0', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Row 1: range mode + month nav + generate button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Range tabs */}
              <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #e8ddd0' }}>
                {(['1', '3', '6', '12'] as RangeMode[]).map((r, i, arr) => (
                  <button key={r} onClick={() => setRangeMode(r)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: rangeMode === r ? '#3d2b1f' : '#fff', color: rangeMode === r ? '#c9943a' : '#6b7280', border: 'none', borderRight: i < arr.length - 1 ? '1px solid #e8ddd0' : 'none' }}>
                    {r === '1' ? '1 Mês' : r === '3' ? '3 Meses' : r === '6' ? '6 Meses' : 'Ano'}
                  </button>
                ))}
              </div>
              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={prevMonth} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #e8ddd0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b3f25' }}><ChevronLeft size={14} /></button>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#1e1008', minWidth: 200, textAlign: 'center' }}>{rangeLabel}</span>
                <button onClick={nextMonth} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #e8ddd0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b3f25' }}><ChevronRight size={14} /></button>
              </div>
            </div>
            <button
              onClick={handleGeneratePDF}
              disabled={generating || rangeCompromissos.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 10, border: 'none', cursor: generating || rangeCompromissos.length === 0 ? 'not-allowed' : 'pointer', background: generating || rangeCompromissos.length === 0 ? '#e8ddd0' : 'linear-gradient(135deg, #1e1008, #3d2010)', color: generating || rangeCompromissos.length === 0 ? '#8a7260' : '#c9943a', fontWeight: 800, fontSize: 13 }}
            >
              {generating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
              {generating ? 'Gerando...' : `Baixar PDF (${rangeCompromissos.length} compromisso${rangeCompromissos.length !== 1 ? 's' : ''})`}
            </button>
          </div>

          {/* Row 2: type filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#8a7260', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Filter size={12} /> Incluir:
            </span>
            {ALL_TIPOS.map(t => {
              const cfg = TIPO_COLOR[t];
              const sel = selectedTipos.includes(t);
              return (
                <button key={t} onClick={() => toggleTipo(t)} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${sel ? cfg.dot : '#e8ddd0'}`, background: sel ? cfg.bg : '#fff', color: sel ? cfg.text : '#9ca3af', transition: 'all 0.15s' }}>
                  {t}
                </button>
              );
            })}
            {selectedTipos.length < ALL_TIPOS.length && (
              <button onClick={() => setSelectedTipos(ALL_TIPOS)} style={{ fontSize: 11, color: '#c9943a', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}>
                + Todos
              </button>
            )}
          </div>
        </div>

        {/* Printable preview */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '16px' }}>
          <div ref={printRef} style={{ background: '#ffffff', fontFamily: "'Georgia', 'Times New Roman', serif", width: '100%' }}>

            {/* PDF Header */}
            <div style={{ background: 'linear-gradient(135deg, #1e1008 0%, #3d2010 60%, #6b3f25 100%)', padding: '32px 40px 24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(201,148,58,0.08)' }} />
              <div style={{ position: 'absolute', bottom: -20, left: 20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(201,148,58,0.05)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                <div>
                  <div style={{ color: '#c9943a', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'Arial, sans-serif' }}>ESCRITÓRIO DE ADVOCACIA</div>
                  <div style={{ color: '#ffffff', fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 2 }}>Bentes Ramos</div>
                  <div style={{ color: 'rgba(201,148,58,0.8)', fontSize: 13, fontFamily: 'Arial, sans-serif' }}>Advocacia & Consultoria Jurídica</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Relatório de Agenda</div>
                  <div style={{ color: '#c9943a', fontSize: 16, fontWeight: 900, lineHeight: 1.3 }}>{rangeLabel}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontFamily: 'Arial, sans-serif', marginTop: 6 }}>
                    Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                  <div style={{ display: 'inline-block', marginTop: 8, padding: '3px 10px', border: '1px solid rgba(201,148,58,0.5)', borderRadius: 4, fontSize: 8, color: '#c9943a', fontFamily: 'Arial, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    CONFIDENCIAL
                  </div>
                </div>
              </div>
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #c9943a, transparent)', marginTop: 24 }} />
            </div>

            {/* Stats row 1: main KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid #e8ddd0' }}>
              {[
                { label: 'Total',         value: String(stats.total),        color: '#1e1008' },
                { label: 'Confirmados',   value: String(stats.confirmados),  color: '#14532d' },
                { label: 'Pendentes',     value: String(stats.pendentes),    color: '#92400e' },
                { label: 'Taxa Confirm.', value: `${stats.taxa}%`,           color: stats.taxa >= 70 ? '#14532d' : stats.taxa >= 40 ? '#92400e' : '#991b1b' },
              ].map((s, i) => (
                <div key={s.label} style={{ padding: '16px 20px', borderRight: i < 3 ? '1px solid #e8ddd0' : 'none', background: '#fff' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#8a7260', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Arial, sans-serif', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.color, letterSpacing: '-0.04em', lineHeight: 1, fontFamily: 'Arial, sans-serif' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Stats row 2: by type */}
            {filteredTiposForStats.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${filteredTiposForStats.length}, 1fr)`, borderBottom: '1px solid #e8ddd0' }}>
                {filteredTiposForStats.map((t, i) => {
                  const cfg   = TIPO_COLOR[t];
                  const count = stats.byTipo[t] || 0;
                  return (
                    <div key={t} style={{ padding: '10px 14px', borderRight: i < filteredTiposForStats.length - 1 ? '1px solid #e8ddd0' : 'none', background: count > 0 ? cfg.bg : '#fff', opacity: count === 0 ? 0.5 : 1 }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: cfg.text, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Arial, sans-serif', marginBottom: 3 }}>{t}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: cfg.text, letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'Arial, sans-serif' }}>{count}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Content */}
            {days.length === 0 ? (
              <div style={{ padding: '60px 40px', textAlign: 'center', color: '#8a7260', fontFamily: 'Arial, sans-serif' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1e1008', marginBottom: 8 }}>Nenhum compromisso</div>
                <div style={{ fontSize: 13 }}>Não há compromissos para o período e filtros selecionados.</div>
              </div>
            ) : (
              <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {days.map((dayKey, di) => {
                  const dayDate  = new Date(dayKey + 'T00:00:00');
                  const dayComps = byDay[dayKey];
                  const isT      = isToday(dayDate);
                  const dayIsPast = isPast(dayDate) && !isT;
                  const daysUntil = differenceInDays(dayDate, today);
                  const isSoon   = daysUntil >= 0 && daysUntil <= 3;
                  const dayBg     = isT ? '#fdf3e3' : isSoon ? '#fffbeb' : dayIsPast ? '#fafaf9' : '#ffffff';
                  const dayBorder = isT ? '#c9943a' : isSoon ? '#fbbf24' : '#e8ddd0';

                  return (
                    <div key={dayKey} style={{ marginBottom: di < days.length - 1 ? 12 : 0, border: `1.5px solid ${dayBorder}`, borderRadius: 12, overflow: 'hidden', background: dayBg, opacity: dayIsPast ? 0.75 : 1 }}>
                      {/* Day header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: isT ? 'linear-gradient(135deg, #1e1008, #3d2010)' : isSoon ? '#fffbeb' : '#f8f5f0', borderBottom: `1px solid ${dayBorder}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: isT ? '#c9943a' : isSoon ? '#fbbf24' : dayIsPast ? '#d1d5db' : '#e8ddd0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: isT || isSoon ? '#1e1008' : dayIsPast ? '#6b7280' : '#1e1008', fontFamily: 'Arial, sans-serif' }}>
                            {format(dayDate, 'd')}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: isT ? '#ffffff' : '#1e1008', fontFamily: 'Arial, sans-serif', textTransform: 'capitalize' }}>{format(dayDate, 'EEEE', { locale: ptBR })}</div>
                            <div style={{ fontSize: 10, color: isT ? '#c9943a' : '#8a7260', fontFamily: 'Arial, sans-serif' }}>{format(dayDate, "dd 'de' MMMM", { locale: ptBR })}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isT && <span style={{ background: '#c9943a', color: '#1e1008', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 20, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase' }}>Hoje</span>}
                          {isSoon && !isT && <span style={{ background: '#fbbf24', color: '#1e1008', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 20, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase' }}>{daysUntil === 1 ? 'Amanhã' : `Em ${daysUntil} dias`}</span>}
                          {dayIsPast && <span style={{ background: '#d1d5db', color: '#6b7280', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase' }}>Passado</span>}
                          <span style={{ fontSize: 10, color: isT ? 'rgba(255,255,255,0.6)' : '#8a7260', fontFamily: 'Arial, sans-serif' }}>{dayComps.length} compromisso{dayComps.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Appointments */}
                      {dayComps.map((c, ci) => {
                        const tipoCfg   = TIPO_COLOR[c.tipo] || TIPO_COLOR['Outro'];
                        const statusCfg = STATUS_LABEL[c.confirmacao_status || 'pendente'];
                        const hora      = format(new Date(c.data_inicio), 'HH:mm');
                        const horaFim   = c.data_fim ? format(new Date(c.data_fim), 'HH:mm') : null;
                        return (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px', borderBottom: ci < dayComps.length - 1 ? '1px solid rgba(232,221,208,0.6)' : 'none', background: ci % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(250,247,242,0.5)' }}>
                            <div style={{ minWidth: 48, textAlign: 'right', flexShrink: 0, paddingTop: 2 }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#1e1008', fontFamily: 'Arial, sans-serif' }}>{hora}</div>
                              {horaFim && <div style={{ fontSize: 9, color: '#8a7260', fontFamily: 'Arial, sans-serif' }}>{horaFim}</div>}
                            </div>
                            <div style={{ width: 3, alignSelf: 'stretch', background: tipoCfg.dot, borderRadius: 2, flexShrink: 0, minHeight: 32 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1008', marginBottom: 4, fontFamily: 'Arial, sans-serif' }}>{c.titulo}</div>
                              {c.descricao && <div style={{ fontSize: 11, color: '#6b3f25', marginBottom: 5, fontFamily: 'Arial, sans-serif', lineHeight: 1.5 }}>{c.descricao}</div>}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: tipoCfg.bg, color: tipoCfg.text, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.tipo}</span>
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${statusCfg.color}18`, color: statusCfg.color, fontFamily: 'Arial, sans-serif' }}>● {statusCfg.text}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* PDF Footer */}
            <div style={{ background: 'linear-gradient(135deg, #1e1008, #3d2010)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(201,148,58,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#c9943a', fontSize: 14, fontWeight: 900 }}>BR</span>
                </div>
                <div>
                  <div style={{ color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>Bentes Ramos</div>
                  <div style={{ color: 'rgba(201,148,58,0.7)', fontSize: 9, fontFamily: 'Arial, sans-serif' }}>Advocacia & Consultoria Jurídica</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'Arial, sans-serif' }}>Documento gerado pelo sistema CRM interno</div>
                <div style={{ color: 'rgba(201,148,58,0.6)', fontSize: 9, fontFamily: 'Arial, sans-serif' }}>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
