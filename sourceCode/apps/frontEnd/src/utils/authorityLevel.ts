// RBAC — Authority Level calculation for adjuster-type accounts.
//
// Derived solely from the two "override" access permissions (Access to
// updating Service Provider / Access to updating Services). Service Provider
// Rating Visibility and View Reserve/Financial Exposure are independent
// Supervisor decisions and must never factor into this calculation.

export type AuthorityLevel =
  | 'Adjuster – Review Required'
  | 'Adjuster – Limited Authority'
  | 'Adjuster – Independent Authority';

export function calculateAuthorityLevel(
  canOverrideProvider: boolean,
  canOverrideService: boolean,
): AuthorityLevel {
  if (canOverrideProvider && canOverrideService) return 'Adjuster – Independent Authority';
  if (!canOverrideProvider && !canOverrideService) return 'Adjuster – Review Required';
  return 'Adjuster – Limited Authority';
}
