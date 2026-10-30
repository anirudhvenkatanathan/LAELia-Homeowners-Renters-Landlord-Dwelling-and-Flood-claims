import * as XLSX from 'xlsx';
import { logError } from './errorLogService';

export interface FieldMappingParseRecord {
  sourceField: string;
  targetField: string;
}

export interface FieldMappingExcelParseResult {
  success: boolean;
  data?: {
    headers: string[];
    /** Populated only when the file contains "Payload Fields" + "Field Mapping" columns */
    mappingRecords: FieldMappingParseRecord[];
    rawData: Record<string, unknown>[];
  };
  validationResult: string;
  message: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function validateExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.xls');
}

function normaliseForMatch(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Parses an Excel buffer for Field Mapping uploads.
 * Accepts any .xlsx / .xls file — no specific column names are required.
 * When "Payload Fields" and "Field Mapping" columns are detected, mapping
 * records are extracted and returned for auto-seeding configurations.
 */
export async function parseFieldMappingExcel(
  buffer: Buffer,
  fileName: string
): Promise<FieldMappingExcelParseResult> {
  try {
    if (!validateExtension(fileName)) {
      return {
        success: false,
        validationResult: 'FM-001',
        message: `Invalid file format. Only .xlsx and .xls files are accepted. Received: ${fileName}`,
      };
    }

    if (buffer.length === 0) {
      return {
        success: false,
        validationResult: 'FM-002',
        message: 'The uploaded file is empty.',
      };
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        validationResult: 'FM-002',
        message: 'File size exceeds the maximum allowed limit of 10 MB.',
      };
    }

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return {
        success: false,
        validationResult: 'FM-002',
        message: 'The Excel workbook contains no sheets.',
      };
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (rawRows.length === 0) {
      return {
        success: false,
        validationResult: 'FM-002',
        message: 'The Excel sheet contains no data rows.',
      };
    }

    const headers = Object.keys(rawRows[0] ?? {});

    // Detect standard template columns — used for optional auto-seeding only
    const payloadHeader  = headers.find(h => normaliseForMatch(h) === 'payloadfields');
    const mappingHeader  = headers.find(h => normaliseForMatch(h) === 'fieldmapping');

    const mappingRecords: FieldMappingParseRecord[] =
      payloadHeader && mappingHeader
        ? rawRows
            .filter(row => String(row[payloadHeader] ?? '').trim() !== '')
            .map(row => ({
              sourceField: String(row[payloadHeader] ?? '').trim(),
              targetField: String(row[mappingHeader]  ?? '').trim(),
            }))
        : [];

    return {
      success: true,
      validationResult: 'PASS',
      message: `Successfully parsed ${rawRows.length} row(s) from ${fileName}.`,
      data: {
        headers,
        mappingRecords,
        rawData: rawRows as Record<string, unknown>[],
      },
    };
  } catch (err) {
    await logError(err as Error, 'fieldMappingExcelParserService.parseFieldMappingExcel');
    return {
      success: false,
      validationResult: 'FM-008',
      message: 'An unexpected error occurred while parsing the Excel file.',
    };
  }
}
