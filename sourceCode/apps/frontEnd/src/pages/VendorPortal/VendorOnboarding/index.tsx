import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import VendorPortalShell from '../../../components/layout/VendorPortalShell';
import {
  getOnboardingDetails,
  uploadDocument,
  removeDraftDocument,
  submitDraftDocument,
  resubmitApplication,
  getDocumentUrl,
  setAvailability as setAvailabilityApi,
  getWaiveReasons,
  waiveConfirmation,
  clearWaive as clearWaiveApi,
} from '../../../services/vendorOnboarding/vendorOnboardingService';
import type {
  VendorOnboardingDetails,
  ProcessingStage,
  ConfirmationRequirement,
  ConfirmationDoc,
  WaiveReason,
} from '../../../models/vendorOnboarding/vendorOnboardingModel';
import { useAuth } from '../../../context/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
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

function getDotClass(req: ConfirmationRequirement, hasLocal: boolean, isTechReadiness: boolean): string {
  if (req.waiveInfo) return 'ql-item__dot ql-item__dot--pending';
  if (hasLocal) return 'ql-item__dot ql-item__dot--pending';
  if (isTechReadiness) {
    const s = req.documents[0]?.approvalStatus;
    if (s === 'Available') return 'ql-item__dot ql-item__dot--approved';
    return 'ql-item__dot';
  }
  const active = req.documents.filter((d) => d.approvalStatus !== 'Draft');
  if (!active.length) return 'ql-item__dot';
  if (active.some((d) => d.approvalStatus === 'Rejected'))  return 'ql-item__dot ql-item__dot--rejected';
  if (active.every((d) => d.approvalStatus === 'Approved')) return 'ql-item__dot ql-item__dot--approved';
  return 'ql-item__dot ql-item__dot--pending';
}

function getItemStatus(req: ConfirmationRequirement, hasLocal: boolean, isTechReadiness: boolean): string {
  if (req.waiveInfo) return 'WAIVED';
  if (hasLocal) return 'STAGED';
  if (isTechReadiness) {
    const s = req.documents[0]?.approvalStatus;
    if (s === 'Available')     return 'AVAILABLE';
    if (s === 'Not Available') return 'NOT AVAIL';
    return 'PENDING';
  }
  const active = req.documents.filter((d) => d.approvalStatus !== 'Draft');
  if (req.documents.some((d) => d.approvalStatus === 'Draft')) return 'DRAFT';
  if (!active.length) return 'PENDING';
  if (active.some((d) => d.approvalStatus === 'Approved'))  return 'APPROVED';
  if (active.some((d) => d.approvalStatus === 'Rejected'))  return 'REJECTED';
  if (active.some((d) => d.approvalStatus === 'Sent Back')) return 'SENT BACK';
  return 'PENDING';
}

function getStatusBadgeClass(status: string): string {
  if (status === 'WAIVED')      return 'ql-item-status ql-item-status--waived';
  if (status === 'APPROVED')    return 'ql-item-status ql-item-status--approved';
  if (status === 'AVAILABLE')   return 'ql-item-status ql-item-status--available';
  if (status === 'REJECTED')    return 'ql-item-status ql-item-status--rejected';
  if (status === 'SENT BACK')   return 'ql-item-status ql-item-status--sendback';
  if (status === 'DRAFT' || status === 'STAGED') return 'ql-item-status ql-item-status--in-progress';
  return 'ql-item-status ql-item-status--pending';
}

function getDocBadgeClass(status: ConfirmationDoc['approvalStatus']): string {
  if (status === 'Approved')  return 'badge badge-green';
  if (status === 'Rejected')  return 'badge badge-red';
  if (status === 'Sent Back') return 'badge badge-orange';
  if (status === 'Draft')     return 'badge badge-yellow';
  return 'badge badge-yellow';
}

