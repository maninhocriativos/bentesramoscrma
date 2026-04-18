import { ReactNode, useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [visible, setVisible] = useState(true);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const prevPathRef = useRef(location.pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevPathRef.current === location.pathname) {
      setDisplayedChildren(children);
      return;
    }

    // Limpar timer anterior
    if (timerRef.current) clearTimeout(timerRef.current);

    // Fade out rápido
    setVisible(false);

    timerRef.current = setTimeout(() => {
      setDisplayedChildren(children);
      prevPathRef.current = location.pathname;
      // Fade in na próxima microtask para garantir re-render
      requestAnimationFrame(() => setVisible(true));
    }, 80);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname, children]);

  return (
    <div
      style={{
        flex: 1,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.995)',
        transition: visible
          ? 'opacity 180ms cubic-bezier(0.4,0,0.2,1), transform 180ms cubic-bezier(0.4,0,0.2,1)'
          : 'opacity 60ms ease, transform 60ms ease',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {displayedChildren}
    </div>
  );
}
