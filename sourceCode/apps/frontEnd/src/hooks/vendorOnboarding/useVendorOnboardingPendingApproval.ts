import { useState, useEffect, useCallback } from 'react';
import {
  getPendingApprovalDetails,
  approveVendorRequest,
  rejectVendorRequest,
} from '../../services/vendorOnboarding/vendorOnboardingService';
import { logError } from '../../utils/logError';
import type { PendingApprovalDetails } from '../../models/vendorOnboarding/vendorOnboardingModel';

export interface Notification {
  type: 'success' | 'error';
  text: string;
}

export function useVendorOnboardingPendingApproval(vendorId: string) {
  const [details,      setDetails]      = useState<PendingApprovalDetails | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  const showNote = useCallback((type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPendingApprovalDetails(vendorId);
      setDetails(data);
    } catch (err) {
      logError(err, 'useVendorOnboardingPendingApproval.load');
      setError('Failed to load vendor request details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { void load(); }, [load]);

  const approve = useCallback(async (approvedServiceRoleIds: string[]): Promise<boolean> => {
    setSaving(true);
    try {
      await approveVendorRequest(vendorId, approvedServiceRoleIds);
      showNote('success', 'Vendor request approved.');
      return true;
    } catch (err) {
      logError(err, 'useVendorOnboardingPendingApproval.approve');
      showNote('error', 'Failed to initiate vendor request. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [vendorId, showNote]);

  const reject = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      await rejectVendorRequest(vendorId);
      showNote('success', 'Vendor request rejected.');
      return true;
    } catch (err) {
      logError(err, 'useVendorOnboardingPendingApproval.reject');
      showNote('error', 'Failed to reject vendor request. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [vendorId, showNote]);

  return { details, loading, error, saving, notification, approve, reject };
}
