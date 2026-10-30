import { useState, useEffect, useCallback } from 'react';
import type { ServiceRequestRole } from '../../models/ServiceRequestRole/serviceRequestRoleModel';
import { getAllServiceRequestRoles } from '../../services/ServiceRequestRole/serviceRequestRoleService';
import { logError } from '../../utils/logError';

export interface UseServiceRequestRoleReturn {
  roles:               ServiceRequestRole[];
  isLoading:           boolean;
  errors:              Record<string, string>;
  fetchRoles:          () => Promise<void>;
  handleUploadSuccess: () => void;
}

export function useServiceRequestRole(): UseServiceRequestRoleReturn {
  const [roles,     setRoles]     = useState<ServiceRequestRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  const fetchRoles = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await getAllServiceRequestRoles();
      setRoles(data);
      setErrors({});
    } catch (err) {
      logError(err, 'useServiceRequestRole.fetchRoles');
      setErrors((prev) => ({ ...prev, grid: 'Failed to load roles. Please refresh.' }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles().catch((err) => logError(err, 'useServiceRequestRole.mount'));
  }, [fetchRoles]);

  const handleUploadSuccess = useCallback((): void => {
    fetchRoles().catch((err) => logError(err, 'useServiceRequestRole.handleUploadSuccess'));
  }, [fetchRoles]);

  return { roles, isLoading, errors, fetchRoles, handleUploadSuccess };
}
