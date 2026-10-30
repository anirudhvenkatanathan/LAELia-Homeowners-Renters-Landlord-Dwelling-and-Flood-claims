import { gql } from '@apollo/client';
import { getApolloClient } from '../../config/apolloClient';
import { logError } from '../../utils/logError';
import type { UpdateProfileResult, ChangePasswordResult } from '../../models/accountSettings/accountSettingsModel';

// ─── GraphQL Operations ───────────────────────────────────────────────────────

const UPDATE_PROFILE_MUTATION = gql`
  mutation UpdateProfile($token: String!, $username: String!) {
    updateProfile(token: $token, username: $username) {
      success
      message
      username
    }
  }
`;

const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($token: String!, $currentPassword: String!, $newPassword: String!) {
    changePassword(token: $token, currentPassword: $currentPassword, newPassword: $newPassword) {
      success
      message
    }
  }
`;

// ─── Service Functions ────────────────────────────────────────────────────────

export async function updateProfile(token: string, username: string): Promise<UpdateProfileResult> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ updateProfile: UpdateProfileResult }>({
      mutation: UPDATE_PROFILE_MUTATION,
      variables: { token, username },
    });
    return data?.updateProfile ?? { success: false, message: 'No response from server.' };
  } catch (err) {
    logError(err, 'accountSettingsService.updateProfile');
    return { success: false, message: 'Unable to update profile. Please try again.' };
  }
}

export async function changePassword(token: string, currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ changePassword: ChangePasswordResult }>({
      mutation: CHANGE_PASSWORD_MUTATION,
      variables: { token, currentPassword, newPassword },
    });
    return data?.changePassword ?? { success: false, message: 'No response from server.' };
  } catch (err) {
    logError(err, 'accountSettingsService.changePassword');
    return { success: false, message: 'Unable to change password. Please try again.' };
  }
}
