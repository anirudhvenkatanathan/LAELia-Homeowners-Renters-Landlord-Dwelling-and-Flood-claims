import { gql } from 'apollo-server-express';
import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logError } from '../services/errorLogService';
import { syncVendorRequalificationStatus } from '../services/vendorRequalificationService';
import { ServiceRequestRoleModel } from './serviceRequestRoleEntity';

// ─── Mongoose: vendor_status ──────────────────────────────────────────────────

interface IVendorStatus extends Document {
  VendorStatusCode: string;
  VendorStatusName: string;
}

const VendorStatusSchema = new Schema<IVendorStatus>({
  VendorStatusCode: { type: String, default: '' },
  VendorStatusName: { type: String, default: '' },
}, { timestamps: false });

const VendorStatusModel =
  (mongoose.models['vendor_status'] as mongoose.Model<IVendorStatus>) ||
  mongoose.model<IVendorStatus>('vendor_status', VendorStatusSchema, 'vendor_status');

// ─── Mongoose: vendor_details ─────────────────────────────────────────────────

export interface IVendor extends Document {
  vendorId:               string;
  companyName:            string;
  emailId:                string;
  rating:                 number;
  address:                string;
  city:                   string;
  state:                  string;
  country:                string;
  Coverage:               string;
  Status:                 string;   // _id ref into vendor_status
  vendorStatus:           string;   // display status: Pending Approval / In Progress / Active / Disqualified / Suspended / Requalification Due / Ready for Activation
  vendorStatusId:         string;   // statusId ref into vendor_status
  vendorSource:           string;   // 'panel' for Vendor Panel vendors, '' otherwise
  RequalificationStartDate: string;
  RequalificationEndDate: string;
  phoneNumber:            string;
  website:                string;
  contactPersonName:      string;
  contactPersonPhone:     string;
  contactPersonEmail:     string;
  turnaroundTime:         string;
  serviceRequestRoleId:   string;
  serviceRequestRoleName: string;
  createdBy:              string;
  createdAt:              Date;
  uploadedBy:             string;
  uploadedAt:             Date;
  boostApplied:           boolean;
}

const VendorSchema = new Schema<IVendor>({
  vendorId:               { type: String, required: true, unique: true },
  companyName:            { type: String, required: true },
  emailId:                { type: String, default: '' },
  rating:                 { type: Number, default: 0 },
  address:                { type: String, default: '' },
  city:                   { type: String, default: '' },
  state:                  { type: String, default: '' },
  country:                { type: String, default: '' },
  Coverage:               { type: String, default: '' },
  Status:                 { type: String, default: '' },
  vendorStatus:           { type: String, default: '' },
  vendorStatusId:         { type: String, default: '' },
  vendorSource:           { type: String, default: '' },
  RequalificationStartDate: { type: String, default: '' },
  RequalificationEndDate: { type: String, default: '' },
  phoneNumber:            { type: String, default: '' },
  website:                { type: String, default: '' },
  contactPersonName:      { type: String, default: '' },
  contactPersonPhone:     { type: String, default: '' },
  contactPersonEmail:     { type: String, default: '' },
  turnaroundTime:         { type: String, default: '' },
  serviceRequestRoleId:   { type: String, default: '' },
  serviceRequestRoleName: { type: String, default: '' },
  createdBy:              { type: String, default: 'admin' },
  createdAt:              { type: Date,   default: Date.now },
  uploadedBy:             { type: String, default: 'admin' },
  uploadedAt:             { type: Date,   default: Date.now },
  boostApplied:           { type: Boolean, default: false },
}, { timestamps: false });

VendorSchema.index({ companyName: 1 });
VendorSchema.index({ emailId: 1 });
VendorSchema.index({ serviceRequestRoleId: 1 });
VendorSchema.index({ city: 1, state: 1 });
VendorSchema.index({ createdAt: -1 });

export const VendorModel =
  (mongoose.models['vendor_details'] as mongoose.Model<IVendor>) ||
  mongoose.model<IVendor>('vendor_details', VendorSchema, 'vendor_details');

