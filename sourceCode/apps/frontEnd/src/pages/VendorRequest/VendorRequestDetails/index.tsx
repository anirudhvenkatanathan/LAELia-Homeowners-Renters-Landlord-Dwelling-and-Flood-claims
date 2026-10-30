import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import AppShell from '../../../components/layout/AppShell';
import { useVendorServiceRequestDetail } from '../../../hooks/vendorServiceRequest/useVendorServiceRequestDetail';
import { resolveStatusBadge, resolveStatusLabel, US_STATES } from '../../../models/vendorServiceRequest/vendorServiceRequestModel';
import { styles } from './styles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

interface EditForm {
  companyName:   string;
  address:       string;
  email:         string;
  phone:         string;
  website:       string;
  contactPerson: string;
  contactPersonName:  string;
  contactPersonPhone: string;
  contactPersonEmail: string;
}

const EMPTY_EDIT_FORM: EditForm = {
  companyName: '', address: '', email: '', phone: '', website: '', contactPerson: '',
  contactPersonName: '', contactPersonPhone: '', contactPersonEmail: '',
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

const VendorRequestDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { details, loading, error, saving, notification, categories, submitRequest, changeStatus, updateDetails } =
    useVendorServiceRequestDetail(id ?? '');

  const [reviewedBy, setReviewedBy] = useState('');
  const [notes, setNotes] = useState('');

  const [editMode,     setEditMode]     = useState(false);
  const [editForm,     setEditForm]     = useState<EditForm>(EMPTY_EDIT_FORM);
  const [editServices, setEditServices] = useState<string[]>([]);
  const [editCoverage, setEditCoverage] = useState<string[]>([]);
  const [editError,    setEditError]    = useState<string | null>(null);

  useEffect(() => {
    if (details) {
      setReviewedBy(details.reviewedBy ?? '');
      setNotes(details.notes ?? '');
    }
  }, [details]);

  if (loading) {
    return (
      <AppShell>
        <div className="page-card">
          <div className="detail-loading">
            <p className="text-sm-muted">Loading provider service request…</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !details) {
    return (
      <AppShell>
        <div className="page-card">
          <div className="alert alert--error" role="alert">{error ?? 'Service Provider service request not found.'}</div>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/vendor-request')} style={{ marginTop: 12 }}>
            <BackIcon /> Back to list
          </button>
        </div>
      </AppShell>
    );
  }

  const status = details.status;
  const isDraft = status === 'draft';

  const startEdit = () => {
    setEditForm({
      companyName:   details.companyName,
      address:       details.address,
      email:         details.email,
      phone:         details.phone,
      website:       details.website,
      contactPerson: details.contactPerson,
      contactPersonName:  details.contactPersonName,
      contactPersonPhone: details.contactPersonPhone,
      contactPersonEmail: details.contactPersonEmail,
    });
    setEditServices(details.services.map((s) => s.roleId));
    setEditCoverage(details.coverage);
    setEditError(null);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditError(null);
  };

  const updateEditField = (field: keyof EditForm, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleEditService = (roleId: string) => {
    setEditServices((prev) => (
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    ));
  };

  const selectAllEditServices = () => setEditServices(categories.map((c) => c.roleId));
  const clearAllEditServices  = () => setEditServices([]);

  const toggleEditCoverage = (stateCode: string) => {
    setEditCoverage((prev) => (
      prev.includes(stateCode) ? prev.filter((c) => c !== stateCode) : [...prev, stateCode]
    ));
  };

  const saveEdit = async () => {
    if (!editForm.companyName.trim()) {
      setEditError('Company name is required.');
      return;
    }
    if (editServices.length === 0) {
      setEditError('Select at least one service.');
      return;
    }
    setEditError(null);
    const ok = await updateDetails({
      companyName:   editForm.companyName,
      address:       editForm.address,
      email:         editForm.email,
      phone:         editForm.phone,
      website:       editForm.website,
      contactPerson: editForm.contactPerson,
      contactPersonName:  editForm.contactPersonName,
      contactPersonPhone: editForm.contactPersonPhone,
      contactPersonEmail: editForm.contactPersonEmail,
      services:      editServices,
      coverage:      editCoverage,
    });
    if (ok) setEditMode(false);
  };

  return (
    <AppShell>
      <div className="page-card">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="page-header page-header--with-action">
          <div>
            <h1 className={styles.pageTitle}>{details.companyName}</h1>
            <p className={styles.pageSubtitle}>
              <span className={`badge ${resolveStatusBadge(status)}`}>{resolveStatusLabel(status)}</span>
              {' · Created '}{formatDate(details.createdAt)}
            </p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/vendor-request')}>
            <BackIcon /> Back
          </button>
        </div>

        {notification && (
          <div className={`alert ${notification.type === 'success' ? 'alert--success' : 'alert--error'} notification-bar`} role="alert">
            {notification.text}
          </div>
        )}

        {editError && (
          <div className="alert alert--error notification-bar" role="alert">{editError}</div>
        )}

        {/* ── Company Info ─────────────────────────────────────────────── */}
        <div className={styles.sectionBlock}>
          <div className="vsr-section-header">
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Company Information</h2>
            {isDraft && !editMode && (
              <div className="vsr-section-actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={startEdit}>Edit Details</button>
              </div>
            )}
          </div>

          {editMode ? (
            <div className="vsr-form-grid">
              <div className="form-group">
                <label className="form-label form-label--required">Company Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.companyName}
                  onChange={(e) => updateEditField('companyName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.address}
                  onChange={(e) => updateEditField('address', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={editForm.email}
                  onChange={(e) => updateEditField('email', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.phone}
                  onChange={(e) => updateEditField('phone', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Website</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.website}
                  onChange={(e) => updateEditField('website', e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className={styles.detailInfoStrip}>
              <div className={styles.detailInfoField}>
                <span className={styles.detailInfoLabel}>Company Name</span>
                <span className={styles.detailInfoValue}>{details.companyName}</span>
              </div>
              <div className={styles.detailInfoField}>
                <span className={styles.detailInfoLabel}>Address</span>
                <span className={styles.detailInfoValue}>{details.address || '—'}</span>
              </div>
              <div className={styles.detailInfoField}>
                <span className={styles.detailInfoLabel}>Email</span>
                <span className={styles.detailInfoValue}>{details.email || '—'}</span>
              </div>
              <div className={styles.detailInfoField}>
                <span className={styles.detailInfoLabel}>Phone</span>
                <span className={styles.detailInfoValue}>{details.phone || '—'}</span>
              </div>
              <div className={styles.detailInfoField}>
                <span className={styles.detailInfoLabel}>Website</span>
                <span className={styles.detailInfoValue}>{details.website || '—'}</span>
              </div>
              <div className={styles.detailInfoField}>
                <span className={styles.detailInfoLabel}>Submitted By</span>
                <span className={styles.detailInfoValue}>{details.submittedBy || '—'}</span>
              </div>
              <div className={styles.detailInfoField}>
                <span className={styles.detailInfoLabel}>Submitted At</span>
                <span className={styles.detailInfoValue}>{formatDate(details.submittedAt)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Contact Details ──────────────────────────────────────────── */}
        <div className={styles.sectionBlock}>
          <h2 className={styles.sectionTitle}>Contact Details</h2>

          {editMode ? (
            <div className="vsr-form-grid">
              <div className="form-group">
                <label className="form-label">Contact Person Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.contactPersonName}
                  onChange={(e) => updateEditField('contactPersonName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.contactPersonPhone}
                  onChange={(e) => updateEditField('contactPersonPhone', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={editForm.contactPersonEmail}
                  onChange={(e) => updateEditField('contactPersonEmail', e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className={styles.detailInfoStrip}>
              <div className={styles.detailInfoField}>
                <span className={styles.detailInfoLabel}>Contact Person Name</span>
                <span className={styles.detailInfoValue}>{details.contactPersonName || '—'}</span>
              </div>
              <div className={styles.detailInfoField}>
                <span className={styles.detailInfoLabel}>Phone Number</span>
                <span className={styles.detailInfoValue}>{details.contactPersonPhone || '—'}</span>
              </div>
              <div className={styles.detailInfoField}>
                <span className={styles.detailInfoLabel}>Email</span>
                <span className={styles.detailInfoValue}>{details.contactPersonEmail || '—'}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Service Categories ───────────────────────────────────────── */}
        <div className={styles.sectionBlock}>
          {editMode ? (
            <>
              <div className="vsr-section-header">
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Service Categories</h2>
                <div className="vsr-section-actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={selectAllEditServices}>Select All</button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={clearAllEditServices}>Clear All</button>
                </div>
              </div>
              <div className="vsr-service-grid">
                {categories.map((cat) => {
                  const selected = editServices.includes(cat.roleId);
                  return (
                    <label
                      key={cat.roleId}
                      className={`vsr-service-card${selected ? ' vsr-service-card--selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="vsr-service-card__checkbox"
                        checked={selected}
                        onChange={() => toggleEditService(cat.roleId)}
                      />
                      <div className="vsr-service-card__body">
                        <span className="vsr-service-card__name">{cat.name}</span>
                        {cat.description && <span className="vsr-service-card__desc">{cat.description}</span>}
                      </div>
                    </label>
                  );
                })}
                {categories.length === 0 && <p className="text-sm-muted">No active service categories found.</p>}
              </div>
            </>
          ) : (
            <>
              <h2 className={styles.sectionTitle}>Service Categories</h2>
              {details.services.length === 0 ? (
                <p className="text-sm-muted">No services selected.</p>
              ) : (
                <div className="vsr-service-grid">
                  {details.services.map((s) => (
                    <div key={s.roleId} className="vsr-service-card vsr-service-card--selected" style={{ cursor: 'default' }}>
                      <div className="vsr-service-card__body">
                        <span className="vsr-service-card__name">{s.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                <p className={styles.sectionTitle} style={{ marginBottom: 6 }}>Virtual Coverage</p>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
                  {details.coverage.includes('Virtual') ? '✓ Supports virtual / remote service delivery' : '—'}
                </span>
              </div>

              {(() => {
                const geo = details.coverage.filter((c) => c !== 'Virtual');
                return geo.length > 0 ? (
                  <div style={{ marginTop: 14 }}>
                    <p className={styles.sectionTitle} style={{ marginBottom: 8 }}>Geographic Coverage</p>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text)' }}>{geo.join(', ')}</span>
                  </div>
                ) : null;
              })()}
            </>
          )}
        </div>

        {/* ── Coverage (edit + view) ───────────────────────────────────── */}
        {editMode && (
          <div className={styles.sectionBlock}>
            <h2 className={styles.sectionTitle}>Virtual Coverage</h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.88rem', color: 'var(--color-text)' }}>
              <input
                type="checkbox"
                checked={editCoverage.includes('Virtual')}
                onChange={() => toggleEditCoverage('Virtual')}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              We support virtual / remote service delivery
            </label>
          </div>
        )}
        {editMode && (
          <div className={styles.sectionBlock}>
            <h2 className={styles.sectionTitle}>Geographic Coverage</h2>
            <div className="vsr-coverage-grid">
              {US_STATES.filter((s) => s.code !== 'Virtual').map((s) => {
                const selected = editCoverage.includes(s.code);
                return (
                  <label key={s.code} className={`vsr-coverage-chip${selected ? ' vsr-coverage-chip--selected' : ''}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleEditCoverage(s.code)} />
                    {s.code}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Edit Actions ──────────────────────────────────────────────── */}
        {editMode && (
          <div className={styles.sectionBlock}>
            <div className="vsr-form-actions">
              <button type="button" className="btn btn--ghost" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* ── Workflow ──────────────────────────────────────────────────── */}
        <div className={styles.sectionBlock}>
          <h2 className={styles.sectionTitle}>Review &amp; Status</h2>

          {(status === 'in_review' || status === 'approved' || status === 'rejected') && (
            <div className="vsr-form-grid" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Reviewed By</label>
                <input
                  type="text"
                  className="form-input"
                  value={reviewedBy}
                  placeholder="Reviewer name"
                  readOnly={status !== 'in_review'}
                  onChange={(e) => setReviewedBy(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={notes}
                  placeholder="Review notes…"
                  readOnly={status !== 'in_review'}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {status === 'approved' && details.vendorDetail && (
            <div className="alert alert--success" role="status" style={{ marginBottom: 16 }}>
              Linked to provider record <strong>{details.vendorDetail.companyName}</strong> (ID: {details.vendorDetail.vendorId})
            </div>
          )}

          <div className="vsr-form-actions" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0, justifyContent: 'flex-start' }}>
            {status === 'draft' && (
              <button type="button" className="btn btn--primary" onClick={submitRequest} disabled={saving || editMode}>
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
            )}
            {status === 'submitted' && (
              <button type="button" className="btn btn--primary" onClick={() => changeStatus('in_review', reviewedBy, notes)} disabled={saving}>
                {saving ? 'Updating…' : 'Start Review'}
              </button>
            )}
            {status === 'in_review' && (
              <>
                <button type="button" className="btn btn--primary" onClick={() => changeStatus('approved', reviewedBy, notes)} disabled={saving}>
                  {saving ? 'Updating…' : 'Approve'}
                </button>
                <button type="button" className="btn btn--danger" onClick={() => changeStatus('rejected', reviewedBy, notes)} disabled={saving}>
                  {saving ? 'Updating…' : 'Reject'}
                </button>
              </>
            )}
            {(status === 'approved' || status === 'rejected') && (
              <p className="text-sm-muted" style={{ margin: 0 }}>
                This request is {resolveStatusLabel(status).toLowerCase()} and reviewed by {details.reviewedBy || '—'} on {formatDate(details.reviewedAt)}.
              </p>
            )}
          </div>
        </div>

      </div>
    </AppShell>
  );
};

export default VendorRequestDetails;
