import * as XLSX from 'xlsx';
import { logError } from './errorLogService';

export interface ParsedRole {
  roleName:    string;
  description: string;
  status:      string;
}

export interface ServiceRequestRoleParseResult {
  success: boolean;
  data?: {
    headers: string[];
    roles:   ParsedRole[];
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

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Parses an Excel buffer for Service Request Role uploads.
 * Accepts any .xlsx / .xls file. When "Role Name", "Description",
 * and "Status" columns are detected, roles are extracted automatically.
 */
export async function parseServiceRequestRoleExcel(
  buffer: Buffer,
  fileName: string
): Promise<ServiceRequestRoleParseResult> {
  try {
    if (!validateExtension(fileName)) {
      return { success: false, validationResult: 'SRR-001', message: `Invalid file format. Only .xlsx and .xls files are accepted. Received: ${fileName}` };
    }
    if (buffer.length === 0) {
      return { success: false, validationResult: 'SRR-002', message: 'The uploaded file is empty.' };
    }
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return { success: false, validationResult: 'SRR-002', message: 'File size exceeds 10 MB.' };
    }

    const workbook  = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, validationResult: 'SRR-002', message: 'The Excel workbook contains no sheets.' };
    }

    const sheet   = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (rawRows.length === 0) {
      return { success: false, validationResult: 'SRR-002', message: 'The Excel sheet contains no data rows.' };
    }

    const headers     = Object.keys(rawRows[0] ?? {});
    const roleNameH   = headers.find(h => norm(h) === 'rolename');
    const descriptionH = headers.find(h => norm(h) === 'description');
    const statusH     = headers.find(h => norm(h) === 'status');

    const roles: ParsedRole[] = roleNameH
      ? rawRows
          .filter(row => String(row[roleNameH] ?? '').trim() !== '')
          .map(row => ({
            roleName:    String(row[roleNameH]     ?? '').trim(),
            description: String(row[descriptionH!] ?? '').trim(),
            status:      String(row[statusH!]      ?? 'Active').trim() || 'Active',
          }))
      : [];

    if (roles.length === 0) {
      return { success: false, validationResult: 'SRR-002', message: 'No valid role rows found. Ensure the file has a "Role Name" column.' };
    }

    return {
      success: true,
      validationResult: 'PASS',
      message: `Successfully parsed ${roles.length} role(s) from ${fileName}.`,
      data: { headers, roles, rawData: rawRows as Record<string, unknown>[] },
    };
  } catch (err) {
    await logError(err as Error, 'serviceRequestRoleService.parseServiceRequestRoleExcel');
    return { success: false, validationResult: 'SRR-002', message: 'An unexpected error occurred while parsing the file.' };
  }
}
