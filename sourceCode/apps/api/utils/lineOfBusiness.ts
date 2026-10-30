// ─── Line of Business (LOB) mapping ────────────────────────────────────────────
// Service Request Roles are configured per LOB; a claim's LOB is derived from
// its claimType so only rules for that LOB are matched/displayed.

export const LINE_OF_BUSINESS_OPTIONS = ['WCM', 'Auto', 'General Liability', 'Property'] as const;

export type LineOfBusiness = typeof LINE_OF_BUSINESS_OPTIONS[number];

/**
 * Any claimType that doesn't recognizably match one of the four LOBs defaults
 * to WCM — every pre-LOB claim/rule in the system is WCM, so this keeps
 * existing data and behavior unchanged rather than hiding rules for it.
 */
export function mapClaimTypeToLOB(claimType?: string | null): LineOfBusiness {
  const t = (claimType ?? '').toLowerCase().trim();

  const exact = LINE_OF_BUSINESS_OPTIONS.find((lob) => lob.toLowerCase() === t);
  if (exact) return exact;

  if (/general\s*liability|^gl$/.test(t)) return 'General Liability';
  if (/propert/.test(t)) return 'Property';
  if (/auto|vehicle/.test(t)) return 'Auto';
  return 'WCM';
}
