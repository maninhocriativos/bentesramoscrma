import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePerfil } from "@/contexts/PerfilContext";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";

// Regras padrão por cargo — aplicadas SOMENTE quando não há permissão
// explícita do admin na tabela user_page_permissions.
// Admin pode sobrescrever qualquer regra via Configurações → Usuários.
const ROLE_DEFAULTS: Record<string, (p: ReturnType<typeof usePerfil>) => boolean> = {
  'dashboard':            p => p.canAccessDashboard,
  'dados':                p => p.canAccessDashboard,
  'configuracoes':        p => p.canAccessSettings,
  'historico-acessos':   p => p.canAccessSettings,
  'api-hub':             p => p.canAccessSettings,
  'api-docs':            p => p.canAccessSettings,
  'financeiro':          p => p.canAccessFinanceiro,
  'conferencia-extratos': p => p.canAccessFinanceiro,
  'processos':           p => p.canAccessProcessos,
  'intimacoes':          p => p.canAccessProcessos,
  'leads':               p => p.canAccessLeads,
  'meta-leads':          p => p.canAccessLeads,
};

// Única fonte de verdade para "esse usuário pode acessar essa página": permissão
// explícita (tabela user_page_permissions) tem prioridade; sem ela, cai na regra
// padrão por cargo. Usada tanto para checar a página atual quanto para escolher
// um destino de redirect que não vá bloquear de novo (era o bug: 'dashboard'
// bloqueado sempre mandava pro chat, e outras páginas bloqueadas mandavam pro
// dashboard mesmo quando o dashboard TAMBÉM estava bloqueado — cascata que
// sempre terminava em /chat, dando a impressão de que toda navegação ia pro chat).
function isPageAllowed(perfil: ReturnType<typeof usePerfil>, pageId: string): boolean {
  const explicit = perfil.pagePermissions[pageId];
  if (explicit === true)  return true;
  if (explicit === false) return false;
  const roleDefault = ROLE_DEFAULTS[pageId];
  return roleDefault ? roleDefault(perfil) : true;
}

function defaultRedirect(perfil: ReturnType<typeof usePerfil>, blockedPage: string): string {
  const candidatos = ['dashboard', 'processos', 'leads', 'tarefas'];
  for (const pagina of candidatos) {
    if (pagina !== blockedPage && isPageAllowed(perfil, pagina)) return `/${pagina}`;
  }
  return '/bem-vindo';
}

export default function RequireAuth() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const perfil = usePerfil();

  if (loading || perfil.loading) {
    return <AppLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  const pageId = location.pathname.replace(/^\//, '').split('/')[0];

  if (!isPageAllowed(perfil, pageId)) {
    return <Navigate to={defaultRedirect(perfil, pageId)} replace />;
  }

  return <Outlet />;
}