function getStageStatusClass(stage: ProcessingStage): string {
  if (stage.stageStatus === 'Completed') return 'ql-status ql-status--completed';
  if (stage.stageStatus === 'Rejected')  return 'ql-status ql-status--rejected';
  return 'ql-status ql-status--in-progress';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalFileEntry {
  vendorConfirmationId: string;
  vendorStageId:        string;
  itemName:             string;
  fileName:             string;
  fileBase64:           string;
  blobUrl:              string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const FileIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const UploadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

// ─── Global Action Bar ────────────────────────────────────────────────────────

interface GlobalActionBarProps {
  companyName:       string | undefined;
  stagedCount:       number;
  draftCount:        number;
  isPendingApproval: boolean;
  isSubmitted:       boolean;
  isSendBack:        boolean;
  isSavingDraft:     boolean;
  isSubmitting:      boolean;
  onSaveDraft:       () => void;
  onSubmit:          () => void;
}

const GlobalActionBar: React.FC<GlobalActionBarProps> = ({
  companyName, stagedCount, draftCount,
  isPendingApproval, isSubmitted, isSendBack,
  isSavingDraft, isSubmitting, onSaveDraft, onSubmit,
}) => {
  const busy         = isSavingDraft || isSubmitting;
  const canSaveDraft = !isPendingApproval && !isSubmitted && stagedCount > 0 && !busy;
  const canSubmit    = !isPendingApproval && !isSubmitted && (stagedCount > 0 || draftCount > 0) && !busy;
  const canReSubmit  = isSendBack && (stagedCount > 0 || draftCount > 0) && !busy;

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: '#fff',
      borderBottom: '1px solid var(--color-border)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      padding: '16px 36px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
    }}>
      {/* Title */}
      <div>
        <p className="vpo-breadcrumb" style={{ margin: 0 }}>Service Provider Portal</p>
        <h1 className="vpo-page-title" style={{ margin: 0 }}>
          {companyName ? `Welcome, ${companyName}` : 'My Onboarding'}
        </h1>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {isPendingApproval ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 12px' }}>
            <ClockIcon />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#92400e' }}>
              Awaiting Approval
            </span>
          </div>
        ) : isSendBack ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: '6px 12px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#c2410c' }}>
                Corrections Required — Re-upload sent-back documents
              </span>
            </div>
            {(stagedCount > 0 || draftCount > 0) && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {stagedCount > 0 && `${stagedCount} staged`}
                {stagedCount > 0 && draftCount > 0 && ' · '}
                {draftCount > 0 && `${draftCount} draft`}
              </span>
            )}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={!canSaveDraft}
              onClick={onSaveDraft}
              style={{ minWidth: 100 }}
            >
              {isSavingDraft ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={!canReSubmit}
              onClick={onSubmit}
              style={{ minWidth: 100 }}
            >
              {isSubmitting ? 'Submitting…' : 'Re-Submit'}
            </button>
          </>
        ) : isSubmitted ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 12px' }}>
            <CheckCircleIcon />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#15803d' }}>
              Submitted — Pending Review
            </span>
          </div>
        ) : (
          <>
            {(stagedCount > 0 || draftCount > 0) && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {stagedCount > 0 && `${stagedCount} staged`}
                {stagedCount > 0 && draftCount > 0 && ' · '}
                {draftCount > 0 && `${draftCount} draft`}
              </span>
            )}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={!canSaveDraft}
              onClick={onSaveDraft}
              style={{ minWidth: 100 }}
            >
              {isSavingDraft ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={!canSubmit}
              onClick={onSubmit}
              style={{ minWidth: 80 }}
            >
              {isSubmitting ? 'Submitting…' : 'Submit'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── ConfItemPortal ───────────────────────────────────────────────────────────

interface ConfItemPortalProps {
  req:                ConfirmationRequirement;
  vendorStageId:      string;
  isReadOnly:         boolean;
  isTechReadiness:    boolean;
  localFile:          LocalFileEntry | null;
  removingId:         string | null;
  settingAvailId:     string | null;
  waiveReasons:       WaiveReason[];
  onFileSelected:     (entry: LocalFileEntry) => void;
  onDiscardLocal:     (vcId: string) => void;
  onRemoveDbDraft:    (vcId: string) => void;
  onSetAvailability:  (vcId: string, stageId: string, status: 'Available' | 'Not Available') => void;
  onWaive:            (vcId: string, stageId: string, reasonId: string, reasonName: string) => void;
  onClearWaive:       (vcId: string) => void;
}

const ConfItemPortal: React.FC<ConfItemPortalProps> = ({
  req, vendorStageId, isReadOnly, isTechReadiness,
  localFile, removingId, settingAvailId, waiveReasons,
  onFileSelected, onDiscardLocal, onRemoveDbDraft, onSetAvailability, onWaive, onClearWaive,
}) => {
  const inputRef           = useRef<HTMLInputElement>(null);
  const [waivedMode,       setWaivedMode]       = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState('');

  const vcId          = req.vendorConfirmationId;
  const dbDraft       = req.documents.find((d) => d.approvalStatus === 'Draft') ?? null;
  const hasPending    = req.documents.some((d) => d.approvalStatus === 'Pending');
  const isWaived      = req.waiveInfo !== null;
  const itemStatus    = getItemStatus(req, localFile !== null, isTechReadiness);
  const isApproved    = itemStatus === 'APPROVED' || itemStatus === 'AVAILABLE';
  const isRemoving    = removingId === vcId;
  const isBusyAvail   = settingAvailId === vcId;

  // Current availability for tech readiness items
  const currentAvail    = isTechReadiness ? req.documents[0]?.approvalStatus : undefined;
  const isAvailable     = currentAvail === 'Available';
  const isNotAvailable  = currentAvail === 'Not Available';

  // Upload: disabled for tech readiness items, read-only, waived, approved, or already staged/drafted/pending
  const canUpload = !isTechReadiness && !isReadOnly && !isWaived && !isApproved && !localFile && !dbDraft && !hasPending;

  const handleApplyWaive = useCallback(() => {
    const reason = waiveReasons.find((r) => r.waiveReasonId === selectedReasonId);
    if (!reason) return;
    onWaive(vcId, vendorStageId, reason.waiveReasonId, reason.waiveReasonName);
    setWaivedMode(false);
    setSelectedReasonId('');
  }, [waiveReasons, selectedReasonId, onWaive, vcId, vendorStageId]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileBase64 = await fileToBase64(file);
    const blobUrl    = URL.createObjectURL(file);
    onFileSelected({ vendorConfirmationId: vcId, vendorStageId, itemName: req.vendorConfirmationName, fileName: file.name, fileBase64, blobUrl });
    if (inputRef.current) inputRef.current.value = '';
  }, [onFileSelected, vcId, vendorStageId, req.vendorConfirmationName]);

  return (
    <>
      {/* ── Item row ──────────────────────────────────────────────── */}
      <div className="ql-item">
        <span className={getDotClass(req, localFile !== null, isTechReadiness)} />
        <span className="ql-item__name">{req.vendorConfirmationName}</span>
        <span className="ql-item__type">
          {req.isMandatory
            ? <span className="ql-badge-mandatory">Mandatory</span>
            : <span className="ql-badge-recommended">Recommended</span>}
        </span>
        <span className="ql-item__status">
          <span className={getStatusBadgeClass(itemStatus)}>{itemStatus}</span>
        </span>
        <span className="ql-item__actions">
          {/* L3 Tech Readiness: vendor self-declares Available / Not Available */}
          {isTechReadiness && !isReadOnly && (
            <>
              <button
                type="button"
                disabled={isBusyAvail}
                onClick={() => onSetAvailability(vcId, vendorStageId, 'Available')}
                className={`ql-avail-btn ql-avail-btn--available${isAvailable ? ' ql-avail-btn--active-yes' : ''}`}
              >
                {isAvailable && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {isBusyAvail ? '…' : 'Available'}
              </button>
              <button
                type="button"
                disabled={isBusyAvail}
                onClick={() => onSetAvailability(vcId, vendorStageId, 'Not Available')}
                className={`ql-avail-btn ql-avail-btn--not-available${isNotAvailable ? ' ql-avail-btn--active-no' : ''}`}
              >
                {isNotAvailable && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
                {isBusyAvail ? '…' : 'Not Available'}
              </button>
            </>
          )}
          {/* Recommended items: Waive / Clear Waive */}
          {!isTechReadiness && !req.isMandatory && !isApproved && !isReadOnly && (
            isWaived ? (
              <button
                type="button"
                className="ql-waive-btn ql-waive-btn--clear"
                onClick={() => onClearWaive(vcId)}
                title="Remove waive and revert to Pending"
              >
                Clear
              </button>
            ) : (
              <button
                type="button"
                className={`ql-waive-btn${waivedMode ? ' ql-waive-btn--clear' : ''}`}
                onClick={() => { setWaivedMode((p) => !p); setSelectedReasonId(''); }}
                title="Waive this requirement"
              >
                {waivedMode ? 'Cancel' : 'Waive'}
              </button>
            )
          )}
          {/* Other layers: upload button */}
          {canUpload && (
            <>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => inputRef.current?.click()}
              >
                <UploadIcon /> Upload
              </button>
              <input
                ref={inputRef}
                type="file"
                style={{ display: 'none' }}
                accept="*/*"
                onChange={(e) => void handleFileChange(e)}
              />
            </>
          )}
        </span>
      </div>

      {/* Waive reason selector */}
      {waivedMode && !isWaived && !req.isMandatory && (
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
            disabled={!selectedReasonId}
            onClick={handleApplyWaive}
          >
            Apply
          </button>
        </div>
      )}

      {/* Waive audit info */}
      {isWaived && req.waiveInfo && (
        <div className="ql-waive-info">
          <span className="ql-waive-info__reason">Reason: {req.waiveInfo.waiveReasonName}</span>
          <span className="ql-waive-info__meta">by {req.waiveInfo.waivedBy}</span>
        </div>
      )}

      {/* ── Local staged file (not yet saved to DB) ───────────────── */}
      {localFile && (
        <div className="ql-doc" style={{ background: '#f0f9ff', borderLeft: '3px solid #3b82f6' }}>
          <span className="ql-doc__icon"><FileIcon /></span>
          <span className="ql-doc__name">
            <a
              href={localFile.blobUrl}
              target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontSize: 'inherit' }}
              title="Preview selected file"
            >
              {localFile.fileName}
            </a>
          </span>
          <span className="badge" style={{ fontSize: '0.65rem', background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
            Staged
          </span>
          <span className="ql-doc__actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ fontSize: '0.72rem' }}
              onClick={() => onDiscardLocal(vcId)}
            >
              Remove
            </button>
          </span>
        </div>
      )}

      {/* ── DB draft (saved, not yet submitted) ───────────────────── */}
      {dbDraft && !localFile && (
        <div className="ql-doc" style={{ background: '#fffbeb', borderLeft: '3px solid #f59e0b' }}>
          <span className="ql-doc__icon"><FileIcon /></span>
          <span className="ql-doc__name">
            <a
              href={getDocumentUrl(dbDraft._id)}
              target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontSize: 'inherit' }}
              title="Preview draft document"
            >
              {dbDraft.fileName}
            </a>
          </span>
          <span className="badge badge-yellow" style={{ fontSize: '0.68rem' }}>Draft</span>
          {!isReadOnly && (
            <span className="ql-doc__actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ fontSize: '0.72rem' }}
                disabled={isRemoving}
                onClick={() => onRemoveDbDraft(vcId)}
              >
                {isRemoving ? 'Removing…' : 'Remove'}
              </button>
              <>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ fontSize: '0.72rem' }}
                  disabled={isRemoving}
                  onClick={() => inputRef.current?.click()}
                >
                  Replace
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept="*/*"
                  onChange={(e) => void handleFileChange(e)}
                />
              </>
            </span>
          )}
        </div>
      )}

      {/* ── Submitted docs — not shown for L3 tech readiness (no real file) ── */}
      {!isTechReadiness && req.documents
        .filter((d) => d.approvalStatus !== 'Draft')
        .map((doc) => (
          <div
            key={doc._id}
            className="ql-doc"
            style={doc.approvalStatus === 'Sent Back' ? { background: '#fff7ed', borderLeft: '3px solid #f97316' } : undefined}
          >
            <span className="ql-doc__icon"><FileIcon /></span>
            <span className="ql-doc__name">
              <a
                href={getDocumentUrl(doc._id)}
                target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontSize: 'inherit' }}
              >
                {doc.fileName}
              </a>
            </span>
            <span className="ql-doc__meta">{formatDate(doc.uploadedAt)}</span>
            <span className="ql-doc__meta">{doc.uploadedBy}</span>
            <span className={getDocBadgeClass(doc.approvalStatus)} style={{ fontSize: '0.68rem' }}>
              {doc.approvalStatus}
            </span>
            {doc.approvalStatus === 'Sent Back' && doc.comments && (
              <span style={{ fontSize: '0.78rem', color: '#c2410c', fontStyle: 'italic', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.comments}>
                {doc.comments}
              </span>
            )}
          </div>
        ))}
    </>
  );
};