// ─── Mongoose: vendor_status_history ───────────────────────────────────────────

export type VendorHistoryAction = 'Suspended' | 'Disqualified' | 'Activated' | 'Reactivated';

interface IVendorStatusHistory extends Document {
  historyId:   string;
  vendorId:    string;
  action:      VendorHistoryAction;
  reason:      string;
  remarks:     string;
  performedBy: string;
  performedAt: Date;
}

const VendorStatusHistorySchema = new Schema<IVendorStatusHistory>({
  historyId:   { type: String, required: true, unique: true },
  vendorId:    { type: String, required: true },
  action:      { type: String, required: true },
  reason:      { type: String, default: '' },
  remarks:     { type: String, default: '' },
  performedBy: { type: String, default: 'System' },
  performedAt: { type: Date,   default: Date.now },
}, { timestamps: false });

VendorStatusHistorySchema.index({ vendorId: 1, performedAt: -1 });

export const VendorStatusHistoryModel =
  (mongoose.models['vendor_status_history'] as mongoose.Model<IVendorStatusHistory>) ||
  mongoose.model<IVendorStatusHistory>('vendor_status_history', VendorStatusHistorySchema, 'vendor_status_history');

// Statuses a vendor can fall into before coming back to Active — landing on
// Active from one of these is a "Reactivated" event, not a first-time
// "Activated" one.
export const REACTIVATION_SOURCE_STATUSES = new Set(['Suspended', 'Disqualified', 'Requalification Due']);

