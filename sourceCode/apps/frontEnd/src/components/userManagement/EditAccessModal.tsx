import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateUserAccess } from '../../services/userManagement/userManagementService';
import { logError } from '../../utils/logError';
import type { AdjusterUser } from '../../models/userManagement/userManagementModel';
import { PermissionToggle } from './PermissionToggle';

interface EditAccessModalProps {
  user: AdjusterUser;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/** This modal only ever opens for adjuster-type rows (User Management's grid
 * only ever contains Claims/Senior/Junior Adjuster accounts), so the seed
 * defaults below directly encode the adjuster-type defaults from
 * utils/permissions.ts: rating hidden by default, both overrides allowed by
 * default, reserve exposure shown by default (UI-only, no gating logic yet). */
export const EditAccessModal: React.FC<EditAccessModalProps> = ({ user, onClose, onSuccess }) => {
  const { token } = useAuth();

  const [canAccessServiceProviderRating, setCanAccessServiceProviderRating] =
    useState(user.permissions?.canAccessServiceProviderRating ?? false);
  const [canOverrideService, setCanOverrideService] =
    useState(user.permissions?.canOverrideService ?? true);
  const [canOverrideProvider, setCanOverrideProvider] =
    useState(user.permissions?.canOverrideProvider ?? true);
  const [canViewReserveExposure, setCanViewReserveExposure] =
    useState(user.permissions?.canViewReserveExposure ?? true);

  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { closeBtnRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isSaving) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, isSaving]);

  const handleSave = async () => {
    setError('');
    if (!token) { setError('Your session has expired. Please sign in again.'); return; }

    setIsSaving(true);
    try {
      const result = await updateUserAccess(token, user.loginId, {
        canAccessServiceProviderRating,
        canOverrideService,
        canOverrideProvider,
        canViewReserveExposure,
      });
      if (result.success) {
        onSuccess(result.message || 'Access permissions updated successfully.');
      } else {
        setError(result.message || 'Unable to update access permissions.');
      }
    } catch (err) {
      logError(err, 'EditAccessModal.handleSave');
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-access-title"
      onClick={(e) => { if (e.target === e.currentTarget && !isSaving) onClose(); }}
    >
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title" id="edit-access-title">Edit Access — {user.fullName}</h2>
          <button ref={closeBtnRef} type="button" className="modal__close" onClick={onClose} disabled={isSaving} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal__body">
          {error && <div className="alert alert--error" role="alert">{error}</div>}

          <PermissionToggle
            id="perm-rating"
            label="Access Service Provider Rating"
            description="See FitIQ %, star ratings, and the full scoring breakdown for recommended vendors. When disabled, only the &ldquo;Recommended&rdquo; badge should be visible."
            checked={canAccessServiceProviderRating}
            disabled={isSaving}
            onChange={setCanAccessServiceProviderRating}
          />
          <PermissionToggle
            id="perm-override-service"
            label="Override Service"
            description="Allow the user to override the service selected by the recommendation engine."
            checked={canOverrideService}
            disabled={isSaving}
            onChange={setCanOverrideService}
          />
          <PermissionToggle
            id="perm-override-provider"
            label="Override Provider"
            description="Allow the user to select a different provider than the one recommended by the recommendation engine."
            checked={canOverrideProvider}
            disabled={isSaving}
            onChange={setCanOverrideProvider}
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

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditAccessModal;
