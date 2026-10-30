import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UploadType } from '../../models/claimIntakeMaster/claimIntakeModel';
import { uploadClaim } from '../../services/claimIntakeMaster/claimIntakeService';
import { logError } from '../../utils/logError';

// ─── Config ───────────────────────────────────────────────────────────────────

const UPLOAD_OPTIONS = [
  { value: UploadType.EXCEL, label: 'Excel',    accept: '.xlsx,.xls', hint: '.xlsx, .xls' },
  { value: UploadType.JSON,  label: 'JSON Payload',  accept: '.json',      hint: '.json'       },
  { value: UploadType.XML,   label: 'XML Data',      accept: '.xml',       hint: '.xml'        },
] as const;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = (e) => resolve(e.target?.result as string);
    r.onerror = reject;
    r.readAsText(file);
  });
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = (e) => {
      const dataUrl = e.target?.result as string;
      resolve(dataUrl.split(',')[1] ?? '');  // strip data:...;base64, prefix
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const UploadClaimModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [uploadType, setUploadType] = useState<UploadType | null>(null);
  const [file,       setFile]       = useState<File | null>(null);
  const [isLoading,  setIsLoading]  = useState(false);
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setUploadType(null);
      setFile(null);
      setErrors({});
      setSuccessMsg('');
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleTypeChange = useCallback((type: UploadType) => {
    setUploadType(type);
    setFile(null);
    setErrors({});
    setSuccessMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setErrors({});
  }, []);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};

    if (!uploadType) {
      errs['uploadType'] = 'Please select an Upload Type.';
      setErrors(errs);
      return false;
    }

    if (!file) {
      errs['file'] = 'Please choose a file to upload.';
      setErrors(errs);
      return false;
    }

    const name = file.name.toLowerCase();

    if (file.size === 0) {
      errs['file'] = 'The selected file is empty.';
    } else if (file.size > MAX_BYTES) {
      errs['file'] = 'File size must not exceed 10 MB.';
    } else if (uploadType === UploadType.EXCEL && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      errs['file'] = 'Only .xlsx and .xls files are accepted for Excel upload.';
    } else if (uploadType === UploadType.JSON && !name.endsWith('.json')) {
      errs['file'] = 'Only .json files are accepted for JSON upload.';
    } else if (uploadType === UploadType.XML && !name.endsWith('.xml')) {
      errs['file'] = 'Only .xml files are accepted for XML upload.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [uploadType, file]);

  const handleUpload = useCallback(async () => {
    if (!validate() || !file || !uploadType) return;

    setIsLoading(true);
    setErrors({});

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let input: any = { uploadType, fileName: file.name, uploadedBy: 'Admin' };

      if (uploadType === UploadType.EXCEL) {
        input.excelBase64 = await readAsBase64(file);

      } else if (uploadType === UploadType.JSON) {
        const content = await readAsText(file);
        try {
          const parsed: unknown = JSON.parse(content);
          // Accept single claim object OR array of claim objects
          const isValidShape =
            (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) ||
            (Array.isArray(parsed) && parsed.length > 0);
          if (!isValidShape) {
            setErrors({ file: 'The JSON file must contain a claim object or an array of claim objects.' });
            return;
          }
        } catch {
          setErrors({ file: 'The JSON file is not valid JSON. Please verify the file content.' });
          return;
        }
        input.jsonPayload = content;

      } else {
        const content = await readAsText(file);
        if (!content.trim().startsWith('<')) {
          setErrors({ file: 'The XML file does not appear to contain valid XML markup.' });
          return;
        }
        input.xmlPayload = content;
      }

      const result = await uploadClaim(input);

      if (result.success) {
        setSuccessMsg(`Upload successful! Record ID: ${result.uploadId}`);
        setTimeout(() => { onSuccess(); onClose(); }, 1400);
      } else {
        setErrors({ submit: result.message || 'Upload failed. Please try again.' });
      }
    } catch (err) {
      logError(err, 'UploadClaimModal.handleUpload');
      setErrors({ submit: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [validate, file, uploadType, onSuccess, onClose]);

  if (!isOpen) return null;

  const currentOption = UPLOAD_OPTIONS.find((o) => o.value === uploadType);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="modal__header">
          <h2 className="modal__title" id="upload-modal-title">
            Upload Claim
          </h2>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
            disabled={isLoading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="modal__body">

          {successMsg && (
            <div className="alert alert--success" role="alert">{successMsg}</div>
          )}
          {errors['submit'] && (
            <div className="alert alert--error" role="alert">{errors['submit']}</div>
          )}

          {/* Upload Type */}
          <div className="form-group">
            <label className="form-label form-label--required">Upload Type</label>
            <div className="modal-radio-group" role="radiogroup" aria-label="Upload Type">
              {UPLOAD_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`modal-radio-card${uploadType === opt.value ? ' selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="modal-uploadType"
                    value={opt.value}
                    checked={uploadType === opt.value}
                    onChange={() => handleTypeChange(opt.value)}
                    className="input-hidden"
                  />
                  <span className="modal-radio-card__label">{opt.label}</span>
                  <span className="modal-radio-card__hint">{opt.hint}</span>
                </label>
              ))}
            </div>
            {errors['uploadType'] && (
              <span className="form-error" role="alert">{errors['uploadType']}</span>
            )}
          </div>

          {/* File Upload */}
          {uploadType && (
            <div className="form-group">
              <label className="form-label form-label--required">
                {currentOption?.label} File
              </label>
              <div className="modal-file-drop">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="modal-file-drop__icon">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div className="modal-file-drop__text">
                  {file ? (
                    <span className="modal-file-drop__filename">{file.name}</span>
                  ) : (
                    <span>Click to choose a <strong>{currentOption?.hint}</strong> file</span>
                  )}
                </div>
                <label className="btn btn--ghost btn--sm modal-file-drop__btn" htmlFor="modal-file-input">
                  {file ? 'Change File' : 'Browse'}
                </label>
                <input
                  ref={fileInputRef}
                  id="modal-file-input"
                  type="file"
                  accept={currentOption?.accept}
                  className="input-hidden"
                  onChange={handleFileChange}
                  aria-label={`Upload ${currentOption?.label} file`}
                />
              </div>
              {errors['file'] && (
                <span className="form-error" role="alert">{errors['file']}</span>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="modal__footer">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleUpload}
            disabled={isLoading || !uploadType || !file}
          >
            {isLoading ? (
              'Uploading…'
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default UploadClaimModal;
