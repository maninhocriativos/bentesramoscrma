import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Scale, Users, MessageSquare, Gavel, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { usePerfil } from '@/hooks/usePerfil';
import { cn } from '@/lib/utils';

interface TabDef {
  key: string;
  label: string;
  icon: LucideIcon;
  url: string;
}

interface MobileTabBarProps {
  onOpenMore: () => void;
}

export function MobileTabBar({ onOpenMore }: MobileTabBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccessProcessos, canAccessLeads, canAccessDashboard } = usePerfil();

  const tabs = useMemo<TabDef[]>(() => {
    const list: TabDef[] = [
      { key: 'inicio', label: 'Início', icon: Home, url: canAccessDashboard ? '/dashboard' : '/bem-vindo' },
    ];
    if (canAccessProcessos) list.push({ key: 'processos', label: 'Processos', icon: Scale, url: '/processos' });
    if (canAccessLeads) list.push({ key: 'leads', label: 'Leads', icon: Users, url: '/leads' });
    list.push({ key: 'chat', label: 'Chat', icon: MessageSquare, url: '/chat' });
    if (canAccessProcessos) list.push({ key: 'intimacoes', label: 'Alertas', icon: Gavel, url: '/intimacoes' });
    return list;
  }, [canAccessProcessos, canAccessLeads, canAccessDashboard]);

  const isActive = (url: string) =>
    location.pathname === url || (url !== '/dashboard' && url !== '/bem-vindo' && location.pathname.startsWith(url));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const active = isActive(tab.url);
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.url)}
              className="relative flex flex-col items-center justify-center gap-1 px-1"
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-[3px] rounded-full bg-primary" />
              )}
              <tab.icon
                className={cn('h-[22px] w-[22px]', active ? 'text-primary' : 'text-muted-foreground')}
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span className={cn('text-[9.5px] leading-none', active ? 'font-bold text-primary' : 'font-medium text-muted-foreground')}>
                {tab.label}
              </span>
            </button>
          );
        })}
        <button onClick={onOpenMore} className="flex flex-col items-center justify-center gap-1 px-1">
          <MoreHorizontal className="h-[22px] w-[22px] text-muted-foreground" strokeWidth={1.8} />
          <span className="text-[9.5px] leading-none font-medium text-muted-foreground">Mais</span>
        </button>
      </div>
    </nav>
  );
}
