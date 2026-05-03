import { useState, useRef, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, isSameMonth, isToday, isPast, isFuture, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, FileText, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { Compromisso } from '@/types/compromissos';

interface Props {
  onClose: () => void;
  compromissos: Compromisso[];
}

const TIPO_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  'Audiência': { bg: '#fce7f3', text: '#be185d', dot: '#db2777' },
  'Reunião':   { bg: '#fef3c7', text: '#92400e', dot: '#d97706' },
  'Prazo':     { bg: '#fef9c3', text: '#713f12', dot: '#ca8a04' },
  'Tarefa':    { bg: '#dcfce7', text: '#14532d', dot: '#16a34a' },
  'Intimação': { bg: '#f1f5f9', text: '#475569', dot: '#64748b' },
  'Outro':     { bg: '#f1f5f9', text: '#475569', dot: '#64748b' },
};

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  pendente:   { text: 'Pendente',   color: '#d97706' },
  confirmado: { text: 'Confirmado', color: '#16a34a' },
  cancelado:  { text: 'Cancelado',  color: '#dc2626' },
  remarcado:  { text: 'Remarcado',  color: '#2563eb' },
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function AgendaPDFModal({ onClose, compromissos }: Props) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [generating, setGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const monthStart = startOfMonth(new Date(year, month, 1));
  const monthEnd   = endOfMonth(new Date(year, month, 1));

  const monthCompromissos = compromissos
    .filter(c => {
      const d = new Date(c.data_inicio);
      return d >= monthStart && d <= monthEnd;
    })
    .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());

  // Group by day
  const byDay: Record<string, Compromisso[]> = {};
  for (const c of monthCompromissos) {
    const key = format(new Date(c.data_inicio), 'yyyy-MM-dd');
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(c);
  }
  const days = Object.keys(byDay).sort();

  const stats = {
    total: monthCompromissos.length,
    audiencias: monthCompromissos.filter(c => c.tipo === 'Audiência').length,
    reunioes: monthCompromissos.filter(c => c.tipo === 'Reunião').length,
    pendentes: monthCompromissos.filter(c => (c.confirmacao_status || 'pendente') === 'pendente').length,
    confirmados: monthCompromissos.filter(c => c.confirmacao_status === 'confirmado').length,
  };

  const handleGeneratePDF = useCallback(async () => {
    if (!printRef.current) return;
    setGenerating(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData  = canvas.toDataURL('image/png');
      const pageW    = 210;
      const pageH    = 297;
      const imgW     = pageW;
      const imgH     = (canvas.height * pageW) / canvas.width;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let posY = 0;
      let remaining = imgH;

      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 0, -posY, imgW, imgH);
        remaining -= pageH;
        posY += pageH;
        if (remaining > 0) pdf.addPage();
      }

      const fileName = `agenda-${format(new Date(year, month, 1), 'MMMM-yyyy', { locale: ptBR })}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }, [year, month]);

  const monthLabel = format(new Date(year, month, 1), "MMMM 'de' yyyy", { locale: ptBR });
  const monthLabelUpper = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,10,0,0.7)',
        zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '20px 12px', overflow: 'auto', backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#faf7f2', borderRadius: 20, width: '100%', maxWidth: 820,
          boxShadow: '0 40px 100px rgba(20,10,0,0.45)', overflow: 'hidden',
        }}
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

        {/* Month selector + generate button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', background: '#fff', borderBottom: '1px solid #e8ddd0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e8ddd0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b3f25' }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#1e1008', minWidth: 200, textAlign: 'center' }}>{monthLabelUpper}</span>
            <button onClick={nextMonth} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e8ddd0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b3f25' }}>
              <ChevronRight size={14} />
            </button>
          </div>
          <button
            onClick={handleGeneratePDF}
            disabled={generating || monthCompromissos.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px',
              borderRadius: 10, border: 'none', cursor: generating || monthCompromissos.length === 0 ? 'not-allowed' : 'pointer',
              background: generating || monthCompromissos.length === 0 ? '#e8ddd0' : 'linear-gradient(135deg, #1e1008, #3d2010)',
              color: generating || monthCompromissos.length === 0 ? '#8a7260' : '#c9943a',
              fontWeight: 800, fontSize: 13,
            }}
          >
            {generating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
            {generating ? 'Gerando...' : `Baixar PDF (${monthCompromissos.length} compromisso${monthCompromissos.length !== 1 ? 's' : ''})`}
          </button>
        </div>

        {/* Printable content — preview */}
        <div style={{ maxHeight: '65vh', overflowY: 'auto', padding: '16px' }}>
          <div ref={printRef} style={{ background: '#ffffff', fontFamily: "'Georgia', 'Times New Roman', serif", width: '100%' }}>

            {/* PDF Header */}
            <div style={{ background: 'linear-gradient(135deg, #1e1008 0%, #3d2010 60%, #6b3f25 100%)', padding: '32px 40px 24px', position: 'relative', overflow: 'hidden' }}>
              {/* Decorative circle */}
              <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(201,148,58,0.08)' }} />
              <div style={{ position: 'absolute', bottom: -20, left: 20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(201,148,58,0.05)' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                <div>
                  <div style={{ color: '#c9943a', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'Arial, sans-serif' }}>ESCRITÓRIO DE ADVOCACIA</div>
                  <div style={{ color: '#ffffff', fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 2 }}>Bentes Ramos</div>
                  <div style={{ color: 'rgba(201,148,58,0.8)', fontSize: 13, fontFamily: 'Arial, sans-serif' }}>Advocacia & Consultoria Jurídica</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Relatório de Agenda</div>
                  <div style={{ color: '#c9943a', fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>{monthLabelUpper}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'Arial, sans-serif', marginTop: 4 }}>
                    Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>
              </div>

              {/* Gold divider */}
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #c9943a, transparent)', marginTop: 24 }} />
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1px solid #e8ddd0' }}>
              {[
                { label: 'Total',        value: stats.total,       color: '#1e1008', accent: '#c9943a' },
                { label: 'Audiências',   value: stats.audiencias,  color: '#be185d', accent: '#fce7f3' },
                { label: 'Confirmados',  value: stats.confirmados, color: '#14532d', accent: '#dcfce7' },
                { label: 'Pendentes',    value: stats.pendentes,   color: '#92400e', accent: '#fef3c7' },
              ].map((s, i) => (
                <div key={s.label} style={{
                  padding: '18px 20px', borderRight: i < 3 ? '1px solid #e8ddd0' : 'none',
                  background: '#ffffff',
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#8a7260', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Arial, sans-serif', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: s.color, letterSpacing: '-0.04em', lineHeight: 1 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Content */}
            {days.length === 0 ? (
              <div style={{ padding: '60px 40px', textAlign: 'center', color: '#8a7260', fontFamily: 'Arial, sans-serif' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1e1008', marginBottom: 8 }}>Nenhum compromisso</div>
                <div style={{ fontSize: 13 }}>Não há compromissos agendados para {monthLabel}.</div>
              </div>
            ) : (
              <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {days.map((dayKey, di) => {
                  const dayDate = new Date(dayKey + 'T00:00:00');
                  const dayComps = byDay[dayKey];
                  const isT = isToday(dayDate);
                  const dayIsPast = isPast(dayDate) && !isT;
                  const daysUntil = differenceInDays(dayDate, today);
                  const isSoon = daysUntil >= 0 && daysUntil <= 3;

                  const dayBg = isT ? '#fdf3e3' : isSoon ? '#fffbeb' : dayIsPast ? '#fafaf9' : '#ffffff';
                  const dayBorder = isT ? '#c9943a' : isSoon ? '#fbbf24' : '#e8ddd0';

                  return (
                    <div key={dayKey} style={{
                      marginBottom: di < days.length - 1 ? 12 : 0,
                      border: `1.5px solid ${dayBorder}`,
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: dayBg,
                      opacity: dayIsPast ? 0.75 : 1,
                    }}>
                      {/* Day header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px',
                        background: isT ? 'linear-gradient(135deg, #1e1008, #3d2010)' : isSoon ? '#fffbeb' : '#f8f5f0',
                        borderBottom: `1px solid ${dayBorder}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 9,
                            background: isT ? '#c9943a' : isSoon ? '#fbbf24' : dayIsPast ? '#d1d5db' : '#e8ddd0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, fontWeight: 900,
                            color: isT || isSoon ? '#1e1008' : dayIsPast ? '#6b7280' : '#1e1008',
                            fontFamily: 'Arial, sans-serif',
                          }}>
                            {format(dayDate, 'd')}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: isT ? '#ffffff' : '#1e1008', fontFamily: 'Arial, sans-serif', textTransform: 'capitalize' }}>
                              {format(dayDate, "EEEE", { locale: ptBR })}
                            </div>
                            <div style={{ fontSize: 10, color: isT ? '#c9943a' : '#8a7260', fontFamily: 'Arial, sans-serif' }}>
                              {format(dayDate, "dd 'de' MMMM", { locale: ptBR })}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isT && (
                            <span style={{ background: '#c9943a', color: '#1e1008', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 20, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hoje</span>
                          )}
                          {isSoon && !isT && (
                            <span style={{ background: '#fbbf24', color: '#1e1008', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 20, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `Em ${daysUntil} dias`}
                            </span>
                          )}
                          {dayIsPast && (
                            <span style={{ background: '#d1d5db', color: '#6b7280', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Passado</span>
                          )}
                          <span style={{ fontSize: 10, color: isT ? 'rgba(255,255,255,0.6)' : '#8a7260', fontFamily: 'Arial, sans-serif' }}>
                            {dayComps.length} compromisso{dayComps.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Appointments */}
                      {dayComps.map((c, ci) => {
                        const tipoCfg = TIPO_COLOR[c.tipo] || TIPO_COLOR['Outro'];
                        const statusCfg = STATUS_LABEL[c.confirmacao_status || 'pendente'];
                        const hora = format(new Date(c.data_inicio), 'HH:mm');
                        const horaFim = c.data_fim ? format(new Date(c.data_fim), 'HH:mm') : null;

                        return (
                          <div key={c.id} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 12,
                            padding: '10px 16px',
                            borderBottom: ci < dayComps.length - 1 ? '1px solid rgba(232,221,208,0.6)' : 'none',
                            background: ci % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(250,247,242,0.5)',
                          }}>
                            {/* Time */}
                            <div style={{ minWidth: 48, textAlign: 'right', flexShrink: 0, paddingTop: 2 }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#1e1008', fontFamily: 'Arial, sans-serif' }}>{hora}</div>
                              {horaFim && <div style={{ fontSize: 9, color: '#8a7260', fontFamily: 'Arial, sans-serif' }}>{horaFim}</div>}
                            </div>

                            {/* Divider */}
                            <div style={{ width: 3, alignSelf: 'stretch', background: tipoCfg.dot, borderRadius: 2, flexShrink: 0, minHeight: 32 }} />

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1008', marginBottom: 4, fontFamily: 'Arial, sans-serif' }}>{c.titulo}</div>
                              {c.descricao && (
                                <div style={{ fontSize: 11, color: '#6b3f25', marginBottom: 5, fontFamily: 'Arial, sans-serif', lineHeight: 1.5 }}>{c.descricao}</div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: tipoCfg.bg, color: tipoCfg.text, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.tipo}</span>
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${statusCfg.color}15`, color: statusCfg.color, fontFamily: 'Arial, sans-serif' }}>● {statusCfg.text}</span>
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
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'Arial, sans-serif' }}>
                  Documento gerado pelo sistema CRM interno
                </div>
                <div style={{ color: 'rgba(201,148,58,0.6)', fontSize: 9, fontFamily: 'Arial, sans-serif' }}>
                  {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
