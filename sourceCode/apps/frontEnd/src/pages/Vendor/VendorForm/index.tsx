import React, { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../../../components/layout/AppShell';
import { useVendorForm } from '../../../hooks/vendor/useVendorForm';
import type { FormMode } from '../../../hooks/vendor/useVendorForm';
import type { VendorFormValues } from '../../../models/vendor/vendorModel';

// ─── Field ────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}
const Field: React.FC<FieldProps> = ({ label, required, error, children }) => (
  <div className="form-group" style={{ marginBottom: 0 }}>
    <label className={`form-label${required ? ' form-label--required' : ''}`}>{label}</label>
    {children}
    {error && <span className="form-error" role="alert">{error}</span>}
  </div>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

const VendorForm: React.FC = () => {
  const navigate      = useNavigate();
  const [params]      = useSearchParams();
  const vendorId      = params.get('vendorId');
  const modeParam     = (params.get('mode') ?? 'create') as FormMode;

  const {
    mode, setMode, values, errors, loading, saving, roles,
    submitError, updateField, handleSubmit,
  } = useVendorForm(vendorId, modeParam);

  const isView    = mode === 'view';
  const isCreate  = !vendorId;
  const inputCls  = (field: keyof VendorFormValues) =>
    `form-input${errors[field] ? ' form-input--error' : ''}${isView ? ' form-input--readonly' : ''}`;

  const onSubmit = useCallback(async () => {
    const result = await handleSubmit();
    if (result.success) navigate('/vendor');
  }, [handleSubmit, navigate]);

  const titleMap: Record<FormMode, string> = {
    create: 'Add Service Provider',
    edit:   'Edit Service Provider',
    view:   'Service Provider Details',
  };

  return (
    <AppShell>
      <div className="page-card">

        {/* Header */}
        <div className="page-header page-header--with-action">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <button type="button" className="btn btn--ghost btn--sm"
                style={{ padding: '3px 8px' }} onClick={() => navigate('/vendor')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Service Providers
              </button>
              <span style={{ color: 'var(--color-text-light)', fontSize: '0.75rem' }}>/</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{titleMap[mode]}</span>
            </div>
            <h1 className="page-title">{titleMap[mode]}</h1>
            <p className="page-subtitle">
              {isCreate ? 'Fill in the details below to register a new provider.' : 'View or modify provider information.'}
            </p>
          </div>
          {isView && vendorId && (
            <button type="button" className="btn btn--primary" onClick={() => setMode('edit')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
          )}
        </div>

        {loading && <div className="detail-loading" style={{ padding: '40px 28px' }}><p className="text-sm-muted">Loading provider details…</p></div>}

        {!loading && (
          <div style={{ padding: '0 28px 28px' }}>
            {submitError && <div className="alert alert--error" role="alert" style={{ marginBottom: 20 }}>{submitError}</div>}

            {/* ── Two-column form layout ──────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px' }}>

              {/* Company Name */}
              <Field label="Company Name" required error={errors['companyName']}>
                <input className={inputCls('companyName')} value={values.companyName}
                  readOnly={isView} placeholder="e.g. ABC Medical Services"
                  onChange={(e) => updateField('companyName', e.target.value)} />
              </Field>

              {/* Email ID */}
              <Field label="Email ID" required error={errors['emailId']}>
                <input type="email" className={inputCls('emailId')} value={values.emailId}
                  readOnly={isView} placeholder="e.g. contact@example.com"
                  onChange={(e) => updateField('emailId', e.target.value)} />
              </Field>

              {/* Phone Number */}
              <Field label="Phone Number" required error={errors['phoneNumber']}>
                <input className={inputCls('phoneNumber')} value={values.phoneNumber}
                  readOnly={isView} placeholder="e.g. +91 9876543210"
                  onChange={(e) => updateField('phoneNumber', e.target.value)} />
              </Field>

              {/* Service Request Role */}
              <Field label="Service Request Role" required error={errors['serviceRequestRoleId']}>
                {isView ? (
                  <input className={`form-input form-input--readonly`}
                    value={roles.find((r) => r.roleId === values.serviceRequestRoleId)?.roleName ?? values.serviceRequestRoleId}
                    readOnly />
                ) : (
                  <select
                    className={`form-input${errors['serviceRequestRoleId'] ? ' form-input--error' : ''}`}
                    value={values.serviceRequestRoleId}
                    onChange={(e) => updateField('serviceRequestRoleId', e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">— Select a role —</option>
                    {roles.map((r) => (
                      <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                    ))}
                  </select>
                )}
              </Field>

              {/* Rating */}
              <Field label="Rating (0 – 5)" error={errors['rating']}>
                <input type="number" className={inputCls('rating')} value={values.rating}
                  readOnly={isView} min={0} max={5} step={0.5} placeholder="e.g. 4.5"
                  onChange={(e) => updateField('rating', e.target.value)} />
              </Field>

              {/* Turnaround Time */}
              <Field label="Turnaround Time" error={errors['turnaroundTime']}>
                <input className={inputCls('turnaroundTime')} value={values.turnaroundTime}
                  readOnly={isView} placeholder="e.g. 24 Hours"
                  onChange={(e) => updateField('turnaroundTime', e.target.value)} />
              </Field>

              {/* Address — full width */}
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Address" error={errors['address']}>
                  <input className={inputCls('address')} value={values.address}
                    readOnly={isView} placeholder="Street address"
                    onChange={(e) => updateField('address', e.target.value)} />
                </Field>
              </div>

              {/* City */}
              <Field label="City" error={errors['city']}>
                <input className={inputCls('city')} value={values.city}
                  readOnly={isView} placeholder="e.g. Chennai"
                  onChange={(e) => updateField('city', e.target.value)} />
              </Field>

              {/* State */}
              <Field label="State" error={errors['state']}>
                <input className={inputCls('state')} value={values.state}
                  readOnly={isView} placeholder="e.g. Tamil Nadu"
                  onChange={(e) => updateField('state', e.target.value)} />
              </Field>

              {/* Country */}
              <Field label="Country" error={errors['country']}>
                <input className={inputCls('country')} value={values.country}
                  readOnly={isView} placeholder="e.g. India"
                  onChange={(e) => updateField('country', e.target.value)} />
              </Field>

            </div>

            {/* Footer actions */}
            {!isView && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
                <button type="button" className="btn btn--ghost" onClick={() => navigate('/vendor')} disabled={saving}>Cancel</button>
                <button type="button" className="btn btn--primary" onClick={onSubmit} disabled={saving}>
                  {saving ? 'Saving…' : isCreate ? 'Create Service Provider' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </AppShell>
  );
};

export default VendorForm;
