import mongoose, { Document, Schema } from 'mongoose';

export interface IProcessingStage extends Document {
  vendorStageId:   string;
  vendorStageCode: string;
  vendorStageName: string;
}

const ProcessingStageSchema = new Schema<IProcessingStage>({
  vendorStageId:   { type: String, default: '' },
  vendorStageCode: { type: String, default: '' },
  vendorStageName: { type: String, default: '' },
}, { timestamps: false });

export const ProcessingStageModel =
  (mongoose.models['vendor_processing_stage'] as mongoose.Model<IProcessingStage>) ||
  mongoose.model<IProcessingStage>('vendor_processing_stage', ProcessingStageSchema, 'vendor_processing_stage');

export interface IConfirmationStage extends Document {
  vendorConfirmationId:   string;
  vendorStageId:          string;
  vendorConfirmationName: string;
  isMandatory:            boolean;
  serviceRequestRoleId:   string;
}

const ConfirmationStageSchema = new Schema<IConfirmationStage>({
  vendorConfirmationId:   { type: String, default: '' },
  vendorStageId:          { type: String, default: '', index: true },
  vendorConfirmationName: { type: String, default: '' },
  isMandatory:            { type: Boolean, default: false },
  // FK into service_request_roles; empty for stage-generic items (L2-L4), populated
  // for L1 (Service-Category_Specific) items that belong to one specific service category.
  serviceRequestRoleId:   { type: String, default: '', index: true },
}, { timestamps: false });

export const ConfirmationStageModel =
  (mongoose.models['vendor_confirmation_stage'] as mongoose.Model<IConfirmationStage>) ||
  mongoose.model<IConfirmationStage>('vendor_confirmation_stage', ConfirmationStageSchema, 'vendor_confirmation_stage');

export interface IConfirmationDoc extends Document {
  vendorId:              string;
  vendorStageId:         string;
  vendorConfirmationId:  string;
  fileName:              string;
  filePath:              string;
  fileBase64:            string;
  approvalStatus:        string;
  comments:              string;
  uploadedBy:            string;
  uploadedAt:            Date;
  waiveReasonId:         string;
  waiveReasonName:       string;
}

const ConfirmationDocSchema = new Schema<IConfirmationDoc>({
  vendorId:             { type: String, required: true, index: true },
  vendorStageId:        { type: String, default: '' },
  vendorConfirmationId: { type: String, default: '', index: true },
  fileName:             { type: String, default: '' },
  filePath:             { type: String, default: '' },
  fileBase64:           { type: String, default: '' },
  approvalStatus:       { type: String, default: 'Pending' },
  comments:             { type: String, default: '' },
  uploadedBy:           { type: String, default: 'admin' },
  uploadedAt:           { type: Date,   default: Date.now },
  waiveReasonId:        { type: String, default: '' },
  waiveReasonName:      { type: String, default: '' },
}, { timestamps: false });

export const ConfirmationDocModel =
  (mongoose.models['vendor_confirmation_documents'] as mongoose.Model<IConfirmationDoc>) ||
  mongoose.model<IConfirmationDoc>('vendor_confirmation_documents', ConfirmationDocSchema, 'vendor_confirmation_documents');

export interface IWaiveReason extends Document {
  waiveReasonId:   string;
  waiveReasonCode: string;
  waiveReasonName: string;
  isActive:        boolean;
}

const WaiveReasonSchema = new Schema<IWaiveReason>({
  waiveReasonId:   { type: String, default: '' },
  waiveReasonCode: { type: String, default: '' },
  waiveReasonName: { type: String, default: '' },
  isActive:        { type: Boolean, default: true },
}, { timestamps: false });

export const WaiveReasonModel =
  (mongoose.models['vendor_waive_reason'] as mongoose.Model<IWaiveReason>) ||
  mongoose.model<IWaiveReason>('vendor_waive_reason', WaiveReasonSchema, 'vendor_waive_reason');

export interface IVendorPriorityBoost extends Document {
  vendorId:           string;
  states:             string[];
  serviceDisciplines: string[];
  assignmentLimit:    number | null;
  reasonForBoost:     string;
  boostApplied:       boolean;
  createdBy:          string;
  createdAt:          Date;
  updatedAt:          Date;
}

const VendorPriorityBoostSchema = new Schema<IVendorPriorityBoost>({
  vendorId:           { type: String, required: true, unique: true },
  states:             { type: [String], default: [] },
  serviceDisciplines: { type: [String], default: [] },
  assignmentLimit:    { type: Number, default: null },
  reasonForBoost:     { type: String, default: '' },
  boostApplied:       { type: Boolean, default: false },
  createdBy:          { type: String, default: 'admin' },
  createdAt:          { type: Date, default: Date.now },
  updatedAt:          { type: Date, default: Date.now },
}, { timestamps: false });

export const VendorPriorityBoostModel =
  (mongoose.models['vendor_priority_boost'] as mongoose.Model<IVendorPriorityBoost>) ||
  mongoose.model<IVendorPriorityBoost>('vendor_priority_boost', VendorPriorityBoostSchema, 'vendor_priority_boost');

export async function buildStageMap(): Promise<Map<string, string>> {
  const stages = await ProcessingStageModel.find().lean();
  const map = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (stages as any[]).forEach((s) => {
    map.set(String(s._id), String(s.vendorStageName ?? ''));
  });
  return map;
}
