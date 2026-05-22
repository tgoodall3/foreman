'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      if (
        anchor.href.startsWith(window.location.origin) &&
        anchor.href !== window.location.href
      ) {
        setActive(true);
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => setActive(false), 4000);
      }
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  useEffect(() => { setActive(false); }, [pathname]);

  if (!active) return null;

  return (
    <div
      role="progressbar"
      aria-valuetext="Loading page…"
      className="fixed inset-x-0 top-0 z-[9999] h-[2px] overflow-hidden"
    >
      <div
        className="h-full bg-amber"
        style={{
          animation: 'nav-progress 2s ease-in-out infinite',
          transformOrigin: 'left center',
        }}
      />
      <style>{`
        @keyframes nav-progress {
          0%   { transform: scaleX(0);    opacity: 1; }
          60%  { transform: scaleX(0.75); opacity: 1; }
          100% { transform: scaleX(1);    opacity: 0; }
        }
      `}</style>
    </div>
  );
}
