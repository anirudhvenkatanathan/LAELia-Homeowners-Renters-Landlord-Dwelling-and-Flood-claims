import { useState, useEffect, useCallback } from 'react';
import type { VendorSelectionLogic } from '../../models/vendorSelectionLogic/vendorSelectionLogicModel';
import { getVendorSelectionLogicList, deleteVendorSelectionLogic } from '../../services/vendorSelectionLogic/vendorSelectionLogicService';

export function useVendorSelectionLogic() {
  const [items, setItems]     = useState<VendorSelectionLogic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVendorSelectionLogicList();
      setItems(data);
    } catch {
      setError('Failed to load vendor selection logic rules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = useCallback(async (ruleId: string): Promise<{ success: boolean; message: string }> => {
    setDeleting(true);
    try {
      const result = await deleteVendorSelectionLogic(ruleId);
      if (result.success) {
        setItems((prev) => prev.filter((r) => r.ruleId !== ruleId));
      }
      return result;
    } catch {
      return { success: false, message: 'Failed to delete logic.' };
    } finally {
      setDeleting(false);
    }
  }, []);

  return { items, loading, error, deleting, refresh: load, handleDelete };
}
