// ─── Date range ─────────────────────────────────────────────────────────────

export const DATE_RANGE_OPTIONS = [
  { label: 'Today',         value: 'today' },
  { label: 'This week',     value: 'this-week' },
  { label: 'This Month',    value: 'this-month' },
  { label: 'This Quarter',  value: 'this-quarter' },
  { label: 'This Year',     value: 'this-year' },
] as const;

export type DateRangeValue = typeof DATE_RANGE_OPTIONS[number]['value'];

export const DEFAULT_DATE_RANGE: DateRangeValue = 'today';

/** Multiplier applied to KPI base values per selected date range. */
export const DATE_RANGE_SCALE: Record<DateRangeValue, number> = {
  'today':         0.05,
  'this-week':     0.35,
  'this-month':    0.6,
  'this-quarter':  3,
  'this-year':     6,
};

// ─── KPI Summary Cards (FRD §4) ─────────────────────────────────────────────

export type KpiIconKey = 'claims' | 'lae' | 'savings' | 'subrogation' | 'sla';
export type TrendDirection = 'up' | 'down';

export interface KpiCardData {
  id: string;
  label: string;
  value: string;
  icon: KpiIconKey;
  trendPercent: number;
  trendDirection: TrendDirection;
  /** Unformatted current value (pre-$/%/rounding) — lets the card derive a prior-period figure. */
  rawValue?: number;
}

export interface KpiDefinition {
  id: string;
  label: string;
  icon: KpiIconKey;
  baseValue: number;
  unit: 'count' | 'currency' | 'percent';
  baseTrendPercent: number;
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  { id: 'total-claims',          label: 'Total Claims',          icon: 'claims',       baseValue: 12845,    unit: 'count',    baseTrendPercent: 8.4 },
  { id: 'total-lae',              label: 'Total LAE',              icon: 'lae',          baseValue: 45.62e6,  unit: 'currency', baseTrendPercent: 4.7 },
  { id: 'total-savings',          label: 'Total Savings',          icon: 'savings',      baseValue: 7.10e6,   unit: 'currency', baseTrendPercent: 12.3 },
  { id: 'sla-compliance',         label: 'SLA Compliance',         icon: 'sla',          baseValue: 94.2,     unit: 'percent',  baseTrendPercent: 2.8 },
];

// ─── Formatting helpers ─────────────────────────────────────────────────────

