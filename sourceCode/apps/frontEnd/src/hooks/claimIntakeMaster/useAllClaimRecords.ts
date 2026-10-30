import { useState, useEffect, useCallback } from 'react';
import { getAllClaimRecords } from '../../services/claimIntakeMaster/claimIntakeService';
import { logError } from '../../utils/logError';
import type { IndividualClaimRecord } from '../../models/claimIntakeMaster/claimIntakeModel';

export function useAllClaimRecords() {
  const [records, setRecords] = useState<IndividualClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await getAllClaimRecords());
    } catch (err) {
      logError(err, 'useAllClaimRecords.load');
      setError('Failed to load claim records. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { records, loading, error, refresh: load };
}
