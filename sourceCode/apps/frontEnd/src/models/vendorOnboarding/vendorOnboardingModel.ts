export interface VendorOnboardingRow {
  vendorId: string;
  companyName: string;
  coverage: string;
  daysInAge: string;
  currentStageName: string;
  nextStageName: string;
  vendorStatus: string;
  createdAt: string;
  boostApplied: boolean;
}

export interface VendorOnboardingCounts {
  open:               number;
  inProgress:         number;
  requalificationDue: number;
}

export type VendorOnboardingTab = 'pending' | 'inProgress' | 'requalification';

export interface PendingApprovalService {
  roleId: string;
  name:   string;
}

export interface PendingApprovalDetails {
  vendorId:      string;
  requestId:     string;
  companyName:   string;
  address:       string;
  email:         string;
  phone:         string;
  website:       string;
  contactPerson: string;
  contactPersonName:  string;
  contactPersonPhone: string;
  contactPersonEmail: string;
  services:      PendingApprovalService[];
  coverage:      string[];
  submittedBy:   string;
  submittedAt:   string;
  vendorStatus:  string;
}

export interface ConfirmationDoc {
  _id: string;
  fileName: string;
  approvalStatus: 'Draft' | 'Pending' | 'Approved' | 'Rejected' | 'Available' | 'Not Available' | 'Sent Back';
  comments: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface WaiveInfo {
  docId:           string;
  waiveReasonId:   string;
  waiveReasonName: string;
  waivedBy:        string;
  waivedAt:        string;
}

export interface WaiveReason {
  waiveReasonId:   string;
  waiveReasonCode: string;
  waiveReasonName: string;
  isActive:        boolean;
}

export interface ConfirmationRequirement {
  confirmationId:        string;
  vendorConfirmationId:  string;
  vendorConfirmationName: string;
  isMandatory:           boolean;
  documents:             ConfirmationDoc[];
  waiveInfo:             WaiveInfo | null;
  // Populated only for service-category-scoped items (L1 questions); empty otherwise.
  serviceRequestRoleId:  string;
  serviceRoleName:       string;
}

export interface ProcessingStage {
  stageId: string;
  vendorStageId: string;
  vendorStageCode: string;
  vendorStageName: string;
  stageStatus: 'Completed' | 'In Progress' | 'Rejected';
  confirmations: ConfirmationRequirement[];
}

export interface ServiceRole {
  roleId: string;
  roleName: string;
}

export interface RoleSummaryItem {
  roleId:         string;
  roleName:       string;
  roleCode:       string;
  isVendorRole:   boolean;
  approvalStatus: 'Approved' | 'Pending';
}

export interface PriorityBoostDetails {
  states:             string[];
  serviceDisciplines: string[];
  assignmentLimit:    number | null;
  reasonForBoost:     string;
}

export interface VendorOnboardingDetails {
  vendorId: string;
  companyName: string;
  emailId: string;
  phoneNumber: string;
  address: string;
  website: string;
  contactPersonName: string;
  contactPersonPhone: string;
  contactPersonEmail: string;
  coverage: string;
  city: string;
  state: string;
  country: string;
  vendorStatus: string;
  vendorSource: string;
  boostApplied: boolean;
  priorityBoost: PriorityBoostDetails | null;
  suspendedReason: string;
  disqualifiedReason: string;
  rating:       number | null;
  requalDue:    string;
  createdAt:    string;
  memberSince:  string;
  stages: ProcessingStage[];
  serviceRoles: ServiceRole[];
  roleSummary: RoleSummaryItem[];
  lockedServiceRoleIds: string[];
}
