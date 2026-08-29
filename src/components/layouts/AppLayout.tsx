import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { PageTransition } from '@/components/layouts/PageTransition';
import { ChatInterno } from '@/components/tarefas/ChatInterno';
import { PresenceProvider } from '@/contexts/PresenceContext';
import { MobileTabBar } from '@/components/mobile/MobileTabBar';
import { MobileMoreSheet } from '@/components/mobile/MobileMoreSheet';

import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { useAccessLog } from '@/hooks/useAccessLog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2 } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: perfilLoading, needsOnboarding } = usePerfil();
  const isMobile = useIsMobile();
  const [moreOpen, setMoreOpen] = useState(false);
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
    <PresenceProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <main
            className="flex-1 flex flex-col min-h-screen overflow-hidden min-w-0"
            style={isMobile ? { paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' } : undefined}
          >
            <PageTransition>
              {children}
            </PageTransition>
          </main>
        </div>

        {isMobile && (
          <>
            <MobileTabBar onOpenMore={() => setMoreOpen(true)} />
            <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
          </>
        )}

        {needsOnboarding && <OnboardingModal />}
        <ChatInterno />
      </SidebarProvider>
    </PresenceProvider>
  );
}
