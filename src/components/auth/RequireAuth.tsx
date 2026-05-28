import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePerfil } from "@/contexts/PerfilContext";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";

// Regras baseadas em cargo — espelham exatamente o AppSidebar
const ROLE_RULES: Record<string, (p: ReturnType<typeof usePerfil>) => boolean> = {
  // dashboard bloqueado para Estagiários — redirect vai para /chat (ver abaixo)
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

// Rota padrão por cargo quando uma página está bloqueada.
// Estagiários vão para /chat (não têm dashboard).
// Demais vão para /dashboard.
function defaultRedirect(perfil: ReturnType<typeof usePerfil>): string {
  return perfil.isEstagiario ? '/chat' : '/dashboard';
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

  // Extrai o pageId da rota atual (ex: /financeiro/detalhe → "financeiro")
  const pageId = location.pathname.replace(/^\//, '').split('/')[0];

  // 1. Checa regra de cargo (admin-only, financeiro-only, etc.)
  const roleRule = ROLE_RULES[pageId];
  if (roleRule && !roleRule(perfil)) {
    return <Navigate to={defaultRedirect(perfil)} replace />;
  }

  // 2. Checa permissão individual por página (tabela user_page_permissions)
  if (pageId && !perfil.canAccessPage(pageId)) {
    return <Navigate to={defaultRedirect(perfil)} replace />;
  }

  return <Outlet />;
}
