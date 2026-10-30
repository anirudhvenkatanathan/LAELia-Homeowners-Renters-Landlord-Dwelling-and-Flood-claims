import { useState, useEffect, useCallback, useMemo } from 'react';
import { getVendorPanelVendors } from '../../services/vendor/vendorService';
import { logError } from '../../utils/logError';
import type { Vendor } from '../../models/vendor/vendorModel';

export type PanelStatusFilter = 'all' | 'active' | 'readyForActivation';

export interface PanelStatusCounts {
  all:                number;
  active:             number;
  readyForActivation: number;
}

export interface VendorPanelState {
  vendors:         Vendor[];
  filteredVendors: Vendor[];
  statusCounts:    PanelStatusCounts;
  statusFilter:    PanelStatusFilter;
  setStatusFilter: (f: PanelStatusFilter) => void;
  loading:         boolean;
  error:           string | null;
  refresh:         () => void;
}

export function useVendorPanel(): VendorPanelState {
  const [vendors,      setVendors]      = useState<Vendor[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PanelStatusFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVendorPanelVendors();
      setVendors(data);
    } catch (err) {
      logError(err, 'useVendorPanel.load');
      setError('Failed to load vendors. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const statusCounts = useMemo<PanelStatusCounts>(() => ({
    all:                vendors.length,
    active:             vendors.filter((v) => v.status === 'Active').length,
    readyForActivation: vendors.filter((v) => v.status === 'Ready for Activation').length,
  }), [vendors]);

  const filteredVendors = useMemo(() => {
    if (statusFilter === 'active')             return vendors.filter((v) => v.status === 'Active');
    if (statusFilter === 'readyForActivation') return vendors.filter((v) => v.status === 'Ready for Activation');
    return vendors;
  }, [vendors, statusFilter]);

  return { vendors, filteredVendors, statusCounts, statusFilter, setStatusFilter, loading, error, refresh: load };
}
