import { gql } from 'apollo-server-express';
import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logError } from '../services/errorLogService';

// ─── Mongoose: vendor_selection_logic ────────────────────────────────────────

interface IVendorSelectionLogic extends Document {
  ruleId:      string;
  name:        string;
  category:    string;
  description: string;
  status:      string;
  conditions:  string;
  createdBy:   string;
  createdOn:   Date;
  updatedBy:   string;
  updatedOn:   Date;
  isDeleted:   boolean;
}

const VendorSelectionLogicSchema = new Schema<IVendorSelectionLogic>({
  ruleId:      { type: String, required: true, unique: true },
  name:        { type: String, default: '' },
  category:    { type: String, default: '' },
  description: { type: String, default: '' },
  status:      { type: String, default: 'Active' },
  conditions:  { type: String, default: '' },
  createdBy:   { type: String, default: 'Admin' },
  createdOn:   { type: Date,   default: Date.now },
  updatedBy:   { type: String, default: 'Admin' },
  updatedOn:   { type: Date,   default: Date.now },
  isDeleted:   { type: Boolean, default: false },
}, { timestamps: false });

const VendorSelectionLogicModel =
  (mongoose.models['vendor_selection_rules'] as mongoose.Model<IVendorSelectionLogic>) ||
  mongoose.model<IVendorSelectionLogic>('vendor_selection_rules', VendorSelectionLogicSchema, 'vendor_selection_rules');

// ─── Mongoose: vendor_selection_logic_audit ───────────────────────────────────

interface IVendorSelectionLogicAudit extends Document {
  auditId:   string;
  ruleId:    string;
  action:    string;
  user:      string;
  timestamp: Date;
}

const VendorSelectionLogicAuditSchema = new Schema<IVendorSelectionLogicAudit>({
  auditId:   { type: String, required: true, unique: true },
  ruleId:    { type: String, required: true },
  action:    { type: String, required: true },
  user:      { type: String, default: 'Admin' },
  timestamp: { type: Date,   default: Date.now },
}, { timestamps: false });

const VendorSelectionLogicAuditModel =
  (mongoose.models['vendor_selection_audit'] as mongoose.Model<IVendorSelectionLogicAudit>) ||
  mongoose.model<IVendorSelectionLogicAudit>('vendor_selection_audit', VendorSelectionLogicAuditSchema, 'vendor_selection_audit');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date | undefined | null): string {
  return d ? new Date(d).toISOString() : '';
}

// ─── GraphQL Type Definitions ─────────────────────────────────────────────────

export const vendorSelectionLogicTypeDefs = gql`
  type VendorSelectionLogic {
    ruleId:      String!
    name:        String
    category:    String
    description: String
    status:      String
    conditions:  String
    createdBy:   String
    createdOn:   String
    updatedBy:   String
    updatedOn:   String
  }

  type VendorSelectionLogicResponse {
    success: Boolean!
    message: String!
    ruleId:  String
  }

  input VendorSelectionLogicInput {
    name:        String!
    category:    String!
    description: String!
    status:      String
    conditions:  String!
    user:        String
  }

  extend type Query {
    getVendorSelectionLogicList:                          [VendorSelectionLogic!]!
    getVendorSelectionLogicDetails(ruleId: String!):       VendorSelectionLogic
  }

  extend type Mutation {
    createVendorSelectionLogic(input: VendorSelectionLogicInput!): VendorSelectionLogicResponse!
    updateVendorSelectionLogic(ruleId: String!, input: VendorSelectionLogicInput!): VendorSelectionLogicResponse!
    deleteVendorSelectionLogic(ruleId: String!):          VendorSelectionLogicResponse!
  }
`;

// ─── GraphQL Resolvers ────────────────────────────────────────────────────────

