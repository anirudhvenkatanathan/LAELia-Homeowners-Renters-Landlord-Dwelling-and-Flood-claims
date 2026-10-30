import { useState, useEffect, useCallback } from 'react';
import { getVendors, deleteVendor } from '../../services/vendor/vendorService';
import { logError } from '../../utils/logError';
import type { Vendor } from '../../models/vendor/vendorModel';

export function useVendor() {
  const [vendors,  setVendors]  = useState<Vendor[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVendors(await getVendors());
    } catch (err) {
      logError(err, 'useVendor.load');
      setError('Failed to load vendors. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = useCallback(async (vendorId: string): Promise<{ success: boolean; message: string }> => {
    setDeleting(true);
    try {
      const result = await deleteVendor(vendorId);
      if (result.success) setVendors((prev) => prev.filter((v) => v.vendorId !== vendorId));
      return result;
    } catch (err) {
      logError(err, 'useVendor.handleDelete');
      return { success: false, message: 'Failed to delete vendor.' };
    } finally {
      setDeleting(false);
    }
  }, []);

  return { vendors, loading, error, deleting, refresh: load, handleDelete };
}
