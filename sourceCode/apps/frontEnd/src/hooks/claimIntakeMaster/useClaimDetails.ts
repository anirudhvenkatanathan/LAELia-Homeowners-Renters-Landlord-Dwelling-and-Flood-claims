import { useState, useEffect, useCallback } from 'react';
import { getUploadedClaimDetails } from '../../services/claimIntakeMaster/claimIntakeService';
import { logError } from '../../utils/logError';
import type { UploadedClaimDetails } from '../../models/claimIntakeMaster/claimIntakeModel';

export interface UseClaimDetailsResult {
  detail:   UploadedClaimDetails | null;
  loading:  boolean;
  error:    string | null;
  refresh:  () => void;
}

export function useClaimDetails(
  uploadId:    string | undefined,
  refreshKey?: string,            // pass location.key to re-fetch on every navigation
): UseClaimDetailsResult {
  const [detail,  setDetail]  = useState<UploadedClaimDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uploadId) { setError('No upload ID provided.'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const d = await getUploadedClaimDetails(uploadId);
      setDetail(d);
    } catch (err) {
      logError(err, 'useClaimDetails.load');
      setError('Failed to load claim details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [uploadId]);

  // Re-fetch whenever uploadId or refreshKey (location.key) changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load, refreshKey]);

  return { detail, loading, error, refresh: load };
}
