import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ProfileTab } from './ProfileTab';
import { ChangePasswordTab } from './ChangePasswordTab';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Explicit focus-restore target. Preferred over snapshotting document.activeElement
  // on open, since the opener (a dropdown menu item) is typically unmounted in the
  // same commit that mounts this modal — by the time an effect here could read it,
  // the browser has already moved focus to <body>.
  returnFocusRef?: React.RefObject<HTMLElement>;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Universal Account Settings — Profile + Change Password, identical for every
 * authenticated role. No role-branching inside this component: differences
 * (e.g. Organization visibility) are purely data-driven off `user`. */
export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({ isOpen, onClose, returnFocusRef }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'profile' | 'password'>('profile');
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Reset to the Profile tab and remember what to restore focus to each time it opens.
  useEffect(() => {
    if (isOpen) {
      setTab('profile');
      previouslyFocused.current = document.activeElement as HTMLElement | null;
    } else {
      (returnFocusRef?.current ?? previouslyFocused.current)?.focus();
    }
  }, [isOpen, returnFocusRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = user?.roleName ?? user?.username ?? 'User';

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title" id="account-settings-title">Account Settings</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="account-settings-user">
          <div className="account-settings-user__avatar">{getInitials(displayName)}</div>
          <div className="account-settings-user__info">
            <div className="account-settings-user__name">{displayName}</div>
            {user?.email && <div className="account-settings-user__email">{user.email}</div>}
          </div>
        </div>

        <div className="modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'profile'}
            className={`modal-tabs__item${tab === 'profile' ? ' modal-tabs__item--active' : ''}`}
            onClick={() => setTab('profile')}
          >
            Profile
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'password'}
            className={`modal-tabs__item${tab === 'password' ? ' modal-tabs__item--active' : ''}`}
            onClick={() => setTab('password')}
          >
            Change Password
          </button>
        </div>

        {tab === 'profile'
          ? <ProfileTab onClose={onClose} />
          : <ChangePasswordTab onClose={onClose} />}
      </div>
    </div>
  );
};

export default AccountSettingsModal;
