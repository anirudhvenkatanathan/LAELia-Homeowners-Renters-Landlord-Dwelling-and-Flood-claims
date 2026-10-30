import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AccountSettingsModal } from '../accountSettings/AccountSettingsModal';
import { UserManagementModal } from '../userManagement/UserManagementModal';

// ─── Icons ─────────────────────────────────────────────────────────────────

const SettingsIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

const UsersIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const LogoutIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// ─── Props ────────────────────────────────────────────────────────────────

interface SidebarUserFooterProps {
  /** Caller resolves its own existing fallback chain (differs per shell). */
  displayName: string;
  email?: string;
  /** Desktop rail collapse — vendor shells omit this (mobile-drawer only). */
  isCollapsed?: boolean;
  /** Caller's existing Sign Out handler, incl. any confirm-dialog wrapper. */
  onLogout: () => void;
}

/** Shared sidebar footer (avatar + name/email + account menu), used identically
 * by Sidebar.tsx, ActiveVendorShell.tsx, and VendorPortalShell.tsx. Clicking
 * anywhere on the footer opens the account popup (Account Settings, plus User
 * Management for a Claims Supervisor); the sign-out icon on the right is a
 * separate, independent click zone that signs out directly. */
export const SidebarUserFooter: React.FC<SidebarUserFooterProps> = ({
  displayName, email, isCollapsed = false, onLogout,
}) => {
  const { user } = useAuth();
  const isSupervisor = user?.roleName === 'Claims Supervisor';

  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMgmtOpen, setUserMgmtOpen] = useState(false);
  // Doubles as the modal focus-restore target (tabIndex=-1 makes it
  // programmatically focusable without joining the tab order) — the old
  // gear button that used to hold this ref no longer exists, and the
  // "Account Settings" menu item that's actually focused when openSettings()
  // fires gets unmounted in the same commit that opens the modal, so neither
  // can be the focus-restore target.
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = getInitials(displayName);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const openSettings = useCallback(() => {
    setMenuOpen(false);
    setSettingsOpen(true);
  }, []);

  const openUserManagement = useCallback(() => {
    setMenuOpen(false);
    setUserMgmtOpen(true);
  }, []);

  // The avatar/name/email row is the click target — all bubble here via a
  // single handler; the popup itself stops propagation so selecting a menu item
  // can't re-toggle it. Handler lives on .sidebar-user (not .sidebar-footer) so
  // the modals rendered as its siblings below never bubble into this toggle.
  const handleFooterClick = useCallback(() => {
    if (isCollapsed) return;
    setMenuOpen((o) => !o);
  }, [isCollapsed]);

  // Sign-out icon is its own click zone, independent of the popup: it must
  // stop propagation so it doesn't also bubble into handleFooterClick above
  // and toggle the menu open/closed on the way out.
  const handleSignOutClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    onLogout();
  }, [onLogout]);

  return (
    <div className="sidebar-footer">
      <div
        className="sidebar-user"
        ref={menuRef}
        tabIndex={-1}
        onClick={handleFooterClick}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {isCollapsed ? (
          <div className="sidebar-user__avatar" title={displayName}>{initials}</div>
        ) : (
          <>
            <div className="sidebar-user__profile">
              <div className="sidebar-user__avatar">{initials}</div>
              <div className="sidebar-user__info">
                <div className="sidebar-user__name">{displayName}</div>
                {email && <div className="sidebar-user__email">{email}</div>}
              </div>
            </div>
            <div className="sidebar-user__actions">
              <button
                type="button"
                className="sidebar-user__action"
                title="Sign out"
                aria-label="Sign out"
                onClick={handleSignOutClick}
              >
                <LogoutIcon />
              </button>
              {menuOpen && (
                <div className="sidebar-user__menu" role="menu" onClick={(e) => e.stopPropagation()}>
                  <button type="button" role="menuitem" className="sidebar-user__menu-item" onClick={openSettings}>
                    <SettingsIcon /> Account Settings
                  </button>
                  {isSupervisor && (
                    <button type="button" role="menuitem" className="sidebar-user__menu-item" onClick={openUserManagement}>
                      <UsersIcon /> User Management
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <AccountSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        returnFocusRef={menuRef}
      />
      {isSupervisor && (
        <UserManagementModal
          isOpen={userMgmtOpen}
          onClose={() => setUserMgmtOpen(false)}
          returnFocusRef={menuRef}
        />
      )}
    </div>
  );
};

export default SidebarUserFooter;
