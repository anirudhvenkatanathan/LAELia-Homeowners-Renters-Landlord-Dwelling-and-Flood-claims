import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import ActiveVendorShell from '../../../components/layout/ActiveVendorShell';
import {
  getOnboardingDetails,
  getDocumentUrl,
} from '../../../services/vendorOnboarding/vendorOnboardingService';
import type {
  VendorOnboardingDetails,
  ProcessingStage,
  ConfirmationRequirement,
  ConfirmationDoc,
} from '../../../models/vendorOnboarding/vendorOnboardingModel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
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

function statusBadge(s: ConfirmationDoc['approvalStatus']): string {
  if (s === 'Approved')  return 'badge badge-green';
  if (s === 'Rejected')  return 'badge badge-red';
  if (s === 'Available') return 'badge badge-green';
  return 'badge badge-yellow';
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const FileIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

// ─── Confirmation item (read-only) ────────────────────────────────────────────

const ConfItem: React.FC<{ req: ConfirmationRequirement; isTechReadiness: boolean }> = ({ req, isTechReadiness }) => {
  const docs = req.documents.filter((d) => d.approvalStatus !== 'Draft');

  const itemStatus = () => {
    if (req.waiveInfo) return { label: 'WAIVED', cls: 'ql-item-status ql-item-status--waived' };
    if (isTechReadiness) {
      const s = docs[0]?.approvalStatus;
      if (s === 'Available')     return { label: 'AVAILABLE', cls: 'ql-item-status ql-item-status--available' };
      if (s === 'Not Available') return { label: 'NOT AVAIL', cls: 'ql-item-status ql-item-status--pending' };
    }
    if (docs.some((d) => d.approvalStatus === 'Approved')) return { label: 'APPROVED',  cls: 'ql-item-status ql-item-status--approved' };
    if (docs.some((d) => d.approvalStatus === 'Rejected')) return { label: 'REJECTED',  cls: 'ql-item-status ql-item-status--rejected' };
    if (docs.length > 0)                                   return { label: 'PENDING',   cls: 'ql-item-status ql-item-status--pending' };
    return { label: 'PENDING', cls: 'ql-item-status ql-item-status--pending' };
  };

  const dotClass = () => {
    if (req.waiveInfo) return 'ql-item__dot ql-item__dot--pending';
    if (isTechReadiness) {
      const s = docs[0]?.approvalStatus;
      return s === 'Available' ? 'ql-item__dot ql-item__dot--approved' : 'ql-item__dot';
    }
    if (!docs.length) return 'ql-item__dot';
    if (docs.some((d) => d.approvalStatus === 'Rejected'))  return 'ql-item__dot ql-item__dot--rejected';
    if (docs.every((d) => d.approvalStatus === 'Approved')) return 'ql-item__dot ql-item__dot--approved';
    return 'ql-item__dot ql-item__dot--pending';
  };

  const { label, cls } = itemStatus();

  return (
    <>
      <div className="ql-item">
        <span className={dotClass()} />
        <span className="ql-item__name">{req.vendorConfirmationName}</span>
        <span className="ql-item__type">
          {req.isMandatory
            ? <span className="ql-badge-mandatory">Mandatory</span>
            : <span className="ql-badge-recommended">Recommended</span>}
        </span>
        <span className="ql-item__status"><span className={cls}>{label}</span></span>
        <span className="ql-item__actions" />
      </div>

      {!isTechReadiness && docs.map((doc) => (
        <div key={doc._id} className="ql-doc">
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
          <span className="ql-doc__meta">{fmtDate(doc.uploadedAt)}</span>
          <span className="ql-doc__meta">{doc.uploadedBy}</span>
          <span className={statusBadge(doc.approvalStatus)} style={{ fontSize: '0.68rem' }}>
            {doc.approvalStatus}
          </span>
        </div>
      ))}
    </>
  );
};

// ─── Stage card ───────────────────────────────────────────────────────────────

// Stage whose confirmation items are per-service-category questions (L1), grouped by service.
const ROLE_STAGE_CODES = new Set(['Service-Category_Specific']);

const StageCard: React.FC<{ stage: ProcessingStage }> = ({ stage }) => {
  const [open, setOpen] = useState(true);
  const isTechReadiness = /technology|readiness/i.test(stage.vendorStageCode) || /technology|readiness/i.test(stage.vendorStageName);
  const isServiceScoped = ROLE_STAGE_CODES.has(stage.vendorStageCode);

  const stageStatusCls = stage.stageStatus === 'Completed'
    ? 'ql-status ql-status--completed'
    : stage.stageStatus === 'Rejected'
    ? 'ql-status ql-status--rejected'
    : 'ql-status ql-status--in-progress';

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
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>
        <span className="ql-stage__name">{stage.vendorStageName}</span>
        {stage.confirmations.length > 0 && (
          <span className="ql-stage__count">{stage.confirmations.length}</span>
        )}
        <span className={stageStatusCls}>
          <span className="ql-status--dot" />
          {stage.stageStatus}
        </span>
      </button>

      {open && (
        <div>
          {stage.confirmations.length === 0 ? (
            <p className="ql-empty">No confirmation requirements for this layer.</p>
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
                  .map((req) => (
                    <ConfItem
                      key={req.confirmationId || req.vendorConfirmationId}
                      req={req}
                      isTechReadiness={isTechReadiness}
                    />
                  ))}
              </div>
            ))
          ) : (
            [...stage.confirmations]
              .sort((a, b) => (b.isMandatory ? 1 : 0) - (a.isMandatory ? 1 : 0))
              .map((req) => (
                <ConfItem
                  key={req.confirmationId || req.vendorConfirmationId}
                  req={req}
                  isTechReadiness={isTechReadiness}
                />
              ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const MyDocuments: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [details,  setDetails]  = useState<VendorOnboardingDetails | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendorId) return;
    try {
      const data = await getOnboardingDetails(vendorId);
      setDetails(data);
    } catch {
      setError('Failed to load documents. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { void load(); }, [load]);

  if (!vendorId) return null;

  return (
    <ActiveVendorShell vendorId={vendorId} activeTab="documents" companyName={details?.companyName}>
      <div className="dash-page" style={{ padding: '28px 28px 60px', boxSizing: 'border-box' }}>
        <div className="dash-header-card">
          <div className="dash-title-row">
            <h1 className="page-title">My Documents</h1>
            <p className="page-subtitle">All submitted qualification documents.</p>
          </div>
        </div>

        <div className="dash-content-area">
        {loading && <div className="vpo-loading">Loading documents…</div>}
        {error   && <div className="alert alert--error">{error}</div>}

        {!loading && details && (
          <div className="dash-section">
            <div className="ql-legend">
              <span>Items tagged</span>
              <span className="ql-badge-mandatory">Mandatory</span>
              <span>must be Approved for the layer to complete. Items tagged</span>
              <span className="ql-badge-recommended">Recommended</span>
              <span>are optional.</span>
            </div>
            {details.stages.map((stage) => (
              <StageCard key={stage.vendorStageId} stage={stage} />
            ))}
          </div>
        )}
        </div>
      </div>
    </ActiveVendorShell>
  );
};

export default MyDocuments;
