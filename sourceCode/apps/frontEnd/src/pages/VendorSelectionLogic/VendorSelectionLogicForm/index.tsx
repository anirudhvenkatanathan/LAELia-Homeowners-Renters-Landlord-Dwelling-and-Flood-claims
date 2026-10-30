import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import AppShell from '../../../components/layout/AppShell';
import { useVendorSelectionLogicForm } from '../../../hooks/vendorSelectionLogic/useVendorSelectionLogicForm';
import type { VendorSelectionLogicFormValues } from '../../../models/vendorSelectionLogic/vendorSelectionLogicModel';
import type { FormMode } from '../../../models/vendorSelectionLogic/vendorSelectionLogicModel';

// ─── Icons ────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

// ─── Field sub-component ──────────────────────────────────────────────────────

const Field: React.FC<{ label: string; required?: boolean; error?: string; children: React.ReactNode }> = ({
  label, required, error, children,
}) => (
  <div className="form-group">
    <label className={`form-label${required ? ' form-label--required' : ''}`}>{label}</label>
    {children}
    {error && <span className="form-error">{error}</span>}
  </div>
);

// ─── Page Component ───────────────────────────────────────────────────────────

const VendorSelectionLogicForm: React.FC = () => {
  const { ruleId } = useParams<{ ruleId: string }>();
  const navigate   = useNavigate();

  const isEdit                = Boolean(ruleId);
  const initialMode: FormMode = isEdit ? 'edit' : 'create';

  const { values, errors, loading, saving, submitError, updateField, handleSubmit } =
    useVendorSelectionLogicForm(ruleId ?? null, initialMode);

  const cancelPath = isEdit ? `/vendor/vendor-selection-logic/${ruleId}` : '/vendor/vendor-selection-logic';

  const onSubmit = async () => {
    const result = await handleSubmit();
    if (result.success) {
      navigate(`/vendor/vendor-selection-logic/${result.ruleId}`);
    }
  };

  const inputCls = (field: keyof VendorSelectionLogicFormValues) =>
    `form-input${errors[field] ? ' form-input--error' : ''}`;

  return (
    <AppShell>
      <div className="page-card">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="page-header page-header--with-action">
          <div>
            <h1 className="page-title">
              {isEdit ? 'Edit Service Provider Selection Logic' : 'New Service Provider Selection Logic'}
            </h1>
            <p className="page-subtitle">
              {isEdit
                ? 'Update the rule logic for automated service provider selection.'
                : 'Create a new logic for automated service provider selection.'}
            </p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => navigate(cancelPath)}>
            <BackIcon /> Cancel
          </button>
        </div>

        {submitError && <div className="alert alert--error notification-bar" role="alert">{submitError}</div>}

        {loading ? (
          <div className="detail-loading">
            <p className="text-sm-muted">Loading…</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: 0 }}>

            {/* ── Left: Logic Library ─────────────────────────────────── */}
            <div className="section-block" style={{ paddingTop: 12 }}>
              <h3 className="detail-section__heading">Logic Details</h3>

              <Field label="Logic Name" required error={errors.name}>
                <input
                  type="text"
                  className={inputCls('name')}
                  placeholder="e.g. Conflict Check"
                  maxLength={80}
                  value={values.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </Field>

              <Field label="Category Name" required error={errors.category}>
                <input
                  type="text"
                  className={inputCls('category')}
                  placeholder="e.g. Compliance"
                  value={values.category}
                  onChange={(e) => updateField('category', e.target.value)}
                />
              </Field>

              <Field label="Description" required error={errors.description}>
                <textarea
                  className={inputCls('description')}
                  rows={3}
                  placeholder="Plain-language explanation of what this logic enforces."
                  maxLength={500}
                  value={values.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </Field>

              <Field label="Status" required error={errors.status}>
                <select
                  className={inputCls('status')}
                  value={values.status}
                  onChange={(e) => updateField('status', e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </Field>
            </div>

            {/* ── Right: Preview Logic ───────────────────────────────── */}
            <div className="section-block" style={{ paddingTop: 12 }}>
              <h2 className="section-title">Preview Logic</h2>

              <Field label="Conditions" required error={errors.conditions}>
                <textarea
                  className={`${inputCls('conditions')} form-input--monospace`}
                  rows={8}
                  placeholder="Type your condition here"
                  value={values.conditions}
                  onChange={(e) => updateField('conditions', e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.82rem', resize: 'vertical' }}
                />
              </Field>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Define the rule logic using IF/THEN syntax.
              </p>
            </div>

          </div>
        )}

        {/* ── Footer Actions ────────────────────────────────────────────── */}
        {!loading && (
          <div style={{ padding: '16px 28px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn--ghost" onClick={() => navigate(cancelPath)} disabled={saving}>
              <BackIcon /> Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={onSubmit} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Logic'}
            </button>
          </div>
        )}

      </div>
    </AppShell>
  );
};

export default VendorSelectionLogicForm;
