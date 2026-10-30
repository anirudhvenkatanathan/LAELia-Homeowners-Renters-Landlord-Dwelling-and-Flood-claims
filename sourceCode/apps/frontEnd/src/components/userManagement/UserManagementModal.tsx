import React, { useEffect, useRef, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { useAdjusterUsers } from '../../hooks/userManagement/useAdjusterUsers';
import { updateUserAccess } from '../../services/userManagement/userManagementService';
import { logError } from '../../utils/logError';
import { calculateAuthorityLevel } from '../../utils/authorityLevel';
import type { AdjusterUser } from '../../models/userManagement/userManagementModel';
import { PermissionToggle } from './PermissionToggle';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement>;
}

const getInitials = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Claims-Supervisor-only user management for adjuster-type accounts (Claims
 * Adjuster / Senior Adjuster / Junior Adjuster). Split-panel layout: a
 * searchable name list on the left, the selected user's Edit Access toggles
 * inline on the right — no separate popup modal for editing access. */
export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose, returnFocusRef }) => {
  const { token } = useAuth();
  const { users: allUsers, loading, error, refresh } = useAdjusterUsers(isOpen);
  // Display-only filter — the plain "Claims Adjuster" account is intentionally
  // hidden from this list; listAdjusterUsers/MongoDB data loading is untouched.
  const users = allUsers.filter((u) => u.roleName !== 'Claims Adjuster');
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLoginId, setSelectedLoginId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Selection persists across search filtering — search only narrows which
  // names are listed, it doesn't change what's shown in the right panel.
  const filteredUsers = users.filter((u) =>
    u.fullName.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const selectedUser: AdjusterUser | null =
    users.find((u) => u.loginId === selectedLoginId) ?? users[0] ?? null;

  const [canAccessServiceProviderRating, setCanAccessServiceProviderRating] = useState(false);
  const [canOverrideService,             setCanOverrideService]             = useState(true);
  const [canOverrideProvider,            setCanOverrideProvider]            = useState(true);
  const [canViewReserveExposure,         setCanViewReserveExposure]         = useState(true);

  // Derived, not stored — recalculates on every render straight from the two
  // controlling toggles, so it always reflects unsaved edits instantly.
  const authorityLevel = calculateAuthorityLevel(canOverrideProvider, canOverrideService);
  const authorityVariant =
    authorityLevel === 'Adjuster – Independent Authority' ? 'independent' :
    authorityLevel === 'Adjuster – Limited Authority'     ? 'limited'     : 'review';

  // Reseed the toggles whenever the selected user changes.
  useEffect(() => {
    if (!selectedUser) return;
    setCanAccessServiceProviderRating(selectedUser.permissions?.canAccessServiceProviderRating ?? false);
    setCanOverrideService(selectedUser.permissions?.canOverrideService ?? true);
    setCanOverrideProvider(selectedUser.permissions?.canOverrideProvider ?? true);
    setCanViewReserveExposure(selectedUser.permissions?.canViewReserveExposure ?? true);
    setSaveError('');
  }, [selectedUser?.loginId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
    } else {
      (returnFocusRef?.current ?? previouslyFocused.current)?.focus();
      setNotification(null);
      setSearchQuery('');
      setSelectedLoginId(null);
    }
  }, [isOpen, returnFocusRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const showNote = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    if (!token) { setSaveError('Your session has expired. Please sign in again.'); return; }

    setSaveError('');
    setIsSaving(true);
    try {
      const result = await updateUserAccess(token, selectedUser.loginId, {
        canAccessServiceProviderRating,
        canOverrideService,
        canOverrideProvider,
        canViewReserveExposure,
      });
      if (result.success) {
        showNote('success', result.message || 'Access permissions updated successfully.');
        await refresh();
      } else {
        setSaveError(result.message || 'Unable to update access permissions.');
      }
    } catch (err) {
      logError(err, 'UserManagementModal.handleSave');
      setSaveError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-management-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="um-panel">
        <div className="um-panel__header">
          <div className="um-panel__heading">
            <h2 className="um-panel__title" id="user-management-title">User Management</h2>
            <p className="um-panel__subtitle">Manage access &amp; rating permissions for adjuster accounts</p>
          </div>
          <div className="um-panel__search" role="search">
            <span className="um-panel__search-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              className="um-panel__search-input"
              placeholder="Search adjusters…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search users by name"
            />
          </div>
          <button type="button" className="um-panel__close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {notification && (
          <div className={`alert alert--${notification.type === 'success' ? 'success' : 'error'}`} style={{ margin: '0 20px' }} role="alert">
            {notification.text}
          </div>
        )}
        {error && <div className="alert alert--error" style={{ margin: '0 20px' }} role="alert">{error}</div>}

        {loading ? (
          <div className="detail-loading" style={{ padding: 24 }}><p className="text-sm-muted">Loading users…</p></div>
        ) : (
          <div className="um-panel__body">
            <div className="um-panel__section">
              <div className="um-panel__list" role="listbox" aria-label="Adjustor users">
                {filteredUsers.length === 0 && (
                  <div className="um-panel__empty">No users found.</div>
                )}
                {filteredUsers.map((u) => {
                  const isActive = selectedUser?.loginId === u.loginId;
                  return (
                    <button
                      key={u.loginId}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`um-panel__row${isActive ? ' um-panel__row--active' : ''}`}
                      onClick={() => setSelectedLoginId(u.loginId)}
                    >
                      <span className="um-panel__avatar" aria-hidden="true">{getInitials(u.fullName)}</span>
                      <span className="um-panel__row-text">
                        <span className="um-panel__row-name">{u.fullName}</span>
                        <span className="um-panel__row-role">Claims Management</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="um-panel__access">
                {selectedUser ? (
                  <>
                    <div className="um-panel__authority">
                      <span className="um-panel__authority-label">Authority Level</span>
                      <span
                        className={`um-panel__authority-value um-panel__authority-value--${authorityVariant}`}
                        aria-live="polite"
                      >
                        {authorityLevel}
                      </span>
                    </div>

                    {saveError && <div className="alert alert--error" role="alert" style={{ marginBottom: 12 }}>{saveError}</div>}

                    <div className="um-panel__access-section-label">Access Permissions</div>

                    <div className="um-panel__toggles">
                      <PermissionToggle
                        id="perm-override-provider"
                        label="Access to updating Service Provider"
                        description="Allow the user to select a different provider than the one recommended by the recommendation engine."
                        checked={canOverrideProvider}
                        disabled={isSaving}
                        onChange={setCanOverrideProvider}
                      />
                      <PermissionToggle
                        id="perm-override-service"
                        label="Access to updating Services"
                        description="Allow the user to override the service selected by the recommendation engine."
                        checked={canOverrideService}
                        disabled={isSaving}
                        onChange={setCanOverrideService}
                      />
                      <PermissionToggle
                        id="perm-rating"
                        label="Service Provider Rating Visibility"
                        description="See FitIQ %, star ratings, and the full scoring breakdown for recommended vendors. When disabled, only the &ldquo;Recommended&rdquo; badge is visible."
                        checked={canAccessServiceProviderRating}
                        disabled={isSaving}
                        onChange={setCanAccessServiceProviderRating}
                      />
                      <PermissionToggle
                        id="perm-reserve-exposure"
                        label="View Reserve / Financial Exposure"
                        description="See indemnity/medical exposure and reserve figures on claim cards and details."
                        checked={canViewReserveExposure}
                        disabled={isSaving}
                        onChange={setCanViewReserveExposure}
                      />
                    </div>

                    <div className="um-panel__actions">
                      <button type="button" className="btn btn--primary" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="um-panel__empty">Select a user to edit access.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagementModal;
