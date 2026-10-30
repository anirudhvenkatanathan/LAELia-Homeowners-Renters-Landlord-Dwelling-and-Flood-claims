import { useState, useEffect, useCallback } from 'react';
import { getSupervisorReviewedClaims } from '../../services/claimIntakeMaster/claimIntakeService';
import { logError } from '../../utils/logError';
import type { SupervisorReviewedClaim } from '../../models/claimIntakeMaster/claimIntakeModel';

export function useSupervisorReviewedClaims(adjusterName: string | undefined) {
  const [claims,  setClaims]  = useState<SupervisorReviewedClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adjusterName) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setClaims(await getSupervisorReviewedClaims(adjusterName));
    } catch (err) {
      logError(err, 'useSupervisorReviewedClaims.load');
      setError('Failed to load Supervisor Comments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [adjusterName]);

  useEffect(() => { void load(); }, [load]);

  return { claims, loading, error, refresh: load };
}
