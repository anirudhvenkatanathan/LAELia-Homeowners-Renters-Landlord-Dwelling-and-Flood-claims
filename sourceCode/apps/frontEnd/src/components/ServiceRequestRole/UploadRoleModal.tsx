import React, { useState, useCallback, useRef, useEffect } from 'react';
import { uploadServiceRequestRole } from '../../services/ServiceRequestRole/serviceRequestRoleService';
import { validateUpload } from '../../validations/ServiceRequestRole/serviceRequestRoleSchema';
import { logError } from '../../utils/logError';

const ACCEPT = '.xlsx,.xls';

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => { const d = e.target?.result as string; resolve(d.split(',')[1] ?? ''); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  isOpen:    boolean;
  onClose:   () => void;
  onSuccess: () => void;
}

const UploadRoleModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [file,       setFile]       = useState<File | null>(null);
  const [isLoading,  setIsLoading]  = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCount    = useRef(0);

  useEffect(() => {
    if (isOpen) { setFile(null); setErrors({}); setSuccessMsg(''); setIsDragging(false); dragCount.current = 0; }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  const applyFile = useCallback((f: File | null) => {
    setFile(f); setErrors({}); setIsDragging(false); dragCount.current = 0;
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    applyFile(e.target.files?.[0] ?? null);
  }, [applyFile]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); dragCount.current++; setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCount.current = Math.max(0, dragCount.current - 1);
    if (dragCount.current === 0) setIsDragging(false);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); dragCount.current = 0; setIsDragging(false);
    applyFile(e.dataTransfer.files[0] ?? null);
  }, [applyFile]);

  const handleUpload = useCallback(async () => {
    const { valid, errors: ve } = validateUpload(file);
    if (!valid) { setErrors(ve); return; }
    setIsLoading(true); setErrors({});
    try {
      const base64 = await readAsBase64(file!);
      const result = await uploadServiceRequestRole(base64, file!.name, 'Admin');
      if (result.success) {
        setSuccessMsg(`Upload successful! Upload ID: ${result.uploadId}`);
        setTimeout(() => { onSuccess(); onClose(); }, 1400);
      } else {
        setErrors({ submit: result.message || 'Upload failed. Please try again.' });
      }
    } catch (err) {
      logError(err, 'UploadRoleModal.handleUpload');
      setErrors({ submit: 'An unexpected error occurred. Please try again.' });
    } finally { setIsLoading(false); }
  }, [file, onSuccess, onClose]);

  if (!isOpen) return null;

  const dropClass = ['modal-file-drop', isDragging ? 'modal-file-drop--dragging' : '', file ? 'modal-file-drop--has-file' : ''].filter(Boolean).join(' ');

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="upload-srr-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title" id="upload-srr-title">Upload Service Request Role File</h2>
          <button type="button" className="modal__close" onClick={onClose} disabled={isLoading} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal__body">
          {successMsg && <div className="alert alert--success" role="alert">{successMsg}</div>}
          {errors['submit'] && <div className="alert alert--error" role="alert">{errors['submit']}</div>}

          <div className="form-group">
            <label className="form-label form-label--required">Excel File (.xlsx / .xls)</label>
            <div className={dropClass} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
              {isDragging ? (
                <>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="modal-file-drop__icon modal-file-drop__icon--active">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span className="modal-file-drop__text modal-file-drop__text--active">Drop your file here</span>
                </>
              ) : file ? (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="modal-file-drop__icon modal-file-drop__icon--success">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 12 18 15 15"/><line x1="12" y1="12" x2="12" y2="18"/>
                  </svg>
                  <div className="modal-file-drop__file-info">
                    <span className="modal-file-drop__filename">{file.name}</span>
                    <span className="modal-file-drop__filesize">{formatFileSize(file.size)}</span>
                  </div>
                  <label className="btn btn--ghost btn--sm modal-file-drop__btn" htmlFor="srr-file-input">Change File</label>
                </>
              ) : (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="modal-file-drop__icon">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div className="modal-file-drop__text">Drag &amp; drop your file here, or</div>
                  <label className="btn btn--ghost btn--sm modal-file-drop__btn" htmlFor="srr-file-input">Browse</label>
                  <span className="modal-file-drop__hint">Supported: .xlsx, .xls &nbsp;·&nbsp; Max 10 MB</span>
                </>
              )}
              <input ref={fileInputRef} id="srr-file-input" type="file" accept={ACCEPT} className="input-hidden" onChange={handleFileChange} aria-label="Upload Excel file" />
            </div>
            {errors['file'] && <span className="form-error" role="alert">{errors['file']}</span>}
          </div>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isLoading}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={handleUpload} disabled={isLoading || !file}>
            {isLoading ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="spin"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>Uploading…</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadRoleModal;
