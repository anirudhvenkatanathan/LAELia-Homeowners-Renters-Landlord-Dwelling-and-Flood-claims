import { gql } from '@apollo/client';
import { getApolloClient } from '../../config/apolloClient';
import { logError } from '../../utils/logError';
import type {
  AdjusterUserListResult, AdjusterUserFormValues,
  AdminUserMutationResult, AdminPasswordResetResult, AdminDeleteUserResult,
  UpdateUserAccessResult,
} from '../../models/userManagement/userManagementModel';

// ─── GraphQL Operations ───────────────────────────────────────────────────────

const LIST_ADJUSTER_USERS_QUERY = gql`
  query ListAdjusterUsers($token: String!) {
    listAdjusterUsers(token: $token) {
      success
      message
      count
      users {
        loginId
        fullName
        username
        email
        roleId
        roleName
        status
        isActive
        createdTime
        permissions {
          canAccessServiceProviderRating
          canOverrideService
          canOverrideProvider
          canViewReserveExposure
        }
      }
    }
  }
`;

const ADMIN_UPDATE_USER_MUTATION = gql`
  mutation AdminUpdateUser($token: String!, $loginId: String!, $fullName: String!, $username: String!, $roleName: String!, $status: String!) {
    adminUpdateUser(token: $token, loginId: $loginId, fullName: $fullName, username: $username, roleName: $roleName, status: $status) {
      success
      message
      user {
        loginId
        fullName
        username
        email
        roleId
        roleName
        status
        isActive
        createdTime
      }
    }
  }
`;

const ADMIN_RESET_PASSWORD_MUTATION = gql`
  mutation AdminResetPassword($token: String!, $loginId: String!, $newPassword: String!) {
    adminResetPassword(token: $token, loginId: $loginId, newPassword: $newPassword) {
      success
      message
    }
  }
`;

const ADMIN_DELETE_USER_MUTATION = gql`
  mutation AdminDeleteUser($token: String!, $loginId: String!) {
    adminDeleteUser(token: $token, loginId: $loginId) {
      success
      message
    }
  }
`;

const UPDATE_USER_ACCESS_MUTATION = gql`
  mutation UpdateUserAccess($token: String!, $loginId: String!, $permissions: UserPermissionsInput!) {
    updateUserAccess(token: $token, loginId: $loginId, permissions: $permissions) {
      success
      message
      permissions {
        canAccessServiceProviderRating
        canOverrideService
        canOverrideProvider
        canViewReserveExposure
      }
    }
  }
`;

// ─── Service Functions ────────────────────────────────────────────────────────

export async function listAdjusterUsers(token: string): Promise<AdjusterUserListResult> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ listAdjusterUsers: AdjusterUserListResult }>({
      query: LIST_ADJUSTER_USERS_QUERY,
      variables: { token },
      fetchPolicy: 'no-cache',
    });
    return data?.listAdjusterUsers ?? { success: false, message: 'No response from server.', users: [], count: 0 };
  } catch (err) {
    logError(err, 'userManagementService.listAdjusterUsers');
    return { success: false, message: 'Unable to load users. Please try again.', users: [], count: 0 };
  }
}

export async function adminUpdateUser(token: string, loginId: string, values: AdjusterUserFormValues): Promise<AdminUserMutationResult> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ adminUpdateUser: AdminUserMutationResult }>({
      mutation: ADMIN_UPDATE_USER_MUTATION,
      variables: { token, loginId, ...values },
    });
    return data?.adminUpdateUser ?? { success: false, message: 'No response from server.' };
  } catch (err) {
    logError(err, 'userManagementService.adminUpdateUser');
    return { success: false, message: 'Unable to update user. Please try again.' };
  }
}

export async function adminResetPassword(token: string, loginId: string, newPassword: string): Promise<AdminPasswordResetResult> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ adminResetPassword: AdminPasswordResetResult }>({
      mutation: ADMIN_RESET_PASSWORD_MUTATION,
      variables: { token, loginId, newPassword },
    });
    return data?.adminResetPassword ?? { success: false, message: 'No response from server.' };
  } catch (err) {
    logError(err, 'userManagementService.adminResetPassword');
    return { success: false, message: 'Unable to reset password. Please try again.' };
  }
}

export async function adminDeleteUser(token: string, loginId: string): Promise<AdminDeleteUserResult> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ adminDeleteUser: AdminDeleteUserResult }>({
      mutation: ADMIN_DELETE_USER_MUTATION,
      variables: { token, loginId },
    });
    return data?.adminDeleteUser ?? { success: false, message: 'No response from server.' };
  } catch (err) {
    logError(err, 'userManagementService.adminDeleteUser');
    return { success: false, message: 'Unable to delete user. Please try again.' };
  }
}

export async function updateUserAccess(
  token: string, loginId: string,
  permissions: { canAccessServiceProviderRating: boolean; canOverrideService: boolean; canOverrideProvider: boolean; canViewReserveExposure: boolean },
): Promise<UpdateUserAccessResult> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ updateUserAccess: UpdateUserAccessResult }>({
      mutation: UPDATE_USER_ACCESS_MUTATION,
      variables: { token, loginId, permissions },
    });
    return data?.updateUserAccess ?? { success: false, message: 'No response from server.' };
  } catch (err) {
    logError(err, 'userManagementService.updateUserAccess');
    return { success: false, message: 'Unable to update access permissions. Please try again.' };
  }
}