export function formatCount(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function formatCurrency(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Millions formatter for KPI summary cards, e.g. 2,281,000 -> "$2M" (decimals=0,
 * the default) or "$2.3M" (decimals=1). Standard rounding (0.5 rounds up) to the
 * given decimal precision. One shared utility so every card using it stays
 * consistent — pass `decimals` per card instead of duplicating the logic.
 *
 * A trailing ".0" is always stripped: once rounded to the given precision, if
 * the decimal portion is exactly zero the value prints as a plain whole number
 * (e.g. 16,000,000 at decimals=1 -> "$16M", not "$16.0M") — otherwise it prints
 * with exactly `decimals` digits (e.g. 2,281,000 -> "$2.3M").
 *
 * decimals=0 additionally falls back to a plain comma-formatted whole number
 * (no $/M) for values under $1M — e.g. 355,000 -> "355,000" — since always
 * dividing by 1e6 at zero decimal places would show a misleading "$0M". That
 * fallback doesn't apply once decimals > 0, since e.g. "$0.4M" is already a
 * precise, meaningful figure at that precision.
 */
export function formatMillionsWhole(value: number, decimals: number = 0): string {
  const factor = 10 ** decimals;
  // Round in integer space (not float division) so the "is it a whole number"
  // check below is an exact modulo, not a floating-point equality comparison.
  const scaledInt = Math.round((value / 1_000_000) * factor);
  const roundedMillions = scaledInt / factor;
  if (decimals === 0 && Math.abs(roundedMillions) < 1) {
    return Math.round(value).toLocaleString('en-US');
  }
  if (scaledInt % factor === 0) {
    return `$${scaledInt / factor}M`;
  }
  return `$${roundedMillions.toFixed(decimals)}M`;
}

/** Whole-number percent for KPI summary cards, e.g. 94.2 -> "94%", 11.1 -> "11%". */
export function formatPercentWhole(value: number): string {
  return `${Math.round(value)}%`;
}

// ─── Trend charts (FRD §5, §7) ──────────────────────────────────────────────

export interface TrendPoint {
  month: string;
  value: number;
}

export interface TrendChartData {
  currentValue: string;
  data: TrendPoint[];
}

/** A single month's LAE ratio split into its Allocated / Unallocated components (% of Incurred). */
export interface LaeTrendPoint {
  month: string;
  allocated: number;
  unallocated: number;
}

export interface LaeRatioTrendData {
  currentValue: string;
  data: LaeTrendPoint[];
}

/** LAE savings captured (USD millions), split into Allocated / Unallocated LAE, monthly — Nov '25 to Apr '26. */
export const BASE_LAE_TREND: LaeTrendPoint[] = [
  { month: "Nov '25", allocated: 1.6, unallocated: 0.9 },
  { month: "Dec '25", allocated: 1.7, unallocated: 1.0 },
  { month: "Jan '26", allocated: 1.9, unallocated: 0.9 },
  { month: "Feb '26", allocated: 2.0, unallocated: 1.1 },
  { month: "Mar '26", allocated: 2.2, unallocated: 1.2 },
  { month: "Apr '26", allocated: 2.4, unallocated: 1.5 },
];

/** Subrogation recovery amount (USD millions), monthly — Nov '25 to Apr '26. */
export const BASE_SUBROGATION_TREND: TrendPoint[] = [
  { month: "Nov '25", value: 1.5 },
  { month: "Dec '25", value: 1.8 },
  { month: "Jan '26", value: 1.6 },
  { month: "Feb '26", value: 2.4 },
  { month: "Mar '26", value: 2.2 },
  { month: "Apr '26", value: 3.21 },
];

/** Medical savings captured (USD millions), monthly — Nov '25 to Apr '26. */
export const BASE_MEDICAL_SAVINGS_TREND: TrendPoint[] = [
  { month: "Nov '25", value: 1.2 },
  { month: "Dec '25", value: 1.4 },
  { month: "Jan '26", value: 1.3 },
  { month: "Feb '26", value: 1.6 },
  { month: "Mar '26", value: 1.5 },
  { month: "Apr '26", value: 1.8 },
];

/** Indemnity savings captured (USD millions), monthly — Nov '25 to Apr '26. */
export const BASE_INDEMNITY_SAVINGS_TREND: TrendPoint[] = [
  { month: "Nov '25", value: 0.9 },
  { month: "Dec '25", value: 1.3 },
  { month: "Jan '26", value: 1.0 },
  { month: "Feb '26", value: 1.5 },
  { month: "Mar '26", value: 1.1 },
  { month: "Apr '26", value: 1.4 },
];

// ─── Savings by Service (FRD §6) ────────────────────────────────────────────

export interface SavingsByServiceRow {
  service: string;
  savings: number;
  formatted: string;
}

// ─── Vendor Performance (FRD §8) ────────────────────────────────────────────

export type VendorSortField = 'score' | 'sla' | 'cycleTime' | 'trend';

export const VENDOR_SORT_OPTIONS: { label: string; value: VendorSortField }[] = [
  { label: 'Overall Score',  value: 'score' },
  { label: 'SLA Compliance', value: 'sla' },
  { label: 'Cycle Time',     value: 'cycleTime' },
  { label: 'Trend',          value: 'trend' },
];

export interface VendorRow {
  id: string;
  rank: number;
  vendorName: string;
  overallScore: number;
  slaCompliance: number;
  cycleTimeDays: number;
  trendValue: number;
  trendDirection: TrendDirection;
}

export const BASE_VENDORS: Omit<VendorRow, 'rank'>[] = [
  { id: 'v1',  vendorName: 'MedReview Solutions',          overallScore: 92.4, slaCompliance: 96.3, cycleTimeDays: 7.1,  trendValue: 5.2, trendDirection: 'up' },
  { id: 'v2',  vendorName: 'Care Network Partners',        overallScore: 89.7, slaCompliance: 94.8, cycleTimeDays: 12.3, trendValue: 3.1, trendDirection: 'up' },
  { id: 'v3',  vendorName: 'PharmaMetrics',                overallScore: 88.9, slaCompliance: 93.6, cycleTimeDays: 8.4,  trendValue: 2.8, trendDirection: 'up' },
  { id: 'v4',  vendorName: 'DME Care Services',            overallScore: 87.1, slaCompliance: 92.1, cycleTimeDays: 2.6,  trendValue: 1.4, trendDirection: 'down' },
  { id: 'v5',  vendorName: 'NurseSupport 360',             overallScore: 86.3, slaCompliance: 93.0, cycleTimeDays: 14.2, trendValue: 1.9, trendDirection: 'up' },
  { id: 'v6',  vendorName: 'Apex Diagnostics Group',       overallScore: 84.6, slaCompliance: 90.8, cycleTimeDays: 9.7,  trendValue: 0.8, trendDirection: 'up' },
  { id: 'v7',  vendorName: 'Pinnacle Rehab Partners',      overallScore: 83.2, slaCompliance: 89.5, cycleTimeDays: 11.5, trendValue: 1.1, trendDirection: 'down' },
  { id: 'v8',  vendorName: 'SwiftTransport Solutions',     overallScore: 81.5, slaCompliance: 88.2, cycleTimeDays: 5.3,  trendValue: 0.6, trendDirection: 'up' },
  { id: 'v9',  vendorName: 'ClearPath Legal Services',     overallScore: 79.8, slaCompliance: 86.4, cycleTimeDays: 18.9, trendValue: 2.3, trendDirection: 'down' },
  { id: 'v10', vendorName: 'VocWorks Vocational Services', overallScore: 78.1, slaCompliance: 85.0, cycleTimeDays: 16.2, trendValue: 0.4, trendDirection: 'up' },
];

export const VENDOR_OPTIONS: string[] = BASE_VENDORS.map((v) => v.vendorName);

// ─── SLA Compliance by Service (FRD §9) ─────────────────────────────────────

export type SlaStatus = 'green' | 'amber' | 'red';

export interface SlaComplianceRow {
  serviceId: string;
  serviceName: string;
  compliance: number;
  status: SlaStatus;
}

export function resolveSlaStatus(compliance: number): SlaStatus {
  if (compliance >= 90) return 'green';
  if (compliance >= 80) return 'amber';
  return 'red';
}

// ─── 15 Claims Services (shared — savings, SLA, filters) ───────────────────

export const SERVICE_OPTIONS: string[] = [
  'Medical Bill Review',
  'Network Optimization',
  'Pharmacy Carve-Out',
  'DME & Supplies',
  'UR Management',
  'Nurse Case Mgmt',
  'Independent Medical Exam',
  'Diagnostic Imaging',
  'Physical Therapy',
  'Transportation Services',
  'Translation Services',
  'Home Health Care',
  'Vocational Rehabilitation',
  'Surveillance Services',
  'Legal & Litigation Support',
];

/** Total savings (USD) per service for the base period. */
export const BASE_SAVINGS_BY_SERVICE: Record<string, number> = {
  'Medical Bill Review':        1.85e6,
  'Network Optimization':       1.32e6,
  'Pharmacy Carve-Out':         1.15e6,
  'DME & Supplies':             0.98e6,
  'UR Management':              0.76e6,
  'Nurse Case Mgmt':            0.62e6,
  'Independent Medical Exam':   0.54e6,
  'Diagnostic Imaging':         0.48e6,
  'Physical Therapy':           0.41e6,
  'Transportation Services':    0.33e6,
  'Translation Services':       0.27e6,
  'Home Health Care':           0.24e6,
  'Vocational Rehabilitation':  0.19e6,
  'Surveillance Services':      0.15e6,
  'Legal & Litigation Support': 0.11e6,
};

/** SLA compliance % per service for the base period. */
export const BASE_SLA_COMPLIANCE: Record<string, number> = {
  'Medical Bill Review':        96.8,
  'UR Management':               80.6,
  'Network Optimization':        75.7,
  'Nurse Case Mgmt':              50.9,
  'Pharmacy Carve-Out':           40.2,
  'DME & Supplies':               80.4,
  'Independent Medical Exam':     70.7,
  'Diagnostic Imaging':           75.3,
  'Physical Therapy':             86.5,
  'Transportation Services':      84.1,
  'Translation Services':         40.6,
  'Home Health Care':             30.8,
  'Vocational Rehabilitation':    80.2,
  'Surveillance Services':        90.5,
  'Legal & Litigation Support':   65.9,
};

// ─── Alerts & Exceptions (FRD §10) ──────────────────────────────────────────

export type AlertSeverity = 'critical' | 'high' | 'warning' | 'info';

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  count: number;
}

export const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  warning: 2,
  info: 3,
};

