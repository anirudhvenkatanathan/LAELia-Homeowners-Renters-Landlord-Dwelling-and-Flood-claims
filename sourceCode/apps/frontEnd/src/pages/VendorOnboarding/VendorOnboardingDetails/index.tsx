import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import AppShell from '../../../components/layout/AppShell';
import { useAuth } from '../../../context/AuthContext';
import { useVendorOnboardingDetails } from '../../../hooks/vendorOnboarding/useVendorOnboardingDetails';
import type { ProcessingStage, ConfirmationRequirement, ConfirmationDoc, WaiveReason, RoleSummaryItem, VendorOnboardingDetails } from '../../../models/vendorOnboarding/vendorOnboardingModel';
import { getDocumentUrl } from '../../../services/vendorOnboarding/vendorOnboardingService';
import type { UploadPayload, WaivePayload, VendorIntelligenceResult } from '../../../services/vendorOnboarding/vendorOnboardingService';
import { VendorIntelligenceCard, buildVendorIntelligence } from '../../../components/vendorOnboarding/VendorIntelligenceCard';
import { VendorPerformanceMetrics } from '../../../components/vendorOnboarding/VendorPerformanceMetrics';
import { US_STATES } from '../../../models/vendorServiceRequest/vendorServiceRequestModel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function vendorStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'approved' || s === 'active') return 'badge badge-green';
  if (s === 'suspended' || s === 'disqualified') return 'badge badge-red';
  if (s === 'requalification due') return 'badge badge-blue';
  if (s === 'ready for activation') return 'badge badge-orange';
  return 'badge badge-gray';
}

