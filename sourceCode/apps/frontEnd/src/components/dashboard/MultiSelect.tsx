import React, { useEffect, useRef, useState } from 'react';

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selected,
  onChange,
  placeholder = 'Select…',
  emptyLabel = 'No options',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (option: string) => {
    onChange(selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option]);
  };

  return (
    <div className={`ms-select${open ? ' ms-select--open' : ''}`} ref={ref}>
      <div
        className="ms-select__trigger"
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!disabled) setOpen((p) => !p); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) setOpen((p) => !p);
          }
        }}
      >
        {selected.length > 0
          ? selected.map((s) => (
              <span key={s} className="ms-select__chip">
                {s}
                <span className="ms-select__chip-remove" onClick={(e) => { e.stopPropagation(); toggle(s); }}>×</span>
              </span>
            ))
          : <span className="ms-select__placeholder">{placeholder}</span>}
        <span className="ms-select__chevron">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>
      {open && (
        <div className="ms-select__dropdown">
          {options.length === 0
            ? <div className="ms-select__empty">{emptyLabel}</div>
            : options.map((o) => (
                <label key={o} className="ms-select__option">
                  <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} />
                  {o}
                </label>
              ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
