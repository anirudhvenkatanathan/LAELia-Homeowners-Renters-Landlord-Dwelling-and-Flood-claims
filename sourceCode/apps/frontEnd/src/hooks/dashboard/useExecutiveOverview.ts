import { useCallback, useEffect, useMemo, useState } from 'react';
import { logError } from '../../utils/logError';
import * as svc from '../../services/dashboard/executiveOverviewService';
import {
  DEFAULT_DATE_RANGE,
  EMPTY_FILTERS,
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

const EMPTY_TREND: TrendChartData = { currentValue: '', data: [] };
const EMPTY_LAE_TREND: LaeRatioTrendData = { currentValue: '', data: [] };

export function useExecutiveOverview() {
  const [dateRange, setDateRangeState] = useState<DateRangeValue>(DEFAULT_DATE_RANGE);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [vendorSort, setVendorSortState] = useState<VendorSortField>('score');
  const [vendorOrder, setVendorOrder] = useState<'asc' | 'desc'>('desc');
  const [hiddenKpiIds, setHiddenKpiIds] = useState<string[]>([]);

  const [kpis, setKpis] = useState<KpiCardData[]>([]);
  const [laeRatio, setLaeRatio] = useState<LaeRatioTrendData>(EMPTY_LAE_TREND);
  const [subrogationTrend, setSubrogationTrend] = useState<TrendChartData>(EMPTY_TREND);
  const [medicalSavingsTrend, setMedicalSavingsTrend] = useState<TrendChartData>(EMPTY_TREND);
  const [indemnitySavingsTrend, setIndemnitySavingsTrend] = useState<TrendChartData>(EMPTY_TREND);
  const [savingsByService, setSavingsByService] = useState<SavingsByServiceRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [slaCompliance, setSlaCompliance] = useState<SlaComplianceRow[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);

  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        kpisRes,
        laeRes,
        subroRes,
        medSavingsRes,
        indemSavingsRes,
        savingsRes,
        vendorsRes,
        slaRes,
        alertsRes,
      ] = await Promise.all([
        svc.getKpis(dateRange),
        svc.getLaeRatioTrend(),
        svc.getSubrogationTrend(),
        svc.getMedicalSavingsTrend(),
        svc.getIndemnitySavingsTrend(),
        svc.getSavingsByService(dateRange, filters, 5),
        svc.getVendors(filters, vendorSort, vendorOrder, 5),
        svc.getSlaCompliance(filters, 5),
        svc.getAlerts(dateRange, filters, 5),
      ]);
      setKpis(kpisRes);
      setLaeRatio(laeRes);
      setSubrogationTrend(subroRes);
      setMedicalSavingsTrend(medSavingsRes);
      setIndemnitySavingsTrend(indemSavingsRes);
      setSavingsByService(savingsRes);
      setVendors(vendorsRes);
      setSlaCompliance(slaRes);
      setAlerts(alertsRes);
    } catch (error) {
      logError(error, 'useExecutiveOverview.loadAll');
    } finally {
      setLoading(false);
    }
  }, [dateRange, filters, vendorSort, vendorOrder]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  useEffect(() => {
    svc.getAiInsight()
      .then(setAiInsight)
      .catch((error) => logError(error, 'useExecutiveOverview.getAiInsight'));
  }, []);

  const setDateRange = useCallback((value: DateRangeValue) => {
    setDateRangeState(value);
  }, []);

  const applyFilters = useCallback((next: FilterState) => {
    setFilters(next);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const setVendorSort = useCallback((field: VendorSortField) => {
    setVendorSortState((prevField) => {
      if (prevField === field) {
        setVendorOrder((prevOrder) => (prevOrder === 'desc' ? 'asc' : 'desc'));
        return prevField;
      }
      setVendorOrder('desc');
      return field;
    });
  }, []);

  const toggleKpiVisibility = useCallback((id: string) => {
    setHiddenKpiIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const visibleKpis = useMemo(
    () => kpis.filter((k) => !hiddenKpiIds.includes(k.id)),
    [kpis, hiddenKpiIds],
  );

  const activeFilterCount = useMemo(
    () =>
      filters.service.length +
      filters.vendor.length +
      filters.region.length +
      filters.claimType.length +
      filters.severity.length,
    [filters],
  );

  return {
    // date range + filters
    dateRange, setDateRange,
    filters, applyFilters, clearFilters, activeFilterCount,

    // vendor table sort
    vendorSort, vendorOrder, setVendorSort,

    // KPI visibility
    hiddenKpiIds, toggleKpiVisibility, visibleKpis,

    // section data
    kpis,
    laeRatio,
    subrogationTrend,
    medicalSavingsTrend,
    indemnitySavingsTrend,
    savingsByService,
    vendors,
    slaCompliance,
    alerts,
    aiInsight,

    loading,
    refresh: loadAll,
  };
}
