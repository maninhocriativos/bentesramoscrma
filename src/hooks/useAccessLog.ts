import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/leads': 'CRM de Leads',
  '/meta-leads': 'Leads API (Meta)',
  '/processos': 'Processos',
  '/tarefas': 'Tarefas',
  '/agenda': 'Agenda',
  '/financeiro': 'Financeiro',
  '/documentos': 'Documentos',
  '/contratos': 'Contratos',
  '/assistente': 'Assistentes IA',
  '/isa-autonoma': 'Isa Autônoma',
  '/chat': 'Chat',
  '/api-hub': 'API Hub',
  '/api-docs': 'API Docs',
  '/configuracoes': 'Configurações',
  '/peticoes': 'Petições',
  '/modelos': 'Modelos',
  '/historico-acessos': 'Histórico de Acessos',
};

export function useAccessLog() {
  const location = useLocation();
  const { user } = useAuth();
  const lastPath = useRef<string>('');

  useEffect(() => {
    if (!user || location.pathname === lastPath.current) return;
    lastPath.current = location.pathname;

    const basePath = '/' + location.pathname.split('/')[1];
    const title = PAGE_TITLES[basePath] || location.pathname;

    supabase.from('access_logs').insert({
      user_id: user.id,
      user_email: user.email,
      user_name: user.user_metadata?.full_name || user.email,
      page_path: location.pathname,
      page_title: title,
    }).then(() => {});
  }, [location.pathname, user]);
}
