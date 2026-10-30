import type { MappingConfiguration } from '../../models/FieldMappingMaster/fieldMappingModel';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Upload Validation ────────────────────────────────────────────────────────

export interface UploadValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates a file selected for Field Mapping upload.
 * Rules:
 *  - File must be provided
 *  - Must be .xlsx or .xls
 *  - Must not exceed 10 MB
 *  - Must not be empty (0 bytes)
 */
export function validateUpload(file: File | null): UploadValidationResult {
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
    errors['file'] = 'Only .xlsx and .xls files are accepted for Field Mapping upload.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ─── Mapping Row Validation ───────────────────────────────────────────────────

export interface MappingRowValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates a single mapping configuration row.
 * Rules:
 *  - sourceField is required
 *  - targetField is required
 *  - sourceField must be unique among existing confirmed mappings
 *    (excluding the current row being validated, identified by mappingId)
 */
export function validateMappingRow(
  row: Partial<MappingConfiguration>,
  existingMappings: MappingConfiguration[]
): MappingRowValidationResult {
  const errors: Record<string, string> = {};

  if (!row.sourceField?.trim()) {
    errors['sourceField'] = 'Source field is required.';
  }

  if (!row.targetField?.trim()) {
    errors['targetField'] = 'Target field is required.';
  }

  // Duplicate check — exclude the current row
  if (row.sourceField?.trim()) {
    const duplicate = existingMappings.some(
      (m) =>
        m.mappingId !== row.mappingId &&
        m.sourceField.trim().toLowerCase() === row.sourceField!.trim().toLowerCase()
    );
    if (duplicate) {
      errors['sourceField'] = `Source field "${row.sourceField}" is already mapped.`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
