import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';

interface ChatContextValue {
  currentUserId?: string;
  currentUserName: string;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { fullName } = usePerfil();

  const value = useMemo<ChatContextValue>(() => ({
    currentUserId: user?.id,
    currentUserName: fullName || user?.email?.split('@')[0] || 'Usuário',
  }), [fullName, user?.email, user?.id]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }

  return context;
}