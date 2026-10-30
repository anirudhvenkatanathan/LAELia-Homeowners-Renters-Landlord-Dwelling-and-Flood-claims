import React from 'react';
import type { KpiCardData, KpiIconKey, TrendDirection } from '../../models/dashboard/executiveOverviewModel';
import { formatCount, formatMillionsWhole, formatPercent, formatPercentWhole } from '../../models/dashboard/executiveOverviewModel';

// ─── Icon paths per KPI ──────────────────────────────────────────────────────

const ICON_PATHS: Record<KpiIconKey, string | string[]> = {
  claims:       'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2L14 8 20 8',
  lae:          ['M18 20V10', 'M12 20V4', 'M6 20V14'],
  savings:      'M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  subrogation:  'M3 12a9 9 0 0115-6.7L21 8 M21 12a9 9 0 01-15 6.7L3 16',
  sla:          'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
};

const KPI_SUB_LABELS: Record<string, string> = {
  'total-claims':        'vs. prior period',
  'total-lae':           'Loss Adjustment Expense',
  'total-savings':       'Captured this period',
  'subrogation-recovery':'Recovered this period',
  'sla-compliance':      'Across all services',
};

// Cards showing the new stacked layout — label / current value + "was {prior}"
// pill / trend indicator + "vs. previous 30 days" — instead of the plain
// formatted value string. prior = current / (1 + pct/100).
const PRIOR_PERIOD_CARD_IDS = new Set(['total-claims', 'total-lae', 'total-savings', 'sla-compliance']);

// Per-card number formatting — one shared formatter per unit, no per-card duplication.
// Total Claims is a count (plain comma-separated whole number); Total LAE / Total
// Savings are currency in millions to 1 decimal place (e.g. "$2.3M"); SLA
// Compliance is a percent (whole number, no decimal).
const KPI_VALUE_FORMAT: Record<string, (n: number) => string> = {
  'total-claims':   formatCount,
  'total-lae':      (n) => formatMillionsWhole(n, 1),
  'total-savings':  (n) => formatMillionsWhole(n, 1),
  'sla-compliance': formatPercentWhole,
};

const Icon: React.FC<{ d: string | string[] }> = ({ d }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(d) ? d : [d]).map((path, i) => <path key={i} d={path} />)}
  </svg>
);

// Single shared badge — same markup/classes wherever a trend indicator is shown.
// Percent is shown as-authored (one decimal, e.g. "8.4%"), not rounded to a
// whole number — this is the hardcoded baseTrendPercent from KPI_DEFINITIONS,
// displayed verbatim rather than reformatted.
// `flat` drops the pill background (used inline in the trend row) — the footer
// placement keeps the colored pill.
const TrendBadge: React.FC<{ direction: TrendDirection; percent: number; flat?: boolean }> = ({ direction, percent, flat }) => (
  <span className={`dash-metric-card__trend dash-metric-card__trend--${direction}${flat ? ' dash-metric-card__trend--flat' : ''}`}>
    {direction === 'up' ? '↑' : '↓'} {formatPercent(percent)}
  </span>
);

// ─── KpiCard ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  data: KpiCardData;
  checked: boolean;
  onToggle: (id: string) => void;
}

const KpiCard: React.FC<KpiCardProps> = ({ data, checked, onToggle }) => {
  const showPrior = PRIOR_PERIOD_CARD_IDS.has(data.id) && data.rawValue !== undefined;
  const formatValue = KPI_VALUE_FORMAT[data.id];

  const visibilityToggle = (
    <label
      className="dash-metric-card__visibility-wrap"
      title={checked ? 'Hide this card' : 'Show this card'}
    >
      <input
        type="checkbox"
        className="dash-metric-card__visibility"
        checked={checked}
        onChange={() => onToggle(data.id)}
        aria-label={`Toggle visibility of ${data.label} card`}
      />
    </label>
  );

  return (
    <div className="dash-metric-card">
      {showPrior && formatValue ? (
        <>
          {/* Row 1: label + icon chip (no checkbox — visibility for these cards is
              managed from the Filters modal, not an inline toggle here) */}
          <div className="dash-metric-card__header">
            <span className="dash-metric-card__label">{data.label}</span>
            <span className="dash-metric-card__icon"><Icon d={ICON_PATHS[data.icon]} /></span>
          </div>
          {/* Row 2: current value + "was {prior}" pill */}
          <div className="dash-metric-card__value-line">
            <span className="dash-metric-card__value">{formatValue(Math.round(data.rawValue as number))}</span>
            <span className="dash-metric-card__was-pill">
              was {formatValue(Math.round((data.rawValue as number) / (1 + data.trendPercent / 100)))}
            </span>
          </div>
          {/* Row 3: trend indicator + "vs. previous 30 days" */}
          <div className="dash-metric-card__trend-row">
            <TrendBadge direction={data.trendDirection} percent={data.trendPercent} flat />
            <span className="dash-metric-card__sub">vs. previous 30 days</span>
          </div>
        </>
      ) : (
        <>
          <div className="dash-metric-card__header">
            <span className="dash-metric-card__label">{data.label}</span>
            <div className="dash-metric-card__header-right">
              <span className="dash-metric-card__icon"><Icon d={ICON_PATHS[data.icon]} /></span>
              {visibilityToggle}
            </div>
          </div>
          <div className="dash-metric-card__value">{data.value}</div>
          <div className="dash-metric-card__footer">
            <span className="dash-metric-card__sub">{KPI_SUB_LABELS[data.id] ?? ''}</span>
            <TrendBadge direction={data.trendDirection} percent={data.trendPercent} />
          </div>
        </>
      )}
    </div>
  );
};

export default KpiCard;
