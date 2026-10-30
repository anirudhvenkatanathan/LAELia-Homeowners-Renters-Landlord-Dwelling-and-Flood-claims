import React, { useMemo, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useMenu, FlatMenuItem } from '../../hooks/menu/useMenu';
import { useAuth } from '../../context/AuthContext';
import { isAdjusterTypeRole } from '../../utils/permissions';
import { LaeliaLogo } from './LaeliaLogo';
import { SidebarUserFooter } from './SidebarUserFooter';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TreeMenuItem extends FlatMenuItem {
  children: TreeMenuItem[];
}

// ─── buildTree ────────────────────────────────────────────────────────────────

// Groups whose children should render flattened away entirely (single
// top-level sidebar link, no expandable group) without touching the
// underlying triage_menu data — those pages are reached via ServiceProviderTabs
// instead. Menu documents for the hidden children are untouched in Mongo.
const FLATTENED_GROUP_IDS = new Set(['menu-admin-vendor-group']);

function buildTree(flat: FlatMenuItem[]): TreeMenuItem[] {
  const map = new Map<string, TreeMenuItem>();
  flat.forEach((item) => map.set(item.id, { ...item, children: [] }));
  const roots: TreeMenuItem[] = [];
  map.forEach((node) => {
    if (node.parentId && FLATTENED_GROUP_IDS.has(node.parentId)) return;
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  map.forEach((node) => node.children.sort((a, b) => a.sortOrder - b.sortOrder));
  return roots.sort((a, b) => a.sortOrder - b.sortOrder);
}

// ─── resolveIcon ─────────────────────────────────────────────────────────────

function resolveIcon(iconName: string): React.ReactElement | null {
  const p = {
    xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    width: 18, height: 18,
  };
  switch (iconName?.toLowerCase()) {
    case 'dashboard': case 'grid':
      return <svg {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    case 'inbox': case 'claim-intake': case 'claims':
      return <svg {...p}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>;
    case 'map': case 'field-mapping':
      return <svg {...p}><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>;
    case 'users': case 'vendor':
      return <svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
    case 'file': case 'document':
      return <svg {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
    case 'service-request-role': case 'role': case 'shield':
      return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'search': case 'vendor-search':
      return <svg {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    case 'user-plus': case 'onboarding': case 'vendor-onboarding':
      return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>;
    case 'sigma': case 'kpi': case 'metrics':
      return <svg {...p}><path d="M18 7H6l6 5-6 5h12"/></svg>;
    case 'analytics': case 'insights': case 'chart':
      return <svg {...p}><path d="M3 3v18h18"/><polyline points="7 12 11 8 15 11 19 7"/></svg>;
    default:
      return null;
  }
}

// ─── NavGroup — renders a "Main"-style section with collapsible header ────────

interface NavGroupProps {
  item: TreeMenuItem;
  currentPath: string;
  isCollapsed: boolean;
}

const NavGroup: React.FC<NavGroupProps> = ({ item, currentPath, isCollapsed }) => {
  const groupLabel = item.label;
  return (
    <nav className="nav-group">
      {/* Group label — hidden when sidebar is icon-only */}
      {!isCollapsed && (
        item.path ? (
          <Link to={item.path} className="nav-group-label nav-group-label--link">
            {groupLabel.toUpperCase()}
          </Link>
        ) : (
          <div className="nav-group-label">
            {groupLabel.toUpperCase()}
          </div>
        )
      )}

      <ul className="nav-items">
        {item.children.map((child) => {
          if (child.children.length > 0) {
            return (
              <NavSubGroup
                key={child.id}
                item={child}
                currentPath={currentPath}
                isCollapsed={isCollapsed}
              />
            );
          }

          const isActive = child.path !== '' && (currentPath === child.path || currentPath.startsWith(child.path + '/'));
          const icon = resolveIcon(child.icon);
          const childLabel = child.label;

          return (
            <li
              key={child.id}
              className={`nav-item${isActive ? ' active' : ''}`}
              title={isCollapsed ? childLabel : undefined}
            >
              <Link
                to={child.path || '#'}
                className="nav-item__link"
                aria-current={isActive ? 'page' : undefined}
              >
                {icon && <span className="nav-item__icon">{icon}</span>}
                {!isCollapsed && <span className="nav-item__label">{childLabel}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

// ─── NavSubGroup — collapsible second-level group nested inside a NavGroup ────

interface NavSubGroupProps {
  item: TreeMenuItem;
  currentPath: string;
  isCollapsed: boolean;
}

const NavSubGroup: React.FC<NavSubGroupProps> = ({ item, currentPath, isCollapsed }) => {
  const icon = resolveIcon(item.icon);
  const label = item.label;

  return (
    <li className="nav-subgroup">
      {item.path ? (
        <Link
          to={item.path}
          className="nav-item nav-subgroup__label nav-subgroup__label--link"
          title={isCollapsed ? label : undefined}
        >
          {icon && <span className="nav-item__icon">{icon}</span>}
          {!isCollapsed && <span className="nav-item__label">{label}</span>}
        </Link>
      ) : (
        <div
          className="nav-item nav-subgroup__label"
          title={isCollapsed ? label : undefined}
        >
          {icon && <span className="nav-item__icon">{icon}</span>}
          {!isCollapsed && <span className="nav-item__label">{label}</span>}
        </div>
      )}

      <ul className="nav-subitems">
        {item.children.map((child) => {
          const isActive = child.path !== '' && (currentPath === child.path || currentPath.startsWith(child.path + '/'));
          const childIcon = resolveIcon(child.icon);
          const childLabel = child.label;

          return (
            <li
              key={child.id}
              className={`nav-item nav-item--sub${isActive ? ' active' : ''}`}
              title={isCollapsed ? childLabel : undefined}
            >
              <Link
                to={child.path || '#'}
                className="nav-item__link"
                aria-current={isActive ? 'page' : undefined}
              >
                {childIcon && <span className="nav-item__icon">{childIcon}</span>}
                {!isCollapsed && <span className="nav-item__label">{childLabel}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
};

// ─── TopLevelLink — root leaf item (no group) ─────────────────────────────────

interface TopLevelLinkProps {
  item: TreeMenuItem;
  currentPath: string;
  isCollapsed: boolean;
}

const TopLevelLink: React.FC<TopLevelLinkProps> = ({ item, currentPath, isCollapsed }) => {
  const isActive = item.path !== '' && currentPath === item.path;
  const icon = resolveIcon(item.icon);
  const label = item.label;
  return (
    <Link
      to={item.path || '#'}
      className={`nav-item${isActive ? ' active' : ''} nav-item--root`}
      title={isCollapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon && <span className="nav-item__icon">{icon}</span>}
      {!isCollapsed && <span className="nav-item__label">{label}</span>}
    </Link>
  );
};

// ─── SidebarToggleIcon ───────────────────────────────────────────────────────
// collapsed=false → ‹ chevron in right panel (click to collapse)
// collapsed=true  → › chevron in right panel (click to expand)

const SidebarToggleIcon: React.FC<{ collapsed: boolean }> = ({ collapsed }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {/* Squircle outer border */}
    <rect x="1.5" y="1.5" width="21" height="21" rx="6.5"/>
    {/* Vertical divider — left panel ~30% */}
    <line x1="7.5" y1="1.5" x2="7.5" y2="22.5"/>
    {/* Chevron centred in the right panel — ‹ to collapse, › to expand */}
    {collapsed
      ? <polyline points="10.5 9  13.5 12  10.5 15"/>
      : <polyline points="13.5 9  10.5 12  13.5 15"/>
    }
  </svg>
);

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

// Map `location.state.from` values to the sidebar path that should stay active
const FROM_PATH_MAP: Record<string, string> = {
  'vendor-panel':  '/vendor/panel',
  'vendor-search': '/vendor/search',
  'analytics':     '/service-provider-analytics',
};

// UI-only display name for the sidebar (logo subtitle + user footer) —
// user.roleName itself, and every permission/role check keyed off it
// (isSupervisor, isClientManager, etc.), are unchanged.
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  'Claims Supervisor': 'Authority Reviewer',
};

const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  isCollapsed = false,
  onToggle,
}) => {
  const location = useLocation();
  const navigate  = useNavigate();
  const { items, loading } = useMenu();
  const { user, logout } = useAuth();

  const handleLogout = useCallback(() => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login', { replace: true });
    }
  }, [logout, navigate]);

  // Adjuster-type accounts (Claims/Senior/Junior Adjuster) show the person's
  // actual name when one is on file, rather than their role name — every
  // other role keeps the existing role-name display, remapped through
  // ROLE_DISPLAY_NAMES for UI-only relabeling (e.g. Claims Supervisor →
  // Authority Reviewer).
  const displayName = (isAdjusterTypeRole(user?.roleName) && user?.fullName)
    ? user.fullName
    : (ROLE_DISPLAY_NAMES[user?.roleName ?? ''] ?? user?.roleName ?? user?.username ?? 'Admin User');

  const fromKey = (location.state as { from?: string } | null)?.from ?? '';
  const currentPath = FROM_PATH_MAP[fromKey] ?? location.pathname;
  const HIDDEN_PATHS = new Set(['/field-mapping']);

  const visibleItems = useMemo(() => {
    const base = items.filter((item) => !HIDDEN_PATHS.has(item.path));
    const permittedIds = user?.menuIds ?? [];
    if (permittedIds.length === 0) return base;

    // Mark permitted items and all their ancestors
    const permittedSet = new Set(permittedIds);
    const allowed = new Set<string>();
    base.forEach((item) => {
      if (item.path && permittedSet.has(item.id)) {
        allowed.add(item.id);
        let parentId = item.parentId;
        while (parentId) {
          allowed.add(parentId);
          const parent = base.find((f) => f.id === parentId);
          parentId = parent?.parentId ?? null;
        }
      }
    });
    return base.filter((item) => allowed.has(item.id));
  }, [items, user?.menuIds]);

  const tree = buildTree(visibleItems);

  const sidebarClass = [
    'sidebar',
    isOpen      ? 'open'              : '',
    isCollapsed ? 'sidebar--collapsed': '',
  ].filter(Boolean).join(' ');

  return (
    <aside className={sidebarClass}>
      {/* Logo / brand — hidden when collapsed (corner toggle takes over) */}
      {!isCollapsed && (
        <div className="sidebar-logo">
          <div className="logo-mark-box">
            <LaeliaLogo variant="on-dark" size={32} />
          </div>
          <div className="logo-name-row">
            <span className="logo-username">{displayName}</span>
          </div>
        </div>
      )}

      {/* Toggle — pinned to top-right corner of the sidebar */}
      <button
        type="button"
        className="sidebar-corner-toggle"
        onClick={onToggle}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <SidebarToggleIcon collapsed={!!isCollapsed} />
      </button>

      {/* Navigation */}
      <div className="sidebar-nav-scroll">
        {loading && !isCollapsed && <p className="sidebar-loading">Loading menu…</p>}

        {!loading && tree.map((item) => {
          // Any item with children → NavGroup (label becomes a Link when item.path is set)
          if (item.children.length > 0) {
            return (
              <NavGroup
                key={item.id}
                item={item}
                currentPath={currentPath}
                isCollapsed={isCollapsed}
              />
            );
          }
          // Leaf item
          return (
            <TopLevelLink
              key={item.id}
              item={item}
              currentPath={currentPath}
              isCollapsed={isCollapsed}
            />
          );
        })}
      </div>

      {/* Footer — user profile + actions, pinned to bottom of the sidebar */}
      <SidebarUserFooter
        displayName={displayName}
        email={user?.email}
        isCollapsed={isCollapsed}
        onLogout={handleLogout}
      />
    </aside>
  );
};

export default Sidebar;