// ─── Stage card ───────────────────────────────────────────────────────────────

interface StageCardPortalProps {
  stage:              ProcessingStage;
  vendorId:           string;
  isReadOnly:         boolean;
  localFiles:         Record<string, LocalFileEntry>;
  removingId:         string | null;
  settingAvailId:     string | null;
  waiveReasons:       WaiveReason[];
  onFileSelected:     (entry: LocalFileEntry) => void;
  onDiscardLocal:     (vcId: string) => void;
  onRemoveDbDraft:    (vcId: string) => void;
  onSetAvailability:  (vcId: string, stageId: string, status: 'Available' | 'Not Available') => void;
  onWaive:            (vcId: string, stageId: string, reasonId: string, reasonName: string) => void;
  onClearWaive:       (vcId: string) => void;
}

// Stage whose confirmation items are per-service-category questions (L1), grouped by service.
const ROLE_STAGE_CODES = new Set(['Service-Category_Specific']);

const StageCardPortal: React.FC<StageCardPortalProps> = ({
  stage, isReadOnly, localFiles, removingId, settingAvailId, waiveReasons,
  onFileSelected, onDiscardLocal, onRemoveDbDraft, onSetAvailability, onWaive, onClearWaive,
}) => {
  const [open, setOpen] = useState(true);
  const isTechReadiness = /technology|readiness/i.test(stage.vendorStageCode) || /technology|readiness/i.test(stage.vendorStageName);
  const isServiceScoped = ROLE_STAGE_CODES.has(stage.vendorStageCode);

  const renderConfItem = (req: ConfirmationRequirement) => (
    <ConfItemPortal
      key={req.confirmationId || req.vendorConfirmationId}
      req={req}
      vendorStageId={stage.vendorStageId}
      isReadOnly={isReadOnly}
      isTechReadiness={isTechReadiness}
      localFile={localFiles[req.vendorConfirmationId] ?? null}
      removingId={removingId}
      settingAvailId={settingAvailId}
      waiveReasons={waiveReasons}
      onFileSelected={onFileSelected}
      onDiscardLocal={onDiscardLocal}
      onRemoveDbDraft={onRemoveDbDraft}
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
        <span className={getStageStatusClass(stage)}>
          <span className="ql-status--dot" />
          {stage.stageStatus}
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
            [...stage.confirmations]
              .sort((a, b) => (b.isMandatory ? 1 : 0) - (a.isMandatory ? 1 : 0))
              .map(renderConfItem)
          )}
        </div>
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const VendorOnboardingPage: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { user }     = useAuth();

  const [details,        setDetails]        = useState<VendorOnboardingDetails | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [toast,          setToast]          = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [localFiles,     setLocalFiles]     = useState<Record<string, LocalFileEntry>>({});
  const [removingId,     setRemovingId]     = useState<string | null>(null);
  const [isSavingDraft,  setIsSavingDraft]  = useState(false);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [settingAvailId, setSettingAvailId] = useState<string | null>(null);
  const [waiveReasons,   setWaiveReasons]   = useState<WaiveReason[]>([]);

  const load = useCallback(async () => {
    if (!vendorId) return;
    try {
      const data = await getOnboardingDetails(vendorId);
      setDetails(data);
    } catch {
      setError('Failed to load checklist. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    getWaiveReasons()
      .then(setWaiveReasons)
      .catch(() => {});
  }, []);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // ── Derive overall state ──────────────────────────────────────────────────

  const vendorStatus      = details?.vendorStatus ?? '';
  const isPendingApproval = vendorStatus === 'Pending Approval';
  // Fallback: detect SendBack from document-level status in case vendorStatus hasn't propagated yet
  const hasSentBackDocs = details?.stages.some((s) =>
    s.confirmations.some((c) => c.documents.some((d) => d.approvalStatus === 'Sent Back'))
  ) ?? false;
  const isSendBack = vendorStatus === 'SendBack' || vendorStatus === 'Send Back' || hasSentBackDocs;

  const dbDraftVcIds: string[] = details
    ? details.stages.flatMap((s) =>
        s.confirmations
          .filter((c) => c.documents.some((d) => d.approvalStatus === 'Draft'))
          .map((c) => c.vendorConfirmationId)
      )
    : [];

  const hasLocalFiles = Object.keys(localFiles).length > 0;
  const hasDraftDocs  = dbDraftVcIds.length > 0;

  const hasSubmittedDocs = details
    ? details.stages.some((s) =>
        s.confirmations.some((c) =>
          c.documents.some((d) => ['Pending', 'Approved', 'Rejected', 'Sent Back'].includes(d.approvalStatus))
        )
      )
    : false;

  // Submitted: package sent for review, no pending local/draft changes
  const isSubmitted = !isPendingApproval && !hasLocalFiles && !hasDraftDocs && hasSubmittedDocs;

  // Upload controls disabled when pending approval or already submitted.
  // For 'SendBack' vendors, allow editing so they can re-upload corrected documents.
  const isReadOnly = isPendingApproval || (isSubmitted && !isSendBack);

  // ── Local file management ─────────────────────────────────────────────────

  const handleFileSelected = useCallback((entry: LocalFileEntry) => {
    setLocalFiles((prev) => ({ ...prev, [entry.vendorConfirmationId]: entry }));
  }, []);

  const handleDiscardLocal = useCallback((vcId: string) => {
    setLocalFiles((prev) => {
      const entry = prev[vcId];
      if (entry) URL.revokeObjectURL(entry.blobUrl);
      const next = { ...prev };
      delete next[vcId];
      return next;
    });
  }, []);

  // ── DB draft remove ───────────────────────────────────────────────────────

  const handleRemoveDbDraft = useCallback(async (vcId: string) => {
    if (!vendorId) return;
    setRemovingId(vcId);
    try {
      const result = await removeDraftDocument(vendorId, vcId);
      if (result.success) {
        await load();
      } else {
        showToast('error', result.message || 'Remove failed.');
      }
    } catch {
      showToast('error', 'Remove failed. Please try again.');
    } finally {
      setRemovingId(null);
    }
  }, [vendorId, load, showToast]);

  // ── Set Availability (L3 Tech Readiness) ─────────────────────────────────

  const handleSetAvailability = useCallback(async (
    vcId: string,
    stageId: string,
    status: 'Available' | 'Not Available',
  ) => {
    if (!vendorId) return;
    setSettingAvailId(vcId);
    try {
      const result = await setAvailabilityApi(vendorId, stageId, vcId, status);
      if (result.success) {
        await load();
      } else {
        showToast('error', result.message || 'Could not save availability.');
      }
    } catch {
      showToast('error', 'Could not save availability. Please try again.');
    } finally {
      setSettingAvailId(null);
    }
  }, [vendorId, load, showToast]);

  // ── Waive / Clear Waive ───────────────────────────────────────────────────

  const handleWaive = useCallback(async (
    vcId: string,
    stageId: string,
    reasonId: string,
    reasonName: string,
  ) => {
    if (!vendorId) return;
    try {
      await waiveConfirmation({
        vendorId,
        vendorStageId:        stageId,
        vendorConfirmationId: vcId,
        waiveReasonId:        reasonId,
        waiveReasonName:      reasonName,
        waivedBy:             user?.email ?? 'vendor',
      });
      await load();
    } catch {
      showToast('error', 'Could not apply waive. Please try again.');
    }
  }, [vendorId, user, load, showToast]);

  const handleClearWaive = useCallback(async (vcId: string) => {
    if (!vendorId) return;
    try {
      await clearWaiveApi(vendorId, vcId);
      await load();
    } catch {
      showToast('error', 'Could not clear waive. Please try again.');
    }
  }, [vendorId, load, showToast]);

  // ── Global Save Draft ─────────────────────────────────────────────────────

  const handleSaveDraft = useCallback(async () => {
    if (!vendorId) return;
    setIsSavingDraft(true);
    const entries   = Object.values(localFiles);
    let   anyFailed = false;

    for (const entry of entries) {
      try {
        const result = await uploadDocument({
          vendorId,
          vendorStageId:        entry.vendorStageId,
          vendorConfirmationId: entry.vendorConfirmationId,
          fileName:             entry.fileName,
          fileBase64:           entry.fileBase64,
          uploadedBy:           user?.email ?? 'vendor',
          approvalStatus:       'Draft',
        });
        if (result.success) {
          URL.revokeObjectURL(entry.blobUrl);
          setLocalFiles((prev) => {
            const n = { ...prev };
            delete n[entry.vendorConfirmationId];
            return n;
          });
        } else {
          anyFailed = true;
        }
      } catch {
        anyFailed = true;
      }
    }

    await load();
    setIsSavingDraft(false);

    if (!anyFailed) {
      showToast('success', 'Draft saved. You can continue uploading or submit when ready.');
    } else {
      showToast('error', 'Some documents could not be saved. Please try again.');
    }
  }, [localFiles, vendorId, user, load, showToast]);

  // ── Global Submit ─────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!vendorId || !details) return;

    // Validate: for initial submit, all mandatory items must have a document.
    // For re-submit (SendBack), skip this check — vendor only needs to fix sent-back items.
    if (!isSendBack) {
      const missingNames: string[] = [];
      for (const stage of details.stages) {
        const isTechReadiness = /technology|readiness/i.test(stage.vendorStageCode) || /technology|readiness/i.test(stage.vendorStageName);
        for (const req of stage.confirmations) {
          if (!req.isMandatory) continue;
          if (req.waiveInfo) continue;
          if (isTechReadiness) {
            const s = req.documents[0]?.approvalStatus;
            if (s !== 'Available' && s !== 'Not Available') missingNames.push(req.vendorConfirmationName);
          } else {
            const hasLocal = !!localFiles[req.vendorConfirmationId];
            const hasDoc   = req.documents.some((d) => ['Draft', 'Pending', 'Approved'].includes(d.approvalStatus));
            if (!hasLocal && !hasDoc) missingNames.push(req.vendorConfirmationName);
          }
        }
      }
      if (missingNames.length > 0) {
        showToast('error', `Please upload all required documents before submitting. Missing: ${missingNames.join(', ')}.`);
        return;
      }
    }

    setIsSubmitting(true);
    let anyFailed = false;

    // 1. Upload any locally staged files directly as Pending
    for (const entry of Object.values(localFiles)) {
      try {
        const result = await uploadDocument({
          vendorId,
          vendorStageId:        entry.vendorStageId,
          vendorConfirmationId: entry.vendorConfirmationId,
          fileName:             entry.fileName,
          fileBase64:           entry.fileBase64,
          uploadedBy:           user?.email ?? 'vendor',
          approvalStatus:       'Pending',
        });
        if (result.success) {
          URL.revokeObjectURL(entry.blobUrl);
          setLocalFiles((prev) => {
            const n = { ...prev };
            delete n[entry.vendorConfirmationId];
            return n;
          });
        } else {
          anyFailed = true;
        }
      } catch {
        anyFailed = true;
      }
    }

    // 2. Promote all existing DB drafts to Pending
    for (const vcId of dbDraftVcIds) {
      try {
        const result = await submitDraftDocument(vendorId, vcId);
        if (!result.success) anyFailed = true;
      } catch {
        anyFailed = true;
      }
    }

    // 3. For re-submit (SendBack), change vendor status back to InProgress
    if (isSendBack && !anyFailed) {
      try {
        const result = await resubmitApplication(vendorId);
        if (!result.success) anyFailed = true;
      } catch {
        anyFailed = true;
      }
    }

    await load();
    setIsSubmitting(false);

    if (!anyFailed) {
      showToast('success', isSendBack ? 'Application re-submitted for review.' : 'Onboarding package submitted for review.');
    } else {
      showToast('error', 'Some documents failed to submit. Please try again.');
    }
  }, [localFiles, dbDraftVcIds, vendorId, user, isSendBack, load, showToast]);

  if (!vendorId) return null;

  const pageSubtitle = isPendingApproval
    ? 'Your registration is pending admin approval. Document upload will be enabled once approved.'
    : isSendBack
    ? 'Some documents have been sent back for revision. Review the feedback below, re-upload the corrected documents, then click Re-Submit.'
    : isSubmitted
    ? 'Your onboarding package has been submitted and is awaiting review.'
    : 'Upload documents for each qualification layer, then Save Draft or Submit for review.';

  return (
    <VendorPortalShell vendorId={vendorId} activeTab="onboarding" companyName={details?.companyName}>

      {/* ── Global Action Bar (sticky) ───────────────────────────── */}
      <GlobalActionBar
        companyName={details?.companyName}
        stagedCount={Object.keys(localFiles).length}
        draftCount={dbDraftVcIds.length}
        isPendingApproval={isPendingApproval}
        isSubmitted={isSubmitted}
        isSendBack={isSendBack}
        isSavingDraft={isSavingDraft}
        isSubmitting={isSubmitting}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
      />

      {/* ── Page content ────────────────────────────────────────── */}
      <div className="vpo-page">
        <p className="vpo-page-sub">{pageSubtitle}</p>

        {toast && (
          <div className={`alert alert--${toast.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>
            {toast.text}
          </div>
        )}

        {loading && <div className="vpo-loading">Loading…</div>}
        {error   && <div className="alert alert--error">{error}</div>}

        {!loading && details && (
          <div className="vod-main-card">
            <h2 className="vod-section-title">Qualification — 4 Layers</h2>
            <div className="ql-legend">
              <span>Items tagged</span>
              <span className="ql-badge-mandatory">Mandatory</span>
              <span>must be Approved for the layer to be Complete. Items tagged</span>
              <span className="ql-badge-recommended">Recommended</span>
              <span>are optional.</span>
            </div>
            {details.stages.map((stage) => (
              <StageCardPortal
                key={stage.vendorStageId}
                stage={stage}
                vendorId={vendorId}
                isReadOnly={isReadOnly}
                localFiles={localFiles}
                removingId={removingId}
                settingAvailId={settingAvailId}
                waiveReasons={waiveReasons}
                onFileSelected={handleFileSelected}
                onDiscardLocal={handleDiscardLocal}
                onRemoveDbDraft={handleRemoveDbDraft}
                onSetAvailability={handleSetAvailability}
                onWaive={(vcId, stageId, reasonId, reasonName) => void handleWaive(vcId, stageId, reasonId, reasonName)}
                onClearWaive={(vcId) => void handleClearWaive(vcId)}
              />
            ))}
          </div>
        )}
      </div>
    </VendorPortalShell>
  );
};

export default VendorOnboardingPage;
