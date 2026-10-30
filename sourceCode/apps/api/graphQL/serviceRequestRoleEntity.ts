import { gql } from 'apollo-server-express';
import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logError } from '../services/errorLogService';
import { parseServiceRequestRoleExcel } from '../services/serviceRequestRoleService';
import { FieldMappingConfigurationModel } from './fieldMappingEntity';
import { LINE_OF_BUSINESS_OPTIONS } from '../utils/lineOfBusiness';

// ─── Mongoose: Upload ─────────────────────────────────────────────────────────

export interface IServiceRequestRoleUpload extends Document {
  uploadId:    string;
  fileName:    string;
  uploadType:  string;
  totalRecords: number;
  uploadedBy:  string;
  uploadDate:  Date;
  status:      string;
}

const ServiceRequestRoleUploadSchema = new Schema<IServiceRequestRoleUpload>({
  uploadId:     { type: String, required: true, unique: true },
  fileName:     { type: String, default: '' },
  uploadType:   { type: String, default: 'EXCEL' },
  totalRecords: { type: Number, default: 0 },
  uploadedBy:   { type: String, default: 'System' },
  uploadDate:   { type: Date,   default: Date.now },
  status:       { type: String, default: 'Pending' },
}, { timestamps: true });

// ─── Mongoose: Role ───────────────────────────────────────────────────────────

export interface IServiceRequestRole extends Document {
  roleId:               string;
  uploadId:             string;
  roleName:             string;
  description:          string;
  status:               string;
  nlpCondition:         string;
  conditionExpression:  string;
  nlpConditionInWords:  string;
  lineOfBusiness:       string[];
}

const ServiceRequestRoleSchema = new Schema<IServiceRequestRole>({
  roleId:              { type: String, required: true, unique: true },
  uploadId:            { type: String, required: true, index: true },
  roleName:            { type: String, default: '' },
  description:         { type: String, default: '' },
  status:              { type: String, default: 'Active' },
  nlpCondition:        { type: String, default: '' },
  conditionExpression: { type: String, default: '' },
  nlpConditionInWords: { type: String, default: '' },
  // A role can now serve multiple LOBs (e.g. a GL rule reused instead of
  // duplicated per LOB). Excel bulk-upload has no LOB column, so it (and any
  // pre-LOB record) stays WCM by default — see
  // scripts/backfillServiceRequestRoleLOB.ts for the one-time backfill of
  // records created before this field existed, and for the legacy
  // single-string → array migration.
  lineOfBusiness:      { type: [String], required: true, enum: LINE_OF_BUSINESS_OPTIONS, default: ['WCM'] },
});

// ─── Mongoose: Condition ──────────────────────────────────────────────────────

export interface IServiceRequestRoleCondition extends Document {
  conditionId:   string;
  roleId:        string;
  fieldName:     string;
  operator:      string;
  value:         string;
  conditionType: string;
  sortOrder:     number;
}

const ServiceRequestRoleConditionSchema = new Schema<IServiceRequestRoleCondition>({
  conditionId:   { type: String, required: true, unique: true },
  roleId:        { type: String, required: true, index: true },
  fieldName:     { type: String, default: '' },
  operator:      { type: String, default: 'equals' },
  value:         { type: String, default: '' },
  conditionType: { type: String, default: 'AND' },
  sortOrder:     { type: Number, default: 0 },
});

// ─── Mongoose: Audit ──────────────────────────────────────────────────────────

export interface IServiceRequestRoleAudit extends Document {
  auditId:      string;
  roleId:       string;
  action:       string;
  user:         string;
  timestamp:    Date;
}

const ServiceRequestRoleAuditSchema = new Schema<IServiceRequestRoleAudit>({
  auditId:   { type: String, required: true, unique: true },
  roleId:    { type: String, required: true },
  action:    { type: String, required: true },
  user:      { type: String, default: 'System' },
  timestamp: { type: Date,   default: Date.now },
});

// ─── Models ───────────────────────────────────────────────────────────────────

export const ServiceRequestRoleUploadModel =
  (mongoose.models['service_request_role_upload'] as mongoose.Model<IServiceRequestRoleUpload>) ||
  mongoose.model<IServiceRequestRoleUpload>('service_request_role_upload', ServiceRequestRoleUploadSchema);

