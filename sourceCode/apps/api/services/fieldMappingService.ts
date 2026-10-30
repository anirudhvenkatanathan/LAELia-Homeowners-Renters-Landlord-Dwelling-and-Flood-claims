import { v4 as uuidv4 } from 'uuid';
import { logError } from './errorLogService';
import {
  FieldMappingUploadModel,
  FieldMappingRecordModel,
  FieldMappingConfigurationModel,
  FieldMappingAuditModel,
  TemplateMasterModel,
} from '../graphQL/fieldMappingEntity';
import { parseFieldMappingExcel } from './fieldMappingExcelParserService';
import { generateTemplate } from './templateGeneratorService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadFieldMappingResult {
  uploadId: string;
  totalRecords: number;
  status: string;
  message: string;
  success: boolean;
}

export interface MappingInputItem {
  mappingId?: string;
  sourceField: string;
  targetField: string;
  dataType?: string;
  isMandatory?: boolean;
  sortOrder?: number;
}

export interface SaveMappingResult {
  success: boolean;
  message: string;
  savedCount: number;
}

export interface DownloadTemplateResult {
  success: boolean;
  base64: string | null;
  fileName: string | null;
  message: string;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Processes an Excel file upload for field mapping.
 */
export async function uploadFieldMappingFile(
  excelBase64: string,
  fileName: string,
  uploadedBy: string
): Promise<UploadFieldMappingResult> {
  try {
    const buffer = Buffer.from(excelBase64, 'base64');
    const parsed = await parseFieldMappingExcel(buffer, fileName);

    if (!parsed.success) {
      return { uploadId: '', totalRecords: 0, status: 'Failed', message: parsed.message, success: false };
    }

    const rawData: Record<string, unknown>[] = parsed.data?.rawData ?? [];
    const headerArray: string[] = parsed.data?.headers ?? [];
    const mappingRecords = parsed.data?.mappingRecords ?? [];

    if (rawData.length === 0) {
      return { uploadId: '', totalRecords: 0, status: 'Failed', message: 'No data rows found.', success: false };
    }

    const uploadId = uuidv4();
    const now      = new Date();

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

    await new FieldMappingUploadModel({
      uploadId,
      fileName,
      uploadType:         'EXCEL',
      uploadedBy,
      uploadDate:         now,
      totalRecords:       rawData.length,
      status:             'Processed',
      headers:            JSON.stringify(headerArray),
      validationResults:  'PASS',
      processingMessages: `Processed ${rawData.length} record(s).`,
    }).save();

    const templateCount = await TemplateMasterModel.countDocuments({});
    if (templateCount === 0) {
      await TemplateMasterModel.findOneAndUpdate(
        { templateName: 'default' },
        { templateId: uuidv4(), templateName: 'default', excelHeaders: JSON.stringify(headerArray), createdBy: uploadedBy, createdDate: now },
        { upsert: true, new: true }
      );
    }

    await new FieldMappingAuditModel({
      auditId:       uuidv4(),
      uploadId,
      action:        'UPLOAD',
      performedBy:   uploadedBy,
      performedDate: now,
      remarks:       `Excel upload — ${rawData.length} record(s)${configDocs.length > 0 ? `, ${configDocs.length} mapping(s)` : ''}`,
    }).save();

    return { uploadId, totalRecords: rawData.length, status: 'Processed', message: 'Upload successful.', success: true };
  } catch (err) {
    await logError(err as Error, 'fieldMappingService.uploadFieldMappingFile');
    return { uploadId: '', totalRecords: 0, status: 'Error', message: 'Internal error during upload.', success: false };
  }
}

/**
 * Retrieves all uploaded file rows sorted by date descending.
 */
export async function getUploadedFiles() {
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
      uploadDate:   d.uploadDate ? new Date(d.uploadDate).toISOString() : '',
      status:       d.status,
    }));
  } catch (err) {
    await logError(err as Error, 'fieldMappingService.getUploadedFiles');
    throw err;
  }
}

/**
 * Retrieves full field mapping details for a given uploadId.
 */
export async function getFieldMappingDetails(uploadId: string) {
  try {
    const doc = await FieldMappingUploadModel.findOne({ uploadId }).lean().exec();
    if (!doc) return null;

    const records = await FieldMappingRecordModel.find({ uploadId }).sort({ recordIndex: 1 }).lean().exec();
    const mappings = await FieldMappingConfigurationModel.find({ uploadId }).sort({ sortOrder: 1 }).lean().exec();

    return {
      uploadId:     doc.uploadId,
      fileName:     doc.fileName,
      uploadType:   doc.uploadType,
      totalRecords: doc.totalRecords ?? records.length,
      uploadedBy:   doc.uploadedBy,
      uploadDate:   doc.uploadDate ? new Date(doc.uploadDate).toISOString() : '',
      status:       doc.status,
      headers:      doc.headers ?? '[]',
      records:      records.map((r) => ({ recordIndex: r.recordIndex, recordData: r.recordData })),
      mappings:     mappings.map((m) => ({
        mappingId: m.mappingId, uploadId: m.uploadId,
        sourceField: m.sourceField, targetField: m.targetField,
        dataType: m.dataType, isMandatory: m.isMandatory, sortOrder: m.sortOrder,
      })),
    };
  } catch (err) {
    await logError(err as Error, 'fieldMappingService.getFieldMappingDetails');
    throw err;
  }
}

/**
 * Saves (replaces) mapping configuration for an upload.
 */
export async function saveFieldMapping(
  uploadId: string,
  mappings: MappingInputItem[]
): Promise<SaveMappingResult> {
  try {
    await FieldMappingConfigurationModel.deleteMany({ uploadId });

    const docs = mappings.map((m, idx) => ({
      mappingId:   m.mappingId ?? uuidv4(),
      uploadId,
      sourceField: m.sourceField,
      targetField: m.targetField,
      dataType:    m.dataType    ?? 'String',
      isMandatory: m.isMandatory ?? false,
      sortOrder:   m.sortOrder   ?? idx,
    }));

    await FieldMappingConfigurationModel.insertMany(docs);

    await new FieldMappingAuditModel({
      auditId:       uuidv4(),
      uploadId,
      action:        'SAVE_MAPPING',
      performedBy:   'System',
      performedDate: new Date(),
      remarks:       `Saved ${docs.length} mapping(s).`,
    }).save();

    return { success: true, message: 'Mappings saved successfully.', savedCount: docs.length };
  } catch (err) {
    await logError(err as Error, 'fieldMappingService.saveFieldMapping');
    return { success: false, message: 'Failed to save mappings.', savedCount: 0 };
  }
}

/**
 * Generates a downloadable Excel template for field mapping.
 */
export async function downloadTemplate(uploadId?: string): Promise<DownloadTemplateResult> {
  try {
    let headers: string[] = [];

    if (uploadId) {
      const upload = await FieldMappingUploadModel.findOne({ uploadId }).lean().exec();
      if (upload) {
        headers = JSON.parse(upload.headers || '[]');
      }
    }

    if (headers.length === 0) {
      const template = await TemplateMasterModel.findOne({}).lean().exec();
      if (template) {
        headers = JSON.parse(template.excelHeaders || '[]');
      }
    }

    if (headers.length === 0) {
      headers = ['SourceField1', 'SourceField2', 'SourceField3'];
    }

    const base64 = generateTemplate(headers);
    return { success: true, base64, fileName: 'field-mapping-template.xlsx', message: 'Template generated.' };
  } catch (err) {
    await logError(err as Error, 'fieldMappingService.downloadTemplate');
    return { success: false, base64: null, fileName: null, message: 'Failed to generate template.' };
  }
}
