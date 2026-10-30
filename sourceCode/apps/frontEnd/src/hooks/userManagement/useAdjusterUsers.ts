import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listAdjusterUsers } from '../../services/userManagement/userManagementService';
import { logError } from '../../utils/logError';
import type { AdjusterUser } from '../../models/userManagement/userManagementModel';

export function useAdjusterUsers(enabled: boolean) {
  const { token } = useAuth();
  const [users,   setUsers]   = useState<AdjusterUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listAdjusterUsers(token);
      if (result.success) {
        setUsers(result.users);
      } else {
        setError(result.message || 'Failed to load users. Please try again.');
      }
    } catch (err) {
      logError(err, 'useAdjusterUsers.load');
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (enabled) void load(); }, [enabled, load]);

  return { users, loading, error, refresh: load };
}
