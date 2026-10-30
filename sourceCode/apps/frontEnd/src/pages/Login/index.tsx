import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LaeliaLogo } from '../../components/layout/LaeliaLogo';
import type { QuickLoginOption } from './types';

const EyeIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const QUICK_LOGINS: QuickLoginOption[] = [
  { key: 'admin',      label: 'Admin',              email: 'admin@laelia.com',      password: 'admin@123' },
  { key: 'adjuster',   label: 'Claims  Adjuster',          email: 'priya.nair@laelia.com', password: 'adjuster@123' },
  { key: 'supervisor', label: 'Claims Authority Reviewer',   email: 'claimssupr@laelia.com', password: 'client@123' },
];

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  // Kept separate — the Email/User ID and Phone tabs are distinct fields;
  // sharing one identifier state let a quick-login email leak into the
  // Phone input when switching tabs.
  const [emailIdentifier, setEmailIdentifier] = useState('');
  const [phoneIdentifier, setPhoneIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [activeQuickLogin, setActiveQuickLogin] = useState<string | null>(null);
  const [idMethod,   setIdMethod]   = useState<'email' | 'phone'>('email');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const doLogin = async (user: string, pass: string) => {
    setLoading(true);
    setError('');
    const result = await login(user.trim(), pass);
    setLoading(false);
    if (result.success) {
      if (result.vendorId) {
        if (result.vendorStatus === 'Active') {
          navigate(`/vendors/active/clients/${result.vendorId}`, { replace: true });
        } else {
          navigate(`/vendor/portal/onboarding/${result.vendorId}`, { replace: true });
        }
      } else {
        navigate(from, { replace: true });
      }
    } else {
      setError(result.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = idMethod === 'phone' ? phoneIdentifier : emailIdentifier;
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your email/username and password.');
      return;
    }
    await doLogin(identifier, password);
  };

  const handleQuickLogin = (option: QuickLoginOption) => {
    setActiveQuickLogin(option.key);
    setIdMethod('email');
    setEmailIdentifier(option.email);
    setPassword(option.password);
    setError('');
  };

  return (
    <div className="login-page">
      {/* Quick Login role selector — required to stay visible/functional */}
      <div className="login-quicklogin-bar">
        {QUICK_LOGINS.map((option) => {
          const isActive = activeQuickLogin === option.key;
          return (
            <button
              key={option.key}
              type="button"
              className={`login-quicklogin-tab${isActive ? ' login-quicklogin-tab--active' : ''}`}
              onClick={() => handleQuickLogin(option)}
              disabled={loading}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Hero: single two-tone panel (teal marketing side + white login card),
          matching the LandingPage.png reference layout */}
      <div className="login-hero">
        <div className="login-panel">
          <div className="login-panel-left">
            <LaeliaLogo variant="on-dark" size={60} />
            <h1 className="login-hero-heading">
              The Patented AI-Powered<br />
              3rd Party Claims Service<br />
              Orchestration Platform
            </h1>
            <ul className="login-hero-bullets">
              <li>Reduce Loss Adjustment Expense.</li>
              <li>Optimize vendor performance.</li>
              <li>Improve Claims outcomes.</li>
            </ul>
          </div>

          <div className="login-card">
            <div className="login-card-body">
              <h2 className="login-card-title">Login to your account</h2>

              <div className="login-inner-card">
                <form onSubmit={handleSubmit} noValidate>
                  {error && (
                    <div className="login-error-box">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {error}
                    </div>
                  )}

                  <div className="login-id-tabs-row">
                    <button
                      type="button"
                      className={`login-id-tab${idMethod === 'email' ? ' login-id-tab--active' : ''}`}
                      onClick={() => setIdMethod('email')}
                      disabled={loading}
                    >
                      Email or User ID
                    </button>
                    <button
                      type="button"
                      className={`login-id-tab${idMethod === 'phone' ? ' login-id-tab--active' : ''}`}
                      onClick={() => setIdMethod('phone')}
                      disabled={loading}
                    >
                      Phone
                    </button>
                  </div>

                  <div className="login-form-group">
                    <input
                      type={idMethod === 'phone' ? 'tel' : 'text'}
                      className="login-input"
                      placeholder={idMethod === 'phone' ? 'Enter your phone number' : 'Enter your email or username'}
                      value={idMethod === 'phone' ? phoneIdentifier : emailIdentifier}
                      onChange={(e) => (idMethod === 'phone' ? setPhoneIdentifier(e.target.value) : setEmailIdentifier(e.target.value))}
                      autoComplete={idMethod === 'phone' ? 'tel' : 'username'}
                      autoFocus
                      disabled={loading}
                    />
                  </div>

                  <div className="login-form-group">
                    <div className="password-input">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="login-input"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        className="password-input__toggle"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>

                  <label className="login-remember-row">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="login-checkbox"
                    />
                    Remember me
                  </label>

                  <button
                    type="submit"
                    className="login-submit-btn"
                    disabled={loading}
                  >
                    {loading ? (
                      <svg className="login-spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                        <path d="M21 12a9 9 0 11-6.22-8.56" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    )}
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>

                <p className="login-terms login-terms--first">
                  By selecting Sign In, you agree to{' '}
                  <span className="login-link">LAElia terms</span>.
                </p>
                <p className="login-terms">
                  Our <span className="login-link">Privacy Policy</span> applies to your personal data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legal footer links — sit on the light page background below the panel,
          matching the LandingPage.png reference */}
      <div className="login-footer-links-row login-footer-links-row--first">
        <span className="login-footer-link">Legal</span>
        <span className="login-footer-link">Privacy</span>
        <span className="login-footer-link">Security</span>
        <span className="login-footer-link">Manage cookies</span>
        <span className="login-footer-link">Support</span>
        <span className="login-footer-link">Software License Agreement</span>
      </div>
      <p className="login-copyright">© 2026 Mahathi InfoTech. All rights reserved.</p>
    </div>
  );
};

export default LoginPage;
