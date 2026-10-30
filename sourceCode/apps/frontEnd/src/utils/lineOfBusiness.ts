import { LINE_OF_BUSINESS_OPTIONS } from '../models/ServiceRequestRole/serviceRequestRoleModel';

/**
 * Any claimType that doesn't recognizably match one of the four LOBs defaults
 * to WCM — every pre-LOB claim/rule in the system is WCM, so this keeps
 * existing data and behavior unchanged rather than hiding rules for it.
 * Mirrors sourceCode/apps/api/utils/lineOfBusiness.ts — keep the two in sync.
 */
export function mapClaimTypeToLOB(claimType?: string | null): string {
  const t = (claimType ?? '').toLowerCase().trim();

  const exact = LINE_OF_BUSINESS_OPTIONS.find((lob) => lob.toLowerCase() === t);
  if (exact) return exact;

  if (/general\s*liability|^gl$/.test(t)) return 'General Liability';
  if (/propert/.test(t)) return 'Property';
  if (/auto|vehicle/.test(t)) return 'Auto';
  return 'WCM';
}
