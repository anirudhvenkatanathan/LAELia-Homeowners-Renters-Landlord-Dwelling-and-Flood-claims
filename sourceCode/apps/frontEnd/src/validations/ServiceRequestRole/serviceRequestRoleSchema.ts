import type { ServiceRequestRole, RoleCondition } from '../../models/ServiceRequestRole/serviceRequestRoleModel';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface ValidationResult {
  valid:  boolean;
  errors: Record<string, string>;
}

export function validateUpload(file: File | null): ValidationResult {
  const errors: Record<string, string> = {};
  if (!file) {
    errors['file'] = 'Please choose a file to upload.';
    return { valid: false, errors };
  }
  const name = file.name.toLowerCase();
  if (file.size === 0) {
    errors['file'] = 'The selected file is empty.';
  } else if (file.size > MAX_FILE_SIZE_BYTES) {
    errors['file'] = 'File size must not exceed 10 MB.';
  } else if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    errors['file'] = 'Only .xlsx and .xls files are accepted.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateRole(
  row: Partial<ServiceRequestRole>,
  existing: ServiceRequestRole[]
): ValidationResult {
  const errors: Record<string, string> = {};
  if (!row.roleName?.trim()) {
    errors['roleName'] = 'Role Name is required.';
  } else {
    const dup = existing.some(
      (r) => r.roleId !== row.roleId &&
             r.roleName.trim().toLowerCase() === row.roleName!.trim().toLowerCase()
    );
    if (dup) errors['roleName'] = `Role "${row.roleName}" already exists.`;
  }
  if (!row.description?.trim()) {
    errors['description'] = 'Description is required.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateCondition(
  row: Partial<RoleCondition>,
  existing: RoleCondition[]
): ValidationResult {
  const errors: Record<string, string> = {};
  if (!row.fieldName?.trim()) errors['fieldName'] = 'Field is required.';
  if (!row.operator?.trim())  errors['operator']  = 'Operator is required.';
  if (!row.value?.trim())     errors['value']      = 'Value is required.';

  if (row.fieldName && row.operator && row.value) {
    const dup = existing.some(
      (c) => c.conditionId !== row.conditionId &&
             c.fieldName.trim().toLowerCase() === row.fieldName!.trim().toLowerCase() &&
             c.operator   === row.operator &&
             c.value.trim().toLowerCase() === row.value!.trim().toLowerCase()
    );
    if (dup) errors['fieldName'] = 'This condition already exists.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
