import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { AdjusterUser } from '../../models/userManagement/userManagementModel';

const EditIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

interface UserRowActionsMenuProps {
  user: AdjusterUser;
  onResetPassword: (u: AdjusterUser) => void;
  onEditAccess: (u: AdjusterUser) => void;
  onDelete: (u: AdjusterUser) => void;
}

// AG Grid clips row-cell overflow for row virtualization, so a plain
// position:absolute dropdown (like the sidebar's .sidebar-user__menu) would be
// clipped/mispositioned once the grid scrolls. Uses the same createPortal +
// getBoundingClientRect() floating-panel technique already established in
// pages/Vendor/VendorSearch/index.tsx's CategoryCellRenderer tray.
export const UserRowActionsMenu: React.FC<UserRowActionsMenuProps> = ({ user, onResetPassword, onEditAccess, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const openMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.right - 180 });
    setOpen(true);
  }, []);

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [open, closeMenu]);

  const runAndClose = (fn: () => void) => { closeMenu(); fn(); };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="grid-action-btn"
        title="Actions"
        aria-label={`Actions for ${user.fullName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); open ? closeMenu() : openMenu(); }}
      >
        <EditIcon />
      </button>
      {open && pos && createPortal(
        <div
          ref={panelRef}
          className="um-row-menu__panel"
          role="menu"
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" role="menuitem" className="um-row-menu__item" onClick={() => runAndClose(() => onEditAccess(user))}>
            Edit Access
          </button>
          <button type="button" role="menuitem" className="um-row-menu__item" onClick={() => runAndClose(() => onResetPassword(user))}>
            Change Password
          </button>
          <button type="button" role="menuitem" className="um-row-menu__item um-row-menu__item--danger" onClick={() => runAndClose(() => onDelete(user))}>
            Delete User
          </button>
        </div>,
        document.body,
      )}
    </>
  );
};

export default UserRowActionsMenu;
