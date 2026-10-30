import { useState, useEffect, useCallback } from 'react';
import { getOnboardingList } from '../../services/vendorOnboarding/vendorOnboardingService';
import { logError } from '../../utils/logError';
import type { VendorOnboardingRow, VendorOnboardingCounts, VendorOnboardingTab } from '../../models/vendorOnboarding/vendorOnboardingModel';

const EMPTY_COUNTS: VendorOnboardingCounts = { open: 0, inProgress: 0, requalificationDue: 0 };

export function useVendorOnboarding(tab: VendorOnboardingTab) {
  const [rows,         setRows]         = useState<VendorOnboardingRow[]>([]);
  const [counts,       setCounts]       = useState<VendorOnboardingCounts>(EMPTY_COUNTS);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [page,         setPage]         = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const limit = 500;

  const load = useCallback(async (currentPage: number, currentTab: VendorOnboardingTab) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getOnboardingList(currentPage, limit, currentTab);
      setRows(result.data);
      setTotalRecords(result.totalRecords);
      setCounts(result.counts);
    } catch (err) {
      logError(err, 'useVendorOnboarding.load');
      setError('Failed to load vendor onboarding list. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(page, tab); }, [load, page, tab]);

  useEffect(() => { setPage(1); }, [tab]);

  const refresh = useCallback(() => { void load(page, tab); }, [load, page, tab]);

  return { rows, counts, loading, error, totalRecords, page, setPage, refresh };
}
