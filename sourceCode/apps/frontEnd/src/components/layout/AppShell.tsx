import React, { ReactNode, useState, useCallback, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ErrorBoundary from './ErrorBoundary';

interface AppShellProps {
  children: ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen]   = useState(false);   // mobile slide-in
  const [collapsed,   setCollapsed]     = useState(() => {   // desktop icon-rail
    try {
      const stored = localStorage.getItem('sidebar-collapsed');
      return stored === null ? true : stored === 'true';
    } catch { return true; }
  });

  const isMobile = useCallback(
    () => window.matchMedia('(max-width: 768px)').matches,
    []
  );

  // Desktop: toggle collapse. Mobile: toggle slide-in (topbar button).
  const handleDesktopToggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  }, []);

  // Mobile topbar hamburger
  const handleMobileToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleOverlayClick = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const close = (e: MediaQueryListEvent) => { if (e.matches) setSidebarOpen(false); };
    mq.addEventListener('change', close);
    return () => mq.removeEventListener('change', close);
  }, []);

  const wrapperClass = [
    'app-wrapper',
    'app-wrapper--admin',
    collapsed ? 'app-wrapper--sidebar-collapsed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClass}>
      <div
        className={`sidebar-overlay${sidebarOpen ? ' active' : ''}`}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      <ErrorBoundary>
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={collapsed}
          onToggle={handleDesktopToggle}
        />
      </ErrorBoundary>

      <div className="main-content">
        <ErrorBoundary>
          {/* Mobile-only: topbar hamburger. Hidden on desktop via CSS. */}
          <Topbar onMenuToggle={handleMobileToggle} />
        </ErrorBoundary>
        <div className="page">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default AppShell;
