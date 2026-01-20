import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  // Simplified: instant page transitions with subtle fade-in
  return (
    <div className="flex-1 animate-in fade-in duration-150">
      {children}
    </div>
  );
}
