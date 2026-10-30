import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import AppShell from '../../../components/layout/AppShell';
import { useVendorSelectionLogicForm } from '../../../hooks/vendorSelectionLogic/useVendorSelectionLogicForm';

// ─── Icons ────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ReadonlyField: React.FC<{ label: string; value: string; textarea?: boolean }> = ({ label, value, textarea }) => (
  <div className="form-group">
    <label className="form-label">{label}</label>
    {textarea ? (
      <textarea
        className="form-input form-input--readonly"
        readOnly
        rows={4}
        value={value}
        style={{ resize: 'none' }}
      />
    ) : (
      <input
        type="text"
        className="form-input form-input--readonly"
        readOnly
        value={value}
      />
    )}
  </div>
);

const PanelTab: React.FC<{ label: string }> = ({ label }) => (
  <div style={{
    padding: '12px 0 10px',
    borderBottom: '2px solid var(--color-primary, #f97316)',
    marginBottom: 20,
    display: 'inline-block',
  }}>
    <span style={{ color: 'var(--color-primary, #f97316)', fontWeight: 600, fontSize: '0.95rem' }}>{label}</span>
  </div>
);

// ─── Page Component ───────────────────────────────────────────────────────────

const VendorSelectionLogicDetail: React.FC = () => {
  const { ruleId } = useParams<{ ruleId: string }>();
  const navigate   = useNavigate();
  const { values, detail, loading, submitError } = useVendorSelectionLogicForm(ruleId ?? null, 'view');

  return (
    <AppShell>
      <div className="page-card">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="page-header page-header--with-action">
          <div>
            <h1 className="page-title">View Service Provider Selection Logic</h1>
            <p className="page-subtitle">Defines logic for automated service provider selection logic.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/vendor/vendor-selection-logic')}>
              <BackIcon /> Back
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => navigate(`/vendor/vendor-selection-logic/${ruleId}/edit`)}
            >
              <EditIcon /> Edit Logic
            </button>
          </div>
        </div>

        {submitError && <div className="alert alert--error notification-bar" role="alert">{submitError}</div>}

        {loading ? (
          <div className="detail-loading">
            <p className="text-sm-muted">Loading logic details…</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '16px 28px 28px' }}>

            {/* ── Left: Logic Library ─────────────────────────────────── */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '0 20px 20px' }}>
              <PanelTab label="Logic Library" />

              {/* Sub-header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  Logic Details
                </span>
              </div>

              <ReadonlyField label="Logic Name *"    value={values.name        || '—'} />
              <ReadonlyField label="Category Name *" value={values.category    || '—'} />
              <ReadonlyField label="Description *"   value={values.description || '—'} textarea />

              {/* Bottom row: Status | Updated By | Updated On */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 4 }}>
                <ReadonlyField label="Status"     value={values.status          || '—'} />
                <ReadonlyField label="Updated By" value={detail?.updatedBy      || '—'} />
                <ReadonlyField label="Updated On" value={formatDate(detail?.updatedOn)} />
              </div>
            </div>

            {/* ── Right: Preview Logic ───────────────────────────────── */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '0 20px 20px' }}>
              <PanelTab label="Preview Logic" />

              <div className="form-group">
                <label className="form-label">Conditions</label>
                <pre
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    padding: '14px 16px',
                    fontFamily: 'monospace',
                    fontSize: '0.82rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    minHeight: 160,
                    margin: 0,
                    background: 'var(--color-white)',
                    color: 'var(--color-text)',
                  }}
                >
                  {values.conditions || 'No conditions defined.'}
                </pre>
              </div>
            </div>

          </div>
        )}

      </div>
    </AppShell>
  );
};

export default VendorSelectionLogicDetail;
