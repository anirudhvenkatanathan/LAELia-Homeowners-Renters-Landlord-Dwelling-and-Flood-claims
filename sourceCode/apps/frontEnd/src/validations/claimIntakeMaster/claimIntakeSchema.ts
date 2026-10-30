import { UploadType } from '../../models/claimIntakeMaster/claimIntakeModel';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface ClaimIntakeFormData {
  uploadType: UploadType | null;
  file?: File | null;
  jsonPayload?: string;
  xmlData?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates the Claim Intake upload form data.
 *
 * Rules:
 * - uploadType is required
 * - EXCEL: file required, .xlsx/.xls only, max 10 MB
 * - JSON:  jsonPayload required, must be valid JSON, not empty
 * - XML:   xmlData required, must start with '<' (basic check), not empty
 */
export function validateClaimIntakeForm(data: ClaimIntakeFormData): ValidationResult {
  const errors: Record<string, string> = {};

  // Upload type — always required
  if (!data.uploadType) {
    errors['uploadType'] = 'Upload Type is required. Please select Excel File, JSON Payload, or XML Data.';
  }

  if (data.uploadType === UploadType.EXCEL) {
    if (!data.file) {
      errors['file'] = 'An Excel file is required for the Excel File upload type.';
    } else {
      const name = data.file.name.toLowerCase();
      if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
        errors['file'] = 'Invalid file format. Only .xlsx and .xls files are accepted.';
      } else if (data.file.size > MAX_FILE_SIZE_BYTES) {
        errors['file'] = 'File size exceeds the maximum allowed limit of 10 MB.';
      } else if (data.file.size === 0) {
        errors['file'] = 'The selected file is empty. Please choose a valid Excel file.';
      }
    }
  }

  if (data.uploadType === UploadType.JSON) {
    if (!data.jsonPayload || data.jsonPayload.trim() === '') {
      errors['jsonPayload'] = 'JSON Payload is required for the JSON Payload upload type.';
    } else {
      try {
        const parsed: unknown = JSON.parse(data.jsonPayload);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          errors['jsonPayload'] = 'JSON Payload must be a valid non-null JSON object.';
        }
      } catch {
        errors['jsonPayload'] = 'JSON Payload is not valid JSON. Please check the syntax and try again.';
      }
    }
  }

  if (data.uploadType === UploadType.XML) {
    if (!data.xmlData || data.xmlData.trim() === '') {
      errors['xmlData'] = 'XML Data is required for the XML Data upload type.';
    } else if (!data.xmlData.trim().startsWith('<')) {
      errors['xmlData'] = 'XML Data is not valid XML. Content must begin with a tag element (e.g. <claim>).';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
