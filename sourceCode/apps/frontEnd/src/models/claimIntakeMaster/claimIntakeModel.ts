// ─── Enums ─────────────────────────────────────────────────────────────────────

export enum UploadType {
  EXCEL = 'EXCEL',
  JSON  = 'JSON',
  XML   = 'XML',
}

// ─── Grid row — one row per uploaded file ─────────────────────────────────────

export interface UploadedClaimsGridRow {
  uploadId:    string;
  fileName:    string;
  claimNumber: string;
  uploadType:  string;
  totalClaims: number;
  uploadedBy:  string;
  uploadDate:  string;
  status:      string;
}

// ─── Per-service vendor review (Pending Review workflow) ──────────────────────

export interface ServiceVendorReview {
  roleName:           string;
  changeType:         'ProviderChange' | 'ServiceAdded';
  recommendedVendor:  string;
  proposedVendor:     string;   // Adjuster's original pick — frozen, never overwritten by Supervisor review
  selectedVendor:     string;
  status:             'Locked' | 'Pending Review' | 'Modified' | 'Included' | 'Rejected';
  confirmedBy:        string;
  confirmedAt:        string;
  reviewedBy?:         string;
  reviewedAt?:          string;
  supervisorComment?:  string;
  adjusterComment?:    string;
}

// ─── Supervisor Comments page ──────────────────────────────────────────────────

export interface SupervisorReviewedItem {
  roleName:          string;
  changeType:         'ProviderChange' | 'ServiceAdded';
  displayChangeType:  string;   // 'Provider Change' | 'Service Added' | 'Service Removed'
  originalValue:      string;
  finalValue:          string;
  finalBadge:          'Modified' | 'Included' | 'Rejected';
  supervisorComment:   string;
  reviewedBy:          string;
  reviewedAt:          string;
}

export interface SupervisorReviewedClaim {
  uploadId:       string;
  recordIndex:    number;
  claimNumber:    string;
  insuredName:    string;
  claimType:      string;
  lastReviewedAt: string;
  items:          SupervisorReviewedItem[];
}

// ─── Individual claim record inside an upload ─────────────────────────────────

export interface IndividualClaimRecord {
  uploadId?:            string;
  recordIndex:          number;
  claimNumber:          string;
  policyNumber:         string;
  insuredName:          string;
  claimType:            string;
  lossDate:             string;
  reportedDate:         string;
  claimAmount:          string;
  claimStatus:          string;
  validationStatus:     string;
  validationMessage:    string;
  planServices:              string[];   // latest rule-evaluation roleIds (updated on every upload)
  planServiceNames:          string[];   // resolved display names for latest suggestions
  confirmedPlanServices:     string[];   // roleIds user explicitly confirmed
  confirmedPlanServiceNames: string[];   // resolved display names for confirmed selections
  existingplanservices?:     string[];
  planServiceStatus:     string;
  planServiceComments:   string;
  vendorServices:        string[];
  vendorServiceComments: string;
  serviceVendorReview?:   ServiceVendorReview[];
  suggestedVendors:      string[];
  isCompleted?:          boolean;
  completedAt?:          string;
  completedBy?:          string;
  adjusterComments?:     string;
  adjusterSubmittedBy?:  string;
  adjusterSubmittedAt?:  string;
  causeOfLoss?:            string;
  damagedAreas?:              string;
  policyForm?:                  string;
  severity?:               string;
  jurisdiction?:           string;
  floodZone?:   string;
  coverageALimit?:         string;
  buildingExposure?:     string;
  contentsExposure?:       string;
  propertyAddress?:          string;
  assignedAdjuster?:      string;
  contractorName?:       string;
}

// ─── Details — upload header + all claim records ──────────────────────────────

export interface UploadedClaimDetails {
  uploadId:     string;
  fileName:     string;
  uploadType:   string;
  totalClaims:  number;
  successCount: number;
  failedCount:  number;
  uploadedBy:   string;
  uploadDate:   string;
  status:       string;
  records:      IndividualClaimRecord[];
}

// ─── Change Log ───────────────────────────────────────────────────────────────

export interface VendorOption {
  companyName:  string;
  rating:       number;
  boostApplied?: boolean;
}

export interface ClaimChangeLogEntry {
  id:            string;
  uploadId:      string;
  recordIndex:   number;
  claimNumber:   string;
  type:          string;
  changedItem:   string;
  previousValue: string;
  updatedValue:  string;
  reason:        string;
  updatedBy:     string;
  updatedAt:     string;
}

// ─── API Inputs / Responses ───────────────────────────────────────────────────

export interface UploadClaimInput {
  uploadType:   UploadType;
  fileName?:    string;
  jsonPayload?: string;
  xmlPayload?:  string;
  excelBase64?: string;
  uploadedBy?:  string;
}

export interface UploadClaimResponse {
  uploadId:         string;
  totalClaims:      number;
  successCount:     number;
  failedCount:      number;
  status:           string;
  validationResult: string;
  message:          string;
  success:          boolean;
}
