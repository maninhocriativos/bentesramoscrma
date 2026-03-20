import { ReactNode, useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [transitionStage, setTransitionStage] = useState<'enter' | 'exit'>('enter');
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      setTransitionStage('exit');
      
      const exitTimer = setTimeout(() => {
        setDisplayedChildren(children);
        setTransitionStage('enter');
        prevPathRef.current = location.pathname;
      }, 150); // Reduced from 350ms for snappier navigation

      return () => clearTimeout(exitTimer);
    } else {
      setDisplayedChildren(children);
    }
  }, [location.pathname, children]);

  return (
    <div
      className={`flex-1 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        transitionStage === 'enter'
          ? 'opacity-100 translate-x-0 scale-100'
          : 'opacity-0 translate-x-6 scale-[0.98]'
      }`}
    >
      {displayedChildren}
    </div>
  );
}
