import React, { createContext, useContext, useState, useCallback } from 'react';
import { getApolloClient } from '../config/apolloClient';
import { gql } from '@apollo/client';
import { ADJUSTER_ROLE_NAMES } from '../utils/permissions';
import type { UserPermissions } from '../utils/permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthUser {
  loginId:      string;
  username:     string;
  fullName?:    string;
  email:        string;
  roleId:       string;
  roleName:     string;
  menuIds:      string[];
  vendorId?:      string;
  vendorStatus?:  string;
  companyName?:   string;
  permissions?:   UserPermissions;
}

interface AuthContextValue {
  user:            AuthUser | null;
  token:           string | null;
  isAuthenticated: boolean;
  login:           (identifier: string, password: string) => Promise<{ success: boolean; message: string; vendorId?: string; vendorStatus?: string }>;
  logout:          () => void;
  // Patches the in-memory user + localStorage in place (e.g. after an Account
  // Settings profile save) — does not re-fetch or touch the session token.
  updateUser:      (patch: Partial<AuthUser>) => void;
  // Dev/demo-only shortcut — bootstraps a session for an already-known Active
  // Service Provider without a password. Does not call the login mutation and
  // never touches the real credential flow above. See /dev/service-provider.
  loginAsServiceProvider: (vendor: { vendorId: string; companyName?: string; email?: string }) => void;
}

// ─── GraphQL ──────────────────────────────────────────────────────────────────

const LOGIN_MUTATION = gql`
  mutation Login($identifier: String!, $password: String!) {
    login(identifier: $identifier, password: $password) {
      success message token loginId username fullName email roleId roleName menuIds
    }
  }
`;

const GET_VENDOR_PROFILE = gql`
  query GetVendorProfile($token: String!) {
    getVendorProfile(token: $token) {
      vendorId
      vendorStatus
      companyName
    }
  }
`;

const GET_USER_PERMISSIONS = gql`
  query GetUserPermissions($token: String!) {
    getUserPermissions(token: $token) {
      canAccessServiceProviderRating
      canOverrideService
      canOverrideProvider
      canViewReserveExposure
    }
  }
`;

// ─── Storage keys ─────────────────────────────────────────────────────────────

const TOKEN_KEY = 'ct_auth_token';
const USER_KEY  = 'ct_auth_user';

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null, token: null, isAuthenticated: false,
  login: async () => ({ success: false, message: '' }),
  logout: () => {},
  updateUser: () => {},
  loginAsServiceProvider: () => {},
});

export const useAuth = () => useContext(AuthContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  });
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch { return null; }
  });

  const login = useCallback(async (identifier: string, password: string) => {
    try {
      const client = getApolloClient();
      const result = await client.mutate<{ login: {
        success: boolean; message: string; token: string;
        loginId: string; username: string; fullName?: string; email: string;
        roleId: string; roleName: string; menuIds: string[];
      }}>({
        mutation: LOGIN_MUTATION,
        variables: { identifier, password },
      });

      const data = result.data?.login;
      if (!data?.success || !data.token) {
        return { success: false, message: data?.message ?? 'Login failed.' };
      }

      const authUser: AuthUser = {
        loginId:  data.loginId,
        username: data.username,
        fullName: data.fullName || undefined,
        email:    data.email,
        roleId:   data.roleId,
        roleName: data.roleName,
        menuIds:  data.menuIds ?? [],
      };

      // For Vendor Users, look up their vendor record to get the vendorId
      let vendorId: string | undefined;
      if (data.roleName === 'Vendor User') {
        try {
          const profileResult = await client.query<{ getVendorProfile: { vendorId: string; vendorStatus: string; companyName?: string } | null }>({
            query: GET_VENDOR_PROFILE,
            variables: { token: data.token },
            fetchPolicy: 'no-cache',
          });
          vendorId = profileResult.data?.getVendorProfile?.vendorId;
          const vendorStatus = profileResult.data?.getVendorProfile?.vendorStatus;
          authUser.vendorId     = vendorId;
          authUser.vendorStatus = vendorStatus;
          authUser.companyName  = profileResult.data?.getVendorProfile?.companyName;
        } catch {
          // vendor lookup failure doesn't block login
        }
      }

      // For adjuster-type accounts, load any Supervisor-configured Edit Access
      // permissions so claim-intake-details can gate rating/override controls.
      // Conditioned on role (not fetched unconditionally) since only
      // adjuster-type accounts can have permissions set today — same reasoning
      // as the vendor-profile fetch above being conditional on 'Vendor User'.
      if ((ADJUSTER_ROLE_NAMES as readonly string[]).includes(data.roleName)) {
        try {
          const permsResult = await client.query<{ getUserPermissions: UserPermissions | null }>({
            query: GET_USER_PERMISSIONS,
            variables: { token: data.token },
            fetchPolicy: 'no-cache',
          });
          if (permsResult.data?.getUserPermissions) {
            authUser.permissions = permsResult.data.getUserPermissions;
          }
        } catch {
          // permissions lookup failure doesn't block login — consumers fall
          // back to role-appropriate defaults via resolveHideVendorRating() etc.
        }
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(authUser));
      setToken(data.token);
      setUser(authUser);

      return { success: true, message: 'Login successful.', vendorId, vendorStatus: authUser.vendorStatus };
    } catch {
      return { success: false, message: 'Login failed. Please try again.' };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try { localStorage.setItem(USER_KEY, JSON.stringify(next)); } catch { /* storage unavailable — in-memory state still updates */ }
      return next;
    });
  }, []);

  const loginAsServiceProvider = useCallback((vendor: { vendorId: string; companyName?: string; email?: string }) => {
    const devToken = `dev-service-provider-${vendor.vendorId}`;
    const authUser: AuthUser = {
      loginId:      `dev-${vendor.vendorId}`,
      username:     vendor.companyName ?? 'Service Provider',
      email:        vendor.email ?? '',
      roleId:       'dev-vendor-user',
      roleName:     'Vendor User',
      menuIds:      [],
      vendorId:     vendor.vendorId,
      vendorStatus: 'Active',
      companyName:  vendor.companyName,
    };
    localStorage.setItem(TOKEN_KEY, devToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    setToken(devToken);
    setUser(authUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token && !!user, login, logout, updateUser, loginAsServiceProvider }}>
      {children}
    </AuthContext.Provider>
  );
};
