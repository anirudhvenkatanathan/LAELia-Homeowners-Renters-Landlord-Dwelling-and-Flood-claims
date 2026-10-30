import React, { forwardRef, useState } from 'react';

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

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
}

/** Shared show/hide password field — matches the .form-group/.form-input/.form-error
 * classes used throughout the app, with a .password-input__toggle eye button. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ id, label, value, onChange, error, required, autoComplete, disabled }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="form-group">
        <label className={`form-label${required ? ' form-label--required' : ''}`} htmlFor={id}>
          {label}
        </label>
        <div className="password-input">
          <input
            ref={ref}
            id={id}
            type={visible ? 'text' : 'password'}
            className="form-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            disabled={disabled}
          />
          <button
            type="button"
            className="password-input__toggle"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? `Hide ${label}` : `Show ${label}`}
            tabIndex={-1}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {error && <span className="form-error" role="alert">{error}</span>}
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
