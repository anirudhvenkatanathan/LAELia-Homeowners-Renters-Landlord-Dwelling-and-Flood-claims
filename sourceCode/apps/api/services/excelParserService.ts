import * as XLSX from 'xlsx';
import { logError } from './errorLogService';

export interface ParsedClaimData {
  claimNumber: string;
  policyNumber: string;
  insuredName: string;
  lossDate: string;
  reportedDate: string;
  claimType: string;
  rawData: Record<string, unknown>[];
}

export interface ExcelParseResult {
  success: boolean;
  data?: ParsedClaimData;
  validationResult: string;
  message: string;
}

const REQUIRED_COLUMNS = [
  'claimNumber',
  'policyNumber',
  'insuredName',
  'lossDate',
  'reportedDate',
  'claimType',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Validates the file extension is .xlsx or .xls.
 */
function validateExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.xls');
}

/**
 * Normalises column header keys to camelCase for comparison.
 * "Claim Number" → "claimNumber", "CLAIM NUMBER" → "claimNumber", "claim_type" → "claimType".
 */
function normaliseHeader(raw: string): string {
  const t = raw.trim();
  // Has word separators — phrase format: lowercase everything first, then camelCase
  if (/[\s_-]/.test(t)) {
    return t.toLowerCase().replace(/[\s_-]+(.)/g, (_, c: string) => c.toUpperCase());
  }
  // All uppercase with no separators (e.g. "CLAIMTYPE") — lowercase for pick() to find via k.toLowerCase()
  if (t === t.toUpperCase() && /[A-Z]/.test(t)) return t.toLowerCase();
  // PascalCase (e.g. "ClaimNumber") → camelCase
  return t.replace(/^[A-Z]/, (c) => c.toLowerCase());
}

/**
 * Parses an Excel buffer and returns structured claim data.
 */
export async function parseExcelFile(
  buffer: Buffer,
  fileName: string
): Promise<ExcelParseResult> {
  try {
    // Extension check (CI-001)
    if (!validateExtension(fileName)) {
      return {
        success: false,
        validationResult: 'CI-001',
        message: `Invalid file format. Only .xlsx and .xls files are accepted. Received: ${fileName}`,
      };
    }

    // File size check
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        validationResult: 'CI-002',
        message: `File size exceeds the maximum allowed limit of 10 MB.`,
      };
    }

    // Empty file check (CI-002)
    if (buffer.length === 0) {
      return {
        success: false,
        validationResult: 'CI-002',
        message: 'The uploaded file is empty.',
      };
    }

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return {
        success: false,
        validationResult: 'CI-002',
        message: 'The Excel workbook contains no sheets.',
      };
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
    });

    if (rawRows.length === 0) {
      return {
        success: false,
        validationResult: 'CI-002',
        message: 'The Excel sheet contains no data rows.',
      };
    }

    // Normalise column keys
    const normalisedRows = rawRows.map((row) => {
      const normRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        normRow[normaliseHeader(key)] = value;
      }
      return normRow;
    });

    // Required columns check (CI-003) — case-insensitive to handle all-caps headers
    const firstRow = normalisedRows[0] ?? {};
    const firstRowKeysLower = new Set(Object.keys(firstRow).map((k) => k.toLowerCase()));
    const missingColumns = REQUIRED_COLUMNS.filter((col) => !firstRowKeysLower.has(col.toLowerCase()));

    if (missingColumns.length > 0) {
      return {
        success: false,
        validationResult: 'CI-003',
        message: `Missing required columns: ${missingColumns.join(', ')}`,
      };
    }

    // Extract first row claim data
    const first = normalisedRows[0] as Record<string, string>;

    return {
      success: true,
      validationResult: 'PASS',
      message: `Successfully parsed ${normalisedRows.length} row(s) from ${fileName}.`,
      data: {
        claimNumber:  String(first['claimNumber'] ?? ''),
        policyNumber: String(first['policyNumber'] ?? ''),
        insuredName:  String(first['insuredName'] ?? ''),
        lossDate:     String(first['lossDate'] ?? ''),
        reportedDate: String(first['reportedDate'] ?? ''),
        claimType:    String(first['claimType'] ?? ''),
        rawData:      normalisedRows,
      },
    };
  } catch (err) {
    await logError(err as Error, 'excelParserService.parseExcelFile');
    return {
      success: false,
      validationResult: 'CI-008',
      message: 'An unexpected error occurred while parsing the Excel file.',
    };
  }
}
