import { gql } from 'apollo-server-express';
import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { logError } from '../services/errorLogService';
import { parseFieldMappingExcel } from '../services/fieldMappingExcelParserService';

// ─── Mongoose: Upload Record ──────────────────────────────────────────────────

export interface IFieldMappingUpload extends Document {
  uploadId: string;
  fileName: string;
  uploadType: string;
  uploadedBy: string;
  uploadDate: Date;
  totalRecords: number;
  status: string;
  headers: string;
  validationResults: string;
  processingMessages: string;
}

const FieldMappingUploadSchema = new Schema<IFieldMappingUpload>({
  uploadId:           { type: String, required: true, unique: true },
  fileName:           { type: String, default: '' },
  uploadType:         { type: String, default: 'EXCEL' },
  uploadedBy:         { type: String, default: 'System' },
  uploadDate:         { type: Date,   default: Date.now },
  totalRecords:       { type: Number, default: 0 },
  status:             { type: String, default: 'Pending' },
  headers:            { type: String, default: '[]' },
  validationResults:  { type: String, default: '' },
  processingMessages: { type: String, default: '' },
}, { timestamps: true });

// ─── Mongoose: Individual Record ──────────────────────────────────────────────

export interface IFieldMappingRecord extends Document {
  recordId: string;
  uploadId: string;
  recordIndex: number;
  recordData: string;
}

const FieldMappingRecordSchema = new Schema<IFieldMappingRecord>({
  recordId:    { type: String, required: true, unique: true },
  uploadId:    { type: String, required: true, index: true },
  recordIndex: { type: Number, required: true },
  recordData:  { type: String, default: '{}' },
});

// ─── Mongoose: Mapping Configuration ─────────────────────────────────────────

export interface IFieldMappingConfiguration extends Document {
  mappingId:   string;
  uploadId:    string;
  sourceField: string;
  targetField: string;
  dataType:    string;
  isMandatory: boolean;
  sortOrder:   number;
}

const FieldMappingConfigurationSchema = new Schema<IFieldMappingConfiguration>({
  mappingId:   { type: String, required: true, unique: true },
  uploadId:    { type: String, required: true, index: true },
  sourceField: { type: String, default: '' },
  targetField: { type: String, default: '' },
  dataType:    { type: String, default: 'String' },
  isMandatory: { type: Boolean, default: false },
  sortOrder:   { type: Number, default: 0 },
});

// ─── Mongoose: Template Master ────────────────────────────────────────────────

export interface ITemplateMaster extends Document {
  templateId:   string;
  templateName: string;
  excelHeaders: string;
  createdBy:    string;
  createdDate:  Date;
}

const TemplateMasterSchema = new Schema<ITemplateMaster>({
  templateId:   { type: String, required: true, unique: true },
  templateName: { type: String, default: 'default' },
  excelHeaders: { type: String, default: '[]' },
  createdBy:    { type: String, default: 'System' },
  createdDate:  { type: Date,   default: Date.now },
});

// ─── Mongoose: Audit ──────────────────────────────────────────────────────────

export interface IFieldMappingAudit extends Document {
  auditId:       string;
  uploadId:      string;
  action:        string;
  performedBy:   string;
  performedDate: Date;
  remarks:       string;
}

const FieldMappingAuditSchema = new Schema<IFieldMappingAudit>({
  auditId:       { type: String, required: true, unique: true },
  uploadId:      { type: String, required: true },
  action:        { type: String, required: true },
  performedBy:   { type: String, default: 'System' },
  performedDate: { type: Date,   default: Date.now },
  remarks:       { type: String, default: '' },
});

// ─── Models ───────────────────────────────────────────────────────────────────

export const FieldMappingUploadModel =
  (mongoose.models['field_mapping_upload'] as mongoose.Model<IFieldMappingUpload>) ||
  mongoose.model<IFieldMappingUpload>('field_mapping_upload', FieldMappingUploadSchema);

