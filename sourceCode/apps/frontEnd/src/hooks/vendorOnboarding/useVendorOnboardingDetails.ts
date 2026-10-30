import { useState, useEffect, useCallback } from 'react';
import {
  getOnboardingDetails,
  uploadDocument,
  approveDocument,
  rejectDocument,
  recallDocument,
  sendBackDocument,
  finalApproveVendor,
  applyPriorityBoost,
  suspendVendor,
  disqualifyVendor,
  setAvailability as setAvailabilityApi,
  getWaiveReasons,
  waiveConfirmation,
  clearWaive as clearWaiveApi,
  updateServiceRoles as updateServiceRolesApi,
  getVendorStatusHistory,
} from '../../services/vendorOnboarding/vendorOnboardingService';
import { activateVendorFromPanel } from '../../services/vendor/vendorService';
import type { UploadPayload, WaivePayload, VendorStatusHistoryEntry, PriorityBoostPayload } from '../../services/vendorOnboarding/vendorOnboardingService';
import { logError } from '../../utils/logError';
import type { VendorOnboardingDetails, WaiveReason } from '../../models/vendorOnboarding/vendorOnboardingModel';

export interface Notification {
  type: 'success' | 'error';
  text: string;
}

export function useVendorOnboardingDetails(vendorId: string) {
  const [details,      setDetails]      = useState<VendorOnboardingDetails | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [waiveReasons, setWaiveReasons] = useState<WaiveReason[]>([]);
  const [statusHistory, setStatusHistory] = useState<VendorStatusHistoryEntry[]>([]);

  useEffect(() => {
    getWaiveReasons().then(setWaiveReasons).catch(() => {});
  }, []);

  const refetchHistory = useCallback(async () => {
    try {
      const entries = await getVendorStatusHistory(vendorId);
      setStatusHistory(entries);
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.refetchHistory');
    }
  }, [vendorId]);

  useEffect(() => { void refetchHistory(); }, [refetchHistory]);

  const showNote = useCallback((type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOnboardingDetails(vendorId);
      setDetails(data);
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.load');
      setError('Failed to load vendor details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { void load(); }, [load]);

  const refresh = useCallback(() => { void load(); }, [load]);

  // Fetches the latest details without toggling the page-level loading state,
  // so the screen doesn't appear to reload.
  const refetchDetails = useCallback(async () => {
    try {
      const data = await getOnboardingDetails(vendorId);
      setDetails(data);
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.refetchDetails');
    }
  }, [vendorId]);

  const uploadDoc = useCallback(async (payload: UploadPayload) => {
    setSaving(true);
    try {
      const result = await uploadDocument(payload);
      if (result.success) {
        await refetchDetails();
      } else {
        showNote('error', result.message || 'Upload failed.');
      }
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.uploadDoc');
      showNote('error', 'Upload failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [refetchDetails, showNote]);

  const approveDoc = useCallback(async (vendorConfirmationId: string, comments: string) => {
    setSaving(true);
    try {
      const result = await approveDocument(vendorId, vendorConfirmationId, comments);
      if (result.success) {
        showNote('success', 'Document approved.');
        await refetchDetails();
      } else {
        showNote('error', result.message || 'Approval failed.');
      }
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.approveDoc');
      showNote('error', 'Approval failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [vendorId, refetchDetails, showNote]);

  const rejectDoc = useCallback(async (vendorConfirmationId: string, comments: string) => {
    setSaving(true);
    try {
      const result = await rejectDocument(vendorId, vendorConfirmationId, comments);
      if (result.success) {
        showNote('success', 'Document rejected.');
        await refetchDetails();
      } else {
        showNote('error', result.message || 'Rejection failed.');
      }
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.rejectDoc');
      showNote('error', 'Rejection failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [vendorId, refetchDetails, showNote]);

  const finalApprove = useCallback(async (performedBy?: string, resetBoost?: boolean) => {
    setSaving(true);
    try {
      const result = await finalApproveVendor(vendorId, performedBy, resetBoost);
      if (result.success) {
        showNote('success', 'Service Provider activated successfully.');
        await Promise.all([refetchDetails(), refetchHistory()]);
      } else {
        showNote('error', result.message || 'Final approval failed.');
      }
      return result;
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.finalApprove');
      showNote('error', 'Final approval failed. Please try again.');
      return { success: false, message: 'Final approval failed. Please try again.' };
    } finally {
      setSaving(false);
    }
  }, [vendorId, refetchDetails, refetchHistory, showNote]);

  const applyBoost = useCallback(async (payload: Omit<PriorityBoostPayload, 'vendorId'>) => {
    setSaving(true);
    try {
      const result = await applyPriorityBoost({ ...payload, vendorId });
      if (result.success) {
        showNote('success', 'Priority Boost applied successfully.');
        await refetchDetails();
      } else {
        showNote('error', result.message || 'Failed to apply Priority Boost.');
      }
      return result;
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.applyBoost');
      showNote('error', 'Failed to apply Priority Boost. Please try again.');
      return { success: false, message: 'Failed to apply Priority Boost. Please try again.' };
    } finally {
      setSaving(false);
    }
  }, [vendorId, refetchDetails, showNote]);

  const suspend = useCallback(async (reason: string, performedBy?: string) => {
    setSaving(true);
    try {
      const result = await suspendVendor(vendorId, reason, performedBy);
      if (result.success) {
        showNote('success', 'Vendor suspended.');
        await Promise.all([refetchDetails(), refetchHistory()]);
      } else {
        showNote('error', result.message || 'Suspend failed.');
      }
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.suspend');
      showNote('error', 'Suspend failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [vendorId, refetchDetails, refetchHistory, showNote]);

  const disqualify = useCallback(async (reason: string, performedBy?: string) => {
    setSaving(true);
    try {
      const result = await disqualifyVendor(vendorId, reason, performedBy);
      if (result.success) {
        showNote('success', 'Vendor disqualified.');
        await Promise.all([refetchDetails(), refetchHistory()]);
      } else {
        showNote('error', result.message || 'Disqualify failed.');
      }
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.disqualify');
      showNote('error', 'Disqualify failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [vendorId, refetchDetails, refetchHistory, showNote]);

  const setAvailability = useCallback(async (
    vendorStageId: string,
    vendorConfirmationId: string,
    status: 'Available' | 'Not Available',
  ) => {
    setSaving(true);
    try {
      const result = await setAvailabilityApi(vendorId, vendorStageId, vendorConfirmationId, status);
      if (result.success) {
        await refetchDetails();
      } else {
        showNote('error', result.message || 'Failed to save availability status.');
      }
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.setAvailability');
      showNote('error', 'Failed to save availability status. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [vendorId, refetchDetails, showNote]);

  const waiveItem = useCallback(async (payload: Omit<WaivePayload, 'vendorId'>) => {
    setSaving(true);
    try {
      const result = await waiveConfirmation({ ...payload, vendorId });
      if (result.success) {
        showNote('success', 'Item waived.');
        await refetchDetails();
      } else {
        showNote('error', result.message || 'Waive failed.');
      }
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.waiveItem');
      showNote('error', 'Waive failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [vendorId, refetchDetails, showNote]);

  const activateFromPanel = useCallback(async (performedBy?: string) => {
    setSaving(true);
    try {
      const result = await activateVendorFromPanel(vendorId, performedBy);
      if (result.success) {
        showNote('success', 'Vendor Activated Successfully');
        setDetails((prev) => prev ? { ...prev, vendorStatus: 'Active' } : prev);
        await refetchHistory();
      } else {
        showNote('error', result.message || 'Activation failed.');
      }
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.activateFromPanel');
      showNote('error', 'Activation failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [vendorId, refetchHistory, showNote]);

  const clearWaiveItem = useCallback(async (vendorConfirmationId: string) => {
    setSaving(true);
    try {
      const result = await clearWaiveApi(vendorId, vendorConfirmationId);
      if (result.success) {
        showNote('success', 'Waive cleared.');
        await refetchDetails();
      } else {
        showNote('error', result.message || 'Clear waive failed.');
      }
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.clearWaiveItem');
      showNote('error', 'Clear waive failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [vendorId, refetchDetails, showNote]);

  const patchDetails = useCallback((updater: (prev: VendorOnboardingDetails) => VendorOnboardingDetails) => {
    setDetails((prev) => (prev ? updater(prev) : prev));
  }, []);

  const updateServiceRoles = useCallback(async (roleIds: string[]) => {
    try {
      const result = await updateServiceRolesApi(vendorId, roleIds);
      if (!result.success) {
        showNote('error', result.message || 'Failed to save service categories.');
        await refetchDetails();
      } else {
        await refetchDetails();
      }
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.updateServiceRoles');
      showNote('error', 'Failed to save service categories. Please try again.');
      await refetchDetails();
    }
  }, [vendorId, refetchDetails, showNote]);

  const sendBackDoc = useCallback(async (vendorConfirmationId: string, comments: string) => {
    setSaving(true);
    try {
      const result = await sendBackDocument(vendorId, vendorConfirmationId, comments);
      if (result.success) {
        showNote('success', 'Document sent back. Vendor will be notified to re-upload.');
        await refetchDetails();
      } else {
        showNote('error', result.message || 'Send back failed.');
      }
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.sendBackDoc');
      showNote('error', 'Send back failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [vendorId, refetchDetails, showNote]);

  const recallDoc = useCallback(async (vendorConfirmationId: string) => {
    try {
      const result = await recallDocument(vendorId, vendorConfirmationId);
      if (result.success) {
        await refetchDetails();
      }
    } catch (err) {
      logError(err, 'useVendorOnboardingDetails.recallDoc');
    }
  }, [vendorId, refetchDetails]);

  return {
    details,
    loading,
    error,
    saving,
    notification,
    waiveReasons,
    statusHistory,
    uploadDoc,
    approveDoc,
    rejectDoc,
    sendBackDoc,
    recallDoc,
    finalApprove,
    applyBoost,
    suspend,
    disqualify,
    setAvailability,
    waiveItem,
    clearWaiveItem,
    activateFromPanel,
    updateServiceRoles,
    patchDetails,
    refresh,
    showNote,
  };
}
