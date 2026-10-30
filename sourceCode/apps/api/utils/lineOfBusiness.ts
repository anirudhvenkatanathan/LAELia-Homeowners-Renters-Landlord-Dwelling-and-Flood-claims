// ─── Line of Business (LOB) mapping ────────────────────────────────────────────
// Service Request Roles are configured per LOB; a claim's LOB is derived from
// its claimType so only rules for that LOB are matched/displayed.
//
// Mirrored in sourceCode/apps/frontEnd/src/utils/lineOfBusiness.ts — keep the
// two (and LINE_OF_BUSINESS_OPTIONS in serviceRequestRoleModel.ts) in sync.

export const LINE_OF_BUSINESS_OPTIONS = ['Homeowners', 'Renters', 'Landlord', 'Dwelling', 'Flood'] as const;

export type LineOfBusiness = typeof LINE_OF_BUSINESS_OPTIONS[number];

/**
 * Maps a claim's claimType to one of the five LOBs. Accepts the LOB name itself
 * ("Homeowners") or the carrier's policy form codes and common wording
 * (HO3/HO5/HO6 → Homeowners, HO4 → Renters, DF3-DL → Landlord, DF1/DF3-DO →
 * Dwelling, SFIP/NFIP → Flood).
 *
 * Returns null when the claimType is empty or unrecognised. There is
 * deliberately no default LOB: an unknown type must be rejected at intake
 * instead of silently picking up another line's rules.
 */
export function mapClaimTypeToLOB(claimType?: string | null): LineOfBusiness | null {
  const t = (claimType ?? '').toLowerCase().trim();
  if (!t) return null;

  const exact = LINE_OF_BUSINESS_OPTIONS.find((lob) => lob.toLowerCase() === t);
  if (exact) return exact;

  // Order matters: "dwelling landlord" must hit Landlord before Dwelling.
  if (/flood|sfip|nfip/.test(t)) return 'Flood';
  if (/renter|^ho-?4$/.test(t)) return 'Renters';
  if (/landlord|rental|^df-?3-?dl$/.test(t)) return 'Landlord';
  if (/dwelling|^df-?1$|^df-?3(-?do)?$/.test(t)) return 'Dwelling';
  if (/home|condo|^ho-?[356]$/.test(t)) return 'Homeowners';
  return null;
}