export const FieldMappingRecordModel =
  (mongoose.models['field_mapping_records'] as mongoose.Model<IFieldMappingRecord>) ||
  mongoose.model<IFieldMappingRecord>('field_mapping_records', FieldMappingRecordSchema);

export const FieldMappingConfigurationModel =
  (mongoose.models['field_mapping_configuration'] as mongoose.Model<IFieldMappingConfiguration>) ||
  mongoose.model<IFieldMappingConfiguration>('field_mapping_configuration', FieldMappingConfigurationSchema);

export const TemplateMasterModel =
  (mongoose.models['template_master'] as mongoose.Model<ITemplateMaster>) ||
  mongoose.model<ITemplateMaster>('template_master', TemplateMasterSchema);

export const FieldMappingAuditModel =
  (mongoose.models['field_mapping_audit'] as mongoose.Model<IFieldMappingAudit>) ||
  mongoose.model<IFieldMappingAudit>('field_mapping_audit', FieldMappingAuditSchema);

// ─── GraphQL Type Definitions ─────────────────────────────────────────────────

export const fieldMappingTypeDefs = gql`
  type UploadedFileRow {
    uploadId:     String!
    fileName:     String
    uploadType:   String
    totalRecords: Int
    uploadedBy:   String
    uploadDate:   String
    status:       String
  }

  type FieldMappingRecord {
    recordIndex: Int
    recordData:  String
  }

  type MappingConfiguration {
    mappingId:   String!
    uploadId:    String
    sourceField: String
    targetField: String
    dataType:    String
    isMandatory: Boolean
    sortOrder:   Int
  }

  type FieldMappingDetails {
    uploadId:     String!
    fileName:     String
    uploadType:   String
    totalRecords: Int
    uploadedBy:   String
    uploadDate:   String
    status:       String
    headers:      String
    records:      [FieldMappingRecord!]!
    mappings:     [MappingConfiguration!]!
  }

  type UploadFieldMappingResponse {
    uploadId:     String
    totalRecords: Int
    status:       String
    message:      String
    success:      Boolean!
  }

  type SaveMappingResponse {
    success:    Boolean!
    message:    String
    savedCount: Int
  }

  type DownloadTemplateResponse {
    success:  Boolean!
    base64:   String
    fileName: String
    message:  String
  }

  input MappingInput {
    mappingId:   String
    sourceField: String!
    targetField: String!
    dataType:    String
    isMandatory: Boolean
    sortOrder:   Int
  }

  extend type Mutation {
    uploadFieldMappingFile(
      excelBase64: String!
      fileName:    String
      uploadedBy:  String
    ): UploadFieldMappingResponse!

    saveFieldMapping(
      uploadId: String!
      mappings: [MappingInput!]!
    ): SaveMappingResponse!

    downloadTemplate(uploadId: String): DownloadTemplateResponse!
  }

  extend type Query {
    getUploadedFiles: [UploadedFileRow!]!
    getFieldMappingDetails(uploadId: String!): FieldMappingDetails
  }
`;

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatDate(d: Date | undefined | null): string {
  if (!d) return '';
  return new Date(d).toISOString();
}

// ─── GraphQL Resolvers ────────────────────────────────────────────────────────

