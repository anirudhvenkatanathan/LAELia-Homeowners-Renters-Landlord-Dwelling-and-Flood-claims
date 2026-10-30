import { gql } from 'apollo-server-express';
import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logError } from '../services/errorLogService';
import { VendorModel } from './vendorEntity';
import { VendorServiceRequestModel, linkToVendorDetails } from '../controllers/vendorServiceRequestController';

const JWT_SECRET = process.env.JWT_SECRET ?? 'claimtriage_jwt_secret_2026';

// Shared password policy — used by vendorSignUp and changePassword so the rule
// only lives in one place.
function validatePasswordPolicy(password: string): string | null {
  if (password.length < 6) return 'Password must be at least 6 characters.';
  if (!/\d/.test(password)) return 'Password must contain at least one number.';
  if (!/[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/.test(password)) return 'Password must contain at least one special character.';
  return null;
}

// ─── Mongoose: login_user ─────────────────────────────────────────────────────

interface IUserPermissions {
  canAccessServiceProviderRating?: boolean;
  canOverrideService?:             boolean;
  canOverrideProvider?:            boolean;
  canViewReserveExposure?:         boolean;
}

const UserPermissionsSchema = new Schema<IUserPermissions>({
  canAccessServiceProviderRating: { type: Boolean },
  canOverrideService:             { type: Boolean },
  canOverrideProvider:            { type: Boolean },
  canViewReserveExposure:         { type: Boolean },
}, { _id: false });

interface ILoginUser extends Document {
  loginId:     string;
  email:       string;
  username:    string;
  password:    string;
  fullName:    string;
  status:      string;   // 'Active' | 'Inactive'
  isActive:    boolean;  // kept in sync with status; no separate UI control
  // Absent (undefined) on every document until a Claims Supervisor's first
  // Edit Access save — deliberately no schema-level default. Frontend
  // resolves the effective default per-field (see utils/permissions.ts) so
  // "never configured" reproduces today's exact pre-permissions behavior.
  permissions?: IUserPermissions;
  createdBy:   string;
  updatedBy:   string;
  createdTime: Date;
  updatedTime: Date;
}

const LoginUserSchema = new Schema<ILoginUser>({
  loginId:     { type: String, required: true, unique: true },
  email:       { type: String, required: true, unique: true },
  username:    { type: String, required: true, unique: true },
  password:    { type: String, required: true },
  fullName:    { type: String, default: '' },
  status:      { type: String, default: 'Active' },
  isActive:    { type: Boolean, default: true },
  permissions: { type: UserPermissionsSchema },
  createdBy:   { type: String, default: 'system' },
  updatedBy:   { type: String, default: 'system' },
  createdTime: { type: Date, default: Date.now },
  updatedTime: { type: Date, default: Date.now },
}, { timestamps: false });

export const LoginUserModel =
  (mongoose.models['login_user'] as mongoose.Model<ILoginUser>) ||
  mongoose.model<ILoginUser>('login_user', LoginUserSchema, 'login_user');

// ─── Mongoose: login_role ─────────────────────────────────────────────────────

interface ILoginRole extends Document {
  roleId:          string;
  roleName:        string;
  roleDescription: string;
  createdBy:       string;
  updatedBy:       string;
  createdTime:     Date;
  updatedTime:     Date;
}

const LoginRoleSchema = new Schema<ILoginRole>({
  roleId:          { type: String, required: true, unique: true },
  roleName:        { type: String, required: true },
  roleDescription: { type: String, default: '' },
  createdBy:       { type: String, default: 'system' },
  updatedBy:       { type: String, default: 'system' },
  createdTime:     { type: Date, default: Date.now },
  updatedTime:     { type: Date, default: Date.now },
}, { timestamps: false });

export const LoginRoleModel =
  (mongoose.models['login_role'] as mongoose.Model<ILoginRole>) ||
  mongoose.model<ILoginRole>('login_role', LoginRoleSchema, 'login_role');

// ─── Mongoose: login_user_access ──────────────────────────────────────────────

interface ILoginUserAccess extends Document {
  loginUserAccessId: string;
  loginId:           string;
  roleId:            string;
  menuId:            string;
  createdBy:         string;
  updatedBy:         string;
  createdTime:       Date;
  updatedTime:       Date;
}

const LoginUserAccessSchema = new Schema<ILoginUserAccess>({
  loginUserAccessId: { type: String, required: true, unique: true },
  loginId:           { type: String, required: true, index: true },
  roleId:            { type: String, required: true },
  menuId:            { type: String, required: true },
  createdBy:         { type: String, default: 'system' },
  updatedBy:         { type: String, default: 'system' },
  createdTime:       { type: Date, default: Date.now },
  updatedTime:       { type: Date, default: Date.now },
}, { timestamps: false });

export const LoginUserAccessModel =
  (mongoose.models['login_user_access'] as mongoose.Model<ILoginUserAccess>) ||
  mongoose.model<ILoginUserAccess>('login_user_access', LoginUserAccessSchema, 'login_user_access');

// ─── Mongoose: demo_users ─────────────────────────────────────────────────────
// Source-of-truth for the Quick Login demo accounts seeded by
// scripts/seedLoginData.ts — replaces the hardcoded DEMO_USERS array that used
// to live directly in the seed script.

interface IDemoUser extends Document {
  loginId:     string;
  email:       string;
  username:    string;
  password:    string;
  fullName:    string;
  roleName:    string;
  menuIds:     string[];
  createdBy:   string;
  updatedBy:   string;
  createdTime: Date;
  updatedTime: Date;
}

const DemoUserSchema = new Schema<IDemoUser>({
  loginId:     { type: String, required: true, unique: true },
  email:       { type: String, required: true, unique: true },
  username:    { type: String, required: true, unique: true },
  password:    { type: String, required: true },
  fullName:    { type: String, default: '' },
  roleName:    { type: String, required: true },
  menuIds:     { type: [String], default: [] },
  createdBy:   { type: String, default: 'system' },
  updatedBy:   { type: String, default: 'system' },
  createdTime: { type: Date, default: Date.now },
  updatedTime: { type: Date, default: Date.now },
}, { timestamps: false });

export const DemoUserModel =
  (mongoose.models['demo_users'] as mongoose.Model<IDemoUser>) ||
  mongoose.model<IDemoUser>('demo_users', DemoUserSchema, 'demo_users');

// ─── User Management helpers ──────────────────────────────────────────────────
// Shared by listAdjusterUsers/adminUpdateUser/adminResetPassword/adminDeleteUser —
// this is the first feature where one user's action mutates another user's
// records, so every one of those resolvers independently re-verifies both of
// these checks (defense-in-depth, not a single shared middleware wrapper).

const ADJUSTER_ROLE_NAMES = ['Claims Adjuster', 'Senior Adjuster', 'Junior Adjuster'];
const ASSIGNABLE_ADJUSTER_ROLES = ['Senior Adjuster', 'Junior Adjuster'];

export async function requireSupervisor(token: string): Promise<{ loginId: string; roleName: string } | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { loginId: string; roleName: string };
    return payload.roleName === 'Claims Supervisor' ? payload : null;
  } catch {
    return null;
  }
}

