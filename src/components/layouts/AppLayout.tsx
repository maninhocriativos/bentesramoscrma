import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { PageTransition } from '@/components/layouts/PageTransition';
import { ChatInterno } from '@/components/tarefas/ChatInterno';

import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { useAccessLog } from '@/hooks/useAccessLog';
import { Loader2 } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: perfilLoading, needsOnboarding } = usePerfil();
  useAccessLog();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || perfilLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
          {/* Mobile trigger removed - AppHeader handles SidebarTrigger on mobile */}
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>
      
      {needsOnboarding && <OnboardingModal />}
      <ChatInterno />
    </SidebarProvider>
  );
}
