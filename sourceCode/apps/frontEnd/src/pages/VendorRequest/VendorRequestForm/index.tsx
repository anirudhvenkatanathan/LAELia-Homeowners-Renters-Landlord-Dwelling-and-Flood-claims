import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AppShell from '../../../components/layout/AppShell';
import { ServiceProviderTabs } from '../../../components/layout/ServiceProviderTabs';
import { useVendorServiceRequestForm } from '../../../hooks/vendorServiceRequest/useVendorServiceRequestForm';
import { styles } from './styles';

// ─── Screen ───────────────────────────────────────────────────────────────────

const VendorRequestForm: React.FC = () => {
  const navigate = useNavigate();
  const {
    loading, error, saving, form,
    updateField, submitRequest,
  } = useVendorServiceRequestForm();

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [emailError,       setEmailError]       = useState('');

  const handleSubmit = async () => {
    if (!form.email.trim()) {
      setEmailError('Email is required.');
      return;
    }
    setEmailError('');
    const result = await submitRequest();
    if (!result) return;
    setShowSuccessModal(true);
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    navigate('/vendor/onboarding');
  };

  return (
    <AppShell>
      <ServiceProviderTabs />
      <div className="page-card">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="page-header">
          <div>
            <h1 className={styles.pageTitle}>New Service Provider Request</h1>
            <p className={styles.pageSubtitle}>Capture service provider company details and contact information</p>
          </div>
        </div>

        {error && <div className="alert alert--error notification-bar" role="alert">{error}</div>}

        {/* ── Company Info ─────────────────────────────────────────────── */}
        <div className={styles.sectionBlock}>
          <h2 className={styles.sectionTitle}>Company Information</h2>
          <div className="vsr-form-grid">
            <div className="form-group">
              <label className="form-label form-label--required">Company Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Acme Field Services"
                value={form.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 123 Main St, Springfield, IL"
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label form-label--required">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. contact@acme.com"
                value={form.email}
                onChange={(e) => { if (emailError) setEmailError(''); updateField('email', e.target.value); }}
              />
              {emailError && <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: 4, marginBottom: 0 }}>{emailError}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. (800) 555-1234"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. www.acme.com"
                value={form.website}
                onChange={(e) => updateField('website', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Contact Details ──────────────────────────────────────────── */}
        <div className={styles.sectionBlock}>
          <h2 className={styles.sectionTitle}>Contact Details</h2>
          <div className="vsr-form-grid">
            <div className="form-group">
              <label className="form-label">Contact Person Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Jane Doe"
                value={form.contactPersonName}
                onChange={(e) => updateField('contactPersonName', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. (800) 555-1234"
                value={form.contactPersonPhone}
                onChange={(e) => updateField('contactPersonPhone', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. jane.doe@acme.com"
                value={form.contactPersonEmail}
                onChange={(e) => updateField('contactPersonEmail', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Form Actions ──────────────────────────────────────────────── */}
        <div className={styles.sectionBlock}>
          <div className="vsr-form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/vendor-request')} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSubmit} disabled={saving || loading}>
              {saving ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>

      </div>

      {showSuccessModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal__header">
              <h2 className="modal__title">Service Provider Submitted Successfully</h2>
            </div>
            <div className="modal__body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
                  </svg>
                  <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', margin: 0 }}>
                    Service Provider request has been submitted successfully.
                  </p>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', margin: 0, paddingLeft: 30 }}>
                  A signup link will be sent to <strong>{form.email}</strong> for the provider to complete their registration and further process.
                </p>
              </div>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--primary" onClick={closeSuccessModal}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default VendorRequestForm;