// A user's login_user_access rows each grant one menuId but all share a single
// roleId — reading any one row's roleId tells us their current role.
async function getCurrentRoleName(loginId: string): Promise<string | null> {
  const access = await LoginUserAccessModel.findOne({ loginId }).lean().exec();
  if (!access) return null;
  const role = await LoginRoleModel.findOne({ roleId: access.roleId }).lean().exec();
  return role?.roleName ?? null;
}

// ─── GraphQL Type Definitions ─────────────────────────────────────────────────

export const loginTypeDefs = gql`
  type LoginResponse {
    success:  Boolean!
    message:  String!
    token:    String
    loginId:  String
    username: String
    fullName: String
    email:    String
    roleId:   String
    roleName: String
    menuIds:  [String!]
  }

  type LoginUser {
    loginId:   String!
    email:     String!
    username:  String!
    roleId:    String
    roleName:  String
    menuIds:   [String!]
  }

  type VendorSignUpResponse {
    success: Boolean!
    message: String!
  }

  type VendorProfile {
    vendorId:     String!
    vendorStatus: String!
    companyName:  String
  }

  type UpdateProfileResponse {
    success:  Boolean!
    message:  String!
    username: String
  }

  type ChangePasswordResponse {
    success: Boolean!
    message: String!
  }

  type UserPermissions {
    canAccessServiceProviderRating: Boolean
    canOverrideService:             Boolean
    canOverrideProvider:            Boolean
    canViewReserveExposure:         Boolean
  }

  input UserPermissionsInput {
    canAccessServiceProviderRating: Boolean!
    canOverrideService:             Boolean!
    canOverrideProvider:            Boolean!
    canViewReserveExposure:         Boolean!
  }

  type AdjusterUser {
    loginId:     String!
    fullName:    String!
    username:    String!
    email:       String!
    roleId:      String!
    roleName:    String!
    status:      String!
    isActive:    Boolean!
    createdTime: String!
    permissions: UserPermissions
  }

  type AdjusterUserListResponse {
    success: Boolean!
    message: String!
    users:   [AdjusterUser!]!
    count:   Int!
  }

  type AdminUserMutationResponse {
    success: Boolean!
    message: String!
    user:    AdjusterUser
  }

  type AdminPasswordResetResponse {
    success: Boolean!
    message: String!
  }

  type AdminDeleteUserResponse {
    success: Boolean!
    message: String!
  }

  type UpdateUserAccessResponse {
    success:     Boolean!
    message:     String!
    permissions: UserPermissions
  }

  extend type Query {
    getMe(token: String!): LoginUser
    getVendorProfile(token: String!): VendorProfile
    listAdjusterUsers(token: String!): AdjusterUserListResponse!
    getUserPermissions(token: String!): UserPermissions
  }

  extend type Mutation {
    login(identifier: String!, password: String!): LoginResponse!
    updateProfile(token: String!, username: String!): UpdateProfileResponse!
    changePassword(token: String!, currentPassword: String!, newPassword: String!): ChangePasswordResponse!
    adminUpdateUser(
      token:    String!
      loginId:  String!
      fullName: String!
      username: String!
      roleName: String!
      status:   String!
    ): AdminUserMutationResponse!
    adminResetPassword(token: String!, loginId: String!, newPassword: String!): AdminPasswordResetResponse!
    adminDeleteUser(token: String!, loginId: String!): AdminDeleteUserResponse!
    updateUserAccess(token: String!, loginId: String!, permissions: UserPermissionsInput!): UpdateUserAccessResponse!
    vendorSignUp(
      email:              String!
      password:           String!
      companyName:        String!
      address:            String
      website:            String
      contactPersonName:  String
      contactPersonPhone: String
      contactPersonEmail: String
      services:           [String!]!
      coverage:           [String!]!
    ): VendorSignUpResponse!
  }
`;

