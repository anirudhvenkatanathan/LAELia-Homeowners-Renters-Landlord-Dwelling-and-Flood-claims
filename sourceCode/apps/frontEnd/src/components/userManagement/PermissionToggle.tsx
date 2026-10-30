import React from 'react';

interface PermissionToggleProps {
  id:          string;
  label:       string;
  description: string;
  checked:     boolean;
  disabled?:   boolean;
  onChange:    (checked: boolean) => void;
}

export const PermissionToggle: React.FC<PermissionToggleProps> = ({ id, label, description, checked, disabled, onChange }) => (
  <div className="perm-toggle-row">
    <div className="perm-toggle-row__text">
      <label className="perm-toggle-row__label" htmlFor={id}>{label}</label>
      <span className="perm-toggle-row__desc">{description}</span>
    </div>
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`perm-toggle${checked ? ' perm-toggle--on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="perm-toggle__track" />
    </button>
  </div>
);

export default PermissionToggle;
