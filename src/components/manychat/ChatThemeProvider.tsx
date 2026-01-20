import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ChatTheme = 'light' | 'dark';

interface ChatThemeContextType {
  theme: ChatTheme;
  setTheme: (theme: ChatTheme) => void;
  toggleTheme: () => void;
}

const ChatThemeContext = createContext<ChatThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'chat-theme';

export function ChatThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ChatTheme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    }
    return 'light';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (newTheme: ChatTheme) => setThemeState(newTheme);
  const toggleTheme = () => setThemeState(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <ChatThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ChatThemeContext.Provider>
  );
}

export function useChatTheme() {
  const context = useContext(ChatThemeContext);
  if (!context) {
    throw new Error('useChatTheme must be used within a ChatThemeProvider');
  }
  return context;
}
