import { DATE_RANGE_OPTIONS } from '../../models/dashboard/executiveOverviewModel';
import type { DateRangeValue } from '../../models/dashboard/executiveOverviewModel';

interface DateRangePickerProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  /** Defaults to the shared DATE_RANGE_OPTIONS when omitted. */
  options?: readonly { label: string; value: T }[];
}

function DateRangePicker<T extends string = DateRangeValue>({ value, onChange, options }: DateRangePickerProps<T>) {
  const opts = options ?? (DATE_RANGE_OPTIONS as unknown as readonly { label: string; value: T }[]);
  return (
    <div className="kpi-filter-item">
      <select
        className="kpi-filter-select"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label="Date range"
      >
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="kpi-filter-select__chevron">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </span>
    </div>
  );
}

export default DateRangePicker;
