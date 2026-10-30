import { useState, useEffect, useCallback } from 'react';
import {
  getVendorServiceRequestById,
  updateVendorServiceRequest,
  getServiceCategories,
} from '../../services/vendorServiceRequest/vendorServiceRequestService';
import { logError } from '../../utils/logError';
import type { VendorServiceRequestDetail, VendorServiceRequestStatus, ServiceCategory } from '../../models/vendorServiceRequest/vendorServiceRequestModel';

export interface Notification {
  type: 'success' | 'error';
  text: string;
}

export interface UpdateDetailsInput {
  companyName:   string;
  address:       string;
  email:         string;
  phone:         string;
  website:       string;
  contactPerson: string;
  contactPersonName:  string;
  contactPersonPhone: string;
  contactPersonEmail: string;
  services:      string[];
  coverage:      string[];
}

export function useVendorServiceRequestDetail(requestId: string) {
  const [details,      setDetails]      = useState<VendorServiceRequestDetail | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [categories,   setCategories]   = useState<ServiceCategory[]>([]);

  const showNote = useCallback((type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVendorServiceRequestById(requestId);
      setDetails(data);
    } catch (err) {
      logError(err, 'useVendorServiceRequestDetail.load');
      setError('Failed to load vendor service request. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await getServiceCategories();
        setCategories(data);
      } catch (err) {
        logError(err, 'useVendorServiceRequestDetail.loadCategories');
      }
    })();
  }, []);

  const refresh = useCallback(() => { void load(); }, [load]);

  const submitRequest = useCallback(async () => {
    setSaving(true);
    try {
      await updateVendorServiceRequest(requestId, { status: 'submitted', submittedBy: 'Admin' });
      showNote('success', 'Request submitted.');
      await load();
    } catch (err) {
      logError(err, 'useVendorServiceRequestDetail.submitRequest');
      showNote('error', 'Failed to submit request. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [requestId, load, showNote]);

  const changeStatus = useCallback(async (
    status: VendorServiceRequestStatus,
    reviewedBy: string,
    notes: string,
  ) => {
    setSaving(true);
    try {
      await updateVendorServiceRequest(requestId, { status, reviewedBy, notes });
      showNote('success', `Request marked as ${status.replace('_', ' ')}.`);
      await load();
    } catch (err) {
      logError(err, 'useVendorServiceRequestDetail.changeStatus');
      showNote('error', 'Failed to update request status. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [requestId, load, showNote]);

  const updateDetails = useCallback(async (input: UpdateDetailsInput): Promise<boolean> => {
    setSaving(true);
    try {
      await updateVendorServiceRequest(requestId, {
        companyName:   input.companyName.trim(),
        address:       input.address.trim(),
        email:         input.email.trim(),
        phone:         input.phone.trim(),
        website:       input.website.trim(),
        contactPerson: input.contactPerson.trim(),
        contactPersonName:  input.contactPersonName.trim(),
        contactPersonPhone: input.contactPersonPhone.trim(),
        contactPersonEmail: input.contactPersonEmail.trim(),
        services:      input.services,
        coverage:      input.coverage,
      });
      showNote('success', 'Request details updated.');
      await load();
      return true;
    } catch (err) {
      logError(err, 'useVendorServiceRequestDetail.updateDetails');
      showNote('error', 'Failed to update request details. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [requestId, load, showNote]);

  return {
    details,
    loading,
    error,
    saving,
    notification,
    categories,
    submitRequest,
    changeStatus,
    updateDetails,
    refresh,
  };
}
