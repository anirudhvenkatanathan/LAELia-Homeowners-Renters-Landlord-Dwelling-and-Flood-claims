import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile } from '../../services/accountSettings/accountSettingsService';
import { logError } from '../../utils/logError';

interface ProfileTabProps {
  onClose: () => void;
}

/** Profile view/edit — only fields that already exist on login_user are shown:
 * Username (editable), Email/Role (read-only), Organization (read-only, vendor
 * users only). No Full Name / Phone — neither exists in the data model. */
export const ProfileTab: React.FC<ProfileTabProps> = ({ onClose }) => {
  const { user, token, updateUser } = useAuth();
  const [username,   setUsername]   = useState(user?.username ?? '');
  const [error,      setError]      = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading,  setIsLoading]  = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { usernameRef.current?.focus(); }, []);

  const trimmedUsername = username.trim();
  const isUnchanged = trimmedUsername === (user?.username ?? '');

  const handleSave = async () => {
    setError('');
    setSuccessMsg('');

    if (!trimmedUsername) { setError('Username is required.'); return; }
    if (trimmedUsername.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (isUnchanged) { setError('Change the username before saving.'); return; }
    if (!token) { setError('Your session has expired. Please sign in again.'); return; }

    setIsLoading(true);
    try {
      const result = await updateProfile(token, trimmedUsername);
      if (result.success) {
        updateUser({ username: result.username ?? trimmedUsername });
        setSuccessMsg(result.message || 'Profile updated successfully.');
        setTimeout(onClose, 1400);
      } else {
        setError(result.message || 'Unable to update profile.');
      }
    } catch (err) {
      logError(err, 'ProfileTab.handleSave');
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="modal__body">
        {successMsg && <div className="alert alert--success" role="alert">{successMsg}</div>}
        {error && <div className="alert alert--error" role="alert">{error}</div>}

        <div className="form-group">
          <label className="form-label form-label--required" htmlFor="account-username">Username</label>
          <input
            ref={usernameRef}
            id="account-username"
            type="text"
            className="form-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="account-email">Email Address</label>
          <div className="form-static" id="account-email">{user?.email}</div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="account-role">Role</label>
          <div className="form-static" id="account-role">{user?.roleName || '—'}</div>
        </div>

        {user?.companyName && (
          <div className="form-group">
            <label className="form-label" htmlFor="account-org">Organization</label>
            <div className="form-static" id="account-org">{user.companyName}</div>
          </div>
        )}
      </div>

      <div className="modal__footer">
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isLoading}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleSave}
          disabled={isLoading || isUnchanged || !trimmedUsername}
        >
          {isLoading ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </>
  );
};

export default ProfileTab;