export const vendorSelectionLogicResolvers = {
  Query: {
    getVendorSelectionLogicList: async () => {
      try {
        const docs = await VendorSelectionLogicModel
          .find({ isDeleted: false })
          .sort({ updatedOn: -1 })
          .lean()
          .exec();
        return docs.map((d) => ({
          ruleId:      d.ruleId,
          name:        d.name,
          category:    d.category,
          description: d.description,
          status:      d.status,
          conditions:  d.conditions,
          createdBy:   d.createdBy,
          createdOn:   fmt(d.createdOn),
          updatedBy:   d.updatedBy,
          updatedOn:   fmt(d.updatedOn),
        }));
      } catch (err) {
        await logError(err as Error, 'GraphQL.getVendorSelectionLogicList');
        return [];
      }
    },

    getVendorSelectionLogicDetails: async (_: unknown, args: { ruleId: string }) => {
      try {
        const doc = await VendorSelectionLogicModel
          .findOne({ ruleId: args.ruleId, isDeleted: false })
          .lean()
          .exec();
        if (!doc) return null;
        return {
          ruleId:      doc.ruleId,
          name:        doc.name,
          category:    doc.category,
          description: doc.description,
          status:      doc.status,
          conditions:  doc.conditions,
          createdBy:   doc.createdBy,
          createdOn:   fmt(doc.createdOn),
          updatedBy:   doc.updatedBy,
          updatedOn:   fmt(doc.updatedOn),
        };
      } catch (err) {
        await logError(err as Error, 'GraphQL.getVendorSelectionLogicDetails');
        return null;
      }
    },
  },

  Mutation: {
    createVendorSelectionLogic: async (
      _: unknown,
      args: { input: { name: string; category: string; description: string; status?: string; conditions: string; user?: string } }
    ) => {
      try {
        const { name, category, description, status, conditions, user } = args.input;
        const existing = await VendorSelectionLogicModel.findOne({ name, isDeleted: false }).lean().exec();
        if (existing) {
          return { success: false, message: 'A rule with this name already exists.', ruleId: null };
        }
        const ruleId = uuidv4();
        const now    = new Date();
        const by     = user ?? 'Admin';
        await new VendorSelectionLogicModel({
          ruleId, name, category, description,
          status: status ?? 'Active',
          conditions,
          createdBy: by, createdOn: now,
          updatedBy: by, updatedOn: now,
          isDeleted: false,
        }).save();
        await new VendorSelectionLogicAuditModel({
          auditId: uuidv4(), ruleId,
          action: 'CREATE', user: by, timestamp: now,
        }).save();
        return { success: true, message: 'Logic created successfully.', ruleId };
      } catch (err) {
        await logError(err as Error, 'GraphQL.createVendorSelectionLogic');
        return { success: false, message: 'Failed to create logic.', ruleId: null };
      }
    },

    updateVendorSelectionLogic: async (
      _: unknown,
      args: { ruleId: string; input: { name: string; category: string; description: string; status?: string; conditions: string; user?: string } }
    ) => {
      try {
        const { name, category, description, status, conditions, user } = args.input;
        const duplicate = await VendorSelectionLogicModel
          .findOne({ name, ruleId: { $ne: args.ruleId }, isDeleted: false })
          .lean()
          .exec();
        if (duplicate) {
          return { success: false, message: 'A rule with this name already exists.', ruleId: args.ruleId };
        }
        const now = new Date();
        const by  = user ?? 'Admin';
        await VendorSelectionLogicModel.findOneAndUpdate(
          { ruleId: args.ruleId },
          { name, category, description, status: status ?? 'Active', conditions, updatedBy: by, updatedOn: now }
        );
        await new VendorSelectionLogicAuditModel({
          auditId: uuidv4(), ruleId: args.ruleId,
          action: 'UPDATE', user: by, timestamp: now,
        }).save();
        return { success: true, message: 'Logic updated successfully.', ruleId: args.ruleId };
      } catch (err) {
        await logError(err as Error, 'GraphQL.updateVendorSelectionLogic');
        return { success: false, message: 'Failed to update logic.', ruleId: null };
      }
    },

    deleteVendorSelectionLogic: async (_: unknown, args: { ruleId: string }) => {
      try {
        const now = new Date();
        await VendorSelectionLogicModel.findOneAndUpdate(
          { ruleId: args.ruleId },
          { isDeleted: true, updatedBy: 'Admin', updatedOn: now }
        );
        await new VendorSelectionLogicAuditModel({
          auditId: uuidv4(), ruleId: args.ruleId,
          action: 'DELETE', user: 'Admin', timestamp: now,
        }).save();
        return { success: true, message: 'Logic deleted successfully.', ruleId: args.ruleId };
      } catch (err) {
        await logError(err as Error, 'GraphQL.deleteVendorSelectionLogic');
        return { success: false, message: 'Failed to delete logic.', ruleId: null };
      }
    },
  },
};
