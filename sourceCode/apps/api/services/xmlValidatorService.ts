import { parseStringPromise } from 'xml2js';
import { logError } from './errorLogService';

export interface ParsedXmlClaim {
  claimNumber: string;
  policyNumber: string;
  insuredName: string;
  lossDate: string;
  reportedDate: string;
  claimType: string;
  raw: Record<string, unknown>;
}

export interface XmlValidationResult {
  success: boolean;
  data?: ParsedXmlClaim;
  validationResult: string;
  message: string;
}

/**
 * Safely extracts the first text value from an xml2js parsed node.
 * xml2js wraps values in arrays by default.
 */
function extractText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return String(node[0] ?? '');
  return '';
}

/**
 * Validates XML string structure and extracts claim data using xml2js.
 */
export async function validateXmlPayload(
  xmlString: string
): Promise<XmlValidationResult> {
  try {
    // Empty check (CI-002)
    if (!xmlString || xmlString.trim() === '') {
      return {
        success: false,
        validationResult: 'CI-002',
        message: 'XML payload cannot be empty.',
      };
    }

    // Basic well-formedness pre-check (CI-005)
    if (!xmlString.trim().startsWith('<')) {
      return {
        success: false,
        validationResult: 'CI-005',
        message: 'Invalid XML: content must begin with a tag element.',
      };
    }

    // Full parse via xml2js (CI-005)
    let parsed: Record<string, unknown>;
    try {
      parsed = await parseStringPromise(xmlString, {
        trim: true,
        explicitArray: true,
      }) as Record<string, unknown>;
    } catch (parseErr) {
      return {
        success: false,
        validationResult: 'CI-005',
        message: `Invalid XML structure: ${(parseErr as Error).message}`,
      };
    }

    // Attempt to extract claim data from known root node patterns
    // Supports <claim>...</claim> or <ClaimIntake>...</ClaimIntake> root
    const rootKey = Object.keys(parsed)[0] ?? '';
    const root = parsed[rootKey] as Record<string, unknown> ?? {};

    const claimNumber  = extractText(root['claimNumber'] ?? root['ClaimNumber']);
    const policyNumber = extractText(root['policyNumber'] ?? root['PolicyNumber']);
    const insuredName  = extractText(root['insuredName'] ?? root['InsuredName']);
    const lossDate     = extractText(root['lossDate'] ?? root['LossDate']);
    const reportedDate = extractText(root['reportedDate'] ?? root['ReportedDate']);
    const claimType    = extractText(root['claimType'] ?? root['ClaimType']);

    return {
      success: true,
      validationResult: 'PASS',
      message: 'XML payload is valid and claim data extracted.',
      data: {
        claimNumber,
        policyNumber,
        insuredName,
        lossDate,
        reportedDate,
        claimType,
        raw: parsed,
      },
    };
  } catch (err) {
    await logError(err as Error, 'xmlValidatorService.validateXmlPayload');
    return {
      success: false,
      validationResult: 'CI-008',
      message: 'An unexpected error occurred while validating the XML payload.',
    };
  }
}
