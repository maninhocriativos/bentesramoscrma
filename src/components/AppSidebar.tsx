import { LayoutDashboard, Users, Scale, Settings, CalendarDays, ChevronLeft, DollarSign, FileText, CheckSquare, FileSignature, Bot, MessageSquare, Sparkles, Webhook, Zap, BookOpen } from 'lucide-react';
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

type MenuItemVisibility = 'all' | 'admin-only' | 'processos-only' | 'leads-only' | 'dashboard-only' | 'financeiro-only';

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
    visibility: 'dashboard-only'
  },
  { 
    title: 'CRM de Leads', 
    url: '/leads', 
    icon: Users,
    visibility: 'leads-only'
  },
  { 
    title: 'Processos', 
    url: '/processos', 
    icon: Scale,
    visibility: 'processos-only'
  },
  { 
    title: 'Tarefas', 
    url: '/tarefas', 
    icon: CheckSquare,
    visibility: 'all'
  },
  { 
    title: 'Agenda', 
    url: '/agenda', 
    icon: CalendarDays,
    visibility: 'all'
  },
  { 
    title: 'Financeiro', 
    url: '/financeiro', 
    icon: DollarSign,
    visibility: 'financeiro-only'
  },
  { 
    title: 'Documentos', 
    url: '/documentos', 
    icon: FileText,
    visibility: 'all'
  },
  { 
    title: 'Contratos', 
    url: '/contratos', 
    icon: FileSignature,
    visibility: 'all'
  },
  { 
    title: 'Assistentes IA', 
    url: '/assistente', 
    icon: Bot,
    visibility: 'all'
  },
  { 
    title: 'Isa Autônoma', 
    url: '/isa-autonoma', 
    icon: Zap,
    visibility: 'all'
  },
  { 
    title: 'Chat', 
    url: '/chat', 
    icon: MessageSquare,
    visibility: 'all'
  },
  { 
    title: 'API Hub', 
    url: '/api-hub', 
    icon: Webhook,
    visibility: 'admin-only'
  },
  { 
    title: 'API Docs', 
    url: '/api-docs', 
    icon: BookOpen,
    visibility: 'admin-only'
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
  const { 
    canAccessSettings, 
    canAccessProcessos, 
    canAccessLeads, 
    canAccessDashboard, 
    canAccessFinanceiro,
    cargo 
  } = usePerfil();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const filteredItems = menuItems.filter(item => {
    if (item.visibility === 'admin-only' && !canAccessSettings) {
      return false;
    }
    if (item.visibility === 'processos-only' && !canAccessProcessos) {
      return false;
    }
    if (item.visibility === 'leads-only' && !canAccessLeads) {
      return false;
    }
    if (item.visibility === 'dashboard-only' && !canAccessDashboard) {
      return false;
    }
    if (item.visibility === 'financeiro-only' && !canAccessFinanceiro) {
      return false;
    }
    return true;
  });

  return (
    <Sidebar 
      className="border-r-0"
      collapsible="icon"
    >
      <SidebarHeader className="p-3 border-b border-sidebar-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className={cn(
            "flex items-center gap-2 transition-all duration-300",
            isCollapsed && "opacity-0 w-0 overflow-hidden scale-90"
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
            className={cn(
              "h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground",
              "hover:bg-sidebar-accent/80 shrink-0 rounded-lg",
              "transition-all duration-200 hover:scale-105"
            )}
            onClick={toggleSidebar}
          >
            <ChevronLeft className={cn(
              "h-4 w-4 transition-transform duration-300",
              isCollapsed && "rotate-180"
            )} />
          </Button>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2 py-3 overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {filteredItems.map((item, index) => {
                const isActive = location.pathname === item.url || 
                  (item.url !== '/dashboard' && location.pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem 
                    key={item.title}
                    style={{ animationDelay: `${index * 30}ms` }}
                    className="animate-fade-in"
                  >
                    <SidebarMenuButton 
                      asChild
                      tooltip={item.title}
                      className={cn(
                        "rounded-lg transition-all duration-200 h-9 group/item",
                        "relative overflow-hidden",
                        isActive 
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm' 
                          : 'hover:bg-sidebar-accent/80 text-sidebar-foreground/80 hover:text-sidebar-foreground'
                      )}
                    >
                      <Link to={item.url} className="flex items-center gap-3 px-3">
                        {/* Active indicator */}
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-sidebar-primary-foreground rounded-r-full" />
                        )}
                        
                        <item.icon className={cn(
                          "h-4 w-4 shrink-0 transition-all duration-200",
                          isActive && 'text-sidebar-primary-foreground',
                          !isActive && 'group-hover/item:scale-110'
                        )} />
                        
                        <span className="text-[13px] truncate">{item.title}</span>
                        
                        {/* Hover glow effect */}
                        {!isActive && (
                          <span className="absolute inset-0 bg-gradient-to-r from-sidebar-primary/0 via-sidebar-primary/5 to-sidebar-primary/0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300" />
                        )}
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
        "p-3 border-t border-sidebar-border/50 transition-all duration-300",
        isCollapsed && "opacity-0 scale-90"
      )}>
        <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60">
          <Sparkles className="h-3 w-3 text-sidebar-primary animate-pulse-subtle" />
          <span className="text-sidebar-primary font-medium">{cargo}</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