export const ServiceRequestRoleModel =
  (mongoose.models['service_request_role'] as mongoose.Model<IServiceRequestRole>) ||
  mongoose.model<IServiceRequestRole>('service_request_role', ServiceRequestRoleSchema);

export const ServiceRequestRoleConditionModel =
  (mongoose.models['service_request_role_conditions'] as mongoose.Model<IServiceRequestRoleCondition>) ||
  mongoose.model<IServiceRequestRoleCondition>('service_request_role_conditions', ServiceRequestRoleConditionSchema);

export const ServiceRequestRoleAuditModel =
  (mongoose.models['service_request_role_audit'] as mongoose.Model<IServiceRequestRoleAudit>) ||
  mongoose.model<IServiceRequestRoleAudit>('service_request_role_audit', ServiceRequestRoleAuditSchema);

// ─── Mongoose: Operator Configuration ────────────────────────────────────────

export interface IServiceRequestRoleOperator extends Document {
  operatorId: string;
  label:      string;
  value:      string;
  sortOrder:  number;
  isActive:   boolean;
}

const ServiceRequestRoleOperatorSchema = new Schema<IServiceRequestRoleOperator>({
  operatorId: { type: String, required: true, unique: true },
  label:      { type: String, required: true },
  value:      { type: String, required: true },
  sortOrder:  { type: Number, default: 0 },
  isActive:   { type: Boolean, default: true },
});

export const ServiceRequestRoleOperatorModel =
  (mongoose.models['service_request_role_operators_configuration'] as mongoose.Model<IServiceRequestRoleOperator>) ||
  mongoose.model<IServiceRequestRoleOperator>('service_request_role_operators_configuration', ServiceRequestRoleOperatorSchema);

// ─── Default seed data ────────────────────────────────────────────────────────

const DEFAULT_OPERATORS: Omit<IServiceRequestRoleOperator, keyof Document>[] = [
  { operatorId: 'op-01', label: '= (Equals)',            value: '=',           sortOrder: 1,  isActive: true },
  { operatorId: 'op-02', label: '!= (Not Equals)',       value: '!=',          sortOrder: 2,  isActive: true },
  { operatorId: 'op-03', label: '> (Greater Than)',      value: '>',           sortOrder: 3,  isActive: true },
  { operatorId: 'op-04', label: '>= (Greater or Equal)', value: '>=',          sortOrder: 4,  isActive: true },
  { operatorId: 'op-05', label: '< (Less Than)',         value: '<',           sortOrder: 5,  isActive: true },
  { operatorId: 'op-06', label: '<= (Less or Equal)',    value: '<=',          sortOrder: 6,  isActive: true },
  { operatorId: 'op-07', label: 'IN (In List)',          value: 'IN',          sortOrder: 7,  isActive: true },
  { operatorId: 'op-08', label: 'NOT IN',                value: 'NOT IN',      sortOrder: 8,  isActive: true },
  { operatorId: 'op-09', label: 'Contains',              value: 'contains',    sortOrder: 9,  isActive: true },
  { operatorId: 'op-10', label: 'Starts With',           value: 'starts_with', sortOrder: 10, isActive: true },
  { operatorId: 'op-11', label: 'Ends With',             value: 'ends_with',   sortOrder: 11, isActive: true },
];

// ─── GraphQL Type Definitions ─────────────────────────────────────────────────