// ─── GraphQL Resolvers ────────────────────────────────────────────────────────

export const loginResolvers = {
  Query: {
    getMe: async (_: unknown, args: { token: string }) => {
      try {
        const payload = jwt.verify(args.token, JWT_SECRET) as {
          loginId: string; roleId: string; roleName: string; username: string; email: string; menuIds: string[];
        };
        return {
          loginId:  payload.loginId,
          email:    payload.email,
          username: payload.username,
          roleId:   payload.roleId,
          roleName: payload.roleName,
          menuIds:  payload.menuIds,
        };
      } catch {
        return null;
      }
    },

    getVendorProfile: async (_: unknown, args: { token: string }) => {
      try {
        const payload = jwt.verify(args.token, JWT_SECRET) as { email: string };
        const vendor = await VendorModel.findOne({ emailId: payload.email.toLowerCase().trim() }).lean().exec();
        if (!vendor) return null;
        return { vendorId: vendor.vendorId, vendorStatus: vendor.vendorStatus, companyName: vendor.companyName };
      } catch {
        return null;
      }
    },

    getUserPermissions: async (_: unknown, args: { token: string }) => {
      try {
        const payload = jwt.verify(args.token, JWT_SECRET) as { loginId: string };
        const user = await LoginUserModel.findOne({ loginId: payload.loginId }).lean().exec();
        // null (not a fabricated default object) means "never configured" —
        // callers resolve their own role-appropriate default in that case.
        return user?.permissions ?? null;
      } catch {
        return null;
      }
    },

    listAdjusterUsers: async (_: unknown, args: { token: string }) => {
      try {
        const supervisor = await requireSupervisor(args.token);
        if (!supervisor) return { success: false, message: 'Unauthorized.', users: [], count: 0 };

        const roles = await LoginRoleModel.find({ roleName: { $in: ADJUSTER_ROLE_NAMES } }).lean().exec();
        const roleNameById = new Map(roles.map((r) => [r.roleId, r.roleName]));
        const roleIds = roles.map((r) => r.roleId);

        const accessRows = await LoginUserAccessModel.find({ roleId: { $in: roleIds } }).lean().exec();
        const roleIdByLoginId = new Map<string, string>();
        for (const row of accessRows) roleIdByLoginId.set(row.loginId, row.roleId);

        const users = await LoginUserModel.find({ loginId: { $in: [...roleIdByLoginId.keys()] } }).lean().exec();
        const adjusterUsers = users.map((u) => ({
          loginId:     u.loginId,
          fullName:    u.fullName || u.username,
          username:    u.username,
          email:       u.email,
          roleId:      roleIdByLoginId.get(u.loginId) ?? '',
          roleName:    roleNameById.get(roleIdByLoginId.get(u.loginId) ?? '') ?? '',
          status:      u.status ?? 'Active',
          isActive:    u.isActive ?? true,
          createdTime: u.createdTime.toISOString(),
          permissions: u.permissions ?? null,
        }));

        return { success: true, message: '', users: adjusterUsers, count: adjusterUsers.length };
      } catch (err) {
        await logError(err as Error, 'GraphQL.listAdjusterUsers');
        return { success: false, message: 'Unable to load users. Please try again.', users: [], count: 0 };
      }
    },
  },

  Mutation: {
    vendorSignUp: async (_: unknown, args: {
      email: string; password: string; companyName: string;
      address?: string; website?: string;
      contactPersonName?: string; contactPersonPhone?: string; contactPersonEmail?: string;
      services: string[]; coverage: string[];
    }) => {
      try {
        const {
          email, password, companyName, address, website,
          contactPersonName, contactPersonPhone, contactPersonEmail,
          services, coverage,
        } = args;

        // Password validation
        const passwordPolicyError = validatePasswordPolicy(password);
        if (passwordPolicyError) return { success: false, message: passwordPolicyError };

        const normalizedEmail = email.toLowerCase().trim();

        // Check email uniqueness
        const existing = await LoginUserModel.findOne({ email: normalizedEmail }).lean().exec();
        if (existing) return { success: false, message: 'An account with this email already exists.' };

        // Hash password and create login_user
        const hashed  = await bcrypt.hash(password, 10);
        const loginId = uuidv4();

        // Derive username from company name; append suffix only if already taken
        const baseUsername = companyName.trim().toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')   // non-alphanumeric runs → single hyphen
          .replace(/^-+|-+$/g, '');        // strip leading/trailing hyphens

        let username = baseUsername;
        const taken = await LoginUserModel.findOne({ username: baseUsername }).lean().exec();
        if (taken) username = `${baseUsername}-${loginId.slice(0, 6)}`;

        await LoginUserModel.create({
          loginId, email: normalizedEmail, username, password: hashed,
          createdBy: 'self-registration', updatedBy: 'self-registration',
        });

        // Find or create Vendor User role
        let vendorRole = await LoginRoleModel.findOne({ roleName: 'Vendor User' }).lean().exec();
        if (!vendorRole) {
          const roleId = uuidv4();
          await LoginRoleModel.create({
            roleId, roleName: 'Vendor User', roleDescription: 'Vendor-facing user',
            createdBy: 'system', updatedBy: 'system',
          });
          vendorRole = await LoginRoleModel.findOne({ roleId }).lean().exec();
        }

        // Create login_user_access (menuId='vendor-portal' keeps sidebar empty for vendor role)
        await LoginUserAccessModel.create({
          loginUserAccessId: uuidv4(),
          loginId,
          roleId: vendorRole!.roleId,
          menuId: 'vendor-portal',
          createdBy: 'self-registration',
          updatedBy: 'self-registration',
        });

        // Create vendor_service_request
        const requestId = uuidv4();
        const reqDoc = await VendorServiceRequestModel.create({
          requestId,
          companyName: companyName.trim(),
          address:     address?.trim()            ?? '',
          email:       normalizedEmail,
          phone:       '',
          website:     website?.trim()             ?? '',
          contactPerson:      contactPersonName?.trim() ?? '',
          contactPersonName:  contactPersonName?.trim() ?? '',
          contactPersonPhone: contactPersonPhone?.trim() ?? '',
          contactPersonEmail: contactPersonEmail?.trim() ?? '',
          services,
          coverage,
          status:      'submitted',
          submittedBy: normalizedEmail,
          submittedAt: new Date(),
        });

        // Create Pending Approval vendor_details entry and link back to the request
        const newVendorDetailId = await linkToVendorDetails(reqDoc, 'Pending Approval');
        await VendorServiceRequestModel.updateOne(
          { requestId: reqDoc.requestId },
          { $set: { vendorDetailId: newVendorDetailId } },
        );

        return { success: true, message: 'Account created and vendor request submitted successfully.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.vendorSignUp');
        return { success: false, message: 'Registration failed. Please try again.' };
      }
    },

    login: async (_: unknown, args: { identifier: string; password: string }) => {
      try {
        const { identifier, password } = args;

        // Find user by email or username
        const user = await LoginUserModel.findOne({
          $or: [
            { email: identifier.toLowerCase().trim() },
            { username: identifier.trim() },
          ],
        }).lean().exec();

        if (!user) {
          return { success: false, message: 'Invalid Username or Password' };
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
          return { success: false, message: 'Invalid Username or Password' };
        }

        // Get access records for this user
        const accessRecords = await LoginUserAccessModel
          .find({ loginId: user.loginId })
          .lean()
          .exec();

        const roleId  = accessRecords[0]?.roleId ?? '';
        const menuIds = [...new Set(accessRecords.map((a) => a.menuId).filter(Boolean))];

        // Get role name
        let roleName = '';
        if (roleId) {
          const role = await LoginRoleModel.findOne({ roleId }).lean().exec();
          roleName = role?.roleName ?? '';
        }

        const token = jwt.sign(
          { loginId: user.loginId, email: user.email, username: user.username, roleId, roleName, menuIds },
          JWT_SECRET,
          { expiresIn: '8h' }
        );

        return {
          success: true,
          message: 'Login successful.',
          token,
          loginId:  user.loginId,
          username: user.username,
          fullName: user.fullName || '',
          email:    user.email,
          roleId,
          roleName,
          menuIds,
        };
      } catch (err) {
        await logError(err as Error, 'GraphQL.login');
        return { success: false, message: 'Login failed. Please try again.' };
      }
    },

    updateProfile: async (_: unknown, args: { token: string; username: string }) => {
      try {
        const payload = jwt.verify(args.token, JWT_SECRET) as { loginId: string };
        const newUsername = args.username.trim();
        if (!newUsername) return { success: false, message: 'Username is required.' };
        if (newUsername.length < 3) return { success: false, message: 'Username must be at least 3 characters.' };

        const existing = await LoginUserModel.findOne({
          username: newUsername, loginId: { $ne: payload.loginId },
        }).lean().exec();
        if (existing) return { success: false, message: 'This username is already taken.' };

        const updated = await LoginUserModel.findOneAndUpdate(
          { loginId: payload.loginId },
          { $set: { username: newUsername, updatedBy: payload.loginId, updatedTime: new Date() } },
          { new: true },
        ).lean().exec();
        if (!updated) return { success: false, message: 'User not found.' };

        return { success: true, message: 'Profile updated successfully.', username: updated.username };
      } catch (err) {
        await logError(err as Error, 'GraphQL.updateProfile');
        return { success: false, message: 'Unable to update profile. Please try again.' };
      }
    },

    changePassword: async (_: unknown, args: { token: string; currentPassword: string; newPassword: string }) => {
      try {
        const payload = jwt.verify(args.token, JWT_SECRET) as { loginId: string };
        const user = await LoginUserModel.findOne({ loginId: payload.loginId }).exec();
        if (!user) return { success: false, message: 'User not found.' };

        const match = await bcrypt.compare(args.currentPassword, user.password);
        if (!match) return { success: false, message: 'Current password is incorrect.' };

        if (args.currentPassword === args.newPassword) {
          return { success: false, message: 'New password must be different from the current password.' };
        }
        const policyError = validatePasswordPolicy(args.newPassword);
        if (policyError) return { success: false, message: policyError };

        user.password    = await bcrypt.hash(args.newPassword, 10);
        user.updatedBy   = payload.loginId;
        user.updatedTime = new Date();
        await user.save();

        return { success: true, message: 'Password changed successfully.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.changePassword');
        return { success: false, message: 'Unable to change password. Please try again.' };
      }
    },

    adminUpdateUser: async (_: unknown, args: {
      token: string; loginId: string; fullName: string; username: string; roleName: string; status: string;
    }) => {
      try {
        const supervisor = await requireSupervisor(args.token);
        if (!supervisor) return { success: false, message: 'Unauthorized.' };

        const currentRoleName = await getCurrentRoleName(args.loginId);
        if (!currentRoleName || !ADJUSTER_ROLE_NAMES.includes(currentRoleName)) {
          return { success: false, message: 'Target user is not an adjuster-type account.' };
        }
        if (!ASSIGNABLE_ADJUSTER_ROLES.includes(args.roleName)) {
          return { success: false, message: 'Role must be Senior Adjuster or Junior Adjuster.' };
        }

        const fullName = args.fullName.trim();
        const username = args.username.trim();
        if (!fullName) return { success: false, message: 'Full Name is required.' };
        if (!username || username.length < 3) return { success: false, message: 'Username must be at least 3 characters.' };
        if (args.status !== 'Active' && args.status !== 'Inactive') {
          return { success: false, message: 'Status must be Active or Inactive.' };
        }

        const existing = await LoginUserModel.findOne({
          username, loginId: { $ne: args.loginId },
        }).lean().exec();
        if (existing) return { success: false, message: 'This username is already taken.' };

        const targetRole = await LoginRoleModel.findOne({ roleName: args.roleName }).lean().exec();
        if (!targetRole) return { success: false, message: 'Role not found.' };

        const updated = await LoginUserModel.findOneAndUpdate(
          { loginId: args.loginId },
          { $set: {
            fullName, username, status: args.status, isActive: args.status === 'Active',
            updatedBy: supervisor.loginId, updatedTime: new Date(),
          } },
          { new: true },
        ).lean().exec();
        if (!updated) return { success: false, message: 'User not found.' };

        let roleId = '';
        const currentAccess = await LoginUserAccessModel.findOne({ loginId: args.loginId }).lean().exec();
        roleId = currentAccess?.roleId ?? targetRole.roleId;
        if (currentAccess && currentAccess.roleId !== targetRole.roleId) {
          await LoginUserAccessModel.updateMany(
            { loginId: args.loginId },
            { $set: { roleId: targetRole.roleId, updatedBy: supervisor.loginId, updatedTime: new Date() } },
          ).exec();
          roleId = targetRole.roleId;
        }

        return {
          success: true, message: 'User updated successfully.',
          user: {
            loginId: updated.loginId, fullName: updated.fullName, username: updated.username,
            email: updated.email, roleId, roleName: args.roleName,
            status: updated.status, isActive: updated.isActive, createdTime: updated.createdTime.toISOString(),
          },
        };
      } catch (err) {
        await logError(err as Error, 'GraphQL.adminUpdateUser');
        return { success: false, message: 'Unable to update user. Please try again.' };
      }
    },

    adminResetPassword: async (_: unknown, args: { token: string; loginId: string; newPassword: string }) => {
      try {
        const supervisor = await requireSupervisor(args.token);
        if (!supervisor) return { success: false, message: 'Unauthorized.' };

        const currentRoleName = await getCurrentRoleName(args.loginId);
        if (!currentRoleName || !ADJUSTER_ROLE_NAMES.includes(currentRoleName)) {
          return { success: false, message: 'Target user is not an adjuster-type account.' };
        }

        const policyError = validatePasswordPolicy(args.newPassword);
        if (policyError) return { success: false, message: policyError };

        const user = await LoginUserModel.findOne({ loginId: args.loginId }).exec();
        if (!user) return { success: false, message: 'User not found.' };

        user.password    = await bcrypt.hash(args.newPassword, 10);
        user.updatedBy   = supervisor.loginId;
        user.updatedTime = new Date();
        await user.save();

        return { success: true, message: 'Password reset successfully.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.adminResetPassword');
        return { success: false, message: 'Unable to reset password. Please try again.' };
      }
    },

    adminDeleteUser: async (_: unknown, args: { token: string; loginId: string }) => {
      try {
        const supervisor = await requireSupervisor(args.token);
        if (!supervisor) return { success: false, message: 'Unauthorized.' };

        const currentRoleName = await getCurrentRoleName(args.loginId);
        if (!currentRoleName || !ADJUSTER_ROLE_NAMES.includes(currentRoleName)) {
          return { success: false, message: 'Target user is not an adjuster-type account.' };
        }

        await LoginUserModel.deleteOne({ loginId: args.loginId }).exec();
        await LoginUserAccessModel.deleteMany({ loginId: args.loginId }).exec();

        return { success: true, message: 'User deleted successfully.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.adminDeleteUser');
        return { success: false, message: 'Unable to delete user. Please try again.' };
      }
    },

    updateUserAccess: async (_: unknown, args: {
      token: string; loginId: string;
      permissions: {
        canAccessServiceProviderRating: boolean;
        canOverrideService:             boolean;
        canOverrideProvider:            boolean;
        canViewReserveExposure:         boolean;
      };
    }) => {
      try {
        const supervisor = await requireSupervisor(args.token);
        if (!supervisor) return { success: false, message: 'Unauthorized.', permissions: null };

        const currentRoleName = await getCurrentRoleName(args.loginId);
        if (!currentRoleName || !ADJUSTER_ROLE_NAMES.includes(currentRoleName)) {
          return { success: false, message: 'Target user is not an adjuster-type account.', permissions: null };
        }

        const updated = await LoginUserModel.findOneAndUpdate(
          { loginId: args.loginId },
          { $set: {
            permissions: {
              canAccessServiceProviderRating: args.permissions.canAccessServiceProviderRating,
              canOverrideService:             args.permissions.canOverrideService,
              canOverrideProvider:            args.permissions.canOverrideProvider,
              canViewReserveExposure:         args.permissions.canViewReserveExposure,
            },
            updatedBy:   supervisor.loginId,
            updatedTime: new Date(),
          } },
          { new: true },
        ).lean().exec();
        if (!updated) return { success: false, message: 'User not found.', permissions: null };

        return { success: true, message: 'Access permissions updated successfully.', permissions: updated.permissions ?? null };
      } catch (err) {
        await logError(err as Error, 'GraphQL.updateUserAccess');
        return { success: false, message: 'Unable to update access permissions. Please try again.', permissions: null };
      }
    },
  },
};
