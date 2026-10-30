import { useState, useEffect, useCallback, useMemo } from 'react';
import { getVendors } from '../../services/vendor/vendorService';
import { logError } from '../../utils/logError';
import type { Vendor } from '../../models/vendor/vendorModel';

// ─── Constants ────────────────────────────────────────────────────────────────

const TODAY_MS = Date.now();
const MS_PER_DAY = 86_400_000;
const REQUAL_ALERT_DAYS = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilRequalDue(vendor: Vendor): number | null {
  if (!vendor.requalDue) return null;
  return Math.ceil((new Date(vendor.requalDue).getTime() - TODAY_MS) / MS_PER_DAY);
}

function needsAttention(vendor: Vendor): boolean {
  if (vendor.status === 'Suspended') return true;
  const days = daysUntilRequalDue(vendor);
  return days !== null && days <= REQUAL_ALERT_DAYS;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatusFilter = 'all' | 'active' | 'requal' | 'suspended' | 'disqualified';

export interface StatusCounts {
  all:          number;
  active:       number;
  requal:       number;
  suspended:    number;
  disqualified: number;
}

export interface CategoryOption {
  name:  string;
  count: number;
}

export interface VendorSearchState {
  vendors:            Vendor[];
  filteredVendors:    Vendor[];
  attentionVendors:   Vendor[];
  statusCounts:       StatusCounts;
  categories:         CategoryOption[];
  loading:            boolean;
  error:              string | null;
  searchQuery:        string;
  statusFilter:       StatusFilter;
  selectedCategories: string[];
  setSearchQuery:      (q: string) => void;
  setStatusFilter:      (f: StatusFilter) => void;
  toggleCategory:       (name: string) => void;
  clearCategories:      () => void;
  refresh:              () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVendorSearch(): VendorSearchState {
  const [vendors,      setVendors]      = useState<Vendor[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [statusFilter,       setStatusFilter]       = useState<StatusFilter>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const toggleCategory = useCallback((name: string) => {
    setSelectedCategories((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }, []);

  const clearCategories = useCallback(() => setSelectedCategories([]), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVendors();
      setVendors(data);
    } catch (err) {
      logError(err, 'useVendorSearch.load');
      setError('Failed to load vendors. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Vendors that require attention regardless of active filter
  const attentionVendors = useMemo(
    () => vendors.filter(needsAttention),
    [vendors],
  );

  // Status counts over the full unfiltered set
  const statusCounts = useMemo<StatusCounts>(() => ({
    all:          vendors.length,
    active:       vendors.filter(v => v.status === 'Active').length,
    requal:       vendors.filter(v => v.status === 'Requalification Due').length,
    suspended:    vendors.filter(v => v.status === 'Suspended').length,
    disqualified: vendors.filter(v => v.status === 'Disqualified').length,
  }), [vendors]);

  // Distinct service categories across every vendor, alphabetised, with counts
  // over the full unfiltered set (mirrors statusCounts).
  const categories = useMemo<CategoryOption[]>(() => {
    const counts = new Map<string, number>();
    for (const v of vendors) {
      for (const name of v.serviceRequestRoleNames ?? []) {
        if (!name) continue;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
  }, [vendors]);

  // Apply status tab + category checkboxes (OR within, AND with status/search) + text search
  const filteredVendors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return vendors.filter(v => {
      // ── Status filter ──────────────────────────────────────────────────────
      if (statusFilter === 'active'       && v.status !== 'Active')             return false;
      if (statusFilter === 'requal'       && v.status !== 'Requalification Due') return false;
      if (statusFilter === 'suspended'    && v.status !== 'Suspended')          return false;
      if (statusFilter === 'disqualified' && v.status !== 'Disqualified')       return false;

      // ── Category filter (vendor matches if it has ANY selected category) ───
      if (selectedCategories.length > 0) {
        const vendorCategories = v.serviceRequestRoleNames ?? [];
        if (!selectedCategories.some((c) => vendorCategories.includes(c))) return false;
      }

      // ── Full-text search ───────────────────────────────────────────────────
      if (!q) return true;

      return (
        v.companyName?.toLowerCase().includes(q)            ||
        v.legalEntity?.toLowerCase().includes(q)            ||
        v.serviceRequestRoleName?.toLowerCase().includes(q) ||
        (v.serviceRequestRoleNames ?? []).some(n => n.toLowerCase().includes(q)) ||
        v.city?.toLowerCase().includes(q)                   ||
        v.state?.toLowerCase().includes(q)                  ||
        v.country?.toLowerCase().includes(q)                ||
        v.coverage?.toLowerCase().includes(q)
      );
    });
  }, [vendors, searchQuery, statusFilter, selectedCategories]);

  return {
    vendors,
    filteredVendors,
    attentionVendors,
    statusCounts,
    categories,
    loading,
    error,
    searchQuery,
    statusFilter,
    selectedCategories,
    setSearchQuery,
    setStatusFilter,
    toggleCategory,
    clearCategories,
    refresh: load,
  };
}

export { daysUntilRequalDue };
