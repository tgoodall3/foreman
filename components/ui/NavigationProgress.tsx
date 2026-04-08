'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function NavigationProgress() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest('a');
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.href.startsWith(window.location.origin) && anchor.href !== window.location.href) {
        setShow(true);
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => setShow(false), 3000);
      }
    };

    document.addEventListener('click', handleLinkClick);
    return () => {
      document.removeEventListener('click', handleLinkClick);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    setShow(false);
  }, [pathname]);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] h-1 overflow-hidden bg-amber/20">
      <div className="h-full w-full bg-amber animate-pulse" />
    </div>
  );
}
