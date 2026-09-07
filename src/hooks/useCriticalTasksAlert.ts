import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tarefa, ehResponsavel } from '@/types/tarefas';

/**
 * Alerta de prazo crítico das tarefas do usuário logado — usado GLOBALMENTE
 * (montado uma vez no layout, não só na página de Tarefas), pra que apareça
 * em qualquer tela do sistema, inclusive no /chat (WhatsApp), que fica fora
 * do AppLayoutRoute compartilhado.
 *
 * Busca só as tarefas onde o usuário é responsável (não a tabela inteira —
 * isso fica pequeno por usuário, ao contrário do useTarefas() da página, que
 * pagina a tabela toda) e refaz a busca quando alguma tarefa relevante muda
 * via realtime.
 */
export function useCriticalTasksAlert() {
  const { user } = useAuth();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);

  const fetchMinhasTarefas = useCallback(async () => {
    if (!user?.id) { setTarefas([]); return; }
    const { data } = await supabase
      .from('tarefas')
      .select('*')
      .not('status', 'in', '("Concluída","Cancelada")')
      .or(`responsavel_id.eq.${user.id},responsaveis_ids.cs.{${user.id}}`);
    setTarefas((data || []) as Tarefa[]);
  }, [user?.id]);

  useEffect(() => { fetchMinhasTarefas(); }, [fetchMinhasTarefas]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`critical-tasks-alert-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas' }, () => {
        // Qualquer INSERT/UPDATE/DELETE em tarefas pode ter mudado a lista de
        // responsáveis ou o prazo — refetch simples é barato (resultado é
        // pequeno, por usuário) e evita reimplementar o filtro OR client-side
        // pra cada tipo de payload de realtime.
        fetchMinhasTarefas();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchMinhasTarefas]);

  const criticalTasks = useMemo(() => {
    if (!user) return [];
    return tarefas
      .filter(t => ehResponsavel(t, user.id))
      .filter(t => {
        const deadline = t.prazo_fatal || t.data_limite;
        if (!deadline) return false;
        return differenceInCalendarDays(new Date(deadline), new Date()) <= 3;
      })
      .sort((a, b) => new Date(a.prazo_fatal || a.data_limite || '').getTime() - new Date(b.prazo_fatal || b.data_limite || '').getTime())
      .slice(0, 5);
  }, [tarefas, user]);

  const [popupOpen, setPopupOpen] = useState(false);
  const shownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const newOnes = criticalTasks.filter(t => !shownIdsRef.current.has(t.id));
    if (newOnes.length > 0) {
      newOnes.forEach(t => shownIdsRef.current.add(t.id));
      setPopupOpen(true);
    }
  }, [criticalTasks]);

  return { criticalTasks, popupOpen, setPopupOpen };
}
