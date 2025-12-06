import { LayoutDashboard, Users, Scale, Settings } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
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
} from '@/components/ui/sidebar';
import { usePerfil } from '@/hooks/usePerfil';
import logo from '@/assets/logo-bentes-ramos.png';

const menuItems = [
  { 
    title: 'Dashboard', 
    url: '/dashboard', 
    icon: LayoutDashboard,
    requiredRole: null // Everyone can access
  },
  { 
    title: 'CRM de Leads', 
    url: '/leads', 
    icon: Users,
    requiredRole: null // Everyone can access
  },
  { 
    title: 'Processos', 
    url: '/processos', 
    icon: Scale,
    requiredRole: null // Everyone can access
  },
  { 
    title: 'Configurações', 
    url: '/configuracoes', 
    icon: Settings,
    requiredRole: 'Administrador' as const // Admin only
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { canAccessSettings, cargo } = usePerfil();

  const filteredItems = menuItems.filter(item => {
    if (item.requiredRole === 'Administrador' && !canAccessSettings) {
      return false;
    }
    return true;
  });

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img 
            src={logo} 
            alt="Bentes Ramos" 
            className="h-10 w-auto object-contain brightness-0 invert"
          />
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider mb-2">
            Módulos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      className={`
                        rounded-xl transition-all duration-200
                        ${isActive 
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
                          : 'hover:bg-sidebar-accent text-sidebar-foreground'
                        }
                      `}
                    >
                      <NavLink to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                        <item.icon className="h-5 w-5" />
                        <span className="font-medium">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/60">
          Cargo: <span className="text-sidebar-primary font-medium">{cargo}</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
