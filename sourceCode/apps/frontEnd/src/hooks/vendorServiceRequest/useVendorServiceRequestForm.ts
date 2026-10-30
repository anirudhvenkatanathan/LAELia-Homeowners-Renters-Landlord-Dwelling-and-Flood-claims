import { useState, useEffect, useCallback } from 'react';
import { createVendorServiceRequest, getServiceCategories } from '../../services/vendorServiceRequest/vendorServiceRequestService';
import { logError } from '../../utils/logError';
import type { ServiceCategory } from '../../models/vendorServiceRequest/vendorServiceRequestModel';

export interface VendorRequestFormState {
  companyName:   string;
  address:       string;
  email:         string;
  phone:         string;
  website:       string;
  contactPerson: string;
  contactPersonName:  string;
  contactPersonPhone: string;
  contactPersonEmail: string;
}

const EMPTY_FORM: VendorRequestFormState = {
  companyName: '', address: '', email: '', phone: '', website: '', contactPerson: '',
  contactPersonName: '', contactPersonPhone: '', contactPersonEmail: '',
};

export function useVendorServiceRequestForm() {
  const [categories,    setCategories]    = useState<ServiceCategory[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [form,            setForm]            = useState<VendorRequestFormState>(EMPTY_FORM);
  const [selectedRoles,   setSelectedRoles]   = useState<string[]>([]);
  const [coverage,        setCoverage]        = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getServiceCategories();
      setCategories(data);
    } catch (err) {
      logError(err, 'useVendorServiceRequestForm.load');
      setError('Failed to load service categories. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateField = useCallback((field: keyof VendorRequestFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleRole = useCallback((roleId: string) => {
    setSelectedRoles((prev) => (
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    ));
  }, []);

  const selectAllRoles = useCallback(() => {
    setSelectedRoles(categories.map((c) => c.roleId));
  }, [categories]);

  const clearAllRoles = useCallback(() => {
    setSelectedRoles([]);
  }, []);

  const toggleCoverage = useCallback((stateCode: string) => {
    setCoverage((prev) => (
      prev.includes(stateCode) ? prev.filter((c) => c !== stateCode) : [...prev, stateCode]
    ));
  }, []);

  const validate = useCallback((): string | null => {
    if (!form.companyName.trim()) return 'Company name is required.';
    return null;
  }, [form.companyName]);

  const submitRequest = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return null;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await createVendorServiceRequest({
        companyName:   form.companyName.trim(),
        address:       form.address.trim(),
        email:         form.email.trim(),
        phone:         form.phone.trim(),
        website:       form.website.trim(),
        contactPerson: form.contactPerson.trim(),
        contactPersonName:  form.contactPersonName.trim(),
        contactPersonPhone: form.contactPersonPhone.trim(),
        contactPersonEmail: form.contactPersonEmail.trim(),
        services:      selectedRoles,
        coverage,
        status: 'submitted',
        submittedBy: 'Admin',
      });
      return result;
    } catch (err) {
      logError(err, 'useVendorServiceRequestForm.submitRequest');
      setError('Failed to save vendor service request. Please try again.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [form, selectedRoles, coverage, validate]);

  return {
    categories,
    loading,
    error,
    saving,
    form,
    selectedRoles,
    coverage,
    updateField,
    toggleRole,
    selectAllRoles,
    clearAllRoles,
    toggleCoverage,
    submitRequest,
  };
}
