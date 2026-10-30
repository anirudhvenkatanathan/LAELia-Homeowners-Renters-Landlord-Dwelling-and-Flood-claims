import React from 'react';
import type { AdjusterUser } from '../../models/userManagement/userManagementModel';

interface DeleteUserConfirmModalProps {
  user: AdjusterUser;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteUserConfirmModal: React.FC<DeleteUserConfirmModalProps> = ({ user, isDeleting, onCancel, onConfirm }) => (
  <div
    className="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-user-title"
    onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) onCancel(); }}
  >
    <div className="modal" style={{ maxWidth: 420 }}>
      <div className="modal__header">
        <h2 className="modal__title" id="delete-user-title">Delete User</h2>
        <button type="button" className="modal__close" onClick={onCancel} disabled={isDeleting} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="modal__body">
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
          Are you sure you want to delete <strong>{user.fullName}</strong>?
        </p>
        <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: 'var(--color-text)' }}>
          This action cannot be undone.
        </p>
      </div>

      <div className="modal__footer">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={isDeleting}>
          Cancel
        </button>
        <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={isDeleting}>
          {isDeleting ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="spin">
                <path d="M21 12a9 9 0 11-6.22-8.56" />
              </svg>
              Deleting…
            </>
          ) : 'Delete'}
        </button>
      </div>
    </div>
  </div>
);

export default DeleteUserConfirmModal;
