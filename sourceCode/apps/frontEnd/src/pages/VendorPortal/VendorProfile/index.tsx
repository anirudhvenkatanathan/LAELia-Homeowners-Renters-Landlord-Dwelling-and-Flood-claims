import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import VendorPortalShell from '../../../components/layout/VendorPortalShell';
import {
  getOnboardingDetails,
  updateVendorProfile,
} from '../../../services/vendorOnboarding/vendorOnboardingService';
import type { VendorOnboardingDetails } from '../../../models/vendorOnboarding/vendorOnboardingModel';
import { US_STATES } from '../../../models/vendorServiceRequest/vendorServiceRequestModel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileForm {
  companyName:        string;
  emailId:            string;
  phoneNumber:        string;
  website:            string;
  address:            string;
  contactPersonName:  string;
  contactPersonEmail: string;
  contactPersonPhone: string;
}

function detailsToForm(d: VendorOnboardingDetails): ProfileForm {
  return {
    companyName:        d.companyName,
    emailId:            d.emailId,
    phoneNumber:        d.phoneNumber,
    website:            d.website,
    address:            d.address,
    contactPersonName:  d.contactPersonName,
    contactPersonEmail: d.contactPersonEmail,
    contactPersonPhone: d.contactPersonPhone,
  };
}

function parseCoverage(raw: string): string[] {
  return raw.split(',').map((c) => c.trim()).filter(Boolean);
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, value, type = 'text', onChange, required, editing }: {
  label: string; value: string; type?: string;
  onChange: (v: string) => void; required?: boolean; editing: boolean;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 3 }}>
        {label}{required && editing && <span style={{ color: 'var(--color-danger)' }}> *</span>}
      </div>
      {editing
        ? <input type={type} className="form-input" value={value} onChange={(e) => onChange(e.target.value)} style={{ height: 32, fontSize: '0.85rem', padding: '0 10px' }} />
        : <div style={{ fontSize: '0.88rem', color: value ? 'var(--color-text)' : 'var(--color-text-muted)', fontStyle: value ? 'normal' : 'italic', borderBottom: '1px solid var(--color-border)', padding: '4px 0 3px', minHeight: 26 }}>{value || '—'}</div>}
    </div>
  );
}

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// ─── Compact card ─────────────────────────────────────────────────────────────