export async function recordVendorHistory(
  vendorId:    string,
  action:      VendorHistoryAction,
  reason = '',
  remarks = '',
  performedBy = 'System',
): Promise<void> {
  try {
    await VendorStatusHistoryModel.create({
      historyId: uuidv4(),
      vendorId,
      action,
      reason,
      remarks,
      performedBy: performedBy || 'System',
      performedAt: new Date(),
    });
  } catch (err) {
    await logError(err as Error, 'vendorEntity.recordVendorHistory');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns Active vendors matching the given role IDs, sorted by rating descending.
 *  Filters by vendorStatusId (→ vendor_status.statusId) with Status (_id) as fallback
 *  so that both API-managed and seeded vendors are covered. */
export async function getActiveVendorsByRoleIds(
  roleIds: string[],
): Promise<Array<{ companyName: string; rating: number; boostApplied: boolean }>> {
  if (!roleIds.length) return [];

  const activeDoc = await VendorStatusModel
    .findOne({ $or: [{ VendorStatusName: 'Active' }, { VendorStatusCode: 'Active' }] })
    .lean()
    .exec();

  const raw           = activeDoc as Record<string, unknown> | null;
  const activeStatusId = raw ? String(raw['statusId'] ?? '') : '';   // vendorStatusId FK
  const activeMongoId  = raw ? String(raw['_id']      ?? '') : '';   // Status FK

  // Build status filter — match either FK so no vendor is missed due to missing field
  const statusConditions: Record<string, unknown>[] = [];
  if (activeStatusId) statusConditions.push({ vendorStatusId: activeStatusId });
  if (activeMongoId)  statusConditions.push({ Status: activeMongoId });

  const query: Record<string, unknown> = { serviceRequestRoleId: { $in: roleIds } };
  if (statusConditions.length) query['$or'] = statusConditions;

  const vendors = await VendorModel.find(query).sort({ rating: -1 }).lean().exec();
  return vendors
    .map((v) => ({
      companyName:  String((v as Record<string, unknown>)['companyName'] ?? ''),
      rating:       Number((v as Record<string, unknown>)['rating'] ?? 0),
      boostApplied: (v as Record<string, unknown>)['boostApplied'] === true,
    }))
    .filter((v) => v.companyName);
}

function fmt(d: Date | undefined | null): string {
  return d ? new Date(d).toISOString() : '';
}

// Flatten arrays to comma-separated strings so GraphQL String fields are satisfied.
function str(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.filter(Boolean).join(', ');
  return String(v);
}

// "RequalificationDue" → "Requalification Due"; "Active"/"Suspended" unchanged.
function normalizeStatus(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2');
}

// Statuses that must never appear in the Vendor Management screen.
const MANAGEMENT_EXCLUDED_STATUSES = [
  'Pending Approval',     'PendingApproval',
  'In Progress',          'InProgress',
  'Ready for Activation', 'ReadyForActivation',
];

/** Builds a MongoDB filter that excludes vendors whose status (by FK) is in the excluded set. */
async function buildExcludedStatusFilter(): Promise<Record<string, unknown>> {
  const docs = await VendorStatusModel.find({
    $or: [
      { VendorStatusName: { $in: MANAGEMENT_EXCLUDED_STATUSES } },
      { VendorStatusCode: { $in: MANAGEMENT_EXCLUDED_STATUSES } },
    ],
  }).lean().exec();

  const mongoIds:  string[] = [];
  const statusIds: string[] = [];
  (docs as Record<string, unknown>[]).forEach((s) => {
    const mid = String(s['_id']      ?? ''); if (mid)  mongoIds.push(mid);
    const sid = String(s['statusId'] ?? ''); if (sid)  statusIds.push(sid);
  });

  const conds: Record<string, unknown>[] = [];
  if (mongoIds.length)  conds.push({ Status:         { $in: mongoIds  } });
  if (statusIds.length) conds.push({ vendorStatusId: { $in: statusIds } });
  return conds.length ? { $nor: conds } : {};
}

// Build a lookup map from vendor_status: _id string → display name.
async function buildStatusMap(): Promise<Map<string, string>> {
  const statuses = await VendorStatusModel.find().lean();
  const map = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (statuses as any[]).forEach((s) => {
    const key = String(s._id);
    const label = normalizeStatus(str(s.VendorStatusName || s.VendorStatusCode));
    map.set(key, label);
  });
  return map;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVendorGQL(v: any, statusMap: Map<string, string>) {
  return {
    vendorId:               str(v.vendorId),
    companyName:            str(v.companyName),
    emailId:                str(v.emailId),
    rating:                 v.rating                  ?? 0,
    address:                str(v.address),
    city:                   str(v.city),
    state:                  str(v.state),
    country:                str(v.country),
    coverage:               str(v.Coverage),
    status:                 statusMap.get(str(v.Status)) ?? str(v.vendorStatus),
    vendorSource:           str(v.vendorSource),
    requalDue:              str(v.RequalificationEndDate),
    phoneNumber:            str(v.phoneNumber),
    website:                str(v.website),
    contactPersonName:      str(v.contactPersonName),
    contactPersonPhone:     str(v.contactPersonPhone),
    contactPersonEmail:     str(v.contactPersonEmail),
    turnaroundTime:         str(v.turnaroundTime),
    serviceRequestRoleId:   str(v.serviceRequestRoleId),
    serviceRequestRoleName: str(v.serviceRequestRoleName),
    createdBy:              str(v.createdBy),
    createdAt:              fmt(v.createdAt),
    uploadedBy:             str(v.uploadedBy),
    uploadedAt:             fmt(v.uploadedAt),
    boostApplied:           v.boostApplied === true,
  };
}

// ─── GraphQL Schema ───────────────────────────────────────────────────────────

export const vendorTypeDefs = gql`
  type Vendor {
    vendorId:               String!
    companyName:            String!
    emailId:                String!
    rating:                 Float
    address:                String
    city:                   String
    state:                  String
    country:                String
    coverage:               String
    status:                 String
    vendorSource:           String
    requalDue:              String
    phoneNumber:            String
    website:                String
    contactPersonName:      String
    contactPersonPhone:     String
    contactPersonEmail:     String
    turnaroundTime:         String
    serviceRequestRoleId:    String
    serviceRequestRoleName:  String
    serviceRequestRoleNames: [String]
    createdBy:               String
    createdAt:               String
    uploadedBy:              String
    uploadedAt:              String
    boostApplied:            Boolean
  }

  input VendorInput {
    companyName:            String!
    emailId:                String!
    phoneNumber:            String!
    serviceRequestRoleId:   String
    serviceRequestRoleName: String
    rating:                 Float
    address:                String
    city:                   String
    state:                  String
    country:                String
    turnaroundTime:         String
    createdBy:              String
    uploadedBy:             String
  }

  type VendorMutationResponse {
    success:  Boolean!
    message:  String!
    vendorId: String
  }

  extend type Query {
    getVendors:                      [Vendor!]!
    getVendorById(vendorId: String!): Vendor
    getVendorPanelVendors:           [Vendor!]!
  }

  extend type Mutation {
    createVendor(input: VendorInput!): VendorMutationResponse!
    updateVendor(vendorId: String!, input: VendorInput!): VendorMutationResponse!
    deleteVendor(vendorId: String!): VendorMutationResponse!
    activateVendorFromPanel(vendorId: String!, performedBy: String): VendorMutationResponse!
  }
`;

// ─── GraphQL Resolvers ────────────────────────────────────────────────────────

export const vendorResolvers = {
  Query: {
    getVendors: async () => {
      try {
        await syncVendorRequalificationStatus();
        const [excludeFilter, statusMap] = await Promise.all([
          buildExcludedStatusFilter(),
          buildStatusMap(),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vendors = await VendorModel.find(excludeFilter).sort({ companyName: 1 }).lean() as any[];

        // Collect all unique role IDs across every vendor (field may be array or string)
        const allRoleIds = new Set<string>();
        for (const v of vendors) {
          const ids: string[] = Array.isArray(v.serviceRequestRoleId)
            ? v.serviceRequestRoleId
            : v.serviceRequestRoleId ? [String(v.serviceRequestRoleId)] : [];
          for (const id of ids) if (id) allRoleIds.add(id);
        }

        // One batched query to resolve all role names
        const roleNameMap = new Map<string, string>();
        if (allRoleIds.size > 0) {
          const roleDocs = await ServiceRequestRoleModel.find({ roleId: { $in: [...allRoleIds] } }).lean().exec();
          for (const r of roleDocs) roleNameMap.set(String(r.roleId), String(r.roleName ?? ''));
        }

        return vendors.map((v) => {
          const ids: string[] = Array.isArray(v.serviceRequestRoleId)
            ? v.serviceRequestRoleId
            : v.serviceRequestRoleId ? [String(v.serviceRequestRoleId)] : [];
          const roleNames = ids.map((id) => roleNameMap.get(id) ?? '').filter(Boolean);
          return { ...toVendorGQL(v, statusMap), serviceRequestRoleNames: roleNames };
        });
      } catch (err) {
        await logError(err, 'vendorResolver.getVendors');
        throw new Error('Failed to fetch vendors.');
      }
    },

    getVendorPanelVendors: async () => {
      try {
        const [vendors, statusMap] = await Promise.all([
          VendorModel.find({ vendorSource: 'panel' }).sort({ companyName: 1 }).lean(),
          buildStatusMap(),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (vendors as any[]).map((v) => toVendorGQL(v, statusMap));
      } catch (err) {
        await logError(err, 'vendorResolver.getVendorPanelVendors');
        throw new Error('Failed to fetch vendor panel vendors.');
      }
    },

    getVendorById: async (_: unknown, args: { vendorId: string }) => {
      try {
        await syncVendorRequalificationStatus([args.vendorId]);
        const [vendor, statusMap] = await Promise.all([
          VendorModel.findOne({ vendorId: args.vendorId }).lean(),
          buildStatusMap(),
        ]);
        if (!vendor) return null;
        return toVendorGQL(vendor, statusMap);
      } catch (err) {
        await logError(err, 'vendorResolver.getVendorById');
        throw new Error('Failed to fetch vendor.');
      }
    },
  },

  Mutation: {
    createVendor: async (_: unknown, args: { input: Partial<IVendor> }) => {
      try {
        const now      = new Date();
        const vendorId = uuidv4();

        // Resolve Pending Approval status from vendor_status collection
        const pendingDoc = await VendorStatusModel.findOne({
          $or: [{ VendorStatusName: 'Pending Approval' }, { VendorStatusCode: 'PendingApproval' }],
        }).lean().exec();
        const raw               = pendingDoc as Record<string, unknown> | null;
        const pendingMongoId    = raw ? String(raw['_id']      ?? '') : '';
        const pendingStatusId   = raw ? String(raw['statusId'] ?? '') : '';
        const pendingStatusName = raw
          ? normalizeStatus(String(raw['VendorStatusName'] ?? raw['VendorStatusCode'] ?? 'Pending Approval'))
          : 'Pending Approval';

        // Requalification cycle starts at creation, not at approval, so it's
        // already ticking down by the time the vendor reaches Active status.
        const requalEndDate = new Date(now);
        requalEndDate.setFullYear(requalEndDate.getFullYear() + 1);

        await new VendorModel({
          ...args.input,
          vendorId,
          vendorStatus:   pendingStatusName,
          Status:         pendingMongoId,
          vendorStatusId: pendingStatusId,
          createdAt:      now,
          uploadedAt:     now,
          RequalificationStartDate: now.toISOString(),
          RequalificationEndDate:   requalEndDate.toISOString(),
        }).save();
        return { success: true, message: 'Vendor created successfully.', vendorId };
      } catch (err) {
        await logError(err, 'vendorResolver.createVendor');
        return { success: false, message: 'Failed to create vendor.', vendorId: null };
      }
    },

    updateVendor: async (_: unknown, args: { vendorId: string; input: Partial<IVendor> }) => {
      try {
        const result = await VendorModel.findOneAndUpdate(
          { vendorId: args.vendorId },
          { $set: { ...args.input, uploadedAt: new Date() } },
          { new: true }
        );
        if (!result) return { success: false, message: 'Vendor not found.', vendorId: args.vendorId };
        return { success: true, message: 'Vendor updated successfully.', vendorId: args.vendorId };
      } catch (err) {
        await logError(err, 'vendorResolver.updateVendor');
        return { success: false, message: 'Failed to update vendor.', vendorId: args.vendorId };
      }
    },

    deleteVendor: async (_: unknown, args: { vendorId: string }) => {
      try {
        const result = await VendorModel.deleteOne({ vendorId: args.vendorId });
        if (result.deletedCount === 0) return { success: false, message: 'Vendor not found.', vendorId: args.vendorId };
        return { success: true, message: 'Vendor deleted successfully.', vendorId: args.vendorId };
      } catch (err) {
        await logError(err, 'vendorResolver.deleteVendor');
        return { success: false, message: 'Failed to delete vendor.', vendorId: args.vendorId };
      }
    },

    activateVendorFromPanel: async (_: unknown, args: { vendorId: string; performedBy?: string }) => {
      try {
        const activeStatus = await VendorStatusModel.findOne({
          $or: [{ VendorStatusName: 'Active' }, { VendorStatusCode: 'Active' }],
        }).lean();

        const update: Record<string, unknown> = { vendorStatus: 'Active', uploadedAt: new Date() };
        if (activeStatus) update['Status'] = activeStatus['_id'];

        const result = await VendorModel.findOneAndUpdate(
          { vendorId: args.vendorId, vendorStatus: 'Ready for Activation' },
          { $set: update },
          { new: true },
        );
        if (!result) return { success: false, message: 'Vendor not found or not in Ready for Activation status.', vendorId: args.vendorId };
        // Ready for Activation isn't one of the REACTIVATION_SOURCE_STATUSES, so
        // this path is always a first-time activation.
        await recordVendorHistory(args.vendorId, 'Activated', '', '', args.performedBy);
        return { success: true, message: 'Vendor activated successfully.', vendorId: args.vendorId };
      } catch (err) {
        await logError(err, 'vendorResolver.activateVendorFromPanel');
        return { success: false, message: 'Failed to activate vendor.', vendorId: args.vendorId };
      }
    },
  },
};
