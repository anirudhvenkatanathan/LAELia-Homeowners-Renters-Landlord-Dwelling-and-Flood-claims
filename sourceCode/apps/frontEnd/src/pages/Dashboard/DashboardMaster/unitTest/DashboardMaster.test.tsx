import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  formatCount,
  formatCurrency,
  formatMillionsWhole,
  formatPercent,
  resolveSlaStatus,
} from '../../../../models/dashboard/executiveOverviewModel';
import type {
  AiInsight,
  AlertItem,
  KpiCardData,
  LaeRatioTrendData,
  SavingsByServiceRow,
  SlaComplianceRow,
  TrendChartData,
  VendorRow,
} from '../../../../models/dashboard/executiveOverviewModel';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../../services/dashboard/executiveOverviewService', () => ({
  getKpis: vi.fn(),
  getLaeRatioTrend: vi.fn(),
  getSubrogationTrend: vi.fn(),
  getMedicalSavingsTrend: vi.fn(),
  getIndemnitySavingsTrend: vi.fn(),
  getSavingsByService: vi.fn(),
  getVendors: vi.fn(),
  getSlaCompliance: vi.fn(),
  getAlerts: vi.fn(),
  getAiInsight: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Routes:  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Route:   ({ element }: { element: React.ReactNode })   => <>{element}</>,
  Link:    ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useLocation:  () => ({ pathname: '/dashboard' }),
  useNavigate:  () => vi.fn(),
  Navigate: () => null,
}));

vi.mock('../../../../hooks/menu/useMenu', () => ({
  useMenu: vi.fn(() => ({ items: [], loading: false, error: null })),
}));

import * as eoService from '../../../../services/dashboard/executiveOverviewService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const sampleKpis: KpiCardData[] = [
  { id: 'total-claims',        label: 'Total Claims',        value: '12,845', icon: 'claims',      trendPercent: 8.4,  trendDirection: 'up', rawValue: 12845 },
  { id: 'total-lae',           label: 'Total LAE',           value: '$45.62M', icon: 'lae',         trendPercent: 4.7,  trendDirection: 'up', rawValue: 45.62e6 },
  { id: 'total-savings',       label: 'Total Savings',       value: '$7.10M',  icon: 'savings',     trendPercent: 12.3, trendDirection: 'up', rawValue: 7.10e6 },
  { id: 'subrogation-recovery',label: 'Subrogation Recovery',value: '$3.21M',  icon: 'subrogation', trendPercent: 15.6, trendDirection: 'up' },
  { id: 'sla-compliance',      label: 'SLA Compliance',      value: '94.2%',   icon: 'sla',         trendPercent: 2.8,  trendDirection: 'up', rawValue: 94.2 },
];

const sampleLaeTrend: LaeRatioTrendData = {
  currentValue: '18.6%',
  data: [
    { month: "Mar '26", allocated: 13.9, unallocated: 6.0 },
    { month: "Apr '26", allocated: 13.0, unallocated: 5.6 },
  ],
};

const sampleSubroTrend: TrendChartData = {
  currentValue: '$3.21M',
  data: [{ month: "Mar '26", value: 2.8 }, { month: "Apr '26", value: 3.21 }],
};

const sampleMedicalSavingsTrend: TrendChartData = {
  currentValue: '$1.80M',
  data: [{ month: "Mar '26", value: 1.5 }, { month: "Apr '26", value: 1.8 }],
};

const sampleIndemnitySavingsTrend: TrendChartData = {
  currentValue: '$1.40M',
  data: [{ month: "Mar '26", value: 1.3 }, { month: "Apr '26", value: 1.4 }],
};

const sampleSavings: SavingsByServiceRow[] = [
  { service: 'Medical Bill Review', savings: 1.85e6, formatted: '$1.85M' },
  { service: 'Network Optimization', savings: 1.32e6, formatted: '$1.32M' },
];

const sampleVendors: VendorRow[] = [
  { id: 'v1', rank: 1, vendorName: 'MedReview Solutions', overallScore: 92.4, slaCompliance: 96.3, cycleTimeDays: 7.1, trendValue: 5.2, trendDirection: 'up' },
  { id: 'v2', rank: 2, vendorName: 'Care Network Partners', overallScore: 89.7, slaCompliance: 94.8, cycleTimeDays: 12.3, trendValue: 3.1, trendDirection: 'up' },
];

