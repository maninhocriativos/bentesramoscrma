import { LayoutDashboard, Users, Scale, Settings, CalendarDays, ChevronLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { usePerfil } from '@/hooks/usePerfil';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo-bentes-ramos.png';
import { cn } from '@/lib/utils';

type MenuItemVisibility = 'all' | 'admin-only' | 'processos-only';

interface MenuItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  visibility: MenuItemVisibility;
}

const menuItems: MenuItem[] = [
  { 
    title: 'Dashboard', 
    url: '/dashboard', 
    icon: LayoutDashboard,
    visibility: 'all'
  },
  { 
    title: 'CRM de Leads', 
    url: '/leads', 
    icon: Users,
    visibility: 'all'
  },
  { 
    title: 'Processos', 
    url: '/processos', 
    icon: Scale,
    visibility: 'processos-only'
  },
  { 
    title: 'Agenda', 
    url: '/agenda', 
    icon: CalendarDays,
    visibility: 'all'
  },
  { 
    title: 'Configurações', 
    url: '/configuracoes', 
    icon: Settings,
    visibility: 'admin-only'
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { canAccessSettings, canAccessProcessos, cargo } = usePerfil();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const filteredItems = menuItems.filter(item => {
    if (item.visibility === 'admin-only' && !canAccessSettings) {
      return false;
    }
    if (item.visibility === 'processos-only' && !canAccessProcessos) {
      return false;
    }
    return true;
  });

  return (
    <Sidebar 
      className="border-r-0"
      collapsible="icon"
    >
      <SidebarHeader className="p-3 border-b border-sidebar-border">
        <div className="flex items-center justify-between gap-2">
          <div className={cn(
            "flex items-center gap-2 transition-opacity",
            isCollapsed && "opacity-0 w-0 overflow-hidden"
          )}>
            <img 
              src={logo} 
              alt="Bentes Ramos" 
              className="h-8 w-auto object-contain brightness-0 invert"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
            onClick={toggleSidebar}
          >
            <ChevronLeft className={cn(
              "h-4 w-4 transition-transform",
              isCollapsed && "rotate-180"
            )} />
          </Button>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {filteredItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      tooltip={item.title}
                      className={cn(
                        "rounded-lg transition-all duration-150 h-10",
                        isActive 
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm' 
                          : 'hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground'
                      )}
                    >
                      <Link to={item.url} className="flex items-center gap-3 px-3">
                        <item.icon className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          isActive && 'text-sidebar-primary-foreground'
                        )} />
                        <span className="text-sm truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn(
        "p-3 border-t border-sidebar-border transition-opacity",
        isCollapsed && "opacity-0"
      )}>
        <div className="text-xs text-sidebar-foreground/50">
          <span className="text-sidebar-primary font-medium">{cargo}</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
