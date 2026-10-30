// Re-export all shared model types so the screen can import from a single local path.
export {
  UploadType,
} from '../../../models/claimIntakeMaster/claimIntakeModel';

export type {
  UploadedClaimsGridRow,
  UploadedClaimDetails,
  IndividualClaimRecord,
  UploadClaimInput,
  UploadClaimResponse,
} from '../../../models/claimIntakeMaster/claimIntakeModel';

// ─── Screen-specific local types ──────────────────────────────────────────────

/** Upload type radio option display label + value. */
export interface UploadTypeOption {
  value: string;
  label: string;
}

export const UPLOAD_TYPE_OPTIONS: UploadTypeOption[] = [
  { value: 'EXCEL', label: 'Excel File' },
  { value: 'JSON',  label: 'JSON Payload' },
  { value: 'XML',   label: 'XML Data' },
];

/** Status badge colour mapping for the grid cell renderer. */
export type StatusBadgeVariant = 'badge-green' | 'badge-yellow' | 'badge-red' | 'badge-gray';

export function resolveStatusBadge(status: string): StatusBadgeVariant {
  const s = status?.toLowerCase() ?? '';
  if (s === 'processed' || s === 'success') return 'badge-green';
  if (s === 'pending' || s === 'processing') return 'badge-yellow';
  if (s === 'failed' || s === 'error') return 'badge-red';
  return 'badge-gray';
}
