import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { gql } from '@apollo/client';
import { getApolloClient } from '../../config/apolloClient';
import { getServiceCategories } from '../../services/vendorServiceRequest/vendorServiceRequestService';
import { US_STATES } from '../../models/vendorServiceRequest/vendorServiceRequestModel';
import type { ServiceCategory } from '../../models/vendorServiceRequest/vendorServiceRequestModel';
import { LaeliaLogo } from '../../components/layout/LaeliaLogo';
import { loginTheme } from '../Login/styles';

// ─── GraphQL ──────────────────────────────────────────────────────────────────

const VENDOR_SIGNUP_MUTATION = gql`
  mutation VendorSignUp(
    $email:              String!
    $password:           String!
    $companyName:        String!
    $address:            String
    $website:            String
    $contactPersonName:  String
    $contactPersonPhone: String
    $contactPersonEmail: String
    $services:           [String!]!
    $coverage:           [String!]!
  ) {
    vendorSignUp(
      email:              $email
      password:           $password
      companyName:        $companyName
      address:            $address
      website:            $website
      contactPersonName:  $contactPersonName
      contactPersonPhone: $contactPersonPhone
      contactPersonEmail: $contactPersonEmail
      services:           $services
      coverage:           $coverage
    ) {
      success
      message
    }
  }
`;

// ─── Icons ────────────────────────────────────────────────────────────────────

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

// ─── Section Card ─────────────────────────────────────────────────────────────

const SectionCard: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{
    background: 'var(--color-surface, #fff)',
    border: '1px solid var(--color-border, #e5e7eb)',
    borderRadius: 10,
    padding: '24px 28px',
    marginBottom: 20,
  }}>
    {title && (
      <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text, #111827)', margin: '0 0 18px' }}>
        {title}
      </h2>
    )}
    {children}
  </div>
);

// ─── Password Field ───────────────────────────────────────────────────────────

const PasswordField: React.FC<{
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string;
}> = ({ label, value, onChange, placeholder, error }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="form-group">
      <label className="form-label form-label--required">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          className="form-input"
          placeholder={placeholder ?? ''}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ paddingRight: 40, borderColor: error ? '#dc2626' : undefined }}
        />
        <button
          type="button"
          onClick={() => setShow((p) => !p)}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted, #9ca3af)', padding: 0,
          }}
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && (
        <p style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: 4, marginBottom: 0 }}>{error}</p>
      )}
    </div>
  );
};

