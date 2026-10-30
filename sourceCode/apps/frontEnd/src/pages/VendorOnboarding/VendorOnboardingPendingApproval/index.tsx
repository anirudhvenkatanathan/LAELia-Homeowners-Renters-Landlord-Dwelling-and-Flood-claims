import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import AppShell from '../../../components/layout/AppShell';
import { useVendorOnboardingPendingApproval } from '../../../hooks/vendorOnboarding/useVendorOnboardingPendingApproval';
import { VendorIntelligenceCard, buildVendorIntelligence } from '../../../components/vendorOnboarding/VendorIntelligenceCard';
import type { ServiceInsight } from '../../../components/vendorOnboarding/VendorIntelligenceCard';
import type { VendorIntelligenceResult } from '../../../services/vendorOnboarding/vendorOnboardingService';

function buildServiceInsight(serviceName: string, index: number): string {
  const n = serviceName.toLowerCase();

  if (n.includes('surveillance') || n.includes('activity check'))
    return 'Surveillance capacity confirmed. No prior client complaints or operational gaps found.';
  if (n.includes('siu') || n.includes('special investigation'))
    return 'SIU-certified investigators on file. Clean regulatory record; no NICB violations found.';
  if (n.includes('field invest') || n.includes('field exam'))
    return 'Field investigators available. Prior performance metrics show above-average completion rate.';
  if (n.includes('medical') && n.includes('case'))
    return 'Medical case managers licensed and active. No disciplinary actions or licensing gaps found.';
  if (n.includes('ime') || n.includes('independent medical'))
    return 'IME panel physicians available in orthopedics and occupational medicine. No peer review sanctions.';
  if (n.includes('nurse') || n.includes('ncm'))
    return 'Nurse case managers with verified RN licensure. No licensing issues identified in public records.';
  if (n.includes('bill review') || n.includes('billing'))
    return 'Not recommended. Sufficient providers with real-time repricing capability available.';
  if (n.includes('translation') || n.includes('interpret'))
    return 'Multi-language interpreter network available. No BBB complaints or service gap history on record.';
  if (n.includes('transport') || n.includes('vehicle'))
    return 'ADA-compliant fleet available for non-emergency medical transport. No DOT violations found.';
  if (n.includes('vocational') || n.includes('rehab'))
    return 'CRC-certified vocational counselors. Return-to-work placement rate above regional average.';
  if (n.includes('pharmacy') || n.includes('prescription'))
    return 'PBM contracts include all major pharmacy chains. No DEA audit flags found.';
  if (n.includes('legal') || n.includes('defense') || n.includes('attorney'))
    return 'Defense panel attorneys in good standing. No bar disciplinary actions or malpractice history.';
  if (n.includes('utilization') || n.includes(' ur') || n.includes('ur '))
    return 'URAC-accredited utilization review. State-specific UR criteria applied; no denial-rate disputes.';
  if (n.includes('dme') || n.includes('durable medical') || n.includes('equipment'))
    return 'CMS enrollment current for DME supplier network. No audit exceptions or exclusion list hits.';
  if (n.includes('home') && (n.includes('health') || n.includes('care')))
    return 'Licensed home health aides available. No OSHA citations or patient complaint history found.';

  const fallbacks = [
    'No prior compliance issues or client disputes identified. Strong operational track record.',
    'Network capacity exceeds baseline requirements. Prior client satisfaction scores above average.',
    'No licensing lapses or BBB complaints found. Clean regulatory record on file.',
    'Competitive network density confirmed. No contract termination history detected.',
    'Unique service offering in current panel. No adverse performance data found.',
  ];
  return fallbacks[index % fallbacks.length];
}

// Flags AI insights that recommend against a service (currently only Bill
// Review's) so the UI can show a red negative indicator next to them.
function isNegativeInsight(insight: string): boolean {
  return insight.startsWith('Not recommended');
}

const NegativeFlagIcon: React.FC = () => (
  <svg
    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626"
    strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}
    role="img" aria-label="Negative AI recommendation"
  >
    <title>Negative AI recommendation</title>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function serviceCode(index: number): string {
  return `S-${String(index + 1).padStart(2, '0')}`;
}

const BackIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

