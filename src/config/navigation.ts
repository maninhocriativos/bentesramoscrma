import {
  LayoutDashboard, Users, Scale, Settings, CalendarDays,
  DollarSign, FileText, CheckSquare, FileSignature, Bot, MessageSquare,
  Webhook, Zap, BookOpen, FormInput, History, FileEdit, Gavel, GraduationCap, Calculator, TrendingUp, BarChart3, UserRoundCog,
} from 'lucide-react';

export type MenuItemVisibility = 'all' | 'admin-only' | 'processos-only' | 'leads-only' | 'dashboard-only' | 'financeiro-only';

export interface MenuItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  visibility: MenuItemVisibility;
}

export interface MenuSection {
  label: string;
  items: MenuItem[];
}

// Fonte única do menu de navegação — consumida pela sidebar (desktop) e pela
// tab bar / sheet "Mais" (mobile), pra não ter duas listas de páginas divergindo.
export const menuSections: MenuSection[] = [
  {
    label: 'Principal',
    items: [
      { title: 'Bem-Vindo', url: '/bem-vindo', icon: GraduationCap, visibility: 'all' },
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, visibility: 'dashboard-only' },
      { title: 'Dados', url: '/dados', icon: BarChart3, visibility: 'dashboard-only' },
      { title: 'Leads', url: '/leads', icon: Users, visibility: 'leads-only' },
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
      { title: 'Follow-up', url: '/followup', icon: TrendingUp, visibility: 'all' },
      { title: 'Conferência de Extratos', url: '/conferencia-extratos', icon: Calculator, visibility: 'all' },
      { title: 'Chat', url: '/chat', icon: MessageSquare, visibility: 'all' },
    ],
  },
  {
    label: 'Administração',
    items: [
      { title: 'Histórico de Acessos', url: '/historico-acessos', icon: History, visibility: 'admin-only' },
      { title: 'Histórico de Atendimento', url: '/historico-atendimento', icon: UserRoundCog, visibility: 'admin-only' },
      { title: 'API Hub', url: '/api-hub', icon: Webhook, visibility: 'admin-only' },
      { title: 'API Docs', url: '/api-docs', icon: BookOpen, visibility: 'admin-only' },
      { title: 'Configurações', url: '/configuracoes', icon: Settings, visibility: 'admin-only' },
    ],
  },
];

export interface NavVisibilityFlags {
  canAccessSettings: boolean;
  canAccessProcessos: boolean;
  canAccessLeads: boolean;
  canAccessDashboard: boolean;
  canAccessFinanceiro: boolean;
  canAccessPage: (pageId: string) => boolean;
  pagePermissions: Record<string, boolean>;
}

export function canShowMenuItem(flags: NavVisibilityFlags, visibility: MenuItemVisibility, url: string): boolean {
  const pageId = url.replace(/^\//, '');
  const explicit = flags.pagePermissions[pageId];

  // Permissão explícita do admin tem prioridade absoluta
  if (explicit === true)  return true;
  if (explicit === false) return false;

  // Sem permissão explícita: aplica regra padrão por cargo
  if (!flags.canAccessPage(pageId)) return false;
  if (visibility === 'admin-only')      return flags.canAccessSettings;
  if (visibility === 'processos-only')  return flags.canAccessProcessos;
  if (visibility === 'leads-only')      return flags.canAccessLeads;
  if (visibility === 'dashboard-only')  return flags.canAccessDashboard;
  if (visibility === 'financeiro-only') return flags.canAccessFinanceiro;
  return true;
}
