import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PasswordInput } from '../accountSettings/PasswordInput';
import { adminResetPassword } from '../../services/userManagement/userManagementService';
import { validatePasswordPolicy } from '../../utils/passwordPolicy';
import { logError } from '../../utils/logError';
import type { AdjusterUser } from '../../models/userManagement/userManagementModel';

interface ResetPasswordModalProps {
  user: AdjusterUser;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ user, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const newPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => { newPasswordRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isSaving) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, isSaving]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const policyError = newPassword ? validatePasswordPolicy(newPassword) : 'New password is required.';
    if (policyError) errs.newPassword = policyError;

    if (!confirmPassword) errs.confirmPassword = 'Please confirm the new password.';
    else if (newPassword && confirmPassword !== newPassword) errs.confirmPassword = 'Passwords do not match.';

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    setSubmitError('');
    if (!validate()) return;
    if (!token) { setSubmitError('Your session has expired. Please sign in again.'); return; }

    setIsSaving(true);
    try {
      const result = await adminResetPassword(token, user.loginId, newPassword);
      if (result.success) {
        onSuccess(result.message || 'Password reset successfully.');
      } else {
        setSubmitError(result.message || 'Unable to reset password.');
      }
    } catch (err) {
      logError(err, 'ResetPasswordModal.handleSave');
      setSubmitError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-password-title"
      onClick={(e) => { if (e.target === e.currentTarget && !isSaving) onClose(); }}
    >
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title" id="reset-password-title">Change Password — {user.fullName}</h2>
          <button type="button" className="modal__close" onClick={onClose} disabled={isSaving} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal__body">
          {submitError && <div className="alert alert--error" role="alert">{submitError}</div>}

          <PasswordInput
            ref={newPasswordRef}
            id="reset-new-password"
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            error={fieldErrors.newPassword}
            required
            autoComplete="new-password"
            disabled={isSaving}
          />
          <PasswordInput
            id="reset-confirm-password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={fieldErrors.confirmPassword}
            required
            autoComplete="new-password"
            disabled={isSaving}
          />
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordModal;