const Card: React.FC<{ title: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, children, style }) => (
  <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 16px', flexShrink: 0, ...style }}>
    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
      {title}
    </div>
    {children}
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const VendorProfile: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();

  const [details,   setDetails]   = useState<VendorOnboardingDetails | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [form,      setForm]      = useState<ProfileForm | null>(null);
  const [coverage,  setCoverage]  = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!vendorId) return;
    getOnboardingDetails(vendorId)
      .then((d) => {
        setDetails(d);
        setForm(detailsToForm(d));
        setCoverage(parseCoverage(d.coverage));
      })
      .catch(() => setError('Failed to load profile. Please refresh.'))
      .finally(() => setLoading(false));
  }, [vendorId]);

  const setField = useCallback(<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const toggleCoverage = useCallback((code: string) => {
    setCoverage((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  }, []);

  const handleCancel = useCallback(() => {
    if (!details) return;
    setForm(detailsToForm(details));
    setCoverage(parseCoverage(details.coverage));
    setIsEditing(false);
    setSaveMsg(null);
  }, [details]);

  const handleSave = useCallback(async () => {
    if (!vendorId || !form) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const result = await updateVendorProfile(vendorId, {
        companyName:        form.companyName,
        emailId:            form.emailId,
        phoneNumber:        form.phoneNumber,
        address:            form.address,
        website:            form.website,
        contactPersonName:  form.contactPersonName,
        contactPersonEmail: form.contactPersonEmail,
        contactPersonPhone: form.contactPersonPhone,
        coverageStates:     coverage,
      });
      if (result.success) {
        setSaveMsg({ type: 'success', text: 'Profile updated successfully.' });
        setIsEditing(false);
        const updated = await getOnboardingDetails(vendorId);
        setDetails(updated);
        setForm(detailsToForm(updated));
        setCoverage(parseCoverage(updated.coverage));
        setTimeout(() => setSaveMsg(null), 5000);
      } else {
        setSaveMsg({ type: 'error', text: result.message || 'Save failed.' });
      }
    } catch {
      setSaveMsg({ type: 'error', text: 'Save failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  }, [vendorId, form, coverage]);

  if (!vendorId) return null;

  const states = US_STATES.filter((s) => s.code !== 'Virtual');

  return (
    <VendorPortalShell vendorId={vendorId} activeTab="profile" companyName={details?.companyName} noScroll>
      <div style={{
        height: '100%',
        padding: '18px 28px 16px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Service Provider Portal</p>
            <h1 style={{ margin: '2px 0 0', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>My Profile</h1>
          </div>
          {form && (
            isEditing ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn--ghost btn--sm" disabled={saving} onClick={handleCancel}>Cancel</button>
                <button type="button" className="btn btn--primary btn--sm" disabled={saving} onClick={() => void handleSave()} style={{ minWidth: 110 }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setIsEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <EditIcon /> Edit Profile
              </button>
            )
          )}
        </div>

        {saveMsg && (
          <div className={`alert alert--${saveMsg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 10, fontSize: '0.88rem', padding: '7px 14px', flexShrink: 0 }}>
            {saveMsg.text}
          </div>
        )}

        {loading && <div className="vpo-loading">Loading profile…</div>}
        {error   && <div className="alert alert--error">{error}</div>}

        {!loading && !error && form && (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch' }}>

            {/* ── Left column ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflowY: 'auto' }}>

              <Card title="Company Information">
                <Field label="Company Name" value={form.companyName} onChange={(v) => setField('companyName', v)} required editing={isEditing} />
                <Field label="Address" value={form.address} onChange={(v) => setField('address', v)} editing={isEditing} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                  <Field label="Email" type="email" value={form.emailId} onChange={(v) => setField('emailId', v)} editing={isEditing} />
                  <Field label="Phone" value={form.phoneNumber} onChange={(v) => setField('phoneNumber', v)} editing={isEditing} />
                  <Field label="Website" value={form.website} onChange={(v) => setField('website', v)} editing={isEditing} />
                </div>
              </Card>

              <Card title="Contact Person">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                  <Field label="Name" value={form.contactPersonName} onChange={(v) => setField('contactPersonName', v)} editing={isEditing} />
                  <Field label="Phone" value={form.contactPersonPhone} onChange={(v) => setField('contactPersonPhone', v)} editing={isEditing} />
                  <Field label="Email" type="email" value={form.contactPersonEmail} onChange={(v) => setField('contactPersonEmail', v)} editing={isEditing} />
                </div>
              </Card>

              {details && details.roleSummary.filter((r) => (details.lockedServiceRoleIds ?? []).includes(r.roleId)).length > 0 && (
                <Card title="Service Categories">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {details.roleSummary
                      .filter((r) => (details.lockedServiceRoleIds ?? []).includes(r.roleId))
                      .map((role) => (
                        <div key={role.roleId} style={{ background: '#f1f5f9', border: '1px solid var(--color-border)', borderRadius: 5, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{role.roleCode}</span>
                          <span style={{ fontSize: '0.88rem', color: 'var(--color-text)', fontWeight: 500 }}>{role.roleName}</span>
                        </div>
                      ))}
                  </div>
                </Card>
              )}
            </div>

            {/* ── Right column — Virtual Coverage + Geographic Coverage ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>

              <Card title="Virtual Coverage" style={{ flexShrink: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: isEditing ? 'pointer' : 'default', fontSize: '0.88rem', color: 'var(--color-text)' }}>
                  <input
                    type="checkbox"
                    checked={coverage.includes('Virtual')}
                    onChange={() => isEditing && toggleCoverage('Virtual')}
                    disabled={!isEditing}
                    style={{ width: 14, height: 14, accentColor: 'var(--color-primary)', cursor: isEditing ? 'pointer' : 'default' }}
                  />
                  We support virtual / remote service delivery
                </label>
              </Card>

              <div style={{
                flex: 1, minHeight: 0,
                background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10,
                padding: '12px 16px', display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, flexShrink: 0 }}>
                  Geographic Coverage
                </div>
                <div style={{
                  flex: 1, minHeight: 0, overflowY: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: 5,
                  alignContent: 'start',
                  pointerEvents: isEditing ? 'auto' : 'none',
                  opacity: isEditing ? 1 : 0.8,
                }}>
                  {states.map((s) => {
                    const selected = coverage.includes(s.code);
                    return (
                      <label
                        key={s.code}
                        title={s.name}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: isEditing ? 'pointer' : 'default',
                          background: selected ? 'var(--color-primary)' : '#f8fafc',
                          color: selected ? '#fff' : 'var(--color-text)',
                          border: `1.5px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          borderRadius: 4, padding: '4px 2px',
                          fontSize: '0.72rem', fontWeight: 600,
                          transition: 'background 0.12s, color 0.12s, border-color 0.12s',
                          userSelect: 'none',
                        }}
                      >
                        <input type="checkbox" checked={selected} onChange={() => toggleCoverage(s.code)} disabled={!isEditing} style={{ display: 'none' }} />
                        {s.code}
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>
        )}
      </div>
    </VendorPortalShell>
  );
};

export default VendorProfile;
