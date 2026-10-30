import { useState, useEffect, useCallback } from 'react';
import { getVendorServiceRequests } from '../../services/vendorServiceRequest/vendorServiceRequestService';
import { logError } from '../../utils/logError';
import type { VendorServiceRequestListItem, VendorServiceRequestStatus } from '../../models/vendorServiceRequest/vendorServiceRequestModel';

export type StatusFilter = 'all' | VendorServiceRequestStatus;

export function useVendorServiceRequestList() {
  const [requests,     setRequests]     = useState<VendorServiceRequestListItem[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getVendorServiceRequests({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
        page:   1,
        limit:  200,
      });
      setRequests(result.data);
      setTotal(result.total);
    } catch (err) {
      logError(err, 'useVendorServiceRequestList.load');
      setError('Failed to load vendor service requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => { void load(); }, [load]);

  return {
    requests,
    total,
    loading,
    error,
    searchQuery,
    statusFilter,
    setSearchQuery,
    setStatusFilter,
    refresh: load,
  };
}
