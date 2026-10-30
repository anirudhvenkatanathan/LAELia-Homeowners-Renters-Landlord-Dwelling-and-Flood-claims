import { useState, useEffect, useCallback } from 'react';
import {
  EMPTY_FORM,
  type VendorSelectionLogic,
  type VendorSelectionLogicFormValues,
  type FormMode,
} from '../../models/vendorSelectionLogic/vendorSelectionLogicModel';
import {
  getVendorSelectionLogicDetails,
  createVendorSelectionLogic,
  updateVendorSelectionLogic,
} from '../../services/vendorSelectionLogic/vendorSelectionLogicService';

type FormErrors = Partial<Record<keyof VendorSelectionLogicFormValues, string>>;

function validate(values: VendorSelectionLogicFormValues): FormErrors {
  const errs: FormErrors = {};
  if (!values.name.trim())        errs.name        = 'Logic name is required.';
  else if (values.name.trim().length > 80) errs.name = 'Logic name must be 80 characters or fewer.';
  if (!values.category.trim())    errs.category    = 'Category is required.';
  if (!values.description.trim()) errs.description = 'Description is required.';
  else if (values.description.trim().length < 10) errs.description = 'Description must be at least 10 characters.';
  else if (values.description.trim().length > 500) errs.description = 'Description must be 500 characters or fewer.';
  if (!values.conditions.trim())  errs.conditions  = 'Conditions are required.';
  return errs;
}

export function useVendorSelectionLogicForm(ruleId: string | null, initialMode: FormMode) {
  const [mode, setMode]         = useState<FormMode>(initialMode);
  const [values, setValues]     = useState<VendorSelectionLogicFormValues>(EMPTY_FORM);
  const [detail, setDetail]     = useState<VendorSelectionLogic | null>(null);
  const [errors, setErrors]     = useState<FormErrors>({});
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!ruleId) return;
    setLoading(true);
    getVendorSelectionLogicDetails(ruleId)
      .then((data) => {
        if (data) {
          setDetail(data);
          setValues({
            name:        data.name,
            category:    data.category,
            description: data.description,
            status:      data.status,
            conditions:  data.conditions,
          });
        }
      })
      .catch(() => setSubmitError('Failed to load logic details.'))
      .finally(() => setLoading(false));
  }, [ruleId]);

  const updateField = useCallback(
    (field: keyof VendorSelectionLogicFormValues, value: string) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    []
  );

  const handleSubmit = useCallback(async (): Promise<{ success: boolean; ruleId?: string }> => {
    const errs = validate(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return { success: false };
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const result = ruleId
        ? await updateVendorSelectionLogic(ruleId, values)
        : await createVendorSelectionLogic(values);
      if (!result.success) {
        setSubmitError(result.message);
        return { success: false };
      }
      return { success: true, ruleId: result.ruleId ?? ruleId ?? undefined };
    } catch {
      setSubmitError('Could not save changes. Retry.');
      return { success: false };
    } finally {
      setSaving(false);
    }
  }, [ruleId, values]);

  return { mode, setMode, values, detail, errors, loading, saving, submitError, updateField, handleSubmit };
}