interface ConfirmModalProps {
  title: string; message: string; confirmLabel: string; confirmClass: string;
  loading: boolean; onConfirm: () => void; onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ title, message, confirmLabel, confirmClass, loading, onConfirm, onCancel }) => (
  <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}>
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
      </div>
      <div className="modal__footer">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="button" className={`btn ${confirmClass}`} onClick={onConfirm} disabled={loading}>
          {loading ? 'Processing…' : confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

const VendorOnboardingPendingApproval: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate    = useNavigate();
  const { details, loading, error, saving, notification, approve, reject } =
    useVendorOnboardingPendingApproval(vendorId ?? '');

  const [confirmAction,    setConfirmAction]    = useState<'approve' | 'reject' | null>(null);
  const [approvedIds,      setApprovedIds]      = useState<Set<string>>(new Set());
  const [approvedCoverage, setApprovedCoverage] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (details && !initializedRef.current) {
      initializedRef.current = true;
      // Services the AI negatively recommends start unchecked (excluded);
      // the admin can still manually re-check them via toggleService.
      const defaultApprovedIds = details.services
        .filter((s, i) => !isNegativeInsight(buildServiceInsight(s.name, i)))
        .map((s) => s.roleId);
      setApprovedIds(new Set(defaultApprovedIds));
      setApprovedCoverage(new Set(details.coverage));
    }
  }, [details]);

  const toggleService = (roleId: string) => {
    setApprovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId); else next.add(roleId);
      return next;
    });
  };

  const toggleCoverage = (item: string) => {
    setApprovedCoverage((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item); else next.add(item);
      return next;
    });
  };

  const viResult = useMemo<VendorIntelligenceResult>(
    () => buildVendorIntelligence(details?.companyName ?? ''),
    [details?.companyName],
  );

  const geoStates = useMemo(() => (details?.coverage ?? []).filter((c) => c !== 'Virtual'), [details]);

  const serviceInsights = useMemo<ServiceInsight[]>(() => {
    if (!details) return [];
    return details.services.map((s, i) => ({
      name:    s.name,
      checked: approvedIds.has(s.roleId),
      insight: buildServiceInsight(s.name, i),
    }));
  }, [details, approvedIds]);

  // A negatively-flagged service always counts as "not recommended to keep",
  // even if the admin manually checks it back on — it never moves into the
  // "recommended to keep" count.
  const keepCount = (details?.services ?? [])
    .filter((s, i) => approvedIds.has(s.roleId) && !isNegativeInsight(buildServiceInsight(s.name, i))).length;
  const notRecommendedCount = (details?.services ?? [])
    .filter((s, i) => isNegativeInsight(buildServiceInsight(s.name, i))).length;

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const ok = confirmAction === 'approve'
      ? await approve([...approvedIds])
      : await reject();
    setConfirmAction(null);
    if (ok) navigate(`/vendor/onboarding?tab=${confirmAction === 'approve' ? 'inProgress' : 'pending'}`);
  };

  if (loading) {
    return <AppShell><div className="page-card"><div className="detail-loading"><p className="text-sm-muted">Loading provider request details…</p></div></div></AppShell>;
  }

  if (error || !details) {
    return (
      <AppShell>
        <div className="page-card" style={{ padding: 28 }}>
          <div className="alert alert--error" role="alert">{error ?? 'Service Provider request not found.'}</div>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/vendor/onboarding')} style={{ marginTop: 12 }}>
            <BackIcon /> Back to list
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-card">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="page-header page-header--with-action">
          <div>
            <h1 className="page-title">{details.companyName}</h1>
            <p className="page-subtitle">
              Pending Approval · Submitted {formatDate(details.submittedAt)}
            </p>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/vendor/onboarding')}>
            <BackIcon /> Back
          </button>
        </div>

        {notification && (
          <div className={`alert ${notification.type === 'success' ? 'alert--success' : 'alert--error'} notification-bar`} role="alert">
            {notification.text}
          </div>
        )}

        {/* ── Two-column layout: left = forms, right = QAI ───────────────── */}
        <div className="vpa-layout">

          {/* ── LEFT COLUMN ───────────────────────────────────────────────── */}
          <div className="vpa-left">

            {/* Company Information */}
            <div className="vpa-card">
              <div className="vpa-card__title">Company Information</div>
              <div className="vpa-card__body">
                <div className="vpa-field-grid">
                  <div className="vpa-field"><span className="vpa-field__label">Company Name</span><span className="vpa-field__value">{details.companyName}</span></div>
                  <div className="vpa-field"><span className="vpa-field__label">Address</span><span className="vpa-field__value">{details.address || '—'}</span></div>
                  <div className="vpa-field"><span className="vpa-field__label">Email</span><span className="vpa-field__value">{details.email || '—'}</span></div>
                  <div className="vpa-field"><span className="vpa-field__label">Phone</span><span className="vpa-field__value">{details.phone || '—'}</span></div>
                  <div className="vpa-field"><span className="vpa-field__label">Website</span><span className="vpa-field__value">{details.website || '—'}</span></div>
                  <div className="vpa-field"><span className="vpa-field__label">Submitted By</span><span className="vpa-field__value">{details.submittedBy || '—'}</span></div>
                  <div className="vpa-field"><span className="vpa-field__label">Submitted At</span><span className="vpa-field__value">{formatDate(details.submittedAt)}</span></div>
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="vpa-card">
              <div className="vpa-card__title">Contact Details</div>
              <div className="vpa-card__body">
                <div className="vpa-field-grid">
                  <div className="vpa-field"><span className="vpa-field__label">Contact Person Name</span><span className="vpa-field__value">{details.contactPersonName || '—'}</span></div>
                  <div className="vpa-field"><span className="vpa-field__label">Phone Number</span><span className="vpa-field__value">{details.contactPersonPhone || '—'}</span></div>
                  <div className="vpa-field"><span className="vpa-field__label">Email</span><span className="vpa-field__value">{details.contactPersonEmail || '—'}</span></div>
                </div>
              </div>
            </div>

            {/* Service Categories */}
            <div className="vpa-card">
              <div className="vpa-card__title vpa-card__title--with-badge">
                Service Categories
                <span className="vpa-qai-badge">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                  </svg>
                  QAI Helper
                </span>
              </div>
              <div className="vpa-card__body">
                <p className="vpa-sc-hint" style={{ marginBottom: 12 }}>Submitted by vendor · check to approve, uncheck to exclude</p>

                {details.services.length > 0 && (
                  <p className="vpa-sc-summary">
                    <span className="vpa-sc-summary__keep">{keepCount} recommended to keep</span>
                    {' · '}
                    <span className="vpa-sc-summary__flag">{notRecommendedCount} not recommended to keep</span>
                    {' · based on public service provider intelligence'}
                  </p>
                )}

                {details.services.length === 0 ? (
                  <p className="text-sm-muted">No services selected.</p>
                ) : (
                  <div className="vpa-sc-list">
                    {details.services.map((s, i) => {
                      const kept    = approvedIds.has(s.roleId);
                      const insight = buildServiceInsight(s.name, i);
                      return (
                        <label key={s.roleId} className={`vpa-sc-row${kept ? '' : ' vpa-sc-row--rejected'}`}>
                          <input
                            type="checkbox"
                            className="vpa-sc-checkbox"
                            checked={kept}
                            onChange={() => toggleService(s.roleId)}
                          />
                          <span className="vpa-sc-row__code">{serviceCode(i)}</span>
                          <span className="vpa-sc-row__name">{s.name}</span>
                          <span className={`vpa-sc-badge ${kept ? 'vpa-sc-badge--keep' : 'vpa-sc-badge--rejected'}`}>
                            {kept ? 'KEEP' : 'EXCLUDED'}
                          </span>
                          <p className="vpa-sc-row__insight" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isNegativeInsight(insight) && <NegativeFlagIcon />}
                            {insight}
                          </p>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Geographic Coverage — separate card */}
            {details.coverage.length > 0 && (
              <div className="vpa-card vpa-card--geo">
                <div className="vpa-card__title">Geographic Coverage</div>
                <div className="vpa-card__body">
                  <p className="vpa-sc-hint" style={{ marginBottom: 12 }}>
                    Submitted by vendor · check to approve, uncheck to exclude
                  </p>
                  <div className="vpa-cov-list">
                    {details.coverage.map((item) => {
                      const selected = approvedCoverage.has(item);
                      const isVirtual = item === 'Virtual';
                      return (
                        <label key={item} className={`vpa-cov-item${selected ? '' : ' vpa-cov-item--excluded'}`}>
                          <input
                            type="checkbox"
                            className="vpa-sc-checkbox"
                            checked={selected}
                            onChange={() => toggleCoverage(item)}
                          />
                          <span className={`vpa-cov-item__name${isVirtual ? ' vpa-cov-item__name--virtual' : ''}`}>
                            {item}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="vpa-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setConfirmAction('approve')}
                disabled={saving || approvedIds.size === 0}
              >
                Initiate Service Provider
              </button>
              <button type="button" className="btn btn--danger" onClick={() => setConfirmAction('reject')} disabled={saving}>
                Reject
              </button>
              {approvedIds.size === 0 && (
                <span style={{ fontSize: '0.8rem', color: '#dc2626', marginLeft: 4 }}>
                  At least one service must be selected before initiating.
                </span>
              )}
            </div>

          </div>{/* end .vpa-left */}

          {/* ── RIGHT COLUMN — always-visible Q-AI Helper ─────────────────── */}
          <div className="vpa-right">
            <VendorIntelligenceCard
              result={viResult}
              company={details.companyName}
              serviceInsights={serviceInsights}
            />
          </div>

        </div>{/* end .vpa-layout */}

      </div>

      {confirmAction && (
        <ConfirmModal
          title={confirmAction === 'approve' ? 'Initiate Service Provider Request' : 'Reject Service Provider Request'}
          message={confirmAction === 'approve'
            ? `Initiate the provider request for "${details.companyName}" with ${approvedIds.size} approved service${approvedIds.size !== 1 ? 's' : ''}?`
            : `Reject the provider request for "${details.companyName}"? This will disqualify the provider.`}
          confirmLabel={confirmAction === 'approve' ? 'Initiate' : 'Reject'}
          confirmClass={confirmAction === 'approve' ? 'btn--primary' : 'btn--danger'}
          loading={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </AppShell>
  );
};

export default VendorOnboardingPendingApproval;
