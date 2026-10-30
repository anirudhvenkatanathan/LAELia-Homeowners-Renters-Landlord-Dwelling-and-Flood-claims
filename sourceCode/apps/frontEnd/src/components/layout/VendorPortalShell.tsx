import React, { useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ErrorBoundary from './ErrorBoundary';
import { useMenu } from '../../hooks/menu/useMenu';
import { LaeliaLogo } from './LaeliaLogo';
import { SidebarUserFooter } from './SidebarUserFooter';

export type VendorPortalTab = 'onboarding' | 'profile';

interface VendorPortalShellProps {
  children: React.ReactNode;
  vendorId: string;
  activeTab: VendorPortalTab;
  companyName?: string;
  noScroll?: boolean;
}

const PORTAL_GROUP_ID = 'menu-group-vendor-portal';

const SVG_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  width: 18, height: 18,
};

function resolvePortalIcon(iconName: string): React.ReactNode {
  switch (iconName) {
    case 'portal-onboarding':
      return <svg {...SVG_PROPS}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>;
    case 'portal-profile':
      return <svg {...SVG_PROPS}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    default:
      return null;
  }
}

const STATIC_NAV: { tab: VendorPortalTab; label: string; icon: React.ReactNode; basePath: string }[] = [
  { tab: 'onboarding', label: 'My Onboarding', icon: resolvePortalIcon('portal-onboarding'), basePath: '/vendor/portal/onboarding' },
  { tab: 'profile',    label: 'My Profile',    icon: resolvePortalIcon('portal-profile'),    basePath: '/vendor/portal/profile' },
];

const HamburgerIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6"  />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const VendorPortalShell: React.FC<VendorPortalShellProps> = ({
  children, vendorId, companyName, noScroll,
}) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { items } = useMenu();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const handleOverlayClick = useCallback(() => setSidebarOpen(false), []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const portalItems = items
    .filter((item) => item.parentId === PORTAL_GROUP_ID)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const currentPath = location.pathname;

  const navItems = portalItems.length > 0
    ? portalItems.map((item) => ({
        fullPath: `${item.path}/${vendorId}`,
        basePath: item.path,
        label: item.label,
        icon: resolvePortalIcon(item.icon),
      }))
    : STATIC_NAV.map((item) => ({
        fullPath: `${item.basePath}/${vendorId}`,
        basePath: item.basePath,
        label: item.label,
        icon: item.icon,
      }));

  const displayName = companyName ?? user?.username ?? user?.email ?? 'Service Provider';

  return (
    <div className="app-wrapper">
      <div
        className={`sidebar-overlay${sidebarOpen ? ' active' : ''}`}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* ── Sidebar — identical structure to admin Sidebar.tsx ── */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-mark-box">
            <LaeliaLogo variant="on-dark" size={64} />
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
              {navItems.map(({ fullPath, basePath, label, icon }) => {
                const isActive = currentPath === fullPath || currentPath.startsWith(basePath + '/');
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

export default VendorPortalShell;
