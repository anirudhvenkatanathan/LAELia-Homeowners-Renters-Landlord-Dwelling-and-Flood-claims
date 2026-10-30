import { gql } from 'apollo-server-express';
import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { parseStringPromise } from 'xml2js';
import { logError } from '../services/errorLogService';
import { parseExcelFile } from '../services/excelParserService';
import {
  ServiceRequestRoleModel,
  ServiceRequestRoleConditionModel,
} from './serviceRequestRoleEntity';
import { VendorModel, getActiveVendorsByRoleIds } from './vendorEntity';
import { requireSupervisor } from './loginEntity';
import { Console } from 'console';
import { mapClaimTypeToLOB } from '../utils/lineOfBusiness';
import { ConditionData, evaluateRoleConditions, getClaimField } from '../utils/ruleEvaluator';

// ─── Mongoose: Upload Record (one per file) ───────────────────────────────────

export interface IClaimIntake extends Document {
  uploadId: string;
  fileName: string;
  uploadType: string;
  uploadedBy: string;
  uploadDate: Date;
  status: string;
  totalClaims: number;
  successCount: number;
  failedCount: number;
  validationResults: string;
  processingMessages: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClaimIntakeSchema = new Schema<IClaimIntake>({
  uploadId:          { type: String, required: true, unique: true },
  fileName:          { type: String, default: '' },
  uploadType:        { type: String, required: true },
  uploadedBy:        { type: String, default: 'System' },
  uploadDate:        { type: Date,   default: Date.now },
  status:            { type: String, default: 'Pending' },
  totalClaims:       { type: Number, default: 0 },
  successCount:      { type: Number, default: 0 },
  failedCount:       { type: Number, default: 0 },
  validationResults: { type: String, default: '' },
  processingMessages:{ type: String, default: '' },
}, { timestamps: true });

// ─── Mongoose: Individual Claim Record (one per claim in a file) ──────────────

export interface IClaimRecord extends Document {
  uploadId: string;
  recordIndex: number;
  claimNumber: string;
  policyNumber: string;
  insuredName: string;
  claimType: string;
  lossDate: string;
  reportedDate: string;
  claimAmount: string;
  claimStatus: string;
  validationStatus: string;
  validationMessage: string;
  planServices:          string[];
  confirmedPlanServices: string[];
  existingplanservices:  string[];
  planServiceStatus: string;
  planServiceComments: string;
  vendorServices: string[];
  vendorServiceComments: string;
  serviceVendorReview: {
    roleName: string; changeType: string; recommendedVendor: string; proposedVendor: string; selectedVendor: string;
    status: string; confirmedBy: string; confirmedAt: string;
    reviewedBy?: string; reviewedAt?: string; supervisorComment?: string; adjusterComment?: string;
  }[];
  isCompleted:   boolean;
  completedAt:   Date | null;
  completedBy:   string;
  adjusterComments:    string;
  adjusterSubmittedBy: string;
  adjusterSubmittedAt: string;
}

const ClaimRecordSchema = new Schema<IClaimRecord>({
  uploadId:          { type: String, required: true, index: true },
  recordIndex:       { type: Number, required: true },
  claimNumber:       { type: String, default: '' },
  policyNumber:      { type: String, default: '' },
  insuredName:       { type: String, default: '' },
  claimType:         { type: String, default: '' },
  lossDate:          { type: String, default: '' },
  reportedDate:      { type: String, default: '' },
  claimAmount:       { type: String, default: '' },
  claimStatus:          { type: String, default: 'Active' },
  validationStatus:     { type: String, default: 'Passed' },
  validationMessage:    { type: String, default: '' },
  planServices:          { type: [String], default: [] },
  confirmedPlanServices: { type: [String], default: [] },
  existingplanservices:  { type: [String], default: [] },
  planServiceStatus:     { type: String, default: 'Pending Selection' },
  planServiceComments:   { type: String, default: '' },
  vendorServices:        { type: [String], default: [] },
  vendorServiceComments: { type: String, default: '' },
  serviceVendorReview: {
    type: [{
      roleName:          { type: String },
      changeType:        { type: String },   // 'ProviderChange' | 'ServiceAdded'
      recommendedVendor: { type: String },
      proposedVendor:    { type: String },   // Adjuster's original pick — frozen, never overwritten by Supervisor review
      selectedVendor:    { type: String },   // current/final vendor — Supervisor review updates this
      status:            { type: String },   // 'Locked' | 'Pending Review' | 'Modified' | 'Included' | 'Rejected'
      confirmedBy:       { type: String },
      confirmedAt:       { type: String },
      reviewedBy:        { type: String },
      reviewedAt:        { type: String },
      supervisorComment: { type: String },
      adjusterComment:   { type: String },
    }],
    default: [],
  },
  isCompleted:           { type: Boolean, default: false },
  completedAt:           { type: Date,    default: null },
  completedBy:           { type: String,  default: '' },
  adjusterComments:      { type: String,  default: '' },
  adjusterSubmittedBy:   { type: String,  default: '' },
  adjusterSubmittedAt:   { type: String,  default: '' },
}, { strict: false }); // allow extra dynamic fields from uploaded data

// ─── Mongoose: Audit ──────────────────────────────────────────────────────────

export interface IClaimIntakeAudit extends Document {
  uploadId: string;
  action: string;
  user: string;
  timestamp: Date;
  status: string;
  remarks: string;
}

const ClaimIntakeAuditSchema = new Schema<IClaimIntakeAudit>({
  uploadId:  { type: String, required: true },
  action:    { type: String, required: true },
  user:      { type: String, default: 'System' },
  timestamp: { type: Date,   default: Date.now },
  status:    { type: String, default: '' },
  remarks:   { type: String, default: '' },
});

export const ClaimIntakeModel =
  (mongoose.models['claim_intake'] as mongoose.Model<IClaimIntake>) ||
  mongoose.model<IClaimIntake>('claim_intake', ClaimIntakeSchema);

export const ClaimRecordModel =
  (mongoose.models['claim_intake_records'] as mongoose.Model<IClaimRecord>) ||
  mongoose.model<IClaimRecord>('claim_intake_records', ClaimRecordSchema);

export const ClaimIntakeAuditModel =
  (mongoose.models['claim_intake_audit'] as mongoose.Model<IClaimIntakeAudit>) ||
  mongoose.model<IClaimIntakeAudit>('claim_intake_audit', ClaimIntakeAuditSchema);

// ─── Mongoose: Change Log ─────────────────────────────────────────────────────

export interface IChangeLog extends Document {
  uploadId:      string;
  recordIndex:   number;
  claimNumber:   string;
  type:          string;
  changedItem:   string;
  previousValue: string;
  updatedValue:  string;
  reason:        string;
  updatedBy:     string;
  updatedAt:     Date;
}

const ChangeLogSchema = new Schema<IChangeLog>({
  uploadId:      { type: String, required: true, index: true },
  recordIndex:   { type: Number, required: true },
  claimNumber:   { type: String, default: '' },
  type:          { type: String, required: true },
  changedItem:   { type: String, default: '' },
  previousValue: { type: String, default: '' },
  updatedValue:  { type: String, default: '' },
  reason:        { type: String, required: true },
  updatedBy:     { type: String, default: 'admin' },
  updatedAt:     { type: Date, default: Date.now },
});

export const ChangeLogModel =
  (mongoose.models['claim_change_log'] as mongoose.Model<IChangeLog>) ||
  mongoose.model<IChangeLog>('claim_change_log', ChangeLogSchema);

// ─── GraphQL Type Definitions ─────────────────────────────────────────────────

export const typeDefs = gql`
  type UploadClaimResponse {
    uploadId:      String
    totalClaims:   Int
    successCount:  Int
    failedCount:   Int
    status:        String
    validationResult: String
    message:       String
    success:       Boolean!
  }

  type UploadedClaimsGridRow {
    uploadId:    String!
    fileName:    String
    claimNumber: String
    uploadType:  String
    totalClaims: Int
    uploadedBy:  String
    uploadDate:  String
    status:      String
  }

  type SavePlanServicesResponse {
    success: Boolean!
    message: String
  }

  type SaveVendorServicesResponse {
    success: Boolean!
    message: String
  }

  type ServiceVendorReview {
    roleName:          String
    changeType:        String
    recommendedVendor: String
    proposedVendor:    String
    selectedVendor:    String
    status:            String
    confirmedBy:       String
    confirmedAt:       String
    reviewedBy:        String
    reviewedAt:        String
    supervisorComment: String
    adjusterComment:   String
  }

  input ServiceVendorReviewInput {
    roleName:          String!
    changeType:        String!
    recommendedVendor: String!
    proposedVendor:    String!
    selectedVendor:    String!
    status:            String!
    confirmedBy:       String!
    confirmedAt:       String!
    reviewedBy:        String
    reviewedAt:        String
    supervisorComment: String
    adjusterComment:   String
  }

  input SupervisorReviewDecisionInput {
    roleName:    String!
    decision:    String!   # 'Modified' | 'Included' | 'Rejected'
    finalVendor: String    # Supervisor's final vendor pick (ProviderChange only)
    comment:     String!
  }

  type SupervisorReviewedItem {
    roleName:           String!
    changeType:         String!
    displayChangeType:  String!
    originalValue:      String!
    finalValue:         String!
    finalBadge:         String!
    supervisorComment:  String!
    reviewedBy:         String!
    reviewedAt:         String!
  }

  type SupervisorReviewedClaim {
    uploadId:       String!
    recordIndex:    Int!
    claimNumber:    String!
    insuredName:    String!
    claimType:      String!
    lastReviewedAt: String!
    items:          [SupervisorReviewedItem!]!
  }

  type ClaimRecord {
    uploadId:              String
    recordIndex:           Int
    claimNumber:           String
    policyNumber:          String
    insuredName:           String
    claimType:             String
    lossDate:              String
    reportedDate:          String
    claimAmount:           String
    claimStatus:           String
    validationStatus:      String
    validationMessage:     String
    planServices:           [String!]
    planServiceNames:       [String!]
    confirmedPlanServices:  [String!]
    confirmedPlanServiceNames: [String!]
    existingplanservices:   [String!]
    planServiceStatus:      String
    planServiceComments:   String
    vendorServices:        [String!]
    vendorServiceComments: String
    serviceVendorReview:   [ServiceVendorReview!]
    suggestedVendors:      [String!]
    isCompleted:           Boolean
    completedAt:           String
    completedBy:           String
    adjusterComments:      String
    adjusterSubmittedBy:   String
    adjusterSubmittedAt:   String
    causeOfLoss:            String
    damagedAreas:              String
    policyForm:                  String
    severity:                String
    jurisdiction:            String
    floodZone:    String
    coverageALimit:          String
    buildingExposure:      String
    contentsExposure:        String
    propertyAddress:           String
    assignedAdjuster:       String
    contractorName:        String
  }

  type CompleteClaimResponse {
    success:     Boolean!
    message:     String
    completedAt: String
  }

  type UploadedClaimDetails {
    uploadId:     String!
    fileName:     String
    uploadType:   String
    totalClaims:  Int
    successCount: Int
    failedCount:  Int
    uploadedBy:   String
    uploadDate:   String
    status:       String
    records:      [ClaimRecord!]!
  }

  type Mutation {
    uploadClaim(
      uploadType:  String!
      fileName:    String
      jsonPayload: String
      xmlPayload:  String
      excelBase64: String
      uploadedBy:  String
    ): UploadClaimResponse!

    savePlanServices(
      uploadId:     String!
      recordIndex:  Int!
      planServices: [String!]!
      comments:     String!
    ): SavePlanServicesResponse!

    saveDraftPlanServices(
      uploadId:     String!
      recordIndex:  Int!
      planServices: [String!]!
    ): SavePlanServicesResponse!

    saveVendorServices(
      uploadId:       String!
      recordIndex:    Int!
      vendorServices: [String!]!
      planServices:   [String!]!
      comments:       String!
      serviceVendorReview: [ServiceVendorReviewInput!]
      adjusterComments:    String
      adjusterSubmittedBy: String
    ): SaveVendorServicesResponse!

    reviewServiceVendor(
      uploadId:       String!
      recordIndex:    Int!
      roleName:       String!
      selectedVendor: String!
      reviewedBy:     String!
      token:          String
    ): SaveVendorServicesResponse!

    confirmSupervisorReview(
      uploadId:    String!
      recordIndex: Int!
      reviews:     [SupervisorReviewDecisionInput!]!
      reviewedBy:  String!
      token:       String!
    ): SaveVendorServicesResponse!

    saveChangeLog(
      uploadId:      String!
      recordIndex:   Int!
      claimNumber:   String
      type:          String!
      changedItem:   String!
      previousValue: String!
      updatedValue:  String!
      reason:        String!
      updatedBy:     String
    ): SavePlanServicesResponse!

    completeClaim(
      uploadId:     String!
      recordIndex:  Int!
      completedBy:  String
      token:        String
    ): CompleteClaimResponse!
  }

  type ChangeLogEntry {
    id:            String
    uploadId:      String
    recordIndex:   Int
    claimNumber:   String
    type:          String
    changedItem:   String
    previousValue: String
    updatedValue:  String
    reason:        String
    updatedBy:     String
    updatedAt:     String
  }

  type Query {
    uploadedClaims: [UploadedClaimsGridRow!]!
    uploadedClaimDetails(uploadId: String!): UploadedClaimDetails
    getAllClaimRecords: [ClaimRecord!]!
    getAllVendorNames: [String!]!
    getVendorsByRoleIds(roleIds: [String!]!): [String!]!
    getVendorsByRoleIdsWithDetails(roleIds: [String!]!): [VendorOption!]!
    getChangeLog(uploadId: String!, recordIndex: Int!): [ChangeLogEntry!]!
    getSupervisorReviewedClaims(adjusterName: String!): [SupervisorReviewedClaim!]!
  }

  type VendorOption {
    companyName:  String!
    rating:       Float
    boostApplied: Boolean
  }
`;

// ─── Record extraction helpers ────────────────────────────────────────────────

interface RawRecord {
  claimNumber:  string;
  policyNumber: string;
  insuredName:  string;
  claimType:    string;
  lossDate:     string;
  reportedDate: string;
  claimAmount:  string;
  claimStatus:  string;
  [key: string]: unknown; // extra dynamic fields preserved from the source file
}

function pick(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k] ?? obj[k.toLowerCase()] ?? obj[k.toUpperCase()];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

// All key variants for the known fields — anything NOT in this set is a dynamic extra field
const KNOWN_KEY_VARIANTS = new Set([
  'claimNumber', 'ClaimNumber', 'claim_number',
  'policyNumber', 'PolicyNumber', 'policy_number',
  'insuredName', 'InsuredName', 'insured_name', 'insured',
  'claimType', 'ClaimType', 'claim_type',
  'lossDate', 'LossDate', 'loss_date',
  'reportedDate', 'ReportedDate', 'reported_date',
  'claimAmount', 'ClaimAmount', 'claim_amount', 'amount',
  'claimStatus', 'ClaimStatus', 'claim_status', 'status',
]);

function toCamelCase(key: string): string {
  return key
    .replace(/[_\s-]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/[_\s-]+$/, '');
}

function normaliseRaw(obj: Record<string, unknown>): RawRecord {
  const known: RawRecord = {
    claimNumber:  pick(obj, 'claimNumber',  'ClaimNumber',  'claim_number'),
    policyNumber: pick(obj, 'policyNumber', 'PolicyNumber', 'policy_number'),
    insuredName:  pick(obj, 'insuredName',  'InsuredName',  'insured_name',  'insured'),
    claimType:    pick(obj, 'claimType',    'ClaimType',    'claim_type'),
    lossDate:     pick(obj, 'lossDate',     'LossDate',     'loss_date'),
    reportedDate: pick(obj, 'reportedDate', 'ReportedDate', 'reported_date'),
    claimAmount:  pick(obj, 'claimAmount',  'ClaimAmount',  'claim_amount',  'amount'),
    claimStatus:  pick(obj, 'claimStatus',  'ClaimStatus',  'claim_status',  'status') || 'Active',
  };

  // Capture extra fields not covered by the known set, normalised to camelCase
  for (const [key, val] of Object.entries(obj)) {
    if (!KNOWN_KEY_VARIANTS.has(key) && val !== undefined && val !== null && String(val).trim() !== '') {
      const camel = toCamelCase(key);
      known[camel] = val;
    }
  }

  return known;
}

const REQUIRED_CLAIM_FIELDS = ['claimNumber', 'policyNumber', 'insuredName', 'claimType'] as const;

function validateRawRecord(raw: RawRecord): { valid: boolean; message: string } {
  const missing = REQUIRED_CLAIM_FIELDS.filter((f) => !raw[f]);
  if (missing.length > 0) {
    console.warn('[validateRawRecord] Validation failed. Missing fields:', missing, '| Raw record keys:', Object.keys(raw), '| Values:', JSON.stringify(raw));
    return { valid: false, message: `Missing required fields: ${missing.join(', ')}` };
  }
  if (!mapClaimTypeToLOB(raw['claimType'])) {
    return {
      valid: false,
      message: `Unrecognised claimType "${raw['claimType']}". Use Homeowners, Renters, Landlord, Dwelling or Flood.`,
    };
  }
  return { valid: true, message: 'Passed' };
}

/** xml2js returns values wrapped in arrays when explicitArray:true */
function xmlStr(node: unknown): string {
  if (typeof node === 'string') return node.trim();
  if (Array.isArray(node) && node.length > 0) return String(node[0] ?? '').trim();
  return '';
}

function extractXmlRecords(parsed: Record<string, unknown>): RawRecord[] {
  const rootKey   = Object.keys(parsed)[0] ?? '';
  const root      = (parsed[rootKey] ?? {}) as Record<string, unknown>;

  // Support <claims><claim>…</claim></claims> or bare <claim>…</claim>
  let nodes: Record<string, unknown>[] = [];
  if (root['claim']) {
    const c = root['claim'];
    nodes = Array.isArray(c)
      ? (c as Record<string, unknown>[])
      : [c as Record<string, unknown>];
  } else {
    // Root element itself is a single claim
    nodes = [root];
  }

  return nodes.map((c) => ({
    claimNumber:  xmlStr(c['claimNumber']  ?? c['ClaimNumber']),
    policyNumber: xmlStr(c['policyNumber'] ?? c['PolicyNumber']),
    insuredName:  xmlStr(c['insuredName']  ?? c['InsuredName']),
    claimType:    xmlStr(c['claimType']    ?? c['ClaimType']),
    lossDate:     xmlStr(c['lossDate']     ?? c['LossDate']),
    reportedDate: xmlStr(c['reportedDate'] ?? c['ReportedDate']),
    claimAmount:  xmlStr(c['claimAmount']  ?? c['ClaimAmount']),
    claimStatus:  xmlStr(c['claimStatus']  ?? c['ClaimStatus']) || 'Active',
  }));
}

// ─── Helper: format date ──────────────────────────────────────────────────────

function formatDate(d: Date | undefined | null): string {
  if (!d) return '';
  return new Date(d).toISOString();
}

// ─── Plan Services: condition evaluation ─────────────────────────────────────

async function buildRoleConditionsMap(): Promise<{
  activeRoles: Array<{ roleId: string; roleName: string; lineOfBusiness?: string[] }>;
  condsByRole: Map<string, ConditionData[]>;
}> {
  const activeRoles = await ServiceRequestRoleModel.find({ status: 'Active' }).lean().exec();
  const condsByRole = new Map<string, ConditionData[]>();

  if (activeRoles.length > 0) {
    const rawConditions = await ServiceRequestRoleConditionModel
      .find({ roleId: { $in: activeRoles.map((r) => r.roleId) } })
      .lean()
      .exec();

    for (const c of rawConditions) {
      const cond: ConditionData = {
        roleId:        c.roleId,
        fieldName:     c.fieldName,
        operator:      c.operator,
        value:         c.value,
        conditionType: c.conditionType,
        sortOrder:     c.sortOrder,
      };
      if (!condsByRole.has(c.roleId)) condsByRole.set(c.roleId, []);
      condsByRole.get(c.roleId)!.push(cond);
    }
  }

  return { activeRoles, condsByRole };
}

function matchRolesForRecord(
  record: Record<string, unknown>,
  activeRoles: Array<{ roleId: string; roleName: string; lineOfBusiness?: string[] }>,
  condsByRole: Map<string, ConditionData[]>,
): string[] {
  const recordLOB = mapClaimTypeToLOB(getClaimField(record, 'claimType'));
  const matched: string[] = [];
  if (!recordLOB) return matched;   // unrecognised claimType: no rules apply
  for (const role of activeRoles) {
    // Only rules configured for this claim's LOB are eligible — a role may
    // now be configured for more than one LOB, and a single bulk upload can
    // mix claimTypes/LOBs across records, so this must be checked per-record
    // rather than once for the whole batch.
    const roleLOBs = role.lineOfBusiness ?? [];
    if (!roleLOBs.includes(recordLOB)) continue;
    const conds = condsByRole.get(role.roleId) ?? [];
    if (evaluateRoleConditions(record, conds)) {
      matched.push(role.roleId);   // store roleId, not roleName
    }
  }
  return matched;
}

// Direct lookup: vendor_details.serviceRequestRoleId $in planServiceIds
async function getSuggestedVendors(planServiceIds: string[]): Promise<string[]> {
  if (!planServiceIds.length) return [];
  try {
    const vendors = await VendorModel
      .find({ serviceRequestRoleId: { $in: planServiceIds } })
      .lean()
      .exec();
    return vendors
      .map((v) => String((v as Record<string, unknown>)['companyName'] ?? ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Resolve roleIds → display names in a single DB query
async function resolveRoleNames(roleIds: string[]): Promise<string[]> {
  if (!roleIds.length) return [];
  try {
    const roles = await ServiceRequestRoleModel
      .find({ roleId: { $in: roleIds } })
      .lean()
      .exec();
    const map = new Map(roles.map((r) => [r.roleId, r.roleName]));
    return roleIds.map((id) => map.get(id) ?? id);
  } catch {
    return [];
  }
}

// Guards against a role selected for a claim that belongs to a different LOB
// (e.g. a Flood rule submitted against a Renters claim) — the UI already filters
// the choices it offers by LOB, so this only ever fires on stale/tampered
// input, but it's the enforcement point since the UI filter alone isn't a
// server-side guarantee.
async function validateRolesMatchClaimLOB(
  claimType: string,
  roleIds: string[],
): Promise<{ valid: boolean; invalidRoleNames: string[] }> {
  if (!roleIds.length) return { valid: true, invalidRoleNames: [] };
  const claimLOB = mapClaimTypeToLOB(claimType);
  const roles = await ServiceRequestRoleModel.find({ roleId: { $in: roleIds } }).lean().exec();
  const invalidRoleNames = roles
    .filter((r) => !claimLOB || !(r.lineOfBusiness ?? []).includes(claimLOB))
    .map((r) => r.roleName);
  return { valid: invalidRoleNames.length === 0, invalidRoleNames };
}

// ─── Property fields: read-only, extracted from the nested sub-documents that
// uploads and the seed populate (lossInformation / policyInformation /
// claimInformation / financialExposure / property / assignment). Not part of
// the declared schema (strict:false), so docs that lack these keys simply
// resolve every field to ''.
interface PropertyFields {
  causeOfLoss:       string;
  damagedAreas:      string;
  policyForm:        string;
  severity:          string;
  jurisdiction:      string;
  floodZone:         string;
  coverageALimit:    string;
  buildingExposure:  string;
  contentsExposure:  string;
  propertyAddress:   string;
  assignedAdjuster:  string;
  contractorName:    string;
}

function extractPropertyFields(doc: Record<string, unknown>): PropertyFields {
  const lossInfo   = (doc['lossInformation']   ?? {}) as Record<string, unknown>;
  const policyInfo = (doc['policyInformation'] ?? {}) as Record<string, unknown>;
  const claimInfo  = (doc['claimInformation']  ?? {}) as Record<string, unknown>;
  const financials = (doc['financialExposure'] ?? {}) as Record<string, unknown>;
  const property   = (doc['property']          ?? {}) as Record<string, unknown>;
  const assignment = (doc['assignment']        ?? {}) as Record<string, unknown>;

  const areasRaw = lossInfo['damagedAreas'];
  const damagedAreas = Array.isArray(areasRaw) ? areasRaw.join(', ') : String(areasRaw ?? '');

  const claimSeverity = claimInfo['claimSeverity'];
  const severityScore = claimInfo['severityScore'];
  const severity = claimSeverity != null && severityScore != null
    ? `${claimSeverity} (${severityScore})`
    : String(claimSeverity ?? severityScore ?? '');

  const money = (v: unknown): string => (v != null ? String(v) : '');

  return {
    causeOfLoss:      String(lossInfo['causeOfLoss'] ?? ''),
    damagedAreas,
    policyForm:       String(policyInfo['policyForm'] ?? ''),
    severity,
    jurisdiction:     String(claimInfo['jurisdiction'] ?? ''),
    floodZone:        String(policyInfo['floodZone'] ?? ''),
    coverageALimit:   money(policyInfo['coverageALimit']),
    buildingExposure: money(financials['buildingExposure']),
    contentsExposure: money(financials['contentsExposure']),
    propertyAddress:  String(property['address'] ?? ''),
    assignedAdjuster: String(assignment['assignedAdjuster'] ?? ''),
    contractorName:   String(assignment['contractorName'] ?? ''),
  };
}

async function computePlanServicesForRecords(
  docs: Array<Record<string, unknown>>
): Promise<string[][]> {
  try {
    const { activeRoles, condsByRole } = await buildRoleConditionsMap();
    if (activeRoles.length === 0) return docs.map(() => []);
    return docs.map((doc) => matchRolesForRecord(doc, activeRoles, condsByRole));
  } catch {
    return docs.map(() => []);
  }
}

// ─── Per-service vendor review helpers ─────────────────────────────────────────

interface ServiceVendorReviewEntry {
  roleName:           string;
  changeType?:        string;   // 'ProviderChange' | 'ServiceAdded' — absent on legacy entries predating this field
  recommendedVendor:  string;
  proposedVendor?:    string;   // Adjuster's original pick — frozen, never overwritten by Supervisor review
  selectedVendor:     string;
  status:             string;   // 'Locked' | 'Pending Review' | 'Modified' | 'Included' | 'Rejected'
  confirmedBy:        string;
  confirmedAt:        string;
  reviewedBy?:         string;
  reviewedAt?:          string;
  supervisorComment?:  string;
  adjusterComment?:    string;
}

// Claim-wide status is derived from the per-service array: Pending Review if
// any service is still awaiting Supervisor review, else Finalized Selection.
function deriveClaimStatus(serviceVendorReview: ServiceVendorReviewEntry[]): string {
  return serviceVendorReview.some((e) => e.status === 'Pending Review')
    ? 'Pending Review'
    : 'Finalized Selection';
}

// ─── GraphQL Resolvers ────────────────────────────────────────────────────────

export const resolvers = {
  Mutation: {
    saveDraftPlanServices: async (
      _parent: unknown,
      args: { uploadId: string; recordIndex: number; planServices: string[] }
    ) => {
      try {
        const existing = await ClaimRecordModel.findOne(
          { uploadId: args.uploadId, recordIndex: args.recordIndex }
        ).lean().exec();
        if (!existing) return { success: false, message: 'Claim record not found.' };

        const { valid, invalidRoleNames } = await validateRolesMatchClaimLOB(existing.claimType, args.planServices);
        if (!valid) {
          return { success: false, message: `The following services do not belong to this claim's line of business: ${invalidRoleNames.join(', ')}` };
        }

        const result = await ClaimRecordModel.findOneAndUpdate(
          { uploadId: args.uploadId, recordIndex: args.recordIndex },
          { planServices: args.planServices },
          { new: true }
        );
        if (!result) return { success: false, message: 'Claim record not found.' };
        return { success: true, message: 'Draft saved.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.saveDraftPlanServices');
        return { success: false, message: 'Failed to save draft.' };
      }
    },

    savePlanServices: async (
      _parent: unknown,
      args: { uploadId: string; recordIndex: number; planServices: string[]; comments: string }
    ) => {
      try {
        const existing = await ClaimRecordModel.findOne(
          { uploadId: args.uploadId, recordIndex: args.recordIndex }
        ).lean().exec();
        if (!existing) return { success: false, message: 'Claim record not found.' };

        const { valid, invalidRoleNames } = await validateRolesMatchClaimLOB(existing.claimType, args.planServices);
        if (!valid) {
          return { success: false, message: `The following services do not belong to this claim's line of business: ${invalidRoleNames.join(', ')}` };
        }

        const result = await ClaimRecordModel.findOneAndUpdate(
          { uploadId: args.uploadId, recordIndex: args.recordIndex },
          {
            planServices:          args.planServices,
            confirmedPlanServices: args.planServices, // snapshot of what user confirmed
            planServiceStatus:     'Pending Selection',
            planServiceComments:   args.comments,
          },
          { new: true }
        );
        if (!result) return { success: false, message: 'Claim record not found.' };
        return { success: true, message: 'Plan services saved successfully.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.savePlanServices');
        return { success: false, message: 'Failed to save plan services.' };
      }
    },

    saveVendorServices: async (
      _parent: unknown,
      args: {
        uploadId: string; recordIndex: number; vendorServices: string[]; planServices: string[]; comments: string;
        serviceVendorReview?: ServiceVendorReviewEntry[];
        adjusterComments?: string; adjusterSubmittedBy?: string;
      }
    ) => {
      try {
        const existing = await ClaimRecordModel.findOne(
          { uploadId: args.uploadId, recordIndex: args.recordIndex }
        ).lean().exec();
        if (!existing) return { success: false, message: 'Claim record not found.' };

        const { valid, invalidRoleNames } = await validateRolesMatchClaimLOB(existing.claimType, args.planServices);
        if (!valid) {
          return { success: false, message: `The following services do not belong to this claim's line of business: ${invalidRoleNames.join(', ')}` };
        }

        // Merge (upsert-by-roleName), not overwrite — the caller only ever sends
        // entries for services that aren't already Locked, so any Locked or
        // Pending Review entry not present in this call's payload is preserved
        // as-is (see claimIntakeDetails.tsx confirmVendorSelection) — UNLESS
        // that role was actually removed from the plan (no longer in
        // args.planServices) AND its status isn't 'Rejected', in which case
        // its stale entry must be pruned, not preserved: leaving it behind
        // (e.g. an old 'Locked' entry for a service the user just
        // deselected) let getServiceStatus() keep reporting that role as
        // still resolved/locked even after it was removed from
        // confirmedPlanServices/existingplanservices, causing confusing
        // "still shows as selected" symptoms on the details page despite the
        // plan itself being correctly updated. 'Rejected' entries are the
        // ONE exception — they're never in planServices by definition (that's
        // what being rejected means) but must persist permanently as the
        // historical record getSupervisorReviewedClaims/Supervisor Comments
        // reads — pruning those would silently destroy real review history.
        const existingReview: ServiceVendorReviewEntry[] = (existing.serviceVendorReview ?? []) as ServiceVendorReviewEntry[];
        const incoming = args.serviceVendorReview ?? [];
        const mergedByRole = new Map(existingReview.map((e) => [e.roleName, e]));
        for (const entry of incoming) mergedByRole.set(entry.roleName, entry);
        const currentRoles = await ServiceRequestRoleModel.find({ roleId: { $in: args.planServices } }).lean().exec();
        const currentRoleNames = new Set(currentRoles.map((r) => r.roleName));
        const mergedReview = [...mergedByRole.values()].filter(
          (e) => currentRoleNames.has(e.roleName) || e.status === 'Rejected'
        );

        const nextStatus = deriveClaimStatus(mergedReview);

        const update: Record<string, unknown> = {
          vendorServices:        args.vendorServices,
          existingplanservices:  args.planServices,
          vendorServiceComments: args.comments,
          planServiceStatus:     nextStatus,
          confirmedPlanServices: args.planServices,
          serviceVendorReview:   mergedReview,
        };

        // Only an Adjuster's Confirm Selection sends this arg — a Supervisor's
        // own Confirm Selection call (same mutation) omits it, so their review
        // never overwrites the Adjuster's stored submission comment.
        if (args.adjusterComments !== undefined) {
          update.adjusterComments    = args.adjusterComments;
          update.adjusterSubmittedBy = args.adjusterSubmittedBy ?? '';
          update.adjusterSubmittedAt = new Date().toISOString();
        }

        const result = await ClaimRecordModel.findOneAndUpdate(
          { uploadId: args.uploadId, recordIndex: args.recordIndex },
          update,
          { new: true }
        );
        if (!result) return { success: false, message: 'Claim record not found.' };
        return { success: true, message: 'Vendor services saved successfully.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.saveVendorServices');
        return { success: false, message: 'Failed to save vendor services.' };
      }
    },

    reviewServiceVendor: async (
      _parent: unknown,
      args: { uploadId: string; recordIndex: number; roleName: string; selectedVendor: string; reviewedBy: string; token?: string }
    ) => {
      try {
        const supervisor = await requireSupervisor(args.token ?? '');
        if (!supervisor) {
          return { success: false, message: 'Only a Claims Supervisor can review a vendor override.' };
        }

        const existing = await ClaimRecordModel.findOne(
          { uploadId: args.uploadId, recordIndex: args.recordIndex }
        ).lean().exec();
        if (!existing) return { success: false, message: 'Claim record not found.' };

        const existingReview: ServiceVendorReviewEntry[] = (existing.serviceVendorReview ?? []) as ServiceVendorReviewEntry[];
        const target = existingReview.find((e) => e.roleName === args.roleName);
        if (!target) return { success: false, message: `No pending review found for service "${args.roleName}".` };

        const reviewedAt = new Date().toISOString();
        const updatedReview = existingReview.map((e) => e.roleName === args.roleName
          ? { ...e, selectedVendor: args.selectedVendor, status: 'Locked', reviewedBy: args.reviewedBy, reviewedAt }
          : e);

        const nextStatus = deriveClaimStatus(updatedReview);
        const vendorServices = [...new Set(updatedReview.map((e) => e.selectedVendor).filter(Boolean))];

        const result = await ClaimRecordModel.findOneAndUpdate(
          { uploadId: args.uploadId, recordIndex: args.recordIndex },
          { serviceVendorReview: updatedReview, planServiceStatus: nextStatus, vendorServices },
          { new: true }
        );
        if (!result) return { success: false, message: 'Claim record not found.' };
        return { success: true, message: 'Service provider review completed.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.reviewServiceVendor');
        return { success: false, message: 'Failed to review service vendor.' };
      }
    },

    // Bulk-finalizes every Pending Review service on a claim in one action
    // (replaces the per-service reviewServiceVendor flow above for the new
    // Supervisor Review UI — that mutation is left in place, unused, per
    // "don't change existing APIs unless required"). Every decision must
    // carry a non-empty comment; a Rejected decision also drops that service
    // out of the confirmed plan entirely.
    confirmSupervisorReview: async (
      _parent: unknown,
      args: {
        uploadId: string; recordIndex: number; reviewedBy: string; token: string;
        reviews: { roleName: string; decision: string; finalVendor?: string; comment: string }[];
      }
    ) => {
      try {
        const supervisor = await requireSupervisor(args.token);
        if (!supervisor) {
          return { success: false, message: 'Only a Claims Supervisor can confirm a review.' };
        }
        if (args.reviews.some((r) => !r.comment?.trim())) {
          return { success: false, message: 'A comment is required for every reviewed change.' };
        }

        const existing = await ClaimRecordModel.findOne(
          { uploadId: args.uploadId, recordIndex: args.recordIndex }
        ).lean().exec();
        if (!existing) return { success: false, message: 'Claim record not found.' };

        const existingReview: ServiceVendorReviewEntry[] = (existing.serviceVendorReview ?? []) as ServiceVendorReviewEntry[];
        const decisionByRole = new Map(args.reviews.map((r) => [r.roleName, r]));
        const reviewedAt = new Date().toISOString();

        const updatedReview = existingReview.map((e) => {
          const decision = decisionByRole.get(e.roleName);
          if (!decision) return e;
          return {
            ...e,
            status:            decision.decision,
            selectedVendor:    decision.decision === 'Modified' && decision.finalVendor ? decision.finalVendor : e.selectedVendor,
            reviewedBy:        args.reviewedBy,
            reviewedAt,
            supervisorComment: decision.comment.trim(),
          };
        });

        const rejectedRoleNames = args.reviews.filter((r) => r.decision === 'Rejected').map((r) => r.roleName);
        let confirmedPlanServices = existing.confirmedPlanServices ?? [];
        let planServices          = existing.planServices ?? [];
        let existingplanservices  = existing.existingplanservices ?? [];

        if (rejectedRoleNames.length > 0) {
          const rejectedRoles = await ServiceRequestRoleModel.find({ roleName: { $in: rejectedRoleNames } }).lean().exec();
          const rejectedRoleIds = new Set(rejectedRoles.map((r) => r.roleId));
          confirmedPlanServices = confirmedPlanServices.filter((id) => !rejectedRoleIds.has(id));
          planServices          = planServices.filter((id) => !rejectedRoleIds.has(id));
          existingplanservices  = existingplanservices.filter((id) => !rejectedRoleIds.has(id));
        }

        // Rebuild vendorServices from the updated review (not carried forward from
        // `existing`) so a Supervisor's provider switch on a Modified role — or a
        // Rejected role's now-unused vendor — is actually reflected: previously this
        // array was only ever filtered for rejections, never updated with a switched
        // Modified role's new selectedVendor, so the claim kept showing the
        // Adjuster's original vendor as "confirmed" even after the Supervisor changed it.
        const vendorServices = [...new Set(
          updatedReview.filter((e) => e.status !== 'Rejected').map((e) => e.selectedVendor).filter(Boolean)
        )];

        const nextStatus = deriveClaimStatus(updatedReview);

        const result = await ClaimRecordModel.findOneAndUpdate(
          { uploadId: args.uploadId, recordIndex: args.recordIndex },
          {
            serviceVendorReview: updatedReview,
            planServiceStatus:   nextStatus,
            confirmedPlanServices, planServices, existingplanservices, vendorServices,
          },
          { new: true }
        );
        if (!result) return { success: false, message: 'Claim record not found.' };
        return { success: true, message: 'Review confirmed.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.confirmSupervisorReview');
        return { success: false, message: 'Failed to confirm review.' };
      }
    },

    saveChangeLog: async (
      _parent: unknown,
      args: { uploadId: string; recordIndex: number; claimNumber?: string; type: string; changedItem: string; previousValue: string; updatedValue: string; reason: string; updatedBy?: string }
    ) => {
      try {
        await new ChangeLogModel({
          uploadId:      args.uploadId,
          recordIndex:   args.recordIndex,
          claimNumber:   args.claimNumber ?? '',
          type:          args.type,
          changedItem:   args.changedItem,
          previousValue: args.previousValue,
          updatedValue:  args.updatedValue,
          reason:        args.reason,
          updatedBy:     args.updatedBy ?? 'admin',
          updatedAt:     new Date(),
        }).save();
        return { success: true, message: 'Change logged.' };
      } catch (err) {
        await logError(err as Error, 'GraphQL.saveChangeLog');
        return { success: false, message: 'Failed to log change.' };
      }
    },

    completeClaim: async (
      _parent: unknown,
      args: { uploadId: string; recordIndex: number; completedBy?: string; token?: string }
    ) => {
      try {
        const existing = await ClaimRecordModel.findOne(
          { uploadId: args.uploadId, recordIndex: args.recordIndex }
        ).lean().exec();
        if (!existing) return { success: false, message: 'Claim record not found.' };

        if (existing.planServiceStatus === 'Pending Review') {
          const supervisor = await requireSupervisor(args.token ?? '');
          if (!supervisor) {
            return { success: false, message: 'Only a Claims Supervisor can complete a claim pending review.' };
          }
        }

        const completedAt  = new Date();
        const completedBy  = args.completedBy ?? 'admin';
        const result = await ClaimRecordModel.findOneAndUpdate(
          { uploadId: args.uploadId, recordIndex: args.recordIndex },
          {
            planServiceStatus: 'Completed',
            isCompleted:       true,
            completedAt,
            completedBy,
          },
          { new: true }
        );
        if (!result) return { success: false, message: 'Claim record not found.' };
        return { success: true, message: 'Claim marked as completed.', completedAt: completedAt.toISOString() };
      } catch (err) {
        await logError(err as Error, 'GraphQL.completeClaim');
        return { success: false, message: 'Failed to complete claim.' };
      }
    },

    uploadClaim: async (
      _parent: unknown,
      args: {
        uploadType:  string;
        fileName?:   string;
        jsonPayload?: string;
        xmlPayload?:  string;
        excelBase64?: string;
        uploadedBy?:  string;
      }
    ) => {
      try {
        const uploadId = uuidv4();
        const now      = new Date();
        let rawRecords: RawRecord[]  = [];
        let overallValidation        = 'PASS';
        let overallMessage           = '';
        let overallStatus            = 'Processed';

        // ── Excel ─────────────────────────────────────────────────────────
        if (args.uploadType === 'EXCEL' && args.excelBase64) {
          const buffer = Buffer.from(args.excelBase64, 'base64');
          const parsed = await parseExcelFile(buffer, args.fileName ?? 'upload.xlsx');
          if (!parsed.success) {
            overallValidation = parsed.validationResult;
            overallMessage    = parsed.message;
            overallStatus     = 'Failed';
          } else {
            rawRecords = (parsed.data?.rawData ?? []).map(
              (r) => normaliseRaw(r as Record<string, unknown>)
            );
          }
        }

        // ── JSON (single object OR array of objects) ───────────────────────
        if (args.uploadType === 'JSON' && args.jsonPayload) {
          try {
            const json: unknown = JSON.parse(args.jsonPayload);
            if (Array.isArray(json)) {
              rawRecords = json.map((item) => normaliseRaw(item as Record<string, unknown>));
            } else if (typeof json === 'object' && json !== null) {
              rawRecords = [normaliseRaw(json as Record<string, unknown>)];
            } else {
              overallValidation = 'CI-004';
              overallMessage    = 'JSON payload must be an object or array of claim objects.';
              overallStatus     = 'Failed';
            }
          } catch {
            overallValidation = 'CI-004';
            overallMessage    = 'Invalid JSON format.';
            overallStatus     = 'Failed';
          }
        }

        // ── XML (single <claim> OR <claims><claim>…</claim></claims>) ──────
        if (args.uploadType === 'XML' && args.xmlPayload) {
          try {
            const parsed = await parseStringPromise(args.xmlPayload, {
              trim:          true,
              explicitArray: true,
            }) as Record<string, unknown>;
            rawRecords = extractXmlRecords(parsed);
            if (rawRecords.length === 0) {
              overallValidation = 'CI-005';
              overallMessage    = 'No claim records found in XML payload.';
              overallStatus     = 'Failed';
            }
          } catch (e) {
            overallValidation = 'CI-005';
            overallMessage    = `Invalid XML: ${(e as Error).message}`;
            overallStatus     = 'Failed';
          }
        }

        // ── Validate + build individual claim record docs ──────────────────
        const baseDocs = rawRecords.map((raw, idx) => {
          const { valid, message } = validateRawRecord(raw);
          return {
            uploadId,
            recordIndex:       idx + 1,
            ...raw,
            validationStatus:  valid ? 'Passed' : 'Failed',
            validationMessage: message,
          };
        });

        const totalClaims  = baseDocs.length;
        const successCount = baseDocs.filter((r) => r.validationStatus === 'Passed').length;
        const failedCount  = baseDocs.filter((r) => r.validationStatus === 'Failed').length;

        if (failedCount > 0 && successCount === 0) overallStatus = 'Failed';
        else if (failedCount > 0)                  overallStatus = 'Partial';

        // ── Evaluate plan services for each record ─────────────────────────
        const planServicesPerRecord = await computePlanServicesForRecords(baseDocs);
        const claimDocs = baseDocs.map((doc, i) => ({
          ...doc,
          planServices:        planServicesPerRecord[i] ?? [],
          planServiceStatus:   'Pending Selection',
          planServiceComments: '',
        }));

        // ── Upsert claim records: update existing by claimNumber, insert new ─
        // planServices = only NEWLY eligible roles (confirmed roles are in confirmedPlanServices)
        // confirmedPlanServices: never overwritten by re-upload (only by savePlanServices)
        if (claimDocs.length > 0) {
          // Pre-query: get existing confirmedPlanServices so we can exclude them from planServices
          // Pre-query existing confirmedPlanServices + status for each claim number
          const existingConfirmedMap  = new Map<string, string[]>();
          const existingPlanServicesMap  = new Map<string, string[]>();
          const existingStatusMap     = new Map<string, string>();
          let existingClaim :any = null;
          try {
            const nums = claimDocs.map(d => String((d as Record<string, unknown>)['claimNumber'] ?? '')).filter(Boolean);
            if (nums.length > 0) {
              const rows = await ClaimRecordModel
                .find({ claimNumber: { $in: nums } })
                .select('claimNumber confirmedPlanServices planServiceStatus planServices')
                .lean()
                .exec();
              rows.forEach(r => {
                const num = String(r.claimNumber);
                existingClaim = num;
                existingConfirmedMap.set(num, Array.isArray(r.confirmedPlanServices) ? r.confirmedPlanServices as string[] : []);
                existingPlanServicesMap.set(num, Array.isArray(r.planServices) ? r.planServices as string[] : []);
                existingStatusMap.set(num, String(r.planServiceStatus ?? 'Pending Selection'));
              });
            }
          } catch (preQueryErr) {
            await logError(preQueryErr as Error, 'uploadClaim.preQueryConfirmed');
          }

          const bulkOps = claimDocs.map((doc) => {
            const {
              uploadId: docUploadId,
              recordIndex,
              planServiceComments,
              planServices: allMatchedServices,
              planServiceStatus: _psStatus,
              ...otherFields
            } = doc;

            const claimNum      = String((doc as Record<string, unknown>)['claimNumber'] ?? '');
            const confirmedIds  = existingConfirmedMap.get(claimNum) ?? [];
            const existingPlanServicesId = existingPlanServicesMap.get(claimNum) ?? [];
            const currentStatus = existingStatusMap.get(claimNum)    ?? '';
            const allMatched    = (allMatchedServices as string[]) ?? [];
            let autoConfirmedPS: string[] = [];
            let statusToSet: string = currentStatus || 'Pending Selection';
            // planServices = newly eligible roles not yet in confirmedPlanServices
            const newEligiblePS = allMatched.filter(id => !confirmedIds.includes(id));

           // Auto-confirm: merge new eligible roles into confirmedPlanServices (no duplicates)
           if(existingClaim){
            autoConfirmedPS = newEligiblePS.length > 0
              ? [...new Set([...confirmedIds, ...existingPlanServicesId])]
              : confirmedIds;
            
            // Advance to Pending Selection when new roles are auto-confirmed; otherwise preserve existing status
            
          }
          statusToSet = currentStatus=== 'Finalized Selection' || currentStatus=== 'Completed' ? 'Pending Selection' : statusToSet;
          console.log(`Existing `+currentStatus);

            const setPayload = {
              ...otherFields,
              planServices:          newEligiblePS,
              confirmedPlanServices: autoConfirmedPS,
              planServiceStatus:     statusToSet,
            } as Record<string, unknown>;

            return {
              updateOne: {
                filter: { claimNumber: (doc as Record<string, unknown>)['claimNumber'] },
                update: {
                  $set: setPayload,
                  $setOnInsert: {
                    uploadId:              docUploadId,
                    recordIndex,
                    planServiceComments:   '',
                    vendorServices:        [],
                    vendorServiceComments: '',
                  },
                },
                upsert: true,
              },
            };
          });
          await ClaimRecordModel.bulkWrite(bulkOps as Parameters<typeof ClaimRecordModel.bulkWrite>[0]);
        }

        const failedDetails = baseDocs
          .filter((d) => d.validationStatus === 'Failed')
          .map((d) => `Record ${d.recordIndex}: ${d.validationMessage}`)
          .join(' | ');

        const processingMsg = overallMessage ||
          (failedCount > 0
            ? `Processed ${totalClaims} claim(s). Success: ${successCount}, Failed: ${failedCount}. ${failedDetails}`
            : `Processed ${totalClaims} claim(s). All succeeded.`);

        // ── Persist upload record ──────────────────────────────────────────
        await new ClaimIntakeModel({
          uploadId,
          fileName:           args.fileName ?? '',
          uploadType:         args.uploadType,
          uploadedBy:         args.uploadedBy ?? 'System',
          uploadDate:         now,
          status:             overallStatus,
          totalClaims,
          successCount,
          failedCount,
          validationResults:  overallValidation,
          processingMessages: processingMsg,
        }).save();

        await new ClaimIntakeAuditModel({
          uploadId,
          action:    'UPLOAD',
          user:      args.uploadedBy ?? 'System',
          timestamp: now,
          status:    overallStatus,
          remarks:   `${args.uploadType} upload — ${totalClaims} record(s)`,
        }).save();

        return {
          uploadId,
          totalClaims,
          successCount,
          failedCount,
          status:          overallStatus,
          validationResult: overallValidation,
          message:         processingMsg,
          success:         overallStatus !== 'Failed',
        };
      } catch (err) {
        await logError(err as Error, 'GraphQL.uploadClaim');
        return {
          uploadId: '', totalClaims: 0, successCount: 0, failedCount: 0,
          status: 'Error', validationResult: '', message: 'Failed to create upload record.', success: false,
        };
      }
    },
  },

  Query: {
    getAllClaimRecords: async () => {
      try {
        const records = await ClaimRecordModel.find({}).sort({ _id: -1 }).lean().exec();

        // Batch-resolve plan service role names for all records
        const allRoleIds = [...new Set(records.flatMap((r) => r.planServices ?? []))];
        const roleNameRows = allRoleIds.length > 0
          ? await ServiceRequestRoleModel.find({ roleId: { $in: allRoleIds } }).lean().exec()
          : [];
        const roleNameMap = new Map(roleNameRows.map((r) => [r.roleId, r.roleName]));

        return records.map((r) => {
          const planServiceNames = (r.planServices ?? []).map((id) => roleNameMap.get(id) ?? id);
          return {
            uploadId:              r.uploadId,
            recordIndex:           r.recordIndex,
            claimNumber:           r.claimNumber,
            policyNumber:          r.policyNumber,
            insuredName:           r.insuredName,
            claimType:             r.claimType,
            lossDate:              r.lossDate,
            reportedDate:          r.reportedDate,
            claimAmount:           r.claimAmount,
            claimStatus:           r.claimStatus,
            validationStatus:      r.validationStatus,
            validationMessage:     r.validationMessage,
            planServices:          r.planServices ?? [],
            planServiceNames,
            confirmedPlanServices: r.confirmedPlanServices ?? [],
            existingplanservices:  r.existingplanservices ?? [],
            planServiceStatus:     r.planServiceStatus ?? 'Pending Selection',
            planServiceComments:   r.planServiceComments ?? '',
            vendorServices:        r.vendorServices ?? [],
            vendorServiceComments: r.vendorServiceComments ?? '',
            serviceVendorReview:   r.serviceVendorReview ?? [],
            suggestedVendors:      [],
            ...extractPropertyFields(r as unknown as Record<string, unknown>),
          };
        });
      } catch (err) {
        await logError(err as Error, 'GraphQL.getAllClaimRecords');
        return [];
      }
    },

    getAllVendorNames: async () => {
      try {
        const vendors = await VendorModel.find({}).lean().exec();
        return vendors
          .map((v) => String((v as Record<string, unknown>)['companyName'] ?? ''))
          .filter(Boolean)
          .sort();
      } catch (err) {
        await logError(err as Error, 'GraphQL.getAllVendorNames');
        return [];
      }
    },

    getVendorsByRoleIds: async (_parent: unknown, args: { roleIds: string[] }) => {
      return getSuggestedVendors(args.roleIds);
    },

    getVendorsByRoleIdsWithDetails: async (_parent: unknown, args: { roleIds: string[] }) =>
      getActiveVendorsByRoleIds(args.roleIds),

    getChangeLog: async (_parent: unknown, args: { uploadId: string; recordIndex: number }) => {
      try {
        const entries = await ChangeLogModel
          .find({ uploadId: args.uploadId, recordIndex: args.recordIndex })
          .sort({ updatedAt: -1 })
          .lean()
          .exec();
        return entries.map((e) => ({
          id:            (e as Record<string, unknown>)['_id']?.toString() ?? '',
          uploadId:      e.uploadId,
          recordIndex:   e.recordIndex,
          claimNumber:   e.claimNumber,
          type:          e.type,
          changedItem:   e.changedItem,
          previousValue: e.previousValue,
          updatedValue:  e.updatedValue,
          reason:        e.reason,
          updatedBy:     e.updatedBy,
          updatedAt:     e.updatedAt instanceof Date ? e.updatedAt.toISOString() : String(e.updatedAt ?? ''),
        }));
      } catch (err) {
        await logError(err as Error, 'GraphQL.getChangeLog');
        return [];
      }
    },

    // Every claim where this Adjuster's own override was reviewed by a
    // Claims Supervisor — powers the Supervisor Comments page (FRD §10).
    getSupervisorReviewedClaims: async (_parent: unknown, args: { adjusterName: string }) => {
      try {
        const TERMINAL_STATUSES = ['Modified', 'Included', 'Rejected'];
        const records = await ClaimRecordModel.find({
          serviceVendorReview: {
            $elemMatch: { confirmedBy: args.adjusterName, status: { $in: TERMINAL_STATUSES } },
          },
        }).lean().exec();

        const claims = records.map((r) => {
          const review = (r.serviceVendorReview ?? []) as ServiceVendorReviewEntry[];
          const items = review
            .filter((e) => e.confirmedBy === args.adjusterName && TERMINAL_STATUSES.includes(e.status))
            .map((e) => {
              const isServiceAdded = e.changeType === 'ServiceAdded';
              const displayChangeType = !isServiceAdded
                ? 'Provider Change'
                : e.status === 'Rejected' ? 'Service Removed' : 'Service Added';
              const originalValue = isServiceAdded ? 'Added' : (e.proposedVendor || e.selectedVendor);
              const finalValue = isServiceAdded
                ? (e.status === 'Rejected' ? 'Removed' : 'Included')
                : e.selectedVendor;
              return {
                roleName:          e.roleName,
                changeType:        e.changeType ?? 'ProviderChange',
                displayChangeType,
                originalValue,
                finalValue,
                finalBadge:        e.status,
                supervisorComment: e.supervisorComment ?? '',
                reviewedBy:        e.reviewedBy ?? '',
                reviewedAt:        e.reviewedAt ?? '',
              };
            })
            .sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''));

          return {
            uploadId:       r.uploadId,
            recordIndex:    r.recordIndex,
            claimNumber:    r.claimNumber,
            insuredName:    r.insuredName,
            claimType:      r.claimType,
            lastReviewedAt: items[0]?.reviewedAt ?? '',
            items,
          };
        }).filter((c) => c.items.length > 0);

        claims.sort((a, b) => b.lastReviewedAt.localeCompare(a.lastReviewedAt));
        return claims;
      } catch (err) {
        await logError(err as Error, 'GraphQL.getSupervisorReviewedClaims');
        return [];
      }
    },

    uploadedClaims: async () => {
      try {
        const docs = await ClaimIntakeModel.find({}).sort({ uploadDate: -1 }).lean().exec();

        // Batch-fetch the first claim record for each upload in one query
        const uploadIds = docs.map((d) => d.uploadId);
        const firstRecords = uploadIds.length > 0
          ? await ClaimRecordModel
              .find({ uploadId: { $in: uploadIds }, recordIndex: 1 })
              .select('uploadId claimNumber')
              .lean()
              .exec()
          : [];
        const claimNumberMap = new Map(firstRecords.map((r) => [r.uploadId, r.claimNumber]));

        return docs.map((d) => ({
          uploadId:    d.uploadId,
          fileName:    d.fileName,
          claimNumber: claimNumberMap.get(d.uploadId) ?? '',
          uploadType:  d.uploadType,
          totalClaims: d.totalClaims ?? 0,
          uploadedBy:  d.uploadedBy,
          uploadDate:  formatDate(d.uploadDate),
          status:      d.status,
        }));
      } catch (err) {
        await logError(err as Error, 'GraphQL.uploadedClaims');
        return [];
      }
    },

    uploadedClaimDetails: async (_parent: unknown, args: { uploadId: string }) => {
      try {
        const doc = await ClaimIntakeModel
          .findOne({ uploadId: args.uploadId })
          .lean()
          .exec();

        if (!doc) return null;

        const records = await ClaimRecordModel
          .find({ uploadId: args.uploadId })
          .sort({ recordIndex: 1 })
          .lean()
          .exec();

        // Re-evaluate plan services dynamically for every pending record so
        // newly configured roles/conditions are always reflected.
        const { activeRoles, condsByRole } = await buildRoleConditionsMap();

        // Compute planServices (roleIds) for each record. 'Pending Review' and
        // 'Completed' are reachable ONLY after at least one plan/vendor confirm
        // cycle (deriveClaimStatus / completeClaim) — they are never a claim's
        // starting state — so they must be treated the same as 'Pending
        // Selection'/'Finalized Selection' here: trust the stored planServices
        // (a Supervisor's Rejected/Included decision lives there), not a fresh
        // rules re-match. Excluding them used to make this branch return ONLY
        // matchRolesForRecord()'s output while a claim sat in Pending Review —
        // silently discarding a manually-added service (which by definition
        // isn't a rule match) and any Supervisor removal, so the removed role
        // reappeared the moment the Supervisor's own Confirm Selection routed
        // back through here with another still-pending service on the claim.
        const isRecordConfirmed = (status: string) =>
          status === 'Pending Selection'
          || status === 'Finalized Selection'
          || status === 'Pending Review'
          || status === 'Completed';
        const computedPlanServices = records.map((r) => {
          return isRecordConfirmed(r.planServiceStatus ?? '')
            ? (r.planServices ?? [])
            : matchRolesForRecord(r as unknown as Record<string, unknown>, activeRoles, condsByRole);
        });

        // Batch-resolve all unique roleIds (suggested + confirmed) → display names
        const confirmedIds = records.flatMap(r => r.confirmedPlanServices ?? []);
        const allRoleIds = [...new Set([...computedPlanServices.flat(), ...confirmedIds])];
        const roleNameRows = allRoleIds.length > 0
          ? await ServiceRequestRoleModel.find({ roleId: { $in: allRoleIds } }).lean().exec()
          : [];
        const roleNameMap = new Map(roleNameRows.map((r) => [r.roleId, r.roleName]));

        // Batch-compute suggested vendors for "Pending Selection" records
        const suggestedVendorsCache = new Map<number, string[]>();
        for (let i = 0; i < records.length; i++) {
          const r = records[i];
          if (r.planServiceStatus === 'Pending Selection') {
            suggestedVendorsCache.set(
              r.recordIndex,
              await getSuggestedVendors(computedPlanServices[i] ?? [])
            );
          }
        }

        const mappedRecords = records.map((r, i) => {
          // Always use fresh dynamic matches so newly eligible roles are always visible
          const dynamicMatches = computedPlanServices[i] ?? [];

          // For confirmed records: merge stored confirmed IDs with new dynamic matches
          // so the UI shows both confirmed roles + newly eligible roles
          const planServices = isRecordConfirmed(r.planServiceStatus ?? '')
            ? [...new Set([...(r.planServices ?? []), ...dynamicMatches])]
            : dynamicMatches;
          const planServiceNames = planServices.map((id) => roleNameMap.get(id) ?? id);

          // confirmedPlanServiceNames = ONLY from confirmedPlanServices field
          // No backward-compat fallback to planServices (which may include new eval results)
          const confirmedPlanServicesIds  = r.confirmedPlanServices ?? [];
          const confirmedPlanServiceNames = confirmedPlanServicesIds.map((id) => roleNameMap.get(id) ?? id);
          const suggestedVendors = r.planServiceStatus === 'Pending Selection'
            ? (suggestedVendorsCache.get(r.recordIndex) ?? [])
            : [];

          return {
            recordIndex:               r.recordIndex,
            claimNumber:               r.claimNumber,
            policyNumber:              r.policyNumber,
            insuredName:               r.insuredName,
            claimType:                 r.claimType,
            lossDate:                  r.lossDate,
            reportedDate:              r.reportedDate,
            claimAmount:               r.claimAmount,
            claimStatus:               r.claimStatus,
            validationStatus:          r.validationStatus,
            validationMessage:         r.validationMessage,
            planServices,
            planServiceNames,
            confirmedPlanServices:     confirmedPlanServicesIds,
            confirmedPlanServiceNames,
            existingplanservices:      r.existingplanservices ?? [],
            planServiceStatus:         r.planServiceStatus ?? 'Pending Selection',
            planServiceComments:       r.planServiceComments ?? '',
            vendorServices:            r.vendorServices ?? [],
            vendorServiceComments:     r.vendorServiceComments ?? '',
            serviceVendorReview:       r.serviceVendorReview ?? [],
            adjusterComments:          r.adjusterComments ?? '',
            adjusterSubmittedBy:       r.adjusterSubmittedBy ?? '',
            adjusterSubmittedAt:       r.adjusterSubmittedAt ?? '',
            suggestedVendors,
            ...extractPropertyFields(r as unknown as Record<string, unknown>),
          };
        });

        return {
          uploadId:     doc.uploadId,
          fileName:     doc.fileName,
          uploadType:   doc.uploadType,
          totalClaims:  doc.totalClaims ?? records.length,
          successCount: doc.successCount ?? records.filter((r) => r.validationStatus === 'Passed').length,
          failedCount:  doc.failedCount  ?? records.filter((r) => r.validationStatus === 'Failed').length,
          uploadedBy:   doc.uploadedBy,
          uploadDate:   formatDate(doc.uploadDate),
          status:       doc.status,
          records:      mappedRecords,
        };
      } catch (err) {
        await logError(err as Error, 'GraphQL.uploadedClaimDetails');
        return null;
      }
    },
  },
};
