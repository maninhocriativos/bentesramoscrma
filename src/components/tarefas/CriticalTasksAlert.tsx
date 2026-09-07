import { AlertTriangle, Flame, ChevronRight } from 'lucide-react';
import { differenceInCalendarDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useCriticalTasksAlert } from '@/hooks/useCriticalTasksAlert';
import { useNavigate } from 'react-router-dom';

/**
 * Popup de prazo crítico — montado globalmente (AppLayout + ChatPage) pra
 * aparecer em qualquer tela do sistema, não só na página de Tarefas.
 * Clicar numa tarefa navega pra /tarefas (não há como abrir o detalhe fora
 * dessa página sem duplicar o TarefaDetailModal em todo lugar).
 */
export function CriticalTasksAlert() {
  const { criticalTasks, popupOpen, setPopupOpen } = useCriticalTasksAlert();
  const navigate = useNavigate();

  if (criticalTasks.length === 0) return null;

  const overdueCount = criticalTasks.filter(t => differenceInCalendarDays(new Date(t.prazo_fatal || t.data_limite || ''), new Date()) < 0).length;

  return (
    <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
      <DialogContent
        hideCloseButton
        className="p-0 overflow-hidden gap-0"
        style={{
          width: 'calc(100vw - 32px)',
          maxWidth: 460,
          borderRadius: 20,
          border: '1px solid rgba(220,38,38,0.35)',
          boxShadow: '0 32px 80px rgba(220,38,38,0.18), 0 8px 24px rgba(0,0,0,0.20)',
        }}
      >
        <div style={{ height: 4, background: 'linear-gradient(90deg, #7f1d1d, #dc2626, #ef4444)' }} />

        <div className="px-6 pt-5 pb-4" style={{ background: 'linear-gradient(160deg, #1c0606 0%, #3b0d0d 100%)' }}>
          <div className="flex items-start gap-4">
            <div className="relative shrink-0 mt-0.5">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.20)', border: '1px solid rgba(220,38,38,0.40)' }}>
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-[#1c0606] animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-400/80 mb-0.5">Atenção urgente</p>
              <h2 className="text-lg font-black text-white leading-tight">
                {criticalTasks.length} tarefa{criticalTasks.length !== 1 ? 's' : ''} com prazo crítico
              </h2>
              <p className="text-[12px] text-red-200/60 mt-1 leading-snug">
                {overdueCount > 0
                  ? `${overdueCount} já vencida${overdueCount !== 1 ? 's' : ''} — ação imediata necessária`
                  : 'Prazos fatais próximos — revise e aja agora'}
              </p>
            </div>
            <button
              onClick={() => setPopupOpen(false)}
              className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:opacity-70 shrink-0"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <span className="text-white/60 text-sm leading-none">✕</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-3 space-y-2 max-h-[340px] overflow-y-auto" style={{ background: '#fff' }}>
          {criticalTasks.map((tarefa) => {
            const deadline = tarefa.prazo_fatal || tarefa.data_limite;
            const days = deadline ? differenceInCalendarDays(new Date(deadline), new Date()) : null;
            const isOverdue = days !== null && days < 0;
            const isToday0 = days === 0;
            const overdueDays = isOverdue ? Math.abs(days!) : 0;
            const intensity = isOverdue
              ? overdueDays >= 30 ? 'extreme' : overdueDays >= 7 ? 'high' : 'medium'
              : isToday0 ? 'today' : 'upcoming';
            const badgeStyle: Record<string, React.CSSProperties> = {
              extreme: { background: '#7f1d1d', color: '#fca5a5' },
              high: { background: '#991b1b', color: '#fca5a5' },
              medium: { background: '#dc2626', color: '#fff' },
              today: { background: '#ea580c', color: '#fff' },
              upcoming: { background: '#b45309', color: '#fff' },
            };
            const rowBorder: Record<string, string> = {
              extreme: 'rgba(127,29,29,0.50)',
              high: 'rgba(153,27,27,0.40)',
              medium: 'rgba(220,38,38,0.30)',
              today: 'rgba(234,88,12,0.30)',
              upcoming: 'rgba(180,83,9,0.25)',
            };
            const rowBg: Record<string, string> = {
              extreme: 'rgba(127,29,29,0.06)',
              high: 'rgba(153,27,27,0.05)',
              medium: 'rgba(220,38,38,0.04)',
              today: 'rgba(234,88,12,0.04)',
              upcoming: 'rgba(180,83,9,0.04)',
            };
            return (
              <button
                key={tarefa.id}
                className="w-full text-left rounded-xl p-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  border: `1px solid ${rowBorder[intensity]}`,
                  background: rowBg[intensity],
                  borderLeftWidth: 3,
                  borderLeftColor: isOverdue ? '#dc2626' : isToday0 ? '#ea580c' : '#b45309',
                }}
                onClick={() => { setPopupOpen(false); navigate('/tarefas'); }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isOverdue && <Flame className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                      {isToday0 && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                      <p className="text-sm font-bold text-gray-900 truncate">{tarefa.titulo}</p>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Prazo fatal: {deadline ? format(new Date(deadline), "dd/MM/yyyy", { locale: ptBR }) : 'sem prazo'}
                      {tarefa.horario ? ` às ${tarefa.horario.slice(0, 5)}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-black whitespace-nowrap"
                      style={badgeStyle[intensity]}
                    >
                      {isOverdue ? `${overdueDays}d atraso` : isToday0 ? 'HOJE' : `${days}d`}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 pb-4 pt-2 flex gap-2" style={{ background: '#fff', borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
          <button
            onClick={() => setPopupOpen(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-80"
            style={{ background: 'rgba(0,0,0,0.06)', color: '#374151' }}
          >
            Ver depois
          </button>
          <button
            onClick={() => { setPopupOpen(false); navigate('/tarefas'); }}
            className="flex-[2] py-2.5 rounded-xl text-sm font-black transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #991b1b, #dc2626)', color: '#fff' }}
          >
            Entendido — Vou resolver
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
