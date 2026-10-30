import { logError } from './errorLogService';

export interface ParsedJsonClaim {
  claimNumber: string;
  policyNumber: string;
  insuredName: string;
  lossDate: string;
  reportedDate: string;
  claimType: string;
  raw: Record<string, unknown>;
}

export interface JsonValidationResult {
  success: boolean;
  data?: ParsedJsonClaim;
  validationResult: string;
  message: string;
}

const REQUIRED_FIELDS = [
  'claimNumber',
  'policyNumber',
  'insuredName',
  'lossDate',
  'reportedDate',
  'claimType',
];

/**
 * Validates a JSON string and extracts structured claim data.
 */
export async function validateJsonPayload(
  jsonString: string
): Promise<JsonValidationResult> {
  try {
    // Empty check (CI-002)
    if (!jsonString || jsonString.trim() === '') {
      return {
        success: false,
        validationResult: 'CI-002',
        message: 'JSON payload cannot be empty.',
      };
    }

    // Parse check (CI-004)
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonString) as Record<string, unknown>;
    } catch {
      return {
        success: false,
        validationResult: 'CI-004',
        message: 'The provided JSON payload is not valid JSON.',
      };
    }

    // Empty object check (CI-002)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        success: false,
        validationResult: 'CI-004',
        message: 'JSON payload must be a non-null object.',
      };
    }

    // Required fields check (CI-006)
    const missing = REQUIRED_FIELDS.filter((f) => !(f in parsed) || parsed[f] === '' || parsed[f] === null);

    if (missing.length > 0) {
      return {
        success: false,
        validationResult: 'CI-006',
        message: `Missing required claim fields: ${missing.join(', ')}`,
      };
    }

    return {
      success: true,
      validationResult: 'PASS',
      message: 'JSON payload is valid.',
      data: {
        claimNumber:  String(parsed['claimNumber'] ?? ''),
        policyNumber: String(parsed['policyNumber'] ?? ''),
        insuredName:  String(parsed['insuredName'] ?? ''),
        lossDate:     String(parsed['lossDate'] ?? ''),
        reportedDate: String(parsed['reportedDate'] ?? ''),
        claimType:    String(parsed['claimType'] ?? ''),
        raw:          parsed,
      },
    };
  } catch (err) {
    await logError(err as Error, 'jsonValidatorService.validateJsonPayload');
    return {
      success: false,
      validationResult: 'CI-008',
      message: 'An unexpected error occurred while validating the JSON payload.',
    };
  }
}