// Vendors that are still Active but within the requalification window are
// shown as "Active/Requalification Due" — mirrors the label used on the
// Vendor Management screen for the same underlying status.
function vendorStatusDisplayLabel(status: string): string {
  if (status.toLowerCase() === 'requalification due') return 'Active/Requalification Due';
  return status;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

// Combines geographic coverage states with the Virtual flag into a single
// comma-separated display value, e.g. "CA, MI, Virtual".
function formatCoverageDisplay(coverage: string): string {
  const parts = coverage.split(',').map((s) => s.trim()).filter(Boolean);
  const geo = parts.filter((s) => s !== 'Virtual');
  const isVirtual = parts.includes('Virtual');
  return [...geo, ...(isVirtual ? ['Virtual'] : [])].join(', ');
}

// Groups L1 (service-category-scoped) confirmation items by serviceRequestRoleId,
// preserving the order services first appear in the list.
interface ServiceGroup {
  serviceRequestRoleId: string;
  serviceRoleName:      string;
  items:                ConfirmationRequirement[];
}

function groupByService(confirmations: ConfirmationRequirement[]): ServiceGroup[] {
  const groups: ServiceGroup[] = [];
  const indexByRoleId = new Map<string, number>();

  for (const req of confirmations) {
    const roleId = req.serviceRequestRoleId || '';
    let idx = indexByRoleId.get(roleId);
    if (idx === undefined) {
      idx = groups.length;
      indexByRoleId.set(roleId, idx);
      groups.push({ serviceRequestRoleId: roleId, serviceRoleName: req.serviceRoleName || 'Other', items: [] });
    }
    groups[idx].items.push(req);
  }

  return groups;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function itemDotClass(req: ConfirmationRequirement, isTechReadiness: boolean): string {
  if (req.waiveInfo) return 'ql-item__dot ql-item__dot--pending'; // amber for waived
  const docs = req.documents;
  if (!docs.length) return 'ql-item__dot';
  if (isTechReadiness) {
    const s = docs[0]?.approvalStatus;
    if (s === 'Available') return 'ql-item__dot ql-item__dot--approved';
    return 'ql-item__dot';
  }
  if (docs.some((d) => d.approvalStatus === 'Rejected'))  return 'ql-item__dot ql-item__dot--rejected';
  if (docs.some((d) => d.approvalStatus === 'Sent Back')) return 'ql-item__dot ql-item__dot--sendback';
  if (docs.every((d) => d.approvalStatus === 'Approved')) return 'ql-item__dot ql-item__dot--approved';
  return 'ql-item__dot ql-item__dot--pending';
}

function getItemStatus(req: ConfirmationRequirement, isTechReadiness: boolean): string {
  if (req.waiveInfo) return 'WAIVED';
  const docs = req.documents;
  if (!docs.length) return 'PENDING';
  if (isTechReadiness) {
    const s = docs[0]?.approvalStatus;
    if (s === 'Available')     return 'AVAILABLE';
    if (s === 'Not Available') return 'NOT AVAIL';
    return 'PENDING';
  }
  if (docs.some((d) => d.approvalStatus === 'Approved')) return 'APPROVED';
  if (docs.some((d) => d.approvalStatus === 'Rejected')) return 'REJECTED';
  if (docs.some((d) => d.approvalStatus === 'Sent Back')) return 'SENT BACK';
  return 'PENDING';
}

function itemStatusBadgeClass(status: string): string {
  if (status === 'WAIVED')    return 'ql-item-status ql-item-status--waived';
  if (status === 'APPROVED')  return 'ql-item-status ql-item-status--approved';
  if (status === 'AVAILABLE') return 'ql-item-status ql-item-status--available';
  if (status === 'REJECTED')  return 'ql-item-status ql-item-status--rejected';
  if (status === 'SENT BACK') return 'ql-item-status ql-item-status--sendback';
  return 'ql-item-status ql-item-status--pending';
}

function stageStatusClass(status: ProcessingStage['stageStatus'], isVendorActive: boolean): string {
  if (isVendorActive || status === 'Completed') return 'ql-status ql-status--completed';
  if (status === 'Rejected') return 'ql-status ql-status--rejected';
  return 'ql-status ql-status--in-progress';
}

function stageStatusLabel(status: ProcessingStage['stageStatus'], isVendorActive: boolean): string {
  if (isVendorActive) return 'Completed';
  return status;
}

function docStatusBadgeClass(status: ConfirmationDoc['approvalStatus']): string {
  if (status === 'Approved') return 'badge badge-green';
  if (status === 'Rejected') return 'badge badge-red';
  return 'badge badge-yellow';
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass: string;
  loading: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

const formatMetricValue = (value : string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const numericValue = Number(value);
  if (!isNaN(numericValue)) {
    return `$${numericValue.toLocaleString()}`;
  }
  return value;
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title, message, confirmLabel, confirmClass, loading, confirmDisabled, onConfirm, onCancel, children,
}) => (
  <div
    className="modal-overlay"
    role="dialog"
    aria-modal="true"
    onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
  >
    <div className="modal" style={{ maxWidth: 440 }}>
      <div className="modal__header">
        <h2 className="modal__title">{title}</h2>
        <button type="button" className="modal__close" onClick={onCancel} disabled={loading} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="modal__body">
        <p style={{ fontSize: '0.88rem', color: 'var(--color-text)' }}>{message}</p>
        {children}
      </div>
      <div className="modal__footer">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="button" className={`btn ${confirmClass}`} onClick={onConfirm} disabled={loading || confirmDisabled}>
          {loading ? 'Processing…' : confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

// ─── Checkbox grid (same pattern as the Service Category filter on the
// Service Provider Administration grid: vs-category-panel__grid / vs-category-checkbox) ──

interface CheckboxGridProps {
  options:         string[];
  selected:        string[];
  onChange:        (next: string[]) => void;
  disabled?:       boolean;
  emptyLabel?:     string;
  /** Class for the scrollable grid container. Defaults to the wide category-chip layout. */
  gridClassName?:  string;
  /** Class for each checkbox <label>. Defaults to the wide category-chip checkbox style. */
  itemClassName?:  string;
  itemCheckedClassName?: string;
  labelClassName?: string;
}

const CheckboxGrid: React.FC<CheckboxGridProps> = ({
  options, selected, onChange, disabled, emptyLabel,
  gridClassName = 'vs-category-panel__grid',
  itemClassName = 'vs-category-checkbox',
  itemCheckedClassName = 'vs-category-checkbox--checked',
  labelClassName = 'vs-category-checkbox__label',
}) => {
  const toggle = (option: string) => {
    if (disabled) return;
    onChange(selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option]);
  };

  if (options.length === 0) {
    return <div className="vs-category-panel"><span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{emptyLabel ?? 'No options available'}</span></div>;
  }

  return (
    <div className="vs-category-panel" style={{ margin: 0 }}>
      <div className={gridClassName}>
        {options.map((option) => {
          const checked = selected.includes(option);
          return (
            <label key={option} className={`${itemClassName}${checked ? ` ${itemCheckedClassName}` : ''}`}>
              <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(option)} />
              <span className={labelClassName}>{option}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

// ─── Priority Boost Modal ───────────────────────────────────────────────────────

interface PriorityBoostModalProps {
  companyName:                string;
  serviceRoleOptions:          string[];
  initialStates:               string[];
  initialServiceDisciplines?:  string[];
  initialAssignmentLimit?:     number | null;
  initialReasonForBoost?:      string;
  saving:              boolean;
  onCancel:            () => void;
  // Full validation (States/Service Disciplines/Reason for Boost all
  // mandatory) — saves the Priority Boost, then activates.
  onActivateWithBoost: (payload: {
    states: string[]; serviceDisciplines: string[]; assignmentLimit: number | null; reasonForBoost: string;
  }) => Promise<{ success: boolean; message: string }>;
  // No validation at all — nothing on this form is saved; activates only.
  onActivateWithoutBoost: () => Promise<{ success: boolean; message: string }>;
}

const PriorityBoostModal: React.FC<PriorityBoostModalProps> = ({
  companyName, serviceRoleOptions, initialStates,
  initialServiceDisciplines, initialAssignmentLimit, initialReasonForBoost,
  saving, onCancel, onActivateWithBoost, onActivateWithoutBoost,
}) => {
  const [states, setStates] = useState<string[]>(initialStates);
  // Pre-populate from an existing Priority Boost record for this vendor, if
  // one exists — falls back to "every qualified service role" (the prior
  // default) only when there's nothing saved yet.
  const [serviceDisciplines, setServiceDisciplines] = useState<string[]>(initialServiceDisciplines ?? serviceRoleOptions);
  const [assignmentLimit, setAssignmentLimit] = useState(
    initialAssignmentLimit != null ? String(initialAssignmentLimit) : '',
  );
  const [reasonForBoost, setReasonForBoost] = useState(initialReasonForBoost ?? '');
  const [errors, setErrors] = useState<{ states?: string; serviceDisciplines?: string; reasonForBoost?: string }>({});

  const handleActivateWithBoost = async () => {
    const nextErrors: typeof errors = {};
    if (states.length === 0) nextErrors.states = 'Select at least one state.';
    if (serviceDisciplines.length === 0) nextErrors.serviceDisciplines = 'Select at least one service discipline.';
    if (!reasonForBoost.trim()) nextErrors.reasonForBoost = 'Reason for Boost is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const result = await onActivateWithBoost({
      states,
      serviceDisciplines,
      assignmentLimit: assignmentLimit.trim() === '' ? null : Number(assignmentLimit),
      reasonForBoost: reasonForBoost.trim(),
    });
    if (result.success) onCancel();
  };

  // No validation — an empty/partial Reason for Boost (or any other field)
  // is ignored here, since nothing on this form gets saved on this path.
  const handleActivateWithoutBoost = async () => {
    setErrors({});
    const result = await onActivateWithoutBoost();
    if (result.success) onCancel();
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onCancel(); }}
    >
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">Apply Priority Boost</h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 3 }}>{companyName}</p>
          </div>
          <button type="button" className="modal__close" onClick={onCancel} disabled={saving} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal__body">
          {Object.values(errors).some(Boolean) && (
            <div className="alert alert--error" role="alert" style={{ margin: '0 0 14px' }}>
              {Object.values(errors).filter(Boolean).join(' ')}
            </div>
          )}

          <div className="form-group">
            <label className="form-label form-label--required">States</label>
            <CheckboxGrid
              options={US_STATES.filter((s) => s.code !== 'Virtual').map((s) => s.code)}
              selected={states}
              onChange={setStates}
              disabled={saving}
              gridClassName="vbm-states-grid"
              itemClassName="vbm-state-checkbox"
              itemCheckedClassName=""
              labelClassName=""
            />
            {errors.states && <span className="form-error" role="alert">{errors.states}</span>}
          </div>

          <div className="form-group">
            <label className="form-label form-label--required">Service Disciplines</label>
            <CheckboxGrid
              options={serviceRoleOptions}
              selected={serviceDisciplines}
              onChange={setServiceDisciplines}
              disabled={saving}
              emptyLabel="No service categories on this provider"
              gridClassName="vbm-disciplines-grid"
              itemCheckedClassName=""
            />
            {errors.serviceDisciplines && <span className="form-error" role="alert">{errors.serviceDisciplines}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Assignment Limit (Optional)</label>
            <input
              type="number"
              min={0}
              className="form-input"
              value={assignmentLimit}
              placeholder="Leave blank if no assignment limit is required"
              disabled={saving}
              onChange={(e) => setAssignmentLimit(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label form-label--required">Reason for Boost</label>
            <textarea
              className={`form-textarea${errors.reasonForBoost ? ' form-input--error' : ''}`}
              rows={3}
              value={reasonForBoost}
              placeholder="Explain why this provider is being fast-tracked…"
              disabled={saving}
              onChange={(e) => setReasonForBoost(e.target.value)}
            />
            {errors.reasonForBoost && <span className="form-error" role="alert">{errors.reasonForBoost}</span>}
          </div>
        </div>

        <div className="modal__footer" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--primary" onClick={handleActivateWithBoost} disabled={saving}>
            {saving ? 'Processing…' : 'Activate with Boost'}
          </button>
          <button type="button" className="btn btn--accept" onClick={handleActivateWithoutBoost} disabled={saving}>
            {saving ? 'Processing…' : 'Activate without Boost'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ─── Info Field ───────────────────────────────────────────────────────────────

const InfoField: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </span>
    <span style={{ fontSize: '0.88rem', color: value ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
      {value || '—'}
    </span>
  </div>
);

// ─── Upload trigger ───────────────────────────────────────────────────────────

const UploadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

interface UploadTriggerProps {
  vendorConfirmationId: string;
  disabled: boolean;
  isVendorUser: boolean;
  onFileSelected: (fileName: string, fileBase64: string) => void;
}

const UploadTrigger: React.FC<UploadTriggerProps> = ({
  vendorConfirmationId, disabled, isVendorUser, onFileSelected,
}) => {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fileBase64 = await fileToBase64(file);
      onFileSelected(file.name, fileBase64);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [onFileSelected]);

  const btnStyle: React.CSSProperties = {
    cursor: disabled || busy ? 'not-allowed' : 'pointer',
    opacity: disabled || busy ? 0.6 : 1,
    display: 'inline-flex', alignItems: 'center', gap: 4,
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <input
        ref={inputRef}
        type="file"
        id={`upload-${vendorConfirmationId}`}
        style={{ display: 'none' }}
        disabled={disabled || busy}
        onChange={handleChange}
        accept="*/*"
      />

      {isVendorUser ? (
        // Vendor: button triggers file picker; post-selection confirmation is handled in ConfItem
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          title="Upload document"
          disabled={disabled || busy}
          style={btnStyle}
          onClick={() => { if (!disabled && !busy) inputRef.current?.click(); }}
        >
          <UploadIcon /> {busy ? 'Reading…' : 'Upload'}
        </button>
      ) : (
        <label
          htmlFor={`upload-${vendorConfirmationId}`}
          className="btn btn--ghost btn--sm"
          title="Upload document"
          style={btnStyle}
        >
          <UploadIcon /> {busy ? 'Reading…' : 'Upload'}
        </label>
      )}
    </span>
  );
};

// ─── Document row ─────────────────────────────────────────────────────────────

interface DocRowProps {
  doc: ConfirmationDoc;
  vendorConfirmationId: string;
  isVendorActive: boolean;
  isVendorUser: boolean;
  disabled: boolean;
  onApprove: (vcId: string) => void;
  onSendBack: (vcId: string) => void;
}

const DocRow: React.FC<DocRowProps> = ({ doc, vendorConfirmationId, isVendorActive, isVendorUser, disabled, onApprove, onSendBack }) => (
  <div className="ql-doc">
    <span className="ql-doc__icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    </span>
    <span className="ql-doc__name">
      <a
        href={getDocumentUrl(doc._id)}
        target="_blank" rel="noopener noreferrer"
        title={doc.fileName}
        style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontSize: 'inherit' }}
      >
        {doc.fileName}
      </a>
    </span>
    <span className="ql-doc__meta">{formatDate(doc.uploadedAt)}</span>
    <span className="ql-doc__meta" style={{ minWidth: 48 }}>{doc.uploadedBy}</span>
    {doc.approvalStatus !== 'Approved' && (
      <span className={docStatusBadgeClass(doc.approvalStatus)} style={{ fontSize: '0.68rem' }}>
        {doc.approvalStatus}
      </span>
    )}
    {doc.comments && (
      <span className="ql-doc__meta" style={{ fontStyle: 'italic', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {doc.comments}
      </span>
    )}
    {/* Approve / Send Back — Claim Adjuster only */}
    {!isVendorUser && !isVendorActive && doc.approvalStatus === 'Pending' && (
      <span className="ql-doc__actions">
        <button type="button" className="btn btn--primary btn--sm" style={{ fontSize: '0.72rem', padding: '5px 10px' }} disabled={disabled} onClick={() => onApprove(vendorConfirmationId)}>
          Approve
        </button>
        <button type="button" className="btn btn--danger btn--sm" style={{ fontSize: '0.72rem', padding: '5px 10px' }} disabled={disabled} onClick={() => onSendBack(vendorConfirmationId)}>
          Send Back
        </button>
      </span>
    )}
  </div>
);

// ─── Draft document row (selected but not yet saved) ─────────────────────────

interface DraftDocRowProps {
  fileName: string;
  disabled: boolean;
  saving: boolean;
  isVendorUser: boolean;
  onApprove: () => void;
  onSendBack: () => void;
  onCallback: () => void;
}

const DraftDocRow: React.FC<DraftDocRowProps> = ({ fileName, disabled, saving, isVendorUser, onApprove, onSendBack, onCallback }) => (
  <div className="ql-doc">
    <span className="ql-doc__icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    </span>
    <span className="ql-doc__name" title={fileName}>{fileName}</span>
    <span className={docStatusBadgeClass('Pending')} style={{ fontSize: '0.68rem' }}>
      {saving ? 'Saving…' : 'Pending'}
    </span>
    <span className="ql-doc__actions">
      {isVendorUser ? (
        <button type="button" className="btn btn--primary btn--sm" style={{ fontSize: '0.72rem', padding: '5px 10px' }} disabled={disabled || saving} onClick={onCallback}>
          {saving ? 'Submitting…' : 'Callback'}
        </button>
      ) : (
        <>
          <button type="button" className="btn btn--primary btn--sm" style={{ fontSize: '0.72rem', padding: '5px 10px' }} disabled={disabled || saving} onClick={onApprove}>
            {saving ? 'Saving…' : 'Approve'}
          </button>
          <button type="button" className="btn btn--danger btn--sm" style={{ fontSize: '0.72rem', padding: '5px 10px' }} disabled={disabled || saving} onClick={onSendBack}>
            Send Back
          </button>
        </>
      )}
    </span>
  </div>
);

// ─── Confirmation item row ────────────────────────────────────────────────────

interface ConfItemProps {
  req: ConfirmationRequirement;
  vendorId: string;
  vendorStageId: string;
  isTechReadiness: boolean;
  isVendorActive: boolean;
  isVendorUser: boolean;
  isClientManager: boolean;
  uploadedByEmail: string;
  disabled: boolean;
  waiveReasons: WaiveReason[];
  readOnlyApproved?: boolean;
  onUpload: (payload: UploadPayload) => Promise<void>;
  onRecall: (vcId: string) => Promise<void>;
  onApprove: (vcId: string) => void;
  onSendBack: (vcId: string) => void;
  onSetAvailability: (vcId: string, stageId: string, status: 'Available' | 'Not Available') => void;
  onWaive: (payload: Omit<WaivePayload, 'vendorId'>) => void;
  onClearWaive: (vcId: string) => void;
}

const ConfItem: React.FC<ConfItemProps> = ({
  req, vendorId, vendorStageId, isTechReadiness, isVendorActive, isVendorUser, isClientManager, uploadedByEmail, disabled, waiveReasons,
  readOnlyApproved,
  onUpload, onRecall, onApprove, onSendBack, onSetAvailability, onWaive, onClearWaive,
}) => {
  const [waivedMode,       setWaivedMode]       = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [draftDoc,         setDraftDoc]         = useState<{ fileName: string; fileBase64: string } | null>(null);
  const [submitting,       setSubmitting]       = useState(false);
  const [recalling,        setRecalling]        = useState(false);
  const [uploadSuccess,    setUploadSuccess]    = useState(false);

  const isWaived       = req.waiveInfo != null;
  const currentAvail   = isTechReadiness ? req.documents[0]?.approvalStatus : undefined;
  const isAvailable    = currentAvail === 'Available';
  const isNotAvailable = currentAvail === 'Not Available';
  const itemStatus     = getItemStatus(req, isTechReadiness);
  const displayStatus  = readOnlyApproved ? 'APPROVED' : (isVendorActive && itemStatus === 'PENDING' ? 'APPROVED' : itemStatus);
  const isApproved     = displayStatus === 'APPROVED';
  // Vendor has an outstanding Pending doc — Upload should be hidden, Callback shown
  const hasPendingDoc  = req.documents.some((d) => d.approvalStatus === 'Pending');

  const handleApplyWaive = useCallback(() => {
    const reason = waiveReasons.find((r) => r.waiveReasonId === selectedReasonId);
    if (!reason) return;
    onWaive({ vendorStageId, vendorConfirmationId: req.vendorConfirmationId, waiveReasonId: reason.waiveReasonId, waiveReasonName: reason.waiveReasonName, waivedBy: 'admin' });
    setWaivedMode(false);
    setSelectedReasonId('');
  }, [waiveReasons, selectedReasonId, onWaive, vendorStageId, req.vendorConfirmationId]);

  const handleFileSelected = useCallback((fileName: string, fileBase64: string) => {
    setDraftDoc({ fileName, fileBase64 });
  }, []);

  // Adjuster: approve (save as Approved immediately)
  const handleApproveDraft = useCallback(async () => {
    if (!draftDoc) return;
    setSubmitting(true);
    try {
      await onUpload({
        vendorId, vendorStageId,
        vendorConfirmationId: req.vendorConfirmationId,
        fileName:    draftDoc.fileName,
        fileBase64:  draftDoc.fileBase64,
        uploadedBy:  'admin',
        approvalStatus: 'Approved',
      });
      setDraftDoc(null);
    } finally {
      setSubmitting(false);
    }
  }, [draftDoc, onUpload, vendorId, vendorStageId, req.vendorConfirmationId]);

  const handleSendBackDraft = useCallback(() => { setDraftDoc(null); }, []);

  // Vendor: confirm upload → save as Pending for adjuster review
  const handleVendorSubmit = useCallback(async () => {
    if (!draftDoc) return;
    setSubmitting(true);
    try {
      await onUpload({
        vendorId, vendorStageId,
        vendorConfirmationId: req.vendorConfirmationId,
        fileName:    draftDoc.fileName,
        fileBase64:  draftDoc.fileBase64,
        uploadedBy:  uploadedByEmail || 'vendor',
        approvalStatus: 'Pending',
      });
      setDraftDoc(null);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 5000);
    } finally {
      setSubmitting(false);
    }
  }, [draftDoc, onUpload, vendorId, vendorStageId, req.vendorConfirmationId, uploadedByEmail]);

  // Vendor: callback → delete the Pending document and re-enable Upload
  const handleRecall = useCallback(async () => {
    setRecalling(true);
    try {
      await onRecall(req.vendorConfirmationId);
      setUploadSuccess(false);
    } finally {
      setRecalling(false);
    }
  }, [onRecall, req.vendorConfirmationId]);

  return (
    <>
      <div className="ql-item">
        <span className={readOnlyApproved ? 'ql-item__dot ql-item__dot--approved' : itemDotClass(req, isTechReadiness)} />
        <span className="ql-item__name">{req.vendorConfirmationName}</span>
        <span className="ql-item__type">
          {req.isMandatory
            ? <span className="ql-badge-mandatory">Mandatory</span>
            : <span className="ql-badge-recommended">Recommended</span>
          }
        </span>
        <span className="ql-item__status">
          <span className={itemStatusBadgeClass(displayStatus)}>{displayStatus}</span>
        </span>

        {!isVendorActive && !readOnlyApproved && isTechReadiness && !isClientManager && (
          <span className="ql-item__actions" style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSetAvailability(req.vendorConfirmationId, vendorStageId, 'Available')}
              className={`ql-avail-btn ql-avail-btn--available${isAvailable ? ' ql-avail-btn--active-yes' : ''}`}
            >
              {isAvailable && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              Available
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSetAvailability(req.vendorConfirmationId, vendorStageId, 'Not Available')}
              className={`ql-avail-btn ql-avail-btn--not-available${isNotAvailable ? ' ql-avail-btn--active-no' : ''}`}
            >
              {isNotAvailable && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              Not Available
            </button>
          </span>
        )}

        {!isVendorActive && !readOnlyApproved && !isTechReadiness && !isClientManager && (
          <span className="ql-item__actions">
            {!isApproved && !req.isMandatory && (isWaived ? (
              <button
                type="button"
                className="ql-waive-btn ql-waive-btn--clear"
                disabled={disabled}
                onClick={() => onClearWaive(req.vendorConfirmationId)}
                title="Remove waive and revert to Pending"
              >
                Clear
              </button>
            ) : (
              !req.isMandatory && (
              <button
                type="button"
                className={`ql-waive-btn${waivedMode ? ' ql-waive-btn--clear' : ''}`}
                disabled={disabled}
                onClick={() => { setWaivedMode((p) => !p); setSelectedReasonId(''); }}
                title="Waive this requirement"
              >
                {waivedMode ? 'Cancel' : 'Waive'}
              </button>
              )
            ))}

            {/* Upload only available when no draft pending and (for vendor) no Pending doc exists yet */}
            {!isWaived && !isApproved && !draftDoc && !(isVendorUser && hasPendingDoc) && (
              <UploadTrigger
                vendorConfirmationId={req.vendorConfirmationId}
                disabled={disabled}
                isVendorUser={isVendorUser}
                onFileSelected={handleFileSelected}
              />
            )}
          </span>
        )}
      </div>

      {/* Waive reason selector (opens when Waive clicked) */}
      {waivedMode && !isTechReadiness && !isWaived && !req.isMandatory && !readOnlyApproved && (
        <div className="ql-waive-row">
          <span className="ql-waive-row__label">Waive reason:</span>
          <select
            className="ql-waive-select"
            value={selectedReasonId}
            onChange={(e) => setSelectedReasonId(e.target.value)}
          >
            <option value="">— Select a reason —</option>
            {waiveReasons.map((r) => (
              <option key={r.waiveReasonId} value={r.waiveReasonId}>{r.waiveReasonName}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            style={{ fontSize: '0.72rem', padding: '5px 12px' }}
            disabled={!selectedReasonId || disabled}
            onClick={handleApplyWaive}
          >
            Apply
          </button>
        </div>
      )}

      {/* Waive audit info row */}
      {isWaived && !isTechReadiness && req.waiveInfo && !readOnlyApproved && (
        <div className="ql-waive-info">
          <span className="ql-waive-info__reason">Reason: {req.waiveInfo.waiveReasonName}</span>
          <span className="ql-waive-info__meta">by {req.waiveInfo.waivedBy}</span>
          <span className="ql-waive-info__meta">on {formatDate(req.waiveInfo.waivedAt)}</span>
        </div>
      )}

      {/* Document sub-rows — only for non-Tech-Readiness */}
      {!isTechReadiness && !readOnlyApproved && req.documents.map((doc) => (
        <DocRow
          key={doc._id}
          doc={doc}
          vendorConfirmationId={req.vendorConfirmationId}
          isVendorActive={isVendorActive}
          isVendorUser={isVendorUser}
          disabled={disabled}
          onApprove={onApprove}
          onSendBack={onSendBack}
        />
      ))}

      {/* Adjuster only: draft row with Approve / Send Back actions */}
      {!isTechReadiness && !isVendorUser && draftDoc && !readOnlyApproved && (
        <DraftDocRow
          fileName={draftDoc.fileName}
          disabled={disabled}
          saving={submitting}
          isVendorUser={false}
          onApprove={handleApproveDraft}
          onSendBack={handleSendBackDraft}
          onCallback={() => {}}
        />
      )}

      {/* Vendor only: Callback row — shown when a Pending doc exists */}
      {isVendorUser && hasPendingDoc && !readOnlyApproved && (
        <div className="ql-doc" style={{ marginLeft: 20 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', flex: 1 }}>
            Document submitted for review
          </span>
          <span className="ql-doc__actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ fontSize: '0.72rem', padding: '5px 10px' }}
              disabled={disabled || recalling}
              onClick={() => void handleRecall()}
            >
              {recalling ? 'Recalling…' : 'Callback'}
            </button>
          </span>
        </div>
      )}

      {/* Vendor: confirmation modal — shown after file selected, before saving */}
      {isVendorUser && draftDoc && !readOnlyApproved && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal__header">
              <h2 className="modal__title">Confirm Document Upload</h2>
              <button type="button" className="modal__close" onClick={() => setDraftDoc(null)} disabled={submitting} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', marginBottom: 6 }}>
                Submit this document for adjuster review?
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                {draftDoc.fileName}
              </p>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={() => setDraftDoc(null)} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={() => void handleVendorSubmit()} disabled={submitting}>
                {submitting ? 'Uploading…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success banner — auto-hides after 5 s */}
      {uploadSuccess && (
        <div
          role="status"
          style={{
            margin: '6px 0 0 20px', padding: '8px 12px', borderRadius: 6,
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            color: '#15803d', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Document uploaded successfully and submitted for review.
        </div>
      )}
    </>
  );
};

// ─── Stage card ───────────────────────────────────────────────────────────────

interface StageCardProps {
  stage: ProcessingStage;
  vendorId: string;
  isVendorActive: boolean;
  isVendorUser: boolean;
  isClientManager: boolean;
  uploadedByEmail: string;
  disabled: boolean;
  waiveReasons: WaiveReason[];
  readOnlyApproved?: boolean;
  onUpload: (payload: UploadPayload) => Promise<void>;
  onRecall: (vcId: string) => Promise<void>;
  onApprove: (vcId: string) => void;
  onSendBack: (vcId: string) => void;
  onSetAvailability: (vcId: string, stageId: string, status: 'Available' | 'Not Available') => void;
  onWaive: (payload: Omit<WaivePayload, 'vendorId'>) => void;
  onClearWaive: (vcId: string) => void;
}

// Stage whose confirmation items are per-service-category questions (L1), grouped by service.
const ROLE_STAGE_CODES = new Set(['Service-Category_Specific']);

const StageCard: React.FC<StageCardProps> = ({
  stage, vendorId, isVendorActive, isVendorUser, isClientManager, uploadedByEmail, disabled, waiveReasons, readOnlyApproved,
  onUpload, onRecall, onApprove, onSendBack, onSetAvailability, onWaive, onClearWaive,
}) => {
  const [open, setOpen] = useState(true);
  const isTechReadiness = /technology|readiness/i.test(stage.vendorStageCode) || /technology|readiness/i.test(stage.vendorStageName);
  const isServiceScoped = ROLE_STAGE_CODES.has(stage.vendorStageCode);

  const renderConfItem = (req: ConfirmationRequirement) => (
    <ConfItem
      key={req.confirmationId || req.vendorConfirmationId}
      req={req}
      vendorId={vendorId}
      vendorStageId={stage.vendorStageId}
      isTechReadiness={isTechReadiness}
      isVendorActive={isVendorActive}
      isVendorUser={isVendorUser}
      isClientManager={isClientManager}
      uploadedByEmail={uploadedByEmail}
      disabled={disabled}
      waiveReasons={waiveReasons}
      readOnlyApproved={readOnlyApproved}
      onUpload={onUpload}
      onRecall={onRecall}
      onApprove={onApprove}
      onSendBack={onSendBack}
      onSetAvailability={onSetAvailability}
      onWaive={onWaive}
      onClearWaive={onClearWaive}
    />
  );

  return (
    <div className="ql-stage">
      <button
        type="button"
        className={`ql-stage__header${open ? ' ql-stage__header--open' : ''}`}
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
      >
        <span className={`ql-stage__chevron${open ? ' ql-stage__chevron--open' : ''}`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
        <span className="ql-stage__name">{stage.vendorStageName}</span>
        {stage.confirmations.length > 0 && (
          <span className="ql-stage__count">{stage.confirmations.length}</span>
        )}
        <span className={stageStatusClass(stage.stageStatus, isVendorActive || !!readOnlyApproved)}>
          <span className="ql-status--dot" />
          {stageStatusLabel(stage.stageStatus, isVendorActive || !!readOnlyApproved)}
        </span>
      </button>

      {open && (
        <div>
          {stage.confirmations.length === 0 ? (
            <p className="ql-empty">No confirmation requirements configured for this layer.</p>
          ) : isServiceScoped ? (
            groupByService(stage.confirmations).map((group) => (
              <div key={group.serviceRequestRoleId} className="ql-service-group">
                <div className="ql-service-group__header">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
                    <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
                  </svg>
                  {group.serviceRoleName}
                </div>
                {group.items
                  .sort((a, b) => (b.isMandatory ? 1 : 0) - (a.isMandatory ? 1 : 0))
                  .map(renderConfItem)}
              </div>
            ))
          ) : (
            [...stage.confirmations].sort((a, b) => (b.isMandatory ? 1 : 0) - (a.isMandatory ? 1 : 0)).map(renderConfItem)
          )}
        </div>
      )}
    </div>
  );
};

// ─── Types ────────────────────────────────────────────────────────────────────

type VodTab = 'Metrics' | 'Qualification';

// ─── Dialog config ────────────────────────────────────────────────────────────

type DialogAction = 'finalApprove' | 'suspend' | 'disqualify' | null;

const DIALOG_CONFIG: Record<Exclude<DialogAction, null>, { title: string; message: (companyName: string) => string; confirmLabel: string; confirmClass: string }> = {
  finalApprove: {
    title: 'Final Approve Service Provider',
    message: (companyName) => `Are you sure you want to final-approve ${companyName}? This will mark the provider as fully onboarded.`,
    confirmLabel: 'Activate Service Provider',
    confirmClass: 'btn--activate',
  },
  suspend: {
    title: 'Suspend Service Provider',
    message: (companyName) => `Are you sure you want to suspend ${companyName}? They will no longer be eligible for new work assignments.`,
    confirmLabel: 'Suspend',
    confirmClass: 'btn--danger',
  },
  disqualify: {
    title: 'Disqualify Service Provider',
    message: (companyName) => `Are you sure you want to disqualify ${companyName}? This action removes them from the active provider pool.`,
    confirmLabel: 'Disqualify',
    confirmClass: 'btn--danger',
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const VendorOnboardingDetails: React.FC = () => {
  const { vendorId = '' } = useParams<{ vendorId: string }>();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();
  const navFrom         = (location.state as { from?: string } | null)?.from ?? '';
  const fromVendorPanel = navFrom === 'vendor-panel';
  const fromAnalytics   = navFrom === 'analytics';

  const {
    details, loading, error, saving, notification,
    waiveReasons, statusHistory,
    uploadDoc, approveDoc, rejectDoc, sendBackDoc, recallDoc, finalApprove, applyBoost, suspend, disqualify, setAvailability,
    waiveItem, clearWaiveItem, activateFromPanel, updateServiceRoles, patchDetails,
  } = useVendorOnboardingDetails(vendorId);

  const [activeDialog, setActiveDialog] = useState<DialogAction>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [disqualifyReason, setDisqualifyReason] = useState('');
  const [sendBackTarget, setSendBackTarget] = useState<{ vcId: string } | null>(null);
  const [sendBackComment, setSendBackComment] = useState('');
  // In Progress / Suspended / Requalification Due (gated by boostRequired
  // below): clicking Activate opens this existing Priority Boost modal
  // directly — no separate confirmation dialog — with three footer actions
  // (Activate with Boost / Activate without Boost / Cancel) instead of the
  // old standalone "Apply Priority Boost" button.
  const [showBoostModal, setShowBoostModal] = useState(false);

  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());

  const [activeTab,          setActiveTab]          = useState<VodTab>('Qualification');

  const viResult = useMemo<VendorIntelligenceResult>(
    () => buildVendorIntelligence(details?.companyName ?? ''),
    [details?.companyName],
  );

  const isVendorUser          = user?.roleName === 'Vendor User';
  const isClientManager       = user?.roleName === 'Claims Supervisor';
  const isVendorActive        = details?.vendorStatus === 'Active';
  const isReadyForActivation  = details?.vendorStatus === 'Ready for Activation';
  const showStatusAndCoverage = details?.vendorStatus === 'Active' || details?.vendorStatus === 'Requalification Due'
    || details?.vendorStatus === 'Suspended' || details?.vendorStatus === 'Disqualified' || isReadyForActivation;
  const vendorUploadsDisabled = isVendorUser && details?.vendorStatus === 'Pending Approval';
  const showMetricsTab        = fromAnalytics && (details?.vendorStatus === 'Active' || details?.vendorStatus === 'Requalification Due');
  const qualifiedRoles = details?.roleSummary.filter((r) => r.isVendorRole).map((r) => ({ roleId: r.roleId, roleName: r.roleName })) ?? [];
  // Priority Boost: Suspended / Requalification Due vendors must complete a
  // Priority Boost before they can be reactivated (see finalApprove gate on the server).
  const boostRequired  = details?.vendorStatus === 'Suspended' || details?.vendorStatus === 'Requalification Due' || details?.vendorStatus === 'In Progress';
  const boostSatisfied = !boostRequired || !!details?.boostApplied;

  useEffect(() => {
    const status = details?.vendorStatus;
    const isActive = status === 'Active' || status === 'Requalification Due';
    setActiveTab(fromAnalytics && isActive ? 'Metrics' : 'Qualification');
  }, [details?.vendorId]);

  useEffect(() => {
    if (!details) return;
    setSelectedRoleIds(new Set(details.roleSummary.filter((r) => r.isVendorRole).map((r) => r.roleId)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details?.vendorId, details?.roleSummary.map((r) => r.roleId + r.isVendorRole).join(',')]);

  const handleToggleRole = useCallback((roleId: string) => {
    if (!details) return;

    const role = details.roleSummary.find((r) => r.roleId === roleId);
    if (!role) return;

    const adding = !selectedRoleIds.has(roleId);

    // Compute new role set (merge with locked roles for API call)
    const lockedIds = new Set(details.lockedServiceRoleIds ?? []);
    const nextSelected = new Set(selectedRoleIds);
    if (adding) nextSelected.add(roleId); else nextSelected.delete(roleId);
    const newRoleIds = [...new Set([...lockedIds, ...nextSelected])];

    // 1. Update local selection state immediately
    setSelectedRoleIds(nextSelected);

    // 2. Optimistically patch stages so L1 reflects the change instantly
    patchDetails((prev) => ({
      ...prev,
      roleSummary: prev.roleSummary.map((r) =>
        r.roleId === roleId ? { ...r, isVendorRole: adding } : r,
      ),
      stages: prev.stages.map((stage) => {
        if (!ROLE_STAGE_CODES.has(stage.vendorStageCode)) return stage;
        if (adding) {
          const alreadyExists = stage.confirmations.some((c) => c.vendorConfirmationId === `role_${roleId}`);
          if (alreadyExists) return stage;
          return {
            ...stage,
            confirmations: [
              ...stage.confirmations,
              {
                confirmationId:         `role_${roleId}`,
                vendorConfirmationId:   `role_${roleId}`,
                vendorConfirmationName: role.roleName,
                isMandatory:            true,
                documents:              [],
                waiveInfo:              null,
                serviceRequestRoleId:   roleId,
                serviceRoleName:        role.roleName,
              },
            ],
          };
        } else {
          return {
            ...stage,
            confirmations: stage.confirmations.filter((c) => c.vendorConfirmationId !== `role_${roleId}`),
          };
        }
      }),
    }));

    // 3. Persist to API in background (refetch on completion syncs authoritative state)
    void updateServiceRoles(newRoleIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, selectedRoleIds, patchDetails, updateServiceRoles]);

  const allStagesCompleted = details?.stages.every((s) => s.stageStatus === 'Completed') ?? false;

  const handleDialogConfirm = useCallback(async () => {
    if (!activeDialog) return;
    if (activeDialog === 'finalApprove') await finalApprove(user?.username);
    else if (activeDialog === 'suspend') await suspend(suspendReason.trim(), user?.username);
    else if (activeDialog === 'disqualify') await disqualify(disqualifyReason.trim(), user?.username);
    setActiveDialog(null);
    setSuspendReason('');
    setDisqualifyReason('');
  }, [activeDialog, finalApprove, suspend, disqualify, suspendReason, disqualifyReason, user?.username]);

  const handleApproveDoc   = useCallback((vcId: string) => { void approveDoc(vcId, ''); }, [approveDoc]);
  const handleOpenSendBack = useCallback((vcId: string) => {
    setSendBackComment('');
    setSendBackTarget({ vcId });
  }, []);
  const handleConfirmSendBack = useCallback(async () => {
    if (!sendBackTarget) return;
    await sendBackDoc(sendBackTarget.vcId, sendBackComment.trim());
    setSendBackTarget(null);
    setSendBackComment('');
  }, [sendBackTarget, sendBackComment, sendBackDoc]);
  const handleSetAvailability = useCallback(
    (vcId: string, stageId: string, status: 'Available' | 'Not Available') => {
      void setAvailability(stageId, vcId, status);
    },
    [setAvailability],
  );
  const handleWaive      = useCallback(
    (payload: Omit<WaivePayload, 'vendorId'>) => { void waiveItem(payload); },
    [waiveItem],
  );
  const handleClearWaive = useCallback(
    (vcId: string) => { void clearWaiveItem(vcId); },
    [clearWaiveItem],
  );

  return (
    <>
    <AppShell>
      <div>

        {/* Page header */}
        <div className="page-header--with-action" style={{ marginBottom: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="page-title" style={{ margin: 0 }}>
                {loading ? 'Loading…' : (details?.companyName ?? 'Service Provider Details')}
              </h1>
              {details && (
                <span className={vendorStatusBadgeClass(details.vendorStatus || '')}>
                  {details.vendorStatus ? vendorStatusDisplayLabel(details.vendorStatus) : 'No Status'}
                </span>
              )}
              {details?.vendorSource === 'panel' && (
                <span className="badge badge-blue" style={{ fontSize: '0.7rem', letterSpacing: '0.02em' }}>
                  Service Provider Panel
                </span>
              )}
            </div>
            <p className="page-subtitle" style={{ marginTop: 2 }}>Service Provider onboarding details and document review</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
            {/* Back link — hidden for Vendor User role */}
            {!isVendorUser && (
              <button
                type="button"
                aria-label="Back"
                onClick={() => navigate(-1)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  color: 'var(--color-text-muted)', fontSize: '0.82rem', fontWeight: 400,
                  lineHeight: 1.4,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </button>
            )}

            {details && !isVendorUser && (
              <div style={{ display: 'flex', gap: 8 }}>
                {isReadyForActivation ? (
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={saving}
                    onClick={() => void activateFromPanel(user?.username)}
                  >
                    {saving ? 'Activating…' : 'Activate'}
                  </button>
                ) : isVendorActive && !fromVendorPanel && !fromAnalytics ? (
                  <>
                    <button
                      type="button"
                      className="btn btn--danger"
                      disabled={saving}
                      onClick={() => { setSuspendReason(''); setActiveDialog('suspend'); }}
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      disabled={saving}
                      onClick={() => { setDisqualifyReason(''); setActiveDialog('disqualify'); }}
                    >
                      Disqualify
                    </button>
                  </>
                ) : isVendorActive && (fromVendorPanel || fromAnalytics) ? null : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn--activate"
                      disabled={saving || (!allStagesCompleted && !(boostRequired && boostSatisfied))}
                      onClick={() => {
                        // In Progress / Suspended / Requalification Due: open
                        // the existing Priority Boost modal directly — no
                        // separate confirmation screen — instead of the plain
                        // "Are you sure?" confirm used for every other status.
                        if (boostRequired) {
                          setShowBoostModal(true);
                          return;
                        }
                        setActiveDialog('finalApprove');
                      }}
                      title={
                        (!allStagesCompleted && !(boostRequired && boostSatisfied))
                          ? 'All stages must be completed first'
                          : undefined
                      }
                    >
                      Activate Service Provider
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`alert alert--${notification.type === 'success' ? 'success' : 'error'}`} role="alert" style={{ margin: '0 0 16px' }}>
            {notification.text}
          </div>
        )}

        {/* Suspension reason — shown above the Qualification layers */}
        {details?.suspendedReason && (
          <div className="alert alert--error" role="alert" style={{ margin: '0 0 16px' }}>
            <strong>Suspended due to:</strong> {details.suspendedReason}
          </div>
        )}

        {/* Disqualification reason — shown above the Qualification layers */}
        {details?.disqualifiedReason && (
          <div className="alert alert--error" role="alert" style={{ margin: '0 0 16px' }}>
            <strong>Disqualified due to:</strong> {details.disqualifiedReason}
          </div>
        )}

        {loading && <div className="detail-loading"><p className="text-sm-muted">Loading vendor details…</p></div>}
        {error && !loading && <div className="alert alert--error" role="alert">{error}</div>}

        {!loading && details && (
          <>
            {/* ── Tab bar — hidden when arriving from analytics (metrics-only view) ── */}
            {showMetricsTab && !fromAnalytics && (
              <div className="vod-tab-bar">
                {(['Metrics', 'Qualification'] as VodTab[]).map((tab) => (
                  <button key={tab} type="button"
                    className={`vod-tab${activeTab === tab ? ' vod-tab--active' : ''}`}
                    onClick={() => setActiveTab(tab)}>
                    {tab === 'Metrics' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5, verticalAlign: 'text-bottom' }}>
                        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                      </svg>
                    )}
                    {tab === 'Qualification' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5, verticalAlign: 'text-bottom' }}>
                        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                      </svg>
                    )}
                    {tab}
                  </button>
                ))}
              </div>
            )}

            {/* ── Metrics tab ── */}
            {showMetricsTab && activeTab === 'Metrics' && (
              <VendorPerformanceMetrics companyName={details.companyName} qualifiedRoles={qualifiedRoles} />
            )}

            {/* ── Qualification content — hidden in analytics metrics-only view ── */}
            {!fromAnalytics && (!showMetricsTab || activeTab === 'Qualification') && (
              <div className="vod-layout">

            {/* LEFT: Service Category Approval + Qualification layers */}
            <div className="vod-main">
              {(() => {
                const vendorRoles = details.roleSummary.filter((r) =>
                  (details.lockedServiceRoleIds ?? []).includes(r.roleId),
                );
                if (vendorRoles.length === 0) return null;
                return (
                <div className="vod-main-card">
                  <div style={{ marginBottom: 6 }}>
                    <h2 className="vod-section-title" style={{ margin: 0 }}>Service Category Approval</h2>
                  </div>
                  <p className="sca-info-text">
                    Qualified only when all 4 layers are Complete AND the L4 mandatory item for that category is Approved.
                  </p>
                  <div className="sca-grid">
                    {vendorRoles.map((role: RoleSummaryItem) => (
                      <div
                        key={role.roleId}
                        className={`sca-card${(details.vendorStatus === 'Active' || isReadyForActivation) ? ' sca-card--approved' : ' sca-card--selected'}`}
                        style={{ cursor: 'default' }}
                      >
                        <span className="sca-card__code">{role.roleCode}</span>
                        <span className={`sca-card__name${(details.vendorStatus === 'Active' || isReadyForActivation) ? ' sca-card__name--approved' : ''}`}>{role.roleName}</span>
                        <span className={
                          role.approvalStatus === 'Approved' || details.vendorStatus === 'Active' || isReadyForActivation
                            ? 'sca-card__status sca-card__status--approved'
                            : 'sca-card__status sca-card__status--pending'
                        }>
                          {(details.vendorStatus === 'Active' || isReadyForActivation) ? 'Qualified' : role.approvalStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })()}

              <div className="vod-main-card">
                <h2 className="vod-section-title">Qualification — 4 Layers</h2>
                <div className="ql-legend">
                  <span>Items tagged</span>
                  <span className="ql-badge-mandatory">Mandatory</span>
                  <span>must be Approved for the layer to be Complete. Items tagged</span>
                  <span className="ql-badge-recommended">Recommended</span>
                  <span>can be Waived with a reason and never block layer completion.</span>
                </div>
                {details.stages.length === 0 ? (
                  <p className="text-sm-muted">No stages configured for this provider.</p>
                ) : (
                  details.stages.map((stage) => (
                    <StageCard
                      key={stage.vendorStageId}
                      stage={stage}
                      vendorId={vendorId}
                      isVendorActive={details.vendorStatus === 'Active'}
                      isVendorUser={isVendorUser}
                      isClientManager={isClientManager}
                      uploadedByEmail={user?.email ?? ''}
                      disabled={saving || vendorUploadsDisabled}
                      waiveReasons={waiveReasons}
                      readOnlyApproved={isReadyForActivation}
                      onUpload={uploadDoc}
                      onRecall={recallDoc}
                      onApprove={handleApproveDoc}
                      onSendBack={handleOpenSendBack}
                      onSetAvailability={handleSetAvailability}
                      onWaive={handleWaive}
                      onClearWaive={handleClearWaive}
                    />
                  ))
                )}
              </div>

              {/* History — Suspend/Disqualified/Activation lifecycle log */}
              <div className="vod-main-card" style={{ padding: 0 }}>
                <div className="chl-card">
                  <div className="chl-card__header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                      </svg>
                      <span className="chl-card__title">History</span>
                    </div>
                    {statusHistory.length > 0 && <span className="chl-card__count">{statusHistory.length}</span>}
                  </div>

                  <div className="chl-card__body">
                    {statusHistory.length === 0 ? (
                      <div style={{ padding: '20px 18px' }}>
                        <p className="cid-log-item__empty">No suspend, disqualify, or activation events yet.</p>
                      </div>
                    ) : statusHistory.map((entry, idx) => {
                      const actionModifier =
                        entry.action === 'Suspended'    ? 'suspended' :
                        entry.action === 'Disqualified'  ? 'disqualified' : 'activated';
                      const formatted = entry.performedAt
                        ? new Date(entry.performedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—';
                      return (
                        <div key={entry.historyId}
                          className={`chl-entry${idx < statusHistory.length - 1 ? ' chl-entry--bordered' : ''}`}>
                          <div className={`chl-entry__accent chl-entry__accent--${actionModifier}`} />
                          <div className="chl-entry__content">
                            <div className="chl-entry__row">
                              <span className={`chl-entry__type chl-entry__type--${actionModifier}`}>
                                {entry.action.toUpperCase()}
                              </span>
                              <span className="chl-entry__title">Provider {entry.action}</span>
                            </div>
                            {entry.reason && <div className="chl-entry__reason">"{entry.reason}"</div>}
                            {entry.remarks && <div className="chl-entry__reason">{entry.remarks}</div>}
                            <div className="chl-entry__footer">{formatted} · {entry.performedBy || 'System'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT: Provider Status + Provider Intelligence */}
            <aside className="vod-sidebar">
              {/* Provider Status — Active / Requalification Due / Ready for Activation / Suspended / Disqualified providers */}
              {showStatusAndCoverage ? (
                <div className="vod-card">
                  <h3 className="vod-card__title">Service Provider Status</h3>
                  <div className="vod-status-rows">
                    <div className="vod-status-row">
                      <span className="vod-status-label">Service Provider Status</span>
                      <span className={vendorStatusBadgeClass(details.vendorStatus)} style={{ fontSize: '0.72rem' }}>
                        {details.vendorStatus ? vendorStatusDisplayLabel(details.vendorStatus) : 'N/A'}
                      </span>
                    </div>
                    {details.requalDue && !isReadyForActivation && (
                      <div className="vod-status-row">
                        <span className="vod-status-label">Requalification Due Date</span>
                        <span className="vod-status-value">{formatDate(details.requalDue)}</span>
                      </div>
                    )}
                    <div className="vod-status-row vod-status-row--last">
                      <span className="vod-status-label">Member Since</span>
                      <span className="vod-status-value">{formatDate(details.memberSince)}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Geographic Coverage — Active / Requalification Due / Ready for Activation / Suspended / Disqualified providers */}
              {details.coverage && showStatusAndCoverage ? (
                <div className="vod-card">
                  <h3 className="vod-card__title">Geographic Coverage</h3>
                  <span className="vod-status-value">{formatCoverageDisplay(details.coverage)}</span>
                </div>
              ) : null}

              {/* Vendor Intelligence */}
              <VendorIntelligenceCard
                result={viResult}
                company={details.companyName}
              />
            </aside>
          </div>
            )}
          </>
        )}
      </div>

      {activeDialog && (
        <ConfirmModal
          {...DIALOG_CONFIG[activeDialog]}
          message={DIALOG_CONFIG[activeDialog].message(details?.companyName ?? 'this provider')}
          loading={saving}
          confirmDisabled={
            (activeDialog === 'suspend' && !suspendReason.trim())
            || (activeDialog === 'disqualify' && !disqualifyReason.trim())
          }
          onConfirm={handleDialogConfirm}
          onCancel={() => { setActiveDialog(null); setSuspendReason(''); setDisqualifyReason(''); }}
        >
          {activeDialog === 'suspend' && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label form-label--required">Suspension Reason</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={suspendReason}
                placeholder="Enter the reason for suspending this provider…"
                onChange={(e) => setSuspendReason(e.target.value)}
                autoFocus
              />
            </div>
          )}
          {activeDialog === 'disqualify' && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label form-label--required">Disqualification Reason</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={disqualifyReason}
                placeholder="Enter the reason for disqualifying this provider…"
                onChange={(e) => setDisqualifyReason(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </ConfirmModal>
      )}

      {showBoostModal && details && (
        <PriorityBoostModal
          companyName={details.companyName}
          serviceRoleOptions={details.serviceRoles.map((r) => r.roleName)}
          initialStates={details.priorityBoost?.states ?? details.coverage
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s && s !== 'Virtual' && US_STATES.some((st) => st.code === s))}
          initialServiceDisciplines={details.priorityBoost?.serviceDisciplines}
          initialAssignmentLimit={details.priorityBoost?.assignmentLimit}
          initialReasonForBoost={details.priorityBoost?.reasonForBoost}
          saving={saving}
          onCancel={() => setShowBoostModal(false)}
          onActivateWithBoost={async (payload) => {
            // Save the Priority Boost, then activate in the same action. The
            // modal only closes (see PriorityBoostModal.handleActivateWithBoost)
            // if this resolves success: true, so a boost that saved but
            // couldn't activate leaves the form open (with the page-level
            // error already shown by finalApprove's own showNote) rather than
            // silently losing the user's entries.
            const boostResult = await applyBoost({ ...payload, performedBy: user?.username });
            if (!boostResult.success) return boostResult;
            const activateResult = await finalApprove(user?.username);
            return activateResult.success
              ? activateResult
              : { success: false, message: activateResult.message || 'Priority Boost saved, but activation failed. Please try again.' };
          }}
          onActivateWithoutBoost={() => {
            // No validation, nothing on this form is saved — resetBoost:true
            // makes sure the vendor's Boost value reads No even if a PRIOR
            // Priority Boost had left it Yes.
            return finalApprove(user?.username, true);
          }}
        />
      )}

      {sendBackTarget && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget && !saving) setSendBackTarget(null); }}
        >
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal__header">
              <h2 className="modal__title">Send Back Document</h2>
              <button type="button" className="modal__close" onClick={() => setSendBackTarget(null)} disabled={saving} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', marginBottom: 12 }}>
                The document will be sent back to the vendor for revision. They will be able to re-upload a corrected version.
              </p>
              <div className="form-group">
                <label className="form-label form-label--required">Feedback / Reason</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={sendBackComment}
                  placeholder="Describe what needs to be corrected or resubmitted…"
                  onChange={(e) => setSendBackComment(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={() => setSendBackTarget(null)} disabled={saving}>Cancel</button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => void handleConfirmSendBack()}
                disabled={saving || !sendBackComment.trim()}
              >
                {saving ? 'Sending…' : 'Send Back'}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>

    </>
  );
};

export default VendorOnboardingDetails;
