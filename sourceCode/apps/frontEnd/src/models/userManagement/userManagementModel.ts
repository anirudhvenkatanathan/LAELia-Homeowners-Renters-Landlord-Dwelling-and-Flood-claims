import type { UserPermissions } from '../../utils/permissions';

export interface AdjusterUser {
  loginId:     string;
  fullName:    string;
  username:    string;
  email:       string;
  roleId:      string;
  roleName:    string;
  status:      string;   // 'Active' | 'Inactive'
  isActive:    boolean;
  createdTime: string;
  permissions?: UserPermissions | null;
}

export interface AdjusterUserFormValues {
  fullName: string;
  username: string;
  roleName: 'Senior Adjuster' | 'Junior Adjuster';
  status:   'Active' | 'Inactive';
}

export const ASSIGNABLE_ROLES = ['Senior Adjuster', 'Junior Adjuster'] as const;

export interface AdjusterUserListResult {
  success: boolean;
  message: string;
  users:   AdjusterUser[];
  count:   number;
}

export interface AdminUserMutationResult {
  success: boolean;
  message: string;
  user?:   AdjusterUser;
}

export interface AdminPasswordResetResult {
  success: boolean;
  message: string;
}

export interface AdminDeleteUserResult {
  success: boolean;
  message: string;
}

export interface UpdateUserAccessResult {
  success:     boolean;
  message:     string;
  permissions?: UserPermissions | null;
}

// Local to this feature (mirrors the per-screen statusBadgeClass()/resolveStatusBadge()
// convention already used elsewhere, e.g. pages/Vendor/VendorSearch/index.tsx) —
// reuses the shared .badge/.badge-green/.badge-red classes already in main.css.
export function statusBadgeClass(status: string): string {
  return status === 'Active' ? 'badge badge-green' : 'badge badge-red';
}
