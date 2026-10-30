import React, { useState } from 'react';
import AppShell from '../../../components/layout/AppShell';
import KpiCard from '../../../components/dashboard/KpiCard';
import AreaTrendChart from '../../../components/dashboard/AreaTrendChart';
import HorizontalBarChart from '../../../components/dashboard/HorizontalBarChart';
import VendorPerformanceTable from '../../../components/dashboard/VendorPerformanceTable';
import AlertsPanel from '../../../components/dashboard/AlertsPanel';
import DateRangePicker from '../../../components/dashboard/DateRangePicker';
import FiltersPanel from '../../../components/dashboard/FiltersPanel';
import { useExecutiveOverview } from '../../../hooks/dashboard/useExecutiveOverview';
import { formatCurrency, formatPercent } from './types';
import { styles } from './styles';

// ─── Icons ──────────────────────────────────────────────────────────────────

const FilterIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

const InfoIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

// ─── Dashboard ────────────────────────────────────────────────────────────────

const DashboardMaster: React.FC = () => {
  const eo = useExecutiveOverview();
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <AppShell>
      <div className={styles.dashPage}>

        {/* ── Header card: title + filters ──────────────────────────────── */}
        <div className={styles.headerCard}>
          <div className={styles.titleRow}>
            <h1 className={styles.pageTitle}>Executive Overview</h1>
            <p className={styles.pageSubtitle}>Claims performance, savings, and vendor outcomes at a glance</p>
          </div>

          <div className={styles.filterBar}>
            <span className={styles.filterBarLabel}><FilterIcon />Date Range:</span>
            <DateRangePicker value={eo.dateRange} onChange={eo.setDateRange} />
            <button type="button" className={styles.btnGhost} onClick={() => setFiltersOpen(true)}>
              Filters
              {eo.activeFilterCount > 0 && <span className={styles.badgeBlue}>{eo.activeFilterCount}</span>}
            </button>
          </div>

          {eo.activeFilterCount > 0 && (
            <div className={styles.filterSummary}>
              <strong>{eo.activeFilterCount}</strong> filter{eo.activeFilterCount === 1 ? '' : 's'} applied
              <button type="button" className={styles.filterSummaryClear} onClick={eo.clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {eo.loading && eo.kpis.length === 0 ? (
          <div className={styles.contentArea}>
            <p className={styles.textMuted}>Loading dashboard…</p>
          </div>
        ) : (
          <div className={styles.contentArea}>

            {/* ── KPI SUMMARY CARDS ──────────────────────────────────────── */}
            <div className={styles.section}>
              <div className={styles.metricRow}>
                {eo.visibleKpis.map((kpi) => (
                  <KpiCard
                    key={kpi.id}
                    data={kpi}
                    checked={!eo.hiddenKpiIds.includes(kpi.id)}
                    onToggle={eo.toggleKpiVisibility}
                  />
                ))}
              </div>
            </div>

            {/* ── ROW 1: LAE Ratio Trend + Repair Cost Savings Trend + Contents & ALE Savings Trend ── */}
            <div className={styles.chartRow3}>
              <div className={styles.chartWidget}>
                <div className={styles.chartWidgetTitle}>LAE Savings Trend</div>
                <div className={styles.chartWidgetSub}>Monthly LAE savings captured</div>
                <div className={styles.chartHeroValue}>{eo.laeRatio.currentValue}</div>
                <div className={styles.chartWidgetBody}>
                  <AreaTrendChart
                    data={eo.laeRatio.data.map((point) => ({ month: point.month, value: point.allocated + point.unallocated }))}
                    color="#3A7BD5"
                    valueFormat={(v) => formatCurrency(v * 1e6)}
                    yMin={0}
                    yMax={5}
                    xAxisLabel="Month"
                    yAxisLabel="LAE Savings ($M)"
                  />
                </div>
              </div>

              <div className={styles.chartWidget}>
                <div className={styles.chartWidgetTitle}>Repair Cost Savings Trend</div>
                <div className={styles.chartWidgetSub}>Monthly estimate-review savings captured</div>
                <div className={styles.chartHeroValue}>{eo.medicalSavingsTrend.currentValue}</div>
                <div className={styles.chartWidgetBody}>
                  <AreaTrendChart
                    data={eo.medicalSavingsTrend.data}
                    color="#0E9A94"
                    valueFormat={(v) => formatCurrency(v * 1e6)}
                    yMin={0}
                    yMax={2}
                    xAxisLabel="Month"
                    yAxisLabel="Repair Cost Savings ($M)"
                  />
                </div>
              </div>

              <div className={styles.chartWidget}>
                <div className={styles.chartWidgetTitle}>Contents & ALE Savings Trend</div>
                <div className={styles.chartWidgetSub}>Monthly contents and loss-of-use savings captured</div>
                <div className={styles.chartHeroValue}>{eo.indemnitySavingsTrend.currentValue}</div>
                <div className={styles.chartWidgetBody}>
                  <AreaTrendChart
                    data={eo.indemnitySavingsTrend.data}
                    color="#DD9226"
                    valueFormat={(v) => formatCurrency(v * 1e6)}
                    yMin={0}
                    yMax={2}
                    xAxisLabel="Month"
                    yAxisLabel="Contents & ALE Savings ($M)"
                  />
                </div>
              </div>
            </div>

            {/* ── ROW 2: Subrogation Recovery Trend + Top 5 Savings by Service + SLA Compliance ── */}
            <div className={styles.chartRow3}>
              <div className={styles.chartWidget}>
                <div className={styles.chartWidgetTitle}>Subrogation Recovery Trend</div>
                <div className={styles.chartWidgetSub}>Monthly subrogation recovery amount</div>
                <div className={styles.chartHeroValue}>{eo.subrogationTrend.currentValue}</div>
                <div className={styles.chartWidgetBody}>
                  <AreaTrendChart
                    data={eo.subrogationTrend.data}
                    color="#56A33C"
                    valueFormat={(v) => formatCurrency(v * 1e6)}
                    yMin={0}
                    yMax={4}
                    xAxisLabel="Month"
                    yAxisLabel="Subrogation Recovery ($M)"
                  />
                </div>
              </div>

              <div className={styles.chartWidget}>
                <div className={styles.chartWidgetTitle}>Top 5 Savings by Service</div>
                <div className={styles.chartWidgetSub}>Highest savings captured this period</div>
                <div className={styles.chartWidgetBody}>
                  <HorizontalBarChart
                    data={eo.savingsByService.map((row) => ({
                      label: row.service,
                      value: row.savings,
                      colorClass: 'eo-hbar--primary',
                    }))}
                    valueFormat={formatCurrency}
                  />
                </div>
              </div>

              <div className={styles.chartWidget}>
                <div className={styles.chartWidgetTitle}>
                  SLA Compliance by Service
                  <span className={styles.infoIcon} tabIndex={0}>
                    <InfoIcon />
                    <span className={styles.infoTooltip}>Green ≥ 90% · Amber 80–89% · Red &lt; 80%</span>
                  </span>
                </div>
                <div className={styles.chartWidgetSub}>Top 5 services by SLA compliance</div>
                <div className={styles.chartWidgetBody}>
                  <HorizontalBarChart
                    data={eo.slaCompliance.map((row) => ({
                      label: row.serviceName,
                      value: row.compliance,
                      colorClass: `eo-hbar--${row.status}`,
                    }))}
                    valueFormat={formatPercent}
                    maxValue={100}
                    axisTicks={[0, 50, 100]}
                  />
                </div>
              </div>
            </div>

            {/* ── VENDOR PERFORMANCE OVERVIEW ───────────────────────────────── */}
            <div className={styles.section}>
              <VendorPerformanceTable
                vendors={eo.vendors}
                sortBy={eo.vendorSort}
                sortOrder={eo.vendorOrder}
                onSortChange={eo.setVendorSort}
              />
            </div>

            {/* ── TOP ALERTS & EXCEPTIONS ───────────────────────────────────── */}
            <div className={styles.section} style={{ paddingBottom: 28 }}>
              <AlertsPanel alerts={eo.alerts} />
            </div>

          </div>
        )}
      </div>

      <FiltersPanel
        isOpen={filtersOpen}
        filters={eo.filters}
        onApply={eo.applyFilters}
        onClear={eo.clearFilters}
        onClose={() => setFiltersOpen(false)}
      />
    </AppShell>
  );
};

export default DashboardMaster;
