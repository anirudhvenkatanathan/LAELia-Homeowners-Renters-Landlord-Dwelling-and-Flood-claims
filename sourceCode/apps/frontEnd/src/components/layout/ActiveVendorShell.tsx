import React, { useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ErrorBoundary from './ErrorBoundary';
import { LaeliaLogo } from './LaeliaLogo';
import { SidebarUserFooter } from './SidebarUserFooter';

export type ActiveVendorTab = 'clients' | 'performance' | 'documents' | 'profile' | 'assignments';

interface ActiveVendorShellProps {
  children:     React.ReactNode;
  vendorId:     string;
  activeTab:    ActiveVendorTab;
  companyName?: string;
  noScroll?:    boolean;
}

const SVG_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  width: 18, height: 18,
};

const NAV_ITEMS: { tab: ActiveVendorTab; label: string; icon: React.ReactNode; basePath: string; matchPaths?: string[] }[] = [
  {
    tab: 'clients',
    label: 'Client Management',
    basePath: '/vendors/active/clients',
    // My Performance is reached only via View from this screen, so it
    // still counts as "Client Management" for sidebar highlighting.
    matchPaths: ['/vendors/active/performance'],
    icon: (
      <svg {...SVG_PROPS}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    tab: 'documents',
    label: 'My Documents',
    basePath: '/vendors/active/documents',
    icon: (
      <svg {...SVG_PROPS}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    tab: 'profile',
    label: 'My Profile',
    basePath: '/vendors/active/profile',
    icon: (
      <svg {...SVG_PROPS}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

const HamburgerIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6"  />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const ActiveVendorShell: React.FC<ActiveVendorShellProps> = ({
  children, vendorId, companyName, noScroll,
}) => {
  const { logout, user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const handleOverlayClick = useCallback(() => setSidebarOpen(false), []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const currentPath = location.pathname;
  // companyName (per-page fetch) is preferred once loaded; user.companyName (set at
  // login) covers the gap before that fetch resolves, avoiding a flash of the raw
  // login username.
  const displayName = companyName ?? user?.companyName ?? user?.username ?? user?.email ?? 'Service Provider';

  return (
    // app-wrapper--admin reuses the same white-body/teal-top-bottom-strip
    // sidebar styling as the main admin shell (and the Login screen's brand
    // panel) — this shell used to render plain "app-wrapper", which fell
    // through to .sidebar's own unscoped base rule (solid teal fill) since
    // that rule was never meant to be this shell's final look, just a
    // fallback before this scoping existed.
    <div className="app-wrapper app-wrapper--admin">
      <div
        className={`sidebar-overlay${sidebarOpen ? ' active' : ''}`}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* ── Sidebar — identical structure to admin Sidebar.tsx ── */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-mark-box">
            {/* size=32 matches the admin Sidebar's brand mark exactly
                (claim-intake and every other admin screen) — this shell
                previously rendered it at size=60, nearly double. */}
            <LaeliaLogo variant="on-light" size={32} />
          </div>
          <div className="sidebar-logo__info">
            <div className="logo-name-row"><span className="logo-username">{displayName}</span></div>
          </div>
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            style={{ display: sidebarOpen ? 'inline-flex' : 'none' }}
          >
            <HamburgerIcon />
          </button>
        </div>

        <div className="sidebar-nav-scroll">
          <nav className="nav-group">
            <div className="nav-group-label">MY ACCOUNT</div>
            <ul className="nav-items">
              {NAV_ITEMS.map(({ basePath, label, icon, matchPaths }) => {
                const fullPath = `${basePath}/${vendorId}`;
                const isActive = [basePath, ...(matchPaths ?? [])].some(
                  (p) => currentPath === `${p}/${vendorId}` || currentPath.startsWith(p + '/'),
                );
                return (
                  <li
                    key={basePath}
                    className={`nav-item${isActive ? ' active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Link to={fullPath} className="nav-item__link" aria-current={isActive ? 'page' : undefined}>
                      {icon && <span className="nav-item__icon">{icon}</span>}
                      <span className="nav-item__label">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Footer — logged-in user details + account menu, pinned to bottom of the sidebar */}
        <SidebarUserFooter displayName={displayName} email={user?.email} onLogout={handleLogout} />
      </aside>

      {/* ── Main area — identical structure to admin AppShell ── */}
      {/* padding:0 so .vpo-page handles its own spacing.
          height + overflow-y keep sticky bars working correctly inside. */}
      <div
        className="main-content"
        style={{ padding: 0, height: 'calc(100vh - var(--header-height))', overflowY: noScroll ? 'hidden' : 'auto' }}
      >
        <header className="app-header">
          <button
            type="button"
            className="header-mobile-menu"
            onClick={() => setSidebarOpen((p) => !p)}
            aria-label="Toggle menu"
            style={{ display: 'none' }}
          />
          <span className="header-user">{displayName}</span>
        </header>
        <div className="page" style={noScroll ? { height: '100%', overflow: 'hidden' } : undefined}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default ActiveVendorShell;
