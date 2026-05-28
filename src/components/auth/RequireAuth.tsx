import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePerfil } from "@/contexts/PerfilContext";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";

// Regras padrão por cargo — aplicadas SOMENTE quando não há permissão
// explícita do admin na tabela user_page_permissions.
// Admin pode sobrescrever qualquer regra via Configurações → Usuários.
const ROLE_DEFAULTS: Record<string, (p: ReturnType<typeof usePerfil>) => boolean> = {
  'dashboard':            p => p.canAccessDashboard,
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

function defaultRedirect(perfil: ReturnType<typeof usePerfil>, blockedPage: string): string {
  if (blockedPage === 'dashboard') return '/chat';
  if (blockedPage === 'chat')      return '/bem-vindo';
  return perfil.canAccessDashboard ? '/dashboard' : '/chat';
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

  // Se o admin definiu explicitamente esta página como true para este usuário,
  // ignora as regras de cargo e permite o acesso.
  const explicitPermission = perfil.pagePermissions[pageId];
  if (explicitPermission === true) {
    return <Outlet />;
  }

  // Se o admin bloqueou explicitamente → bloqueia
  if (explicitPermission === false) {
    return <Navigate to={defaultRedirect(perfil, pageId)} replace />;
  }

  // Sem permissão explícita: aplica regra padrão por cargo
  const roleDefault = ROLE_DEFAULTS[pageId];
  if (roleDefault && !roleDefault(perfil)) {
    return <Navigate to={defaultRedirect(perfil, pageId)} replace />;
  }

  return <Outlet />;
}
