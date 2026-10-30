import {
  KPI_DEFINITIONS,
  DATE_RANGE_SCALE,
  BASE_LAE_TREND,
  BASE_SUBROGATION_TREND,
  BASE_MEDICAL_SAVINGS_TREND,
  BASE_INDEMNITY_SAVINGS_TREND,
  BASE_SAVINGS_BY_SERVICE,
  BASE_SLA_COMPLIANCE,
  BASE_VENDORS,
  BASE_ALERTS,
  DEFAULT_AI_INSIGHT,
  SEVERITY_ORDER,
  resolveSlaStatus,
  formatCount,
  formatCurrency,
  formatPercent,
} from '../../models/dashboard/executiveOverviewModel';
import type {
  AiInsight,
  AlertItem,
  DateRangeValue,
  FilterState,
  KpiCardData,
  LaeRatioTrendData,
  SavingsByServiceRow,
  SlaComplianceRow,
  TrendChartData,
  VendorRow,
  VendorSortField,
} from '../../models/dashboard/executiveOverviewModel';

// ─── Mock network latency ───────────────────────────────────────────────────

const MOCK_LATENCY_MS = 250;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));
}

// ─── GET /api/v1/dashboard/kpis ─────────────────────────────────────────────

export async function getKpis(range: DateRangeValue): Promise<KpiCardData[]> {
  const scale = DATE_RANGE_SCALE[range];
  const kpis: KpiCardData[] = KPI_DEFINITIONS.map((def) => {
    const scaledValue = def.unit === 'percent' ? def.baseValue : def.baseValue * scale;
    const value =
      def.unit === 'currency' ? formatCurrency(scaledValue)
      : def.unit === 'percent' ? formatPercent(scaledValue)
      : formatCount(scaledValue);

    return {
      id: def.id,
      label: def.label,
      icon: def.icon,
      value,
      trendPercent: def.baseTrendPercent,
      trendDirection: 'up',
      rawValue: scaledValue,
    };
  });
  return delay(kpis);
}

// ─── GET /api/v1/dashboard/lae-ratio ────────────────────────────────────────

export async function getLaeRatioTrend(): Promise<LaeRatioTrendData> {
  const data = BASE_LAE_TREND;
  const last = data[data.length - 1];
  const currentValue = formatCurrency((last.allocated + last.unallocated) * 1e6);
  return delay({ currentValue, data });
}

// ─── GET /api/v1/dashboard/subrogation-trend ────────────────────────────────

export async function getSubrogationTrend(): Promise<TrendChartData> {
  const data = BASE_SUBROGATION_TREND;
  const currentValue = formatCurrency(data[data.length - 1].value * 1e6);
  return delay({ currentValue, data });
}

// ─── GET /api/v1/dashboard/medical-savings-trend ────────────────────────────

export async function getMedicalSavingsTrend(): Promise<TrendChartData> {
  const data = BASE_MEDICAL_SAVINGS_TREND;
  const currentValue = formatCurrency(data[data.length - 1].value * 1e6);
  return delay({ currentValue, data });
}

// ─── GET /api/v1/dashboard/indemnity-savings-trend ──────────────────────────

export async function getIndemnitySavingsTrend(): Promise<TrendChartData> {
  const data = BASE_INDEMNITY_SAVINGS_TREND;
  const currentValue = formatCurrency(data[data.length - 1].value * 1e6);
  return delay({ currentValue, data });
}

// ─── GET /api/v1/dashboard/savings-by-service ───────────────────────────────

export async function getSavingsByService(
  range: DateRangeValue,
  filters: FilterState,
  limit = 5,
): Promise<SavingsByServiceRow[]> {
  const scale = DATE_RANGE_SCALE[range];
  const services = filters.service.length > 0
    ? Object.keys(BASE_SAVINGS_BY_SERVICE).filter((s) => filters.service.includes(s))
    : Object.keys(BASE_SAVINGS_BY_SERVICE);

  const rows: SavingsByServiceRow[] = services
    .map((service) => {
      const savings = BASE_SAVINGS_BY_SERVICE[service] * scale;
      return { service, savings, formatted: formatCurrency(savings) };
    })
    .sort((a, b) => b.savings - a.savings)
    .slice(0, limit);

  return delay(rows);
}

// ─── GET /api/v1/vendors ─────────────────────────────────────────────────────

const VENDOR_SORT_ACCESSOR: Record<VendorSortField, (v: Omit<VendorRow, 'rank'>) => number> = {
  score:     (v) => v.overallScore,
  sla:       (v) => v.slaCompliance,
  cycleTime: (v) => v.cycleTimeDays,
  trend:     (v) => v.trendValue,
};

export async function getVendors(
  filters: FilterState,
  sortBy: VendorSortField = 'score',
  order: 'asc' | 'desc' = 'desc',
  limit = 5,
): Promise<VendorRow[]> {
  const filtered = filters.vendor.length > 0
    ? BASE_VENDORS.filter((v) => filters.vendor.includes(v.vendorName))
    : BASE_VENDORS;

  const accessor = VENDOR_SORT_ACCESSOR[sortBy];
  const sorted = [...filtered].sort((a, b) =>
    order === 'asc' ? accessor(a) - accessor(b) : accessor(b) - accessor(a),
  );

  const rows: VendorRow[] = sorted.slice(0, limit).map((v, i) => ({ ...v, rank: i + 1 }));
  return delay(rows);
}

// ─── GET /api/v1/dashboard/sla-compliance ───────────────────────────────────

export async function getSlaCompliance(
  filters: FilterState,
  limit = 5,
): Promise<SlaComplianceRow[]> {
  const services = filters.service.length > 0
    ? Object.keys(BASE_SLA_COMPLIANCE).filter((s) => filters.service.includes(s))
    : Object.keys(BASE_SLA_COMPLIANCE);

  const rows: SlaComplianceRow[] = services
    .map((serviceName, i) => {
      const compliance = BASE_SLA_COMPLIANCE[serviceName];
      return {
        serviceId: `svc-${i + 1}`,
        serviceName,
        compliance,
        status: resolveSlaStatus(compliance),
      };
    })
    .sort((a, b) => b.compliance - a.compliance)
    .slice(0, limit);

  return delay(rows);
}

// ─── GET /api/v1/alerts ──────────────────────────────────────────────────────

export async function getAlerts(
  range: DateRangeValue,
  filters: FilterState,
  limit = 5,
): Promise<AlertItem[]> {
  const scale = DATE_RANGE_SCALE[range];
  const filtered = filters.severity.length > 0
    ? BASE_ALERTS.filter((a) => filters.severity.includes(a.severity))
    : BASE_ALERTS;

  const rows: AlertItem[] = filtered
    .map((a) => ({ ...a, count: Math.max(1, Math.round(a.count * scale)) }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, limit);

  return delay(rows);
}

// ─── GET /api/v1/ai-insights/latest ─────────────────────────────────────────

export async function getAiInsight(): Promise<AiInsight> {
  return delay(DEFAULT_AI_INSIGHT);
}