export const fieldMappingResolvers = {
  Mutation: {
    uploadFieldMappingFile: async (
      _parent: unknown,
      args: { excelBase64: string; fileName?: string; uploadedBy?: string }
    ) => {
      try {
        const buffer   = Buffer.from(args.excelBase64, 'base64');
        const fileName = args.fileName ?? 'upload.xlsx';
        const parsed   = await parseFieldMappingExcel(buffer, fileName);

        if (!parsed.success) {
          return {
            uploadId: '', totalRecords: 0, status: 'Failed',
            message: parsed.message, success: false,
          };
        }

        const rawData: Record<string, unknown>[] = parsed.data?.rawData ?? [];
        const headerArray: string[] = parsed.data?.headers ?? [];
        const mappingRecords = parsed.data?.mappingRecords ?? [];

        if (rawData.length === 0) {
          return {
            uploadId: '', totalRecords: 0, status: 'Failed',
            message: 'No data rows found in the uploaded file.', success: false,
          };
        }

        const uploadId = uuidv4();
        const now      = new Date();

        // Persist individual records
        const recordDocs = rawData.map((row, idx) => ({
          recordId:    uuidv4(),
          uploadId,
          recordIndex: idx + 1,
          recordData:  JSON.stringify(row),
        }));
        await FieldMappingRecordModel.insertMany(recordDocs);

        // Auto-seed mapping configuration when standard template columns are detected
        const configDocs = mappingRecords.map((rec, idx) => ({
          mappingId:   uuidv4(),
          uploadId,
          sourceField: rec.sourceField,
          targetField: rec.targetField,
          dataType:    'String',
          isMandatory: false,
          sortOrder:   idx,
        }));
        if (configDocs.length > 0) {
          await FieldMappingConfigurationModel.insertMany(configDocs);
        }

        // Persist upload record
        await new FieldMappingUploadModel({
          uploadId,
          fileName,
          uploadType:   'EXCEL',
          uploadedBy:   args.uploadedBy ?? 'System',
          uploadDate:   now,
          totalRecords: rawData.length,
          status:       'Processed',
          headers:      JSON.stringify(headerArray),
          validationResults:  'PASS',
          processingMessages: `Processed ${rawData.length} record(s)${configDocs.length > 0 ? `, ${configDocs.length} mapping(s)` : ''}.`,
        }).save();

        // Seed template_master if empty
        const templateCount = await TemplateMasterModel.countDocuments({});
        if (templateCount === 0) {
          await TemplateMasterModel.findOneAndUpdate(
            { templateName: 'default' },
            {
              templateId:   uuidv4(),
              templateName: 'default',
              excelHeaders: JSON.stringify(headerArray),
              createdBy:    args.uploadedBy ?? 'System',
              createdDate:  now,
            },
            { upsert: true, new: true }
          );
        }

        // Audit
        await new FieldMappingAuditModel({
          auditId:       uuidv4(),
          uploadId,
          action:        'UPLOAD',
          performedBy:   args.uploadedBy ?? 'System',
          performedDate: now,
          remarks:       `Excel upload — ${rawData.length} record(s)${configDocs.length > 0 ? `, ${configDocs.length} mapping(s)` : ''}`,
        }).save();

        return { uploadId, totalRecords: rawData.length, status: 'Processed', message: 'Upload successful.', success: true };
      } catch (err) {
        await logError(err as Error, 'GraphQL.uploadFieldMappingFile');
        return { uploadId: '', totalRecords: 0, status: 'Error', message: 'Failed to process upload.', success: false };
      }
    },

    saveFieldMapping: async (
      _parent: unknown,
      args: {
        uploadId: string;
        mappings: Array<{
          mappingId?: string;
          sourceField: string;
          targetField: string;
          dataType?: string;
          isMandatory?: boolean;
          sortOrder?: number;
        }>;
      }
    ) => {
      try {
        // Delete existing mappings for this upload
        await FieldMappingConfigurationModel.deleteMany({ uploadId: args.uploadId });

        // Insert new mappings
        const docs = args.mappings.map((m, idx) => ({
          mappingId:   m.mappingId ?? uuidv4(),
          uploadId:    args.uploadId,
          sourceField: m.sourceField,
          targetField: m.targetField,
          dataType:    m.dataType    ?? 'String',
          isMandatory: m.isMandatory ?? false,
          sortOrder:   m.sortOrder   ?? idx,
        }));

        await FieldMappingConfigurationModel.insertMany(docs);

        // Audit
        await new FieldMappingAuditModel({
          auditId:       uuidv4(),
          uploadId:      args.uploadId,
          action:        'SAVE_MAPPING',
          performedBy:   'System',
          performedDate: new Date(),
          remarks:       `Saved ${docs.length} mapping(s).`,
        }).save();

        return { success: true, message: 'Mappings saved successfully.', savedCount: docs.length };
      } catch (err) {
        await logError(err as Error, 'GraphQL.saveFieldMapping');
        return { success: false, message: 'Failed to save mappings.', savedCount: 0 };
      }
    },

    downloadTemplate: async (
      _parent: unknown,
      args: { uploadId?: string }
    ) => {
      try {
        let templateHeaders: string[] = [];

        if (args.uploadId) {
          const upload = await FieldMappingUploadModel.findOne({ uploadId: args.uploadId }).lean().exec();
          if (upload) {
            templateHeaders = JSON.parse((upload.headers as string) || '[]');
          }
        }

        if (templateHeaders.length === 0) {
          const templateDoc = await TemplateMasterModel.findOne({}).lean().exec();
          if (templateDoc) {
            templateHeaders = JSON.parse((templateDoc.excelHeaders as string) || '[]');
          }
        }

        if (templateHeaders.length === 0) {
          templateHeaders = ['SourceField1', 'SourceField2', 'SourceField3'];
        }

        const wb  = XLSX.utils.book_new();
        const ws  = XLSX.utils.aoa_to_sheet([templateHeaders]);
        templateHeaders.forEach((_h, colIdx) => {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
          if (!ws[cellRef]) return;
          ws[cellRef].s = { font: { bold: true } };
        });
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        return { success: true, base64, fileName: 'field-mapping-template.xlsx', message: 'Template generated.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.downloadTemplate');
        return { success: false, base64: null, fileName: null, message: 'Failed to generate template.' };
      }
    },
  },

  Query: {
    getUploadedFiles: async () => {
      try {
        const [docs, configCounts] = await Promise.all([
          FieldMappingUploadModel.find({}).sort({ uploadDate: -1 }).lean().exec(),
          FieldMappingConfigurationModel.aggregate<{ _id: string; count: number }>([
            { $group: { _id: '$uploadId', count: { $sum: 1 } } },
          ]),
        ]);

        const countMap = new Map(configCounts.map((c) => [c._id, c.count]));

        return docs.map((d) => ({
          uploadId:     d.uploadId,
          fileName:     d.fileName,
          uploadType:   d.uploadType,
          totalRecords: countMap.get(d.uploadId) ?? 0,
          uploadedBy:   d.uploadedBy,
          uploadDate:   formatDate(d.uploadDate),
          status:       d.status,
        }));
      } catch (err) {
        await logError(err as Error, 'GraphQL.getUploadedFiles');
        return [];
      }
    },

    getFieldMappingDetails: async (_parent: unknown, args: { uploadId: string }) => {
      try {
        const doc = await FieldMappingUploadModel.findOne({ uploadId: args.uploadId }).lean().exec();
        if (!doc) return null;

        const records = await FieldMappingRecordModel
          .find({ uploadId: args.uploadId })
          .sort({ recordIndex: 1 })
          .lean()
          .exec();

        const mappings = await FieldMappingConfigurationModel
          .find({ uploadId: args.uploadId })
          .sort({ sortOrder: 1 })
          .lean()
          .exec();

        return {
          uploadId:     doc.uploadId,
          fileName:     doc.fileName,
          uploadType:   doc.uploadType,
          totalRecords: doc.totalRecords ?? records.length,
          uploadedBy:   doc.uploadedBy,
          uploadDate:   formatDate(doc.uploadDate),
          status:       doc.status,
          headers:      doc.headers ?? '[]',
          records:      records.map((r) => ({
            recordIndex: r.recordIndex,
            recordData:  r.recordData,
          })),
          mappings: mappings.map((m) => ({
            mappingId:   m.mappingId,
            uploadId:    m.uploadId,
            sourceField: m.sourceField,
            targetField: m.targetField,
            dataType:    m.dataType,
            isMandatory: m.isMandatory,
            sortOrder:   m.sortOrder,
          })),
        };
      } catch (err) {
        await logError(err as Error, 'GraphQL.getFieldMappingDetails');
        return null;
      }
    },
  },
};
