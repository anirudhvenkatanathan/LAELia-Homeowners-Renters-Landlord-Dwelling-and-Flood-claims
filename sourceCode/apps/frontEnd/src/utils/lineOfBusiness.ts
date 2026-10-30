import { LINE_OF_BUSINESS_OPTIONS } from '../models/ServiceRequestRole/serviceRequestRoleModel';

/**
 * Maps a claim's claimType to one of the five LOBs (Homeowners, Renters,
 * Landlord, Dwelling, Flood). Accepts the LOB name or the carrier's policy form
 * codes (HO3/HO5/HO6 → Homeowners, HO4 → Renters, DF3-DL → Landlord,
 * DF1/DF3-DO → Dwelling, SFIP/NFIP → Flood).
 *
 * Returns null for an empty or unrecognised claimType — there is deliberately
 * no default LOB. Mirrors sourceCode/apps/api/utils/lineOfBusiness.ts — keep
 * the two in sync.
 */
export function mapClaimTypeToLOB(claimType?: string | null): string | null {
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
