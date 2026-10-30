import React, { useEffect, useMemo, useRef, useState } from 'react';

interface SpecificDatePickerProps {
  /** Selected date as 'YYYY-MM-DD' (local), or null when no specific date is active. */
  value: string | null;
  onChange: (value: string | null) => void;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const CalendarIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ChevronLeftIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
);

const ChevronRightIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

const SpecificDatePicker: React.FC<SpecificDatePickerProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => (value ? parseIsoDate(value) : new Date()));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, []);

  useEffect(() => {
    if (open) setViewDate(value ? parseIsoDate(value) : new Date());
  }, [open, value]);

  const cells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const out: { date: Date; inMonth: boolean }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      out.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (out.length % 7 !== 0 || out.length < 42) {
      const last = out[out.length - 1].date;
      out.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
    }
    return out;
  }, [viewDate]);

  const todayIso = toIsoDate(new Date());

  return (
    <div className={`dp-picker${open ? ' dp-picker--open' : ''}`} ref={ref}>
      <button
        type="button"
        className={`dp-picker__trigger${value ? ' dp-picker__trigger--active' : ''}`}
        aria-label="Pick a specific date"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
      >
        <CalendarIcon />
        {value && <span className="dp-picker__trigger-label">{formatDisplay(value)}</span>}
        {value && (
          <span
            className="dp-picker__trigger-clear"
            role="button"
            aria-label="Clear selected date"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
          >
            &times;
          </span>
        )}
      </button>

      {open && (
        <div className="dp-picker__panel" role="dialog" aria-label="Select a date">
          <div className="dp-picker__nav">
            <button type="button" className="dp-picker__nav-btn" aria-label="Previous month"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              <ChevronLeftIcon />
            </button>
            <span className="dp-picker__nav-label">
              {viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" className="dp-picker__nav-btn" aria-label="Next month"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              <ChevronRightIcon />
            </button>
          </div>

          <div className="dp-picker__weekdays">
            {WEEKDAY_LABELS.map((w) => <span key={w}>{w}</span>)}
          </div>

          <div className="dp-picker__grid">
            {cells.map(({ date, inMonth }) => {
              const iso = toIsoDate(date);
              const isSelected = value === iso;
              const isToday = todayIso === iso;
              return (
                <button
                  type="button"
                  key={iso}
                  className={[
                    'dp-picker__day',
                    !inMonth && 'dp-picker__day--outside',
                    isToday && 'dp-picker__day--today',
                    isSelected && 'dp-picker__day--selected',
                  ].filter(Boolean).join(' ')}
                  onClick={() => { onChange(iso); setOpen(false); }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecificDatePicker;
