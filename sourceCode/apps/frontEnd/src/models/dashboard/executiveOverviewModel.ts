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

/** LAE savings captured (USD millions), split into Allocated / Unallocated LAE, monthly — May '26 to Oct '26. */
export const BASE_LAE_TREND: LaeTrendPoint[] = [
  { month: "May '26", allocated: 1.6, unallocated: 0.9 },
  { month: "Jun '26", allocated: 1.7, unallocated: 1.0 },
  { month: "Jul '26", allocated: 1.9, unallocated: 0.9 },
  { month: "Aug '26", allocated: 2.0, unallocated: 1.1 },
  { month: "Sep '26", allocated: 2.2, unallocated: 1.2 },
  { month: "Oct '26", allocated: 2.4, unallocated: 1.5 },
];

/** Subrogation recovery amount (USD millions), monthly — May '26 to Oct '26. */
export const BASE_SUBROGATION_TREND: TrendPoint[] = [
  { month: "May '26", value: 1.5 },
  { month: "Jun '26", value: 1.8 },
  { month: "Jul '26", value: 1.6 },
  { month: "Aug '26", value: 2.4 },
  { month: "Sep '26", value: 2.2 },
  { month: "Oct '26", value: 3.21 },
];

/** Estimate-review (repair cost) savings captured (USD millions), monthly — shown as "Repair Cost Savings"; identifiers keep their original names.
 *  (was: Medical savings captured, USD millions), monthly — May '26 to Oct '26. */
export const BASE_MEDICAL_SAVINGS_TREND: TrendPoint[] = [
  { month: "May '26", value: 1.2 },
  { month: "Jun '26", value: 1.4 },
  { month: "Jul '26", value: 1.3 },
  { month: "Aug '26", value: 1.6 },
  { month: "Sep '26", value: 1.5 },
  { month: "Oct '26", value: 1.8 },
];

/** Contents and loss-of-use savings captured (USD millions), monthly — shown as "Contents & ALE Savings".
 *  (was: Indemnity savings captured, USD millions), monthly — May '26 to Oct '26. */
