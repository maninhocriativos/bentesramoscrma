import { 
  LayoutDashboard, Users, Scale, Settings, CalendarDays, ChevronLeft, 
  DollarSign, FileText, CheckSquare, FileSignature, Bot, MessageSquare, 
  Sparkles, Webhook, Zap, BookOpen, FormInput, History, FileEdit, Gavel, GraduationCap
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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

interface MenuSection {
  label: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    label: 'Principal',
    items: [
      { title: 'Bem-Vindo', url: '/bem-vindo', icon: GraduationCap, visibility: 'all' },
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, visibility: 'dashboard-only' },
      { title: 'CRM de Leads', url: '/leads', icon: Users, visibility: 'leads-only' },
      { title: 'Leads API (Meta)', url: '/meta-leads', icon: FormInput, visibility: 'leads-only' },
      { title: 'Processos', url: '/processos', icon: Scale, visibility: 'processos-only' },
      { title: 'Intimações', url: '/intimacoes', icon: Gavel, visibility: 'processos-only' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { title: 'Tarefas', url: '/tarefas', icon: CheckSquare, visibility: 'all' },
      { title: 'Agenda', url: '/agenda', icon: CalendarDays, visibility: 'all' },
      { title: 'Financeiro', url: '/financeiro', icon: DollarSign, visibility: 'financeiro-only' },
      { title: 'Documentos', url: '/documentos', icon: FileText, visibility: 'all' },
      { title: 'Contratos', url: '/contratos', icon: FileSignature, visibility: 'all' },
      { title: 'Petições Iniciais', url: '/peticoes', icon: FileEdit, visibility: 'all' },
    ],
  },
  {
    label: 'Inteligência',
    items: [
      { title: 'Assistentes IA', url: '/assistente', icon: Bot, visibility: 'all' },
      { title: 'Isa Autônoma', url: '/isa-autonoma', icon: Zap, visibility: 'all' },
      { title: 'Chat', url: '/chat', icon: MessageSquare, visibility: 'all' },
    ],
  },
  {
    label: 'Administração',
    items: [
      { title: 'Histórico de Acessos', url: '/historico-acessos', icon: History, visibility: 'admin-only' },
      { title: 'API Hub', url: '/api-hub', icon: Webhook, visibility: 'admin-only' },
      { title: 'API Docs', url: '/api-docs', icon: BookOpen, visibility: 'admin-only' },
      { title: 'Configurações', url: '/configuracoes', icon: Settings, visibility: 'admin-only' },
    ],
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
    cargo,
    fullName,
  } = usePerfil();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const canShow = (visibility: MenuItemVisibility) => {
    if (visibility === 'admin-only') return canAccessSettings;
    if (visibility === 'processos-only') return canAccessProcessos;
    if (visibility === 'leads-only') return canAccessLeads;
    if (visibility === 'dashboard-only') return canAccessDashboard;
    if (visibility === 'financeiro-only') return canAccessFinanceiro;
    return true;
  };

  return (
    <Sidebar className="border-r-0" collapsible="icon">
      {/* Header with logo */}
      <SidebarHeader className="p-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className={cn(
            "flex items-center gap-2 transition-all duration-300",
            isCollapsed && "opacity-0 w-0 overflow-hidden scale-90"
          )}>
            <img 
              src={logo} 
              alt="Bentes Ramos" 
              className="h-9 w-auto object-contain brightness-0 invert"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 shrink-0 rounded-full"
            onClick={toggleSidebar}
          >
            <ChevronLeft className={cn(
              "h-4 w-4 transition-transform duration-300",
              isCollapsed && "rotate-180"
            )} />
          </Button>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-3 py-1 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-accent/40 scrollbar-track-transparent">
        {menuSections.map((section) => {
          const visibleItems = section.items.filter(item => canShow(item.visibility));
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={section.label} className="py-1">
              <SidebarGroupLabel className={cn(
                "text-[10px] uppercase tracking-widest font-semibold text-sidebar-foreground/30 px-3 mb-0.5",
                isCollapsed && "sr-only"
              )}>
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-px">
                  {visibleItems.map((item) => {
                    const isActive = location.pathname === item.url || 
                      (item.url !== '/dashboard' && location.pathname.startsWith(item.url));
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild
                          tooltip={item.title}
                          className={cn(
                            "rounded-lg transition-all duration-200 h-9 group/item relative",
                            isActive 
                              ? 'bg-primary/15 text-sidebar-foreground font-semibold' 
                              : 'text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
                          )}
                        >
                          <Link to={item.url} className="flex items-center gap-3 px-3">
                            {isActive && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                            )}
                            <item.icon className={cn(
                              "h-[18px] w-[18px] shrink-0 transition-all duration-200",
                              isActive ? 'text-primary' : 'group-hover/item:text-sidebar-foreground'
                            )} />
                            <span className={cn("text-[13px] truncate", isActive && "text-sidebar-foreground")}>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className={cn(
        "p-4 pt-3 transition-all duration-300",
        isCollapsed && "p-2"
      )}>
        <div className={cn(
          "flex items-center gap-2.5 rounded-lg bg-sidebar-accent/30 px-3 py-2.5",
          isCollapsed && "justify-center px-2"
        )}>
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-sidebar-foreground truncate">
                {fullName || 'Usuário'}
              </span>
              <span className="text-[10px] text-primary/80 font-medium">{cargo}</span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
