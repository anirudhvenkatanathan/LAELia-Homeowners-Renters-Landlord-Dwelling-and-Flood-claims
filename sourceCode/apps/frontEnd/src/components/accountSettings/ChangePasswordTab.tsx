import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PasswordInput } from './PasswordInput';
import { changePassword } from '../../services/accountSettings/accountSettingsService';
import { logError } from '../../utils/logError';
import { validatePasswordPolicy } from '../../utils/passwordPolicy';

interface ChangePasswordTabProps {
  onClose: () => void;
}

export const ChangePasswordTab: React.FC<ChangePasswordTabProps> = ({ onClose }) => {
  const { token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [successMsg,  setSuccessMsg]  = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const currentPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => { currentPasswordRef.current?.focus(); }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = 'Current password is required.';

    const policyError = newPassword ? validatePasswordPolicy(newPassword) : 'New password is required.';
    if (policyError) errs.newPassword = policyError;

    if (!confirmPassword) errs.confirmPassword = 'Please confirm your new password.';
    else if (newPassword && confirmPassword !== newPassword) errs.confirmPassword = 'Passwords do not match.';

    if (currentPassword && newPassword && currentPassword === newPassword) {
      errs.newPassword = 'New password must be different from the current password.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    setSubmitError('');
    setSuccessMsg('');
    if (!validate()) return;
    if (!token) { setSubmitError('Your session has expired. Please sign in again.'); return; }

    setIsLoading(true);
    try {
      const result = await changePassword(token, currentPassword, newPassword);
      if (result.success) {
        setSuccessMsg(result.message || 'Password changed successfully.');
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        setFieldErrors({});
        setTimeout(onClose, 1400);
      } else {
        setSubmitError(result.message || 'Unable to change password.');
        setCurrentPassword('');
        currentPasswordRef.current?.focus();
      }
    } catch (err) {
      logError(err, 'ChangePasswordTab.handleSave');
      setSubmitError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="modal__body">
        {successMsg && <div className="alert alert--success" role="alert">{successMsg}</div>}
        {submitError && <div className="alert alert--error" role="alert">{submitError}</div>}

        <PasswordInput
          ref={currentPasswordRef}
          id="account-current-password"
          label="Current Password"
          value={currentPassword}
          onChange={setCurrentPassword}
          error={fieldErrors.currentPassword}
          required
          autoComplete="current-password"
          disabled={isLoading}
        />
        <PasswordInput
          id="account-new-password"
          label="New Password"
          value={newPassword}
          onChange={setNewPassword}
          error={fieldErrors.newPassword}
          required
          autoComplete="new-password"
          disabled={isLoading}
        />
        <PasswordInput
          id="account-confirm-password"
          label="Confirm New Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={fieldErrors.confirmPassword}
          required
          autoComplete="new-password"
          disabled={isLoading}
        />
      </div>

      <div className="modal__footer">
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isLoading}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </>
  );
};

export default ChangePasswordTab;