export const BASE_INDEMNITY_SAVINGS_TREND: TrendPoint[] = [
  { month: "May '26", value: 0.9 },
  { month: "Jun '26", value: 1.3 },
  { month: "Jul '26", value: 1.0 },
  { month: "Aug '26", value: 1.5 },
  { month: "Sep '26", value: 1.1 },
  { month: "Oct '26", value: 1.4 },
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
  { id: 'v1',  vendorName: 'Gulfshore Restoration Group',   overallScore: 92.4, slaCompliance: 96.3, cycleTimeDays: 2.1,  trendValue: 5.2, trendDirection: 'up' },
  { id: 'v2',  vendorName: 'Palmetto Flood Adjusters',      overallScore: 89.7, slaCompliance: 94.8, cycleTimeDays: 4.3,  trendValue: 3.1, trendDirection: 'up' },
  { id: 'v3',  vendorName: 'Coastal Claim Estimators',      overallScore: 88.9, slaCompliance: 93.6, cycleTimeDays: 3.4,  trendValue: 2.8, trendDirection: 'up' },
  { id: 'v4',  vendorName: 'Sunstate Roofing Inspections',  overallScore: 87.1, slaCompliance: 92.1, cycleTimeDays: 2.6,  trendValue: 1.4, trendDirection: 'down' },
  { id: 'v5',  vendorName: 'Everglades Cause & Origin',     overallScore: 86.3, slaCompliance: 93.0, cycleTimeDays: 6.2,  trendValue: 1.9, trendDirection: 'up' },
  { id: 'v6',  vendorName: 'Bayfront Independent Adjusters', overallScore: 84.6, slaCompliance: 90.8, cycleTimeDays: 3.7,  trendValue: 0.8, trendDirection: 'up' },
  { id: 'v7',  vendorName: 'Keystone Contents Services',    overallScore: 83.2, slaCompliance: 89.5, cycleTimeDays: 5.5,  trendValue: 1.1, trendDirection: 'down' },
  { id: 'v8',  vendorName: 'Harbor Forensic Engineering',   overallScore: 81.5, slaCompliance: 88.2, cycleTimeDays: 8.3,  trendValue: 0.6, trendDirection: 'up' },
  { id: 'v9',  vendorName: 'Tidewater Recovery Partners',   overallScore: 79.8, slaCompliance: 86.4, cycleTimeDays: 12.9, trendValue: 2.3, trendDirection: 'down' },
  { id: 'v10', vendorName: 'Magnolia Coverage Counsel',     overallScore: 78.1, slaCompliance: 85.0, cycleTimeDays: 9.2,  trendValue: 0.4, trendDirection: 'up' },
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
// Names match the service rules/providers seeded for the five property lines.

export const SERVICE_OPTIONS: string[] = [
  'Water Extraction & Mitigation',
  'Independent Adjusting',
  'Estimate & Invoice Review',
  'Roof & Wind/Hail Inspection',
  'Cause & Origin Investigation',
  'Contents Valuation & Pack-out',
  'NFIP Flood Adjusting',
  'Forensic Engineering',
  'Temporary Housing / ALE',
  'Repair Network Referral',
  'Appraisal & Public Adjuster Support',
  'Loss of Rents Review',
  'Desk Investigations (SIU)',
  'Subrogation & Recovery',
  'Legal & Coverage Counsel',
];

/** Total savings (USD) per service for the base period. */
export const BASE_SAVINGS_BY_SERVICE: Record<string, number> = {
  'Water Extraction & Mitigation': 1.85e6,
  'Independent Adjusting': 1.32e6,
  'Estimate & Invoice Review': 1.15e6,
  'Roof & Wind/Hail Inspection': 0.98e6,
  'Cause & Origin Investigation': 0.76e6,
  'Contents Valuation & Pack-out': 0.62e6,
  'NFIP Flood Adjusting': 0.54e6,
  'Forensic Engineering': 0.48e6,
  'Temporary Housing / ALE': 0.41e6,
  'Repair Network Referral': 0.33e6,
  'Appraisal & Public Adjuster Support': 0.27e6,
  'Loss of Rents Review': 0.24e6,
  'Desk Investigations (SIU)': 0.19e6,
  'Subrogation & Recovery': 0.15e6,
  'Legal & Coverage Counsel': 0.11e6,
};

/** SLA compliance % per service for the base period. */
export const BASE_SLA_COMPLIANCE: Record<string, number> = {
  'Water Extraction & Mitigation': 96.8,
  'Independent Adjusting': 75.7,
  'Estimate & Invoice Review': 40.2,
  'Roof & Wind/Hail Inspection': 80.4,
  'Cause & Origin Investigation': 80.6,
  'Contents Valuation & Pack-out': 50.9,
  'NFIP Flood Adjusting': 70.7,
  'Forensic Engineering': 75.3,
  'Temporary Housing / ALE': 86.5,
  'Repair Network Referral': 84.1,
  'Appraisal & Public Adjuster Support': 40.6,
  'Loss of Rents Review': 30.8,
  'Desk Investigations (SIU)': 80.2,
  'Subrogation & Recovery': 90.5,
  'Legal & Coverage Counsel': 65.9,
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
  { id: 'a2', severity: 'high',     title: 'Statutory Deadline at Risk',   description: '17 claims near a Florida deadline', count: 17 },
  { id: 'a3', severity: 'warning',  title: 'Proof of Loss Overdue',        description: '8 flood claims past 45 days',       count: 8 },
  { id: 'a4', severity: 'info',     title: 'Vendor Score Below Threshold', description: '3 vendors below score threshold',   count: 3 },
];

// ─── AI Insights Panel (FRD §3, §12) ────────────────────────────────────────

export interface AiInsight {
  insightText: string;
  generatedAt: string;
}

export const DEFAULT_AI_INSIGHT: AiInsight = {
  insightText: 'Water extraction response time is above SLA in South Florida. Consider routing more claims to repair network contractors.',
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

export const REGION_OPTIONS: string[] = ['South Florida', 'Central Florida', 'Tampa Bay', 'North Florida', 'Panhandle'];

export const CLAIM_TYPE_OPTIONS: string[] = ['Homeowners', 'Renters', 'Landlord', 'Dwelling', 'Flood'];