const sampleSla: SlaComplianceRow[] = [
  { serviceId: 'Medical Bill Review', serviceName: 'Medical Bill Review', compliance: 96.8, status: 'green' },
  { serviceId: 'Legal & Litigation Support', serviceName: 'Legal & Litigation Support', compliance: 71.9, status: 'red' },
];

const sampleAlerts: AlertItem[] = [
  { id: 'a1', severity: 'critical', title: 'SLA Breaches', description: '12 services breached SLA', count: 23 },
  { id: 'a2', severity: 'high', title: 'High Cycle Time', description: '5 services exceeding benchmark', count: 17 },
];

const sampleAiInsight: AiInsight = {
  insightText: 'DME delivery TAT is above SLA for Region West. Consider vendor rebalancing.',
  generatedAt: new Date().toISOString(),
};

function mockServiceDefaults(): void {
  vi.mocked(eoService.getKpis).mockResolvedValue(sampleKpis);
  vi.mocked(eoService.getLaeRatioTrend).mockResolvedValue(sampleLaeTrend);
  vi.mocked(eoService.getSubrogationTrend).mockResolvedValue(sampleSubroTrend);
  vi.mocked(eoService.getMedicalSavingsTrend).mockResolvedValue(sampleMedicalSavingsTrend);
  vi.mocked(eoService.getIndemnitySavingsTrend).mockResolvedValue(sampleIndemnitySavingsTrend);
  vi.mocked(eoService.getSavingsByService).mockResolvedValue(sampleSavings);
  vi.mocked(eoService.getVendors).mockResolvedValue(sampleVendors);
  vi.mocked(eoService.getSlaCompliance).mockResolvedValue(sampleSla);
  vi.mocked(eoService.getAlerts).mockResolvedValue(sampleAlerts);
  vi.mocked(eoService.getAiInsight).mockResolvedValue(sampleAiInsight);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: Model formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('executiveOverviewModel helpers', () => {
  it('formatCount formats a number with thousands separators', () => {
    expect(formatCount(12845)).toBe('12,845');
  });

  it('formatCurrency formats millions with $ and M suffix', () => {
    expect(formatCurrency(45.62e6)).toBe('$45.62M');
  });

  it('formatCurrency formats thousands with $ and K suffix', () => {
    expect(formatCurrency(8.5e3)).toBe('$8.5K');
  });

  it('formatPercent formats with one decimal and % sign', () => {
    expect(formatPercent(94.2)).toBe('94.2%');
  });

  describe('formatMillionsWhole', () => {
    it('decimals=1: strips a trailing .0 for values that round to an exact whole million', () => {
      expect(formatMillionsWhole(16_000_000, 1)).toBe('$16M');
    });

    it('decimals=1: keeps one decimal when the rounded value is not whole', () => {
      expect(formatMillionsWhole(2_281_000, 1)).toBe('$2.3M');
      expect(formatMillionsWhole(355_000, 1)).toBe('$0.4M');
    });

    it('decimals=1: rounds half up before checking for a trailing .0', () => {
      // 15,950,000 -> 15.95M -> rounds to 16.0M -> trailing .0 stripped -> "$16M"
      expect(formatMillionsWhole(15_950_000, 1)).toBe('$16M');
    });

    it('decimals=0 (default) is unaffected — whole millions, no trailing zero to strip', () => {
      expect(formatMillionsWhole(2_281_000)).toBe('$2M');
    });

    it('decimals=0 still falls back to a plain comma-formatted number under $1M', () => {
      expect(formatMillionsWhole(355_000)).toBe('355,000');
    });
  });

  it('resolveSlaStatus returns green for >= 90', () => {
    expect(resolveSlaStatus(96.8)).toBe('green');
  });

  it('resolveSlaStatus returns amber for 80-89', () => {
    expect(resolveSlaStatus(85)).toBe('amber');
  });

  it('resolveSlaStatus returns red for < 80', () => {
    expect(resolveSlaStatus(71.9)).toBe('red');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: useExecutiveOverview hook
// ─────────────────────────────────────────────────────────────────────────────

import { useExecutiveOverview } from '../../../../hooks/dashboard/useExecutiveOverview';

describe('useExecutiveOverview hook', () => {
  beforeEach(() => {
    mockServiceDefaults();
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('loads all dashboard sections on mount with the default date range', async () => {
    const { result } = renderHook(() => useExecutiveOverview());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.dateRange).toBe('today');
    expect(result.current.kpis).toHaveLength(5);
    expect(result.current.vendors).toHaveLength(2);
    expect(result.current.alerts).toHaveLength(2);
    expect(result.current.slaCompliance).toHaveLength(2);
    expect(eoService.getKpis).toHaveBeenCalledWith('today');
  });

  it('fetches the AI insight independently on mount', async () => {
    const { result } = renderHook(() => useExecutiveOverview());

    await waitFor(() => expect(result.current.aiInsight).not.toBeNull());
    expect(result.current.aiInsight?.insightText).toContain('DME delivery TAT');
  });

  it('reloads sections when the date range changes', async () => {
    const { result } = renderHook(() => useExecutiveOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.setDateRange('this-year'); });

    await waitFor(() => expect(eoService.getKpis).toHaveBeenLastCalledWith('this-year'));
    expect(result.current.dateRange).toBe('this-year');
  });

  it('toggleKpiVisibility hides and re-shows a KPI card', async () => {
    const { result } = renderHook(() => useExecutiveOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.visibleKpis).toHaveLength(5);

    act(() => { result.current.toggleKpiVisibility('total-lae'); });
    expect(result.current.visibleKpis.map((k) => k.id)).not.toContain('total-lae');
    expect(result.current.visibleKpis).toHaveLength(4);

    act(() => { result.current.toggleKpiVisibility('total-lae'); });
    expect(result.current.visibleKpis).toHaveLength(5);
  });

  it('applyFilters updates filters and activeFilterCount', async () => {
    const { result } = renderHook(() => useExecutiveOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.applyFilters({
        service: ['Medical Bill Review'],
        vendor: [],
        region: [],
        claimType: [],
        severity: ['critical'],
      });
    });

    await waitFor(() => expect(result.current.activeFilterCount).toBe(2));

    act(() => { result.current.clearFilters(); });
    await waitFor(() => expect(result.current.activeFilterCount).toBe(0));
  });

  it('setVendorSort toggles order when the same field is selected twice', async () => {
    const { result } = renderHook(() => useExecutiveOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.vendorSort).toBe('score');
    expect(result.current.vendorOrder).toBe('desc');

    act(() => { result.current.setVendorSort('cycleTime'); });
    await waitFor(() => expect(result.current.vendorSort).toBe('cycleTime'));
    expect(result.current.vendorOrder).toBe('desc');

    act(() => { result.current.setVendorSort('cycleTime'); });
    await waitFor(() => expect(result.current.vendorOrder).toBe('asc'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: DashboardMaster component
// ─────────────────────────────────────────────────────────────────────────────

import DashboardMaster from '../index';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

describe('DashboardMaster — Executive Overview', () => {
  beforeEach(() => {
    mockServiceDefaults();
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('renders the page title and subtitle', async () => {
    render(<DashboardMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Executive Overview')).toBeInTheDocument();
      expect(screen.getByText(/Claims performance, savings, and vendor outcomes/i)).toBeInTheDocument();
    });
  });

  it('renders all 5 KPI summary cards', async () => {
    const { container } = render(<DashboardMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      const metricRow = container.querySelector('.dash-metric-row') as HTMLElement;
      expect(metricRow).not.toBeNull();
      expect(within(metricRow).getByText('Total Claims')).toBeInTheDocument();
      expect(within(metricRow).getByText('Total LAE')).toBeInTheDocument();
      expect(within(metricRow).getByText('Total Savings')).toBeInTheDocument();
      expect(within(metricRow).getByText('Subrogation Recovery')).toBeInTheDocument();
      expect(within(metricRow).getByText('SLA Compliance')).toBeInTheDocument();
    });
  });

  it('renders the new current/"was" stacked layout for the 4 redesigned cards, using whole-number formatting', async () => {
    const { container } = render(<DashboardMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      const cardByLabel = (label: string): HTMLElement => {
        const labelEl = within(container).getByText(label, { selector: '.dash-metric-card__label' });
        return labelEl.closest('.dash-metric-card') as HTMLElement;
      };
      const text = (card: HTMLElement, selector: string) => card.querySelector(selector)?.textContent;

      // Total Claims — plain comma-separated count, no $/rounding needed
      const claims = cardByLabel('Total Claims');
      expect(text(claims, '.dash-metric-card__value')).toBe('12,845');
      expect(text(claims, '.dash-metric-card__was-pill')).toBe('was 11,850');
      // Trend badge shows the hardcoded trendPercent as-authored (one decimal), not rounded
      expect(text(claims, '.dash-metric-card__trend')).toBe('↑ 8.4%');
      expect(text(claims, '.dash-metric-card__trend-row .dash-metric-card__sub')).toBe('vs. previous 30 days');

      // Total LAE — millions to 1 decimal (45.62 -> $45.6M, prior 43.57 -> $43.6M)
      const lae = cardByLabel('Total LAE');
      expect(text(lae, '.dash-metric-card__value')).toBe('$45.6M');
      expect(text(lae, '.dash-metric-card__was-pill')).toBe('was $43.6M');

      // Total Savings — millions to 1 decimal (7.10 -> $7.1M, prior 6.32 -> $6.3M)
      const savings = cardByLabel('Total Savings');
      expect(text(savings, '.dash-metric-card__value')).toBe('$7.1M');
      expect(text(savings, '.dash-metric-card__was-pill')).toBe('was $6.3M');

      // SLA Compliance — whole percent (94.2% -> 94%, prior 91.6% -> 92%)
      const sla = cardByLabel('SLA Compliance');
      expect(text(sla, '.dash-metric-card__value')).toBe('94%');
      expect(text(sla, '.dash-metric-card__was-pill')).toBe('was 92%');

      expect(screen.getAllByText('vs. previous 30 days')).toHaveLength(4);

      // Subrogation Recovery isn't one of the 4 redesigned cards — unchanged layout/footer text
      const subrogation = cardByLabel('Subrogation Recovery');
      expect(text(subrogation, '.dash-metric-card__value')).toBe('$3.21M');
      expect(subrogation.querySelector('.dash-metric-card__was-pill')).toBeNull();
      expect(text(subrogation, '.dash-metric-card__sub')).toBe('Recovered this period');
    });
  });

  it('renders the trend chart hero values', async () => {
    const { container } = render(<DashboardMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('LAE Savings Trend')).toBeInTheDocument();
      expect(screen.getByText('Repair Cost Savings Trend')).toBeInTheDocument();
      expect(screen.getByText('Contents & ALE Savings Trend')).toBeInTheDocument();
      expect(screen.getByText('Subrogation Recovery Trend')).toBeInTheDocument();
      const heroValues = container.querySelectorAll('.chart-hero-value');
      expect(heroValues[0].textContent).toBe('18.6%');
      expect(heroValues[1].textContent).toBe('$1.80M');
      expect(heroValues[2].textContent).toBe('$1.40M');
      expect(heroValues[3].textContent).toBe('$3.21M');
    });
  });

  it('renders the Vendor Performance Overview table with vendor rows', async () => {
    render(<DashboardMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Service Provider Performance Overview')).toBeInTheDocument();
      expect(screen.getByText('MedReview Solutions')).toBeInTheDocument();
      expect(screen.getByText('Care Network Partners')).toBeInTheDocument();
    });
  });

  it('renders the Top Alerts & Exceptions panel', async () => {
    render(<DashboardMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Top Alerts & Exceptions')).toBeInTheDocument();
      expect(screen.getByText(/SLA Breaches/)).toBeInTheDocument();
      expect(screen.getByText(/High Cycle Time/)).toBeInTheDocument();
    });
  });

  it('renders the date range filter defaulted to "Today"', async () => {
    render(<DashboardMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      const select = screen.getByLabelText('Date range') as HTMLSelectElement;
      expect(select.value).toBe('today');
    });
  });

  it('opens the Filters modal when the Filters button is clicked', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    render(<DashboardMaster />, { wrapper: Wrapper });

    const filtersBtn = await screen.findByRole('button', { name: /^filters/i });
    await user.click(filtersBtn);

    expect(await screen.findByRole('heading', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
    expect(screen.getByText('Apply Filters')).toBeInTheDocument();
  });

  it('does not render breadcrumbs', async () => {
    render(<DashboardMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeInTheDocument();
    });
  });
});