// ─── Summary Row ──────────────────────────────────────────────────────────────

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: '0.85rem' }}>
    <span style={{ color: 'var(--color-text-muted, #6b7280)', minWidth: 160, flexShrink: 0 }}>{label}</span>
    <span style={{ color: 'var(--color-text, #111827)', fontWeight: 500, wordBreak: 'break-word' }}>{value || '—'}</span>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const VendorSignupPage: React.FC = () => {
  const navigate = useNavigate();

  // Account fields
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Company fields
  const [companyName,        setCompanyName]        = useState('');
  const [address,            setAddress]            = useState('');
  const [website,            setWebsite]            = useState('');

  // Contact fields
  const [contactPersonName,  setContactPersonName]  = useState('');
  const [contactPersonPhone, setContactPersonPhone] = useState('');
  const [contactPersonEmail, setContactPersonEmail] = useState('');

  // Service / coverage
  const [categories,    setCategories]    = useState<ServiceCategory[]>([]);
  const [catLoading,    setCatLoading]    = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [coverage,      setCoverage]      = useState<string[]>([]);
  const [serviceCatError, setServiceCatError] = useState('');

  // UI state
  const [error,                setError]                = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [submitting,           setSubmitting]           = useState(false);
  const [showSummary,          setShowSummary]          = useState(false);
  const [submitted,            setSubmitted]            = useState(false);

  useEffect(() => {
    getServiceCategories()
      .then((data) => setCategories(data))
      .catch(() => setCategories([]))
      .finally(() => setCatLoading(false));
  }, []);

  const toggleRole = (roleId: string) => {
    if (serviceCatError) setServiceCatError('');
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const selectAllRoles = () => {
    if (serviceCatError) setServiceCatError('');
    setSelectedRoles(categories.map((c) => c.roleId));
  };

  const clearAllRoles = () => {
    setSelectedRoles([]);
  };

  const toggleCoverage = (code: string) => {
    setCoverage((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleConfirmPasswordChange = (val: string) => {
    setConfirmPassword(val);
    if (val && password && val !== password) {
      setConfirmPasswordError('Passwords do not match.');
    } else {
      setConfirmPasswordError('');
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (confirmPassword && val !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
    } else if (confirmPassword && val === confirmPassword) {
      setConfirmPasswordError('');
    }
  };

  const validate = (): string | null => {
    if (!email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
    if (!password) return 'Password is required.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (!/\d/.test(password)) return 'Password must contain at least one number.';
    if (!/[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/.test(password)) return 'Password must contain at least one special character.';
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      return 'mismatch'; // sentinel — shown inline, not in bottom banner
    }
    if (!companyName.trim()) return 'Company name is required.';
    if (selectedRoles.length === 0) {
      setServiceCatError('Please select at least one service category.');
      return 'Please select at least one service category.';
    }
    return null;
  };

  const handleSubmitClick = () => {
    setServiceCatError('');
    const err = validate();
    if (err) {
      // 'mismatch' and service-cat errors are shown inline — don't surface in the bottom banner
      if (err !== 'Please select at least one service category.' && err !== 'mismatch') setError(err);
      return;
    }
    setError('');
    setShowSummary(true);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const client = getApolloClient();
      const result = await client.mutate<{ vendorSignUp: { success: boolean; message: string } }>({
        mutation: VENDOR_SIGNUP_MUTATION,
        variables: {
          email: email.trim(),
          password,
          companyName: companyName.trim(),
          address:            address.trim()            || undefined,
          website:            website.trim()            || undefined,
          contactPersonName:  contactPersonName.trim()  || undefined,
          contactPersonPhone: contactPersonPhone.trim() || undefined,
          contactPersonEmail: contactPersonEmail.trim() || undefined,
          services: selectedRoles,
          coverage,
        },
      });
      const res = result.data?.vendorSignUp;
      if (res?.success) {
        setSubmitted(true);
      } else {
        setError(res?.message ?? 'Registration failed. Please try again.');
        setShowSummary(false);
      }
    } catch {
      setError('Registration failed. Please try again.');
      setShowSummary(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalClose = () => {
    setShowSummary(false);
    navigate('/login');
  };

  // Derive display names for summary
  const selectedCategoryNames = categories
    .filter((c) => selectedRoles.includes(c.roleId))
    .map((c) => c.name)
    .join(', ');

  const selectedCoverageNames = coverage.join(', ');

  return (
    <div style={{ minHeight: '100vh', background: loginTheme.teal400 }}>
      {/* Brand bar — identical treatment to the Login screen, pinned to the
          top of the viewport so it stays visible while the long form scrolls. */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: loginTheme.teal400,
        padding: '8px 24px',
      }}>
        <div style={{
          background: loginTheme.tealDarkest,
          padding: '8px 20px',
          borderRadius: 12,
          display: 'inline-flex',
          alignItems: 'center',
        }}>
          <LaeliaLogo variant="on-dark" size={70} />
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 48px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text, #111827)', margin: '0 0 6px' }}>
            Create Account
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted, #6b7280)', margin: 0 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: loginTheme.tealDark, fontWeight: 600, textDecoration: 'none' }}>
              Sign In
            </Link>
          </p>
        </div>

        {/* Account Details */}
        <SectionCard title="New Service Provider Account Details">
          <div className="vsr-form-grid">
            <div className="form-group">
              <label className="form-label form-label--required">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. vendor@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <PasswordField label="Password" value={password} onChange={handlePasswordChange} placeholder="Min 6 chars, 1 number and 1 special atleast" />
            <PasswordField label="Confirm Password" value={confirmPassword} onChange={handleConfirmPasswordChange} placeholder="Re-enter password" error={confirmPasswordError} />
          </div>
        </SectionCard>

        {/* Company Information */}
        <SectionCard title="Company Information">
          <div className="vsr-form-grid">
            <div className="form-group">
              <label className="form-label form-label--required">Company Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Acme Field Services"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 123 Main St, Springfield, IL"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. www.acme.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
          </div>
        </SectionCard>

        {/* Contact Details */}
        <SectionCard title="Contact Details">
          <div className="vsr-form-grid">
            <div className="form-group">
              <label className="form-label">Contact Person Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Jane Doe"
                value={contactPersonName}
                onChange={(e) => setContactPersonName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. (800) 555-1234"
                value={contactPersonPhone}
                onChange={(e) => setContactPersonPhone(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. jane.doe@acme.com"
                value={contactPersonEmail}
                onChange={(e) => setContactPersonEmail(e.target.value)}
              />
            </div>
          </div>
        </SectionCard>

        {/* Service Categories */}
        <SectionCard title="">
          <div className="vsr-section-header" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text, #111827)', margin: 0 }}>
              Service Categories
              <span style={{ color: '#dc2626', marginLeft: 3, fontWeight: 600 }}>*</span>
            </h2>
            <div className="vsr-section-actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={selectAllRoles}>Select All</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={clearAllRoles}>Clear All</button>
            </div>
          </div>
          {catLoading ? (
            <p className="text-sm-muted">Loading service categories…</p>
          ) : (
            <div className="vsr-service-grid">
              {categories.map((cat) => {
                const selected = selectedRoles.includes(cat.roleId);
                return (
                  <label
                    key={cat.roleId}
                    className={`vsr-service-card${selected ? ' vsr-service-card--selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="vsr-service-card__checkbox"
                      checked={selected}
                      onChange={() => toggleRole(cat.roleId)}
                    />
                    <div className="vsr-service-card__body">
                      <span className="vsr-service-card__name">{cat.name}</span>
                      {cat.description && <span className="vsr-service-card__desc">{cat.description}</span>}
                    </div>
                  </label>
                );
              })}
              {categories.length === 0 && (
                <p className="text-sm-muted">No active service categories found.</p>
              )}
            </div>
          )}
          {serviceCatError && (
            <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: 8, marginBottom: 0 }}>
              {serviceCatError}
            </p>
          )}
        </SectionCard>

        {/* Virtual Coverage */}
        <SectionCard title="Virtual Coverage">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.88rem', color: 'var(--color-text, #111827)' }}>
            <input
              type="checkbox"
              checked={coverage.includes('Virtual')}
              onChange={() => toggleCoverage('Virtual')}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            We support virtual / remote service delivery
          </label>
        </SectionCard>

        {/* Geographic Coverage */}
        <SectionCard title="Geographic Coverage">
          <div className="vsr-coverage-grid">
            {US_STATES.filter((s) => s.code !== 'Virtual').map((s) => {
              const selected = coverage.includes(s.code);
              return (
                <label
                  key={s.code}
                  className={`vsr-coverage-chip${selected ? ' vsr-coverage-chip--selected' : ''}`}
                >
                  <input type="checkbox" checked={selected} onChange={() => toggleCoverage(s.code)} />
                  {s.code}
                </label>
              );
            })}
          </div>
        </SectionCard>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            fontSize: '0.85rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="vsr-form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/login')}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSubmitClick}>
            Submit Request
          </button>
        </div>
      </div>

      {/* Summary / Success Modal */}
      {showSummary && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: 520 }}>
            {submitted ? (
              <>
                <div className="modal__header">
                  <h2 className="modal__title" style={{ color: '#16a34a' }}>Registration Successful</h2>
                </div>
                <div className="modal__body">
                  <p style={{ fontSize: '0.88rem', color: 'var(--color-text, #111827)', lineHeight: 1.6 }}>
                    Your account has been created and your vendor request has been submitted successfully.
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted, #6b7280)', marginTop: 8 }}>
                    Please sign in with your email and password to view your onboarding status.
                  </p>
                </div>
                <div className="modal__footer">
                  <button type="button" className="btn btn--primary" onClick={handleModalClose}>
                    Go to Sign In
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal__header">
                  <h2 className="modal__title">Review Your Details</h2>
                </div>
                <div className="modal__body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Account
                    </p>
                    <SummaryRow label="Email" value={email.trim()} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Company
                    </p>
                    <SummaryRow label="Company Name"  value={companyName.trim()} />
                    <SummaryRow label="Address"       value={address.trim()} />
                    <SummaryRow label="Website"       value={website.trim()} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Contact
                    </p>
                    <SummaryRow label="Contact Person" value={contactPersonName.trim()} />
                    <SummaryRow label="Phone"          value={contactPersonPhone.trim()} />
                    <SummaryRow label="Contact Email"  value={contactPersonEmail.trim()} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Services &amp; Coverage
                    </p>
                    <SummaryRow label="Service Categories" value={selectedCategoryNames} />
                    <SummaryRow label="Geographic Coverage" value={selectedCoverageNames} />
                  </div>
                </div>
                <div className="modal__footer">
                  <button type="button" className="btn btn--ghost" onClick={() => setShowSummary(false)} disabled={submitting}>
                    Edit Details
                  </button>
                  <button type="button" className="btn btn--primary" onClick={handleConfirm} disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Confirm & Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorSignupPage;
