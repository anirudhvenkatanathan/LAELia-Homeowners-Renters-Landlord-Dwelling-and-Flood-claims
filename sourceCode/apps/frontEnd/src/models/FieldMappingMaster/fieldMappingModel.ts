// ─── Field Mapping Domain Models ──────────────────────────────────────────────

export interface UploadedFileRow {
  uploadId:     string;
  fileName:     string;
  uploadType:   string;
  totalRecords: number;
  uploadedBy:   string;
  uploadDate:   string;
  status:       string;
}

export interface FieldMappingRecord {
  recordIndex: number;
  recordData:  string; // JSON string of the row object
}

export interface MappingConfiguration {
  mappingId:   string;
  uploadId:    string;
  sourceField: string;
  targetField: string;
  dataType:    string;
  isMandatory: boolean;
  sortOrder:   number;
}

export interface FieldMappingDetails {
  uploadId:     string;
  fileName:     string;
  uploadType:   string;
  totalRecords: number;
  uploadedBy:   string;
  uploadDate:   string;
  status:       string;
  headers:      string; // JSON array string
  records:      FieldMappingRecord[];
  mappings:     MappingConfiguration[];
}

export interface UploadFieldMappingInput {
  excelBase64: string;
  fileName?:   string;
  uploadedBy?: string;
}

export interface UploadFieldMappingResponse {
  uploadId:     string;
  totalRecords: number;
  status:       string;
  message:      string;
  success:      boolean;
}

export interface MappingInput {
  mappingId?:  string;
  sourceField: string;
  targetField: string;
  dataType:    string;
  isMandatory: boolean;
  sortOrder:   number;
}

export interface SaveMappingResponse {
  success:    boolean;
  message:    string;
  savedCount: number;
}

export interface DownloadTemplateResponse {
  success:  boolean;
  base64:   string | null;
  fileName: string | null;
  message:  string;
}

// ─── Shared helpers (belong in model, not in screen folder) ───────────────────

export type StatusBadgeVariant = 'badge-green' | 'badge-yellow' | 'badge-red' | 'badge-gray';

export function resolveStatusBadge(status: string): StatusBadgeVariant {
  const s = status?.toLowerCase() ?? '';
  if (s === 'processed' || s === 'success')     return 'badge-green';
  if (s === 'pending'   || s === 'processing')  return 'badge-yellow';
  if (s === 'failed'    || s === 'error')       return 'badge-red';
  return 'badge-gray';
}

export const DATA_TYPE_OPTIONS = ['String', 'Number', 'Date', 'Boolean', 'Currency'] as const;
export type DataTypeOption = typeof DATA_TYPE_OPTIONS[number];