export const serviceRequestRoleTypeDefs = gql`
  type ServiceRequestRoleUploadRow {
    uploadId:     String!
    fileName:     String
    uploadType:   String
    totalRecords: Int
    uploadedBy:   String
    uploadDate:   String
    status:       String
  }

  type ServiceRequestRole {
    roleId:              String!
    uploadId:            String
    roleName:            String
    description:         String
    status:              String
    nlpCondition:        String
    conditionExpression: String
    nlpConditionInWords: String
    lineOfBusiness:      [String]
  }

  type RoleCondition {
    conditionId:   String!
    roleId:        String
    fieldName:     String
    operator:      String
    value:         String
    conditionType: String
    sortOrder:     Int
  }

  type ServiceRequestRoleDetails {
    uploadId:     String!
    fileName:     String
    uploadType:   String
    totalRecords: Int
    uploadedBy:   String
    uploadDate:   String
    status:       String
    roles:        [ServiceRequestRole!]!
    conditions:   [RoleCondition!]!
  }

  type UploadServiceRequestRoleResponse {
    uploadId:     String
    totalRecords: Int
    status:       String
    message:      String
    success:      Boolean!
  }

  type SaveRoleResponse {
    success:    Boolean!
    message:    String
    savedCount: Int
  }

  type SaveConditionsResponse {
    success:    Boolean!
    message:    String
    savedCount: Int
  }

  input RoleInput {
    roleId:         String
    roleName:       String!
    description:    String
    status:         String
    nlpCondition:   String
    lineOfBusiness: [String]
  }

  input ConditionInput {
    conditionId:   String
    fieldName:     String!
    operator:      String!
    value:         String!
    conditionType: String
    sortOrder:     Int
  }

  type CreateRoleResponse {
    success: Boolean!
    roleId:  String
    message: String
  }

  extend type Mutation {
    uploadServiceRequestRole(
      excelBase64: String!
      fileName:    String
      uploadedBy:  String
    ): UploadServiceRequestRoleResponse!

    createServiceRequestRole(
      roleName:             String!
      description:          String
      uploadedBy:           String
      nlpCondition:         String
      conditionExpression:  String
      nlpConditionInWords:  String
      lineOfBusiness:       [String!]!
    ): CreateRoleResponse!

    updateServiceRequestRole(
      roleId:               String!
      roleName:             String!
      description:          String
      status:               String
      nlpCondition:         String
      conditionExpression:  String
      nlpConditionInWords:  String
      lineOfBusiness:       [String!]!
    ): CreateRoleResponse!

    deleteServiceRequestRole(roleId: String!): CreateRoleResponse!

    saveServiceRequestRole(
      uploadId: String!
      roles:    [RoleInput!]!
    ): SaveRoleResponse!

    saveRoleConditions(
      roleId:     String!
      conditions: [ConditionInput!]!
    ): SaveConditionsResponse!
  }

  type RoleOperator {
    operatorId: String!
    label:      String!
    value:      String!
    sortOrder:  Int
  }

  type NlpFieldMapping {
    sourceField: String!
    nlpAlias:    String!
  }

  extend type Query {
    getServiceRequestRoleUploads:                              [ServiceRequestRoleUploadRow!]!
    getServiceRequestRoleDetails(uploadId: String!):           ServiceRequestRoleDetails
    getAllServiceRequestRoles:                                 [ServiceRequestRole!]!
    getServiceRequestRoleById(roleId: String!):               ServiceRequestRole
    getRoleConditions(roleId: String!):                        [RoleCondition!]!
    getOperatorOptions:                                        [RoleOperator!]!
    getFieldOptions:                                           [String!]!
    getNlpFieldMappings:                                       [NlpFieldMapping!]!
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date | undefined | null): string {
  return d ? new Date(d).toISOString() : '';
}

/** Normalize a lean-read lineOfBusiness value to an array. Defends against
 *  legacy single-string records the startup migration (ensureServiceRequestRoleLOB)
 *  hasn't reached yet, in addition to the normal missing/empty cases. */
function toLOBArray(v: unknown): string[] {
  if (Array.isArray(v) && v.length) return v as string[];
  if (typeof v === 'string' && v) return [v];
  return ['WCM'];
}

/** Convert camelCase field name to lowercase spaced alias for NLP matching.
 *  e.g. "claimAmount" → "claim amount", "injuryType" → "injury type" */
function camelToWords(s: string): string {
  return s.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
}

// ─── GraphQL Resolvers ────────────────────────────────────────────────────────

export const serviceRequestRoleResolvers = {
  Mutation: {
    uploadServiceRequestRole: async (
      _: unknown,
      args: { excelBase64: string; fileName?: string; uploadedBy?: string }
    ) => {
      try {
        const buffer   = Buffer.from(args.excelBase64, 'base64');
        const fileName = args.fileName ?? 'upload.xlsx';
        const parsed   = await parseServiceRequestRoleExcel(buffer, fileName);

        if (!parsed.success) {
          return { uploadId: '', totalRecords: 0, status: 'Failed', message: parsed.message, success: false };
        }

        const roles = parsed.data?.roles ?? [];
        if (roles.length === 0) {
          return { uploadId: '', totalRecords: 0, status: 'Failed', message: 'No role rows found in the uploaded file.', success: false };
        }

        const uploadId = uuidv4();
        const now      = new Date();
        const by       = args.uploadedBy ?? 'System';

        await new ServiceRequestRoleUploadModel({
          uploadId, fileName, uploadType: 'EXCEL',
          totalRecords: roles.length, uploadedBy: by,
          uploadDate: now, status: 'Processed',
        }).save();

        const roleDocs = roles.map((r) => ({
          roleId: uuidv4(), uploadId,
          roleName: r.roleName, description: r.description, status: r.status,
        }));
        await ServiceRequestRoleModel.insertMany(roleDocs);

        await new ServiceRequestRoleAuditModel({
          auditId: uuidv4(), roleId: uploadId,
          action: 'UPLOAD', user: by, timestamp: now,
        }).save();

        return { uploadId, totalRecords: roles.length, status: 'Processed', message: 'Upload successful.', success: true };
      } catch (err) {
        await logError(err as Error, 'GraphQL.uploadServiceRequestRole');
        return { uploadId: '', totalRecords: 0, status: 'Error', message: 'Failed to process upload.', success: false };
      }
    },

    saveServiceRequestRole: async (
      _: unknown,
      args: { uploadId: string; roles: { roleId?: string; roleName: string; description?: string; status?: string; lineOfBusiness?: string[] }[] }
    ) => {
      try {
        await ServiceRequestRoleModel.deleteMany({ uploadId: args.uploadId });

        const docs = args.roles.map((r) => ({
          roleId:         r.roleId ?? uuidv4(),
          uploadId:       args.uploadId,
          roleName:       r.roleName,
          description:    r.description ?? '',
          status:         r.status ?? 'Active',
          // Excel bulk upload has no LOB column today — defaults to WCM.
          lineOfBusiness: r.lineOfBusiness?.length ? r.lineOfBusiness : ['WCM'],
        }));
        await ServiceRequestRoleModel.insertMany(docs);

        await new ServiceRequestRoleAuditModel({
          auditId: uuidv4(), roleId: args.uploadId,
          action: 'SAVE_ROLES', user: 'System', timestamp: new Date(),
        }).save();

        return { success: true, message: 'Roles saved successfully.', savedCount: docs.length };
      } catch (err) {
        await logError(err as Error, 'GraphQL.saveServiceRequestRole');
        return { success: false, message: 'Failed to save roles.', savedCount: 0 };
      }
    },

    createServiceRequestRole: async (
      _: unknown,
      args: { roleName: string; description?: string; uploadedBy?: string; nlpCondition?: string; conditionExpression?: string; nlpConditionInWords?: string; lineOfBusiness: string[] }
    ) => {
      try {
        const roleId = uuidv4();
        await new ServiceRequestRoleModel({
          roleId, uploadId: 'manual',
          roleName:             args.roleName,
          description:          args.description          ?? '',
          status:               'Active',
          nlpCondition:         args.nlpCondition         ?? '',
          conditionExpression:  args.conditionExpression  ?? '',
          nlpConditionInWords:  args.nlpConditionInWords  ?? '',
          lineOfBusiness:       args.lineOfBusiness,
        }).save();
        await new ServiceRequestRoleAuditModel({
          auditId: uuidv4(), roleId,
          action: 'CREATE', user: args.uploadedBy ?? 'Admin', timestamp: new Date(),
        }).save();
        return { success: true, roleId, message: 'Role created successfully.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.createServiceRequestRole');
        return { success: false, roleId: null, message: 'Failed to create role.' };
      }
    },

    updateServiceRequestRole: async (
      _: unknown,
      args: { roleId: string; roleName: string; description?: string; status?: string; nlpCondition?: string; conditionExpression?: string; nlpConditionInWords?: string; lineOfBusiness: string[] }
    ) => {
      try {
        await ServiceRequestRoleModel.findOneAndUpdate(
          { roleId: args.roleId },
          {
            roleName:             args.roleName,
            description:          args.description          ?? '',
            status:               args.status               ?? 'Active',
            nlpCondition:         args.nlpCondition         ?? '',
            conditionExpression:  args.conditionExpression  ?? '',
            nlpConditionInWords:  args.nlpConditionInWords  ?? '',
            lineOfBusiness:       args.lineOfBusiness,
          }
        );
        await new ServiceRequestRoleAuditModel({
          auditId: uuidv4(), roleId: args.roleId,
          action: 'UPDATE', user: 'Admin', timestamp: new Date(),
        }).save();
        return { success: true, roleId: args.roleId, message: 'Role updated successfully.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.updateServiceRequestRole');
        return { success: false, roleId: null, message: 'Failed to update role.' };
      }
    },

    deleteServiceRequestRole: async (_: unknown, args: { roleId: string }) => {
      try {
        await ServiceRequestRoleModel.deleteOne({ roleId: args.roleId });
        await ServiceRequestRoleConditionModel.deleteMany({ roleId: args.roleId });
        await new ServiceRequestRoleAuditModel({
          auditId: uuidv4(), roleId: args.roleId,
          action: 'DELETE', user: 'Admin', timestamp: new Date(),
        }).save();
        return { success: true, roleId: args.roleId, message: 'Role deleted successfully.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.deleteServiceRequestRole');
        return { success: false, roleId: null, message: 'Failed to delete role.' };
      }
    },

    saveRoleConditions: async (
      _: unknown,
      args: { roleId: string; conditions: { conditionId?: string; fieldName: string; operator: string; value: string; conditionType?: string; sortOrder?: number }[] }
    ) => {
      try {
        await ServiceRequestRoleConditionModel.deleteMany({ roleId: args.roleId });

        const docs = args.conditions.map((c, idx) => ({
          conditionId:   c.conditionId ?? uuidv4(),
          roleId:        args.roleId,
          fieldName:     c.fieldName,
          operator:      c.operator,
          value:         c.value,
          conditionType: c.conditionType ?? 'AND',
          sortOrder:     c.sortOrder ?? idx,
        }));
        await ServiceRequestRoleConditionModel.insertMany(docs);

        await new ServiceRequestRoleAuditModel({
          auditId: uuidv4(), roleId: args.roleId,
          action: 'SAVE_CONDITIONS', user: 'System', timestamp: new Date(),
        }).save();

        return { success: true, message: 'Conditions saved successfully.', savedCount: docs.length };
      } catch (err) {
        await logError(err as Error, 'GraphQL.saveRoleConditions');
        return { success: false, message: 'Failed to save conditions.', savedCount: 0 };
      }
    },
  },

  Query: {
    getServiceRequestRoleUploads: async () => {
      try {
        const docs = await ServiceRequestRoleUploadModel.find({}).sort({ uploadDate: -1 }).lean().exec();
        return docs.map((d) => ({
          uploadId:     d.uploadId,
          fileName:     d.fileName,
          uploadType:   d.uploadType,
          totalRecords: d.totalRecords ?? 0,
          uploadedBy:   d.uploadedBy,
          uploadDate:   fmt(d.uploadDate),
          status:       d.status,
        }));
      } catch (err) {
        await logError(err as Error, 'GraphQL.getServiceRequestRoleUploads');
        return [];
      }
    },

    getServiceRequestRoleDetails: async (_: unknown, args: { uploadId: string }) => {
      try {
        const doc = await ServiceRequestRoleUploadModel.findOne({ uploadId: args.uploadId }).lean().exec();
        if (!doc) return null;

        const roles      = await ServiceRequestRoleModel.find({ uploadId: args.uploadId }).lean().exec();
        const roleIds    = roles.map((r) => r.roleId);
        const conditions = await ServiceRequestRoleConditionModel
          .find({ roleId: { $in: roleIds } })
          .sort({ sortOrder: 1 })
          .lean()
          .exec();

        return {
          uploadId:     doc.uploadId,
          fileName:     doc.fileName,
          uploadType:   doc.uploadType,
          totalRecords: doc.totalRecords ?? roles.length,
          uploadedBy:   doc.uploadedBy,
          uploadDate:   fmt(doc.uploadDate),
          status:       doc.status,
          roles:        roles.map((r) => ({ roleId: r.roleId, uploadId: r.uploadId, roleName: r.roleName, description: r.description, status: r.status, nlpCondition: r.nlpCondition ?? '', conditionExpression: r.conditionExpression ?? '', nlpConditionInWords: r.nlpConditionInWords ?? '', lineOfBusiness: toLOBArray(r.lineOfBusiness) })),
          conditions:   conditions.map((c) => ({ conditionId: c.conditionId, roleId: c.roleId, fieldName: c.fieldName, operator: c.operator, value: c.value, conditionType: c.conditionType, sortOrder: c.sortOrder })),
        };
      } catch (err) {
        await logError(err as Error, 'GraphQL.getServiceRequestRoleDetails');
        return null;
      }
    },

    getAllServiceRequestRoles: async () => {
      try {
        const docs = await ServiceRequestRoleModel.find({}).sort({ roleName: 1 }).lean().exec();
        return docs.map((r) => ({ roleId: r.roleId, uploadId: r.uploadId, roleName: r.roleName, description: r.description, status: r.status, nlpCondition: r.nlpCondition ?? '', conditionExpression: r.conditionExpression ?? '', nlpConditionInWords: r.nlpConditionInWords ?? '', lineOfBusiness: toLOBArray(r.lineOfBusiness) }));
      } catch (err) {
        await logError(err as Error, 'GraphQL.getAllServiceRequestRoles');
        return [];
      }
    },

    getServiceRequestRoleById: async (_: unknown, args: { roleId: string }) => {
      try {
        const r = await ServiceRequestRoleModel.findOne({ roleId: args.roleId }).lean().exec();
        if (!r) return null;
        return { roleId: r.roleId, uploadId: r.uploadId, roleName: r.roleName, description: r.description, status: r.status, nlpCondition: r.nlpCondition ?? '', conditionExpression: r.conditionExpression ?? '', nlpConditionInWords: r.nlpConditionInWords ?? '', lineOfBusiness: toLOBArray(r.lineOfBusiness) };
      } catch (err) {
        await logError(err as Error, 'GraphQL.getServiceRequestRoleById');
        return null;
      }
    },

    getRoleConditions: async (_: unknown, args: { roleId: string }) => {
      try {
        const docs = await ServiceRequestRoleConditionModel.find({ roleId: args.roleId }).sort({ sortOrder: 1 }).lean().exec();
        return docs.map((c) => ({ conditionId: c.conditionId, roleId: c.roleId, fieldName: c.fieldName, operator: c.operator, value: c.value, conditionType: c.conditionType, sortOrder: c.sortOrder }));
      } catch (err) {
        await logError(err as Error, 'GraphQL.getRoleConditions');
        return [];
      }
    },

    getOperatorOptions: async () => {
      try {
        let docs = await ServiceRequestRoleOperatorModel
          .find({ isActive: true })
          .sort({ sortOrder: 1 })
          .lean()
          .exec();

        if (docs.length === 0) {
          await ServiceRequestRoleOperatorModel.insertMany(DEFAULT_OPERATORS);
          docs = await ServiceRequestRoleOperatorModel
            .find({ isActive: true })
            .sort({ sortOrder: 1 })
            .lean()
            .exec();
        }

        return docs.map((d) => ({
          operatorId: d.operatorId,
          label:      d.label,
          value:      d.value,
          sortOrder:  d.sortOrder,
        }));
      } catch (err) {
        await logError(err as Error, 'GraphQL.getOperatorOptions');
        return [];
      }
    },

    getFieldOptions: async () => {
      try {
        const fields = await FieldMappingConfigurationModel.distinct('sourceField');
        return (fields as string[]).filter(Boolean).sort();
      } catch (err) {
        await logError(err as Error, 'GraphQL.getFieldOptions');
        return [];
      }
    },

    getNlpFieldMappings: async () => {
      try {
        const fields = await FieldMappingConfigurationModel.distinct('sourceField');
        return (fields as string[])
          .filter(Boolean)
          .sort()
          .map((sourceField) => ({ sourceField, nlpAlias: camelToWords(sourceField) }));
      } catch (err) {
        await logError(err as Error, 'GraphQL.getNlpFieldMappings');
        return [];
      }
    },
  },
};
