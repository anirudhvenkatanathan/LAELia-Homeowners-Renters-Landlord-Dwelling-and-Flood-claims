export interface UserPermissions {
  canAccessServiceProviderRating?: boolean | null;
  canOverrideService?:             boolean | null;
  canOverrideProvider?:            boolean | null;
  canViewReserveExposure?:         boolean | null;
}

// Mirrors ADJUSTER_ROLE_NAMES in apps/api/graphQL/loginEntity.ts. Frontend and
// backend don't share a module, so this is intentionally duplicated — keep
// both in sync if adjuster-type roles ever change.
export const ADJUSTER_ROLE_NAMES = ['Claims Adjuster', 'Senior Adjuster', 'Junior Adjuster'] as const;

export function isAdjusterTypeRole(roleName?: string | null): boolean {
  return !!roleName && (ADJUSTER_ROLE_NAMES as readonly string[]).includes(roleName);
}

// Reproduces today's exact behavior (roleName === 'Claims Adjuster'),
// generalized to all 3 adjuster-type roles and made permission-aware: hidden
// by default for adjuster-type roles unless explicitly granted; never gated
// for any other role.
export function resolveHideVendorRating(
  roleName: string | undefined | null,
  permissions: UserPermissions | undefined | null,
): boolean {
  return isAdjusterTypeRole(roleName) && !(permissions?.canAccessServiceProviderRating ?? false);
}

// Override Service / Override Provider are unrestricted for every user today
// — missing/undefined permission preserves that (defaults to true, for every
// role) until a Supervisor explicitly disables it for a specific
// adjuster-type user via Edit Access.
export function resolveCanOverrideService(permissions: UserPermissions | undefined | null): boolean {
  return permissions?.canOverrideService ?? true;
}

export function resolveCanOverrideProvider(permissions: UserPermissions | undefined | null): boolean {
  return permissions?.canOverrideProvider ?? true;
}