export const SEVERITY_OPTIONS: { label: string; value: AlertSeverity }[] = [
  { label: 'Critical', value: 'critical' },
  { label: 'High',     value: 'high' },
  { label: 'Warning',  value: 'warning' },
  { label: 'Info',     value: 'info' },
];

export const BASE_ALERTS: AlertItem[] = [
  { id: 'a1', severity: 'critical', title: 'SLA Breaches',                description: '12 services breached SLA',          count: 23 },
  { id: 'a2', severity: 'high',     title: 'High Cycle Time',              description: '5 services exceeding benchmark',    count: 17 },
  { id: 'a3', severity: 'warning',  title: 'Leakage Risk',                 description: '8 claims flagged for leakage',      count: 8 },
  { id: 'a4', severity: 'info',     title: 'Vendor Score Below Threshold', description: '3 vendors below score threshold',   count: 3 },
];

// ─── AI Insights Panel (FRD §3, §12) ────────────────────────────────────────

export interface AiInsight {
  insightText: string;
  generatedAt: string;
}

export const DEFAULT_AI_INSIGHT: AiInsight = {
  insightText: 'DME delivery TAT is above SLA for Region West. Consider vendor rebalancing.',
  generatedAt: new Date().toISOString(),
};

// ─── Filters (FRD §13) ───────────────────────────────────────────────────────

export interface FilterState {
  service: string[];
  vendor: string[];
  region: string[];
  claimType: string[];
  severity: AlertSeverity[];
}

export const EMPTY_FILTERS: FilterState = {
  service: [],
  vendor: [],
  region: [],
  claimType: [],
  severity: [],
};

export const REGION_OPTIONS: string[] = ['West', 'East', 'Midwest', 'South', 'Northeast'];

export const CLAIM_TYPE_OPTIONS: string[] = [
  "Workers' Compensation",
  'Auto Liability',
  'General Liability',
  'Property',
  'Disability',
];
