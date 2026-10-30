import { useState, useEffect, useCallback } from 'react';
import { getVendorById, createVendor, updateVendor } from '../../services/vendor/vendorService';
import { getAllServiceRequestRoles } from '../../services/ServiceRequestRole/serviceRequestRoleService';
import { logError } from '../../utils/logError';
import type { VendorFormValues } from '../../models/vendor/vendorModel';
import type { ServiceRequestRole } from '../../models/ServiceRequestRole/serviceRequestRoleModel';
import { EMPTY_FORM } from '../../models/vendor/vendorModel';

export type FormMode = 'create' | 'edit' | 'view';

export interface FormErrors { [key: string]: string }

function validate(values: VendorFormValues): FormErrors {
  const errs: FormErrors = {};
  if (!values.companyName.trim()) errs['companyName'] = 'Company Name is required.';
  if (!values.emailId.trim()) {
    errs['emailId'] = 'Email ID is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.emailId.trim())) {
    errs['emailId'] = 'Email ID must be a valid email address.';
  }
  if (!values.phoneNumber.trim()) errs['phoneNumber'] = 'Phone Number is required.';
  if (!values.serviceRequestRoleId) errs['serviceRequestRoleId'] = 'Service Request Role is required.';
  return errs;
}

export function useVendorForm(vendorId: string | null, initialMode: FormMode) {
  const [mode,    setMode]    = useState<FormMode>(initialMode);
  const [values,  setValues]  = useState<VendorFormValues>(EMPTY_FORM);
  const [errors,  setErrors]  = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [roles,   setRoles]   = useState<ServiceRequestRole[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load roles
  useEffect(() => {
    getAllServiceRequestRoles()
      .then((r) => setRoles(r.filter((x) => x.status === 'Active')))
      .catch((err) => logError(err, 'useVendorForm.loadRoles'));
  }, []);

  // Load vendor for edit/view
  useEffect(() => {
    if (!vendorId) return;
    setLoading(true);
    getVendorById(vendorId)
      .then((v) => {
        setValues({
          companyName:          v.companyName,
          emailId:              v.emailId,
          phoneNumber:          v.phoneNumber,
          serviceRequestRoleId: v.serviceRequestRoleId,
          rating:               v.rating != null ? String(v.rating) : '',
          address:              v.address,
          city:                 v.city,
          state:                v.state,
          country:              v.country,
          turnaroundTime:       v.turnaroundTime,
        });
      })
      .catch((err) => { logError(err, 'useVendorForm.loadVendor'); })
      .finally(() => setLoading(false));
  }, [vendorId]);

  const updateField = useCallback((field: keyof VendorFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  }, []);

  const handleSubmit = useCallback(async (): Promise<{ success: boolean; vendorId?: string }> => {
    const errs = validate(values);
    if (Object.keys(errs).length > 0) { setErrors(errs); return { success: false }; }

    setSaving(true);
    setSubmitError(null);
    try {
      const result = vendorId
        ? await updateVendor(vendorId, values)
        : await createVendor(values);
      if (!result.success) { setSubmitError(result.message ?? 'Save failed.'); return { success: false }; }
      return { success: true, vendorId: result.vendorId };
    } catch (err) {
      logError(err, 'useVendorForm.submit');
      setSubmitError('An unexpected error occurred.');
      return { success: false };
    } finally {
      setSaving(false);
    }
  }, [values, vendorId]);

  return { mode, setMode, values, errors, loading, saving, roles, submitError, updateField, handleSubmit };
}
