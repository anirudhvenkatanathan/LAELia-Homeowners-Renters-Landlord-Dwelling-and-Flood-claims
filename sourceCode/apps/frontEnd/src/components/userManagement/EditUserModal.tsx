import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminUpdateUser } from '../../services/userManagement/userManagementService';
import { logError } from '../../utils/logError';
import { ASSIGNABLE_ROLES } from '../../models/userManagement/userManagementModel';
import type { AdjusterUser } from '../../models/userManagement/userManagementModel';

interface EditUserModalProps {
  user: AdjusterUser;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [fullName, setFullName] = useState(user.fullName);
  const [username, setUsername] = useState(user.username);
  const [roleName, setRoleName] = useState<typeof ASSIGNABLE_ROLES[number]>(
    ASSIGNABLE_ROLES.includes(user.roleName as typeof ASSIGNABLE_ROLES[number])
      ? (user.roleName as typeof ASSIGNABLE_ROLES[number])
      : ASSIGNABLE_ROLES[0],
  );
  const [status, setStatus] = useState<'Active' | 'Inactive'>(user.status === 'Inactive' ? 'Inactive' : 'Active');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fullNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fullNameRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isSaving) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, isSaving]);

  const handleSave = async () => {
    setError('');
    const trimmedFullName = fullName.trim();
    const trimmedUsername = username.trim();
    if (!trimmedFullName) { setError('Full Name is required.'); return; }
    if (trimmedUsername.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (!token) { setError('Your session has expired. Please sign in again.'); return; }

    setIsSaving(true);
    try {
      const result = await adminUpdateUser(token, user.loginId, {
        fullName: trimmedFullName, username: trimmedUsername, roleName, status,
      });
      if (result.success) {
        onSuccess(result.message || 'User updated successfully.');
      } else {
        setError(result.message || 'Unable to update user.');
      }
    } catch (err) {
      logError(err, 'EditUserModal.handleSave');
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
      aria-labelledby="edit-user-title"
      onClick={(e) => { if (e.target === e.currentTarget && !isSaving) onClose(); }}
    >
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title" id="edit-user-title">Edit User</h2>
          <button type="button" className="modal__close" onClick={onClose} disabled={isSaving} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal__body">
          {error && <div className="alert alert--error" role="alert">{error}</div>}

          <div className="form-group">
            <label className="form-label form-label--required" htmlFor="edit-user-fullname">Full Name</label>
            <input
              ref={fullNameRef}
              id="edit-user-fullname"
              type="text"
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="form-group">
            <label className="form-label form-label--required" htmlFor="edit-user-username">Username</label>
            <input
              id="edit-user-username"
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="form-group">
            <label className="form-label form-label--required" htmlFor="edit-user-role">Role</label>
            <select
              id="edit-user-role"
              className="form-select"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value as typeof ASSIGNABLE_ROLES[number])}
              disabled={isSaving}
            >
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label form-label--required" htmlFor="edit-user-status">Status</label>
            <select
              id="edit-user-status"
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
              disabled={isSaving}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-user-email">Email Address</label>
            <div className="form-static" id="edit-user-email">{user.email}</div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-user-id">User ID</label>
            <div className="form-static" id="edit-user-id">{user.loginId}</div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-user-created">Created Date</label>
            <div className="form-static" id="edit-user-created">
              {new Date(user.createdTime).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </div>
          </div>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Update User'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditUserModal;
