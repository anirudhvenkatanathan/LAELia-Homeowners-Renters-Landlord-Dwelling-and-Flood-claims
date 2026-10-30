import { gql } from '@apollo/client';
import { getApolloClient } from '../../config/apolloClient';
import { logError } from '../../utils/logError';
import type {
  UploadClaimInput,
  UploadClaimResponse,
  UploadedClaimsGridRow,
  UploadedClaimDetails,
  ServiceVendorReview,
} from '../../models/claimIntakeMaster/claimIntakeModel';

// ─── GraphQL Operations ───────────────────────────────────────────────────────

const UPLOAD_CLAIM_MUTATION = gql`
  mutation UploadClaim(
    $uploadType:  String!
    $fileName:    String
    $jsonPayload: String
    $xmlPayload:  String
    $excelBase64: String
    $uploadedBy:  String
  ) {
    uploadClaim(
      uploadType:  $uploadType
      fileName:    $fileName
      jsonPayload: $jsonPayload
      xmlPayload:  $xmlPayload
      excelBase64: $excelBase64
      uploadedBy:  $uploadedBy
    ) {
      uploadId
      totalClaims
      successCount
      failedCount
      status
      validationResult
      message
      success
    }
  }
`;

const UPLOADED_CLAIMS_QUERY = gql`
  query UploadedClaims {
    uploadedClaims {
      uploadId
      fileName
      claimNumber
      uploadType
      totalClaims
      uploadedBy
      uploadDate
      status
    }
  }
`;

const UPLOADED_CLAIM_DETAILS_QUERY = gql`
  query UploadedClaimDetails($uploadId: String!) {
    uploadedClaimDetails(uploadId: $uploadId) {
      uploadId
      fileName
      uploadType
      totalClaims
      successCount
      failedCount
      uploadedBy
      uploadDate
      status
      records {
        recordIndex
        claimNumber
        policyNumber
        insuredName
        claimType
        lossDate
        reportedDate
        claimAmount
        claimStatus
        validationStatus
        validationMessage
        planServices
        planServiceNames
        confirmedPlanServices
        confirmedPlanServiceNames
        existingplanservices
        planServiceStatus
        planServiceComments
        vendorServices
        vendorServiceComments
        serviceVendorReview { roleName changeType recommendedVendor proposedVendor selectedVendor status confirmedBy confirmedAt reviewedBy reviewedAt supervisorComment adjusterComment }
        adjusterComments
        adjusterSubmittedBy
        adjusterSubmittedAt
        suggestedVendors
        isCompleted
        completedAt
        completedBy
        causeOfLoss
        damagedAreas
        policyForm
        severity
        jurisdiction
        floodZone
        coverageALimit
        buildingExposure
        contentsExposure
        propertyAddress
        assignedAdjuster
        contractorName
      }
    }
  }
`;

const SAVE_VENDOR_SERVICES_MUTATION = gql`
  mutation SaveVendorServices(
    $uploadId:       String!
    $recordIndex:    Int!
    $vendorServices: [String!]!
    $planServices: [String!]!
    $comments:       String!
    $serviceVendorReview: [ServiceVendorReviewInput!]
    $adjusterComments:    String
    $adjusterSubmittedBy: String
  ) {
    saveVendorServices(
      uploadId:       $uploadId
      recordIndex:    $recordIndex
      vendorServices: $vendorServices
      planServices:   $planServices
      comments:       $comments
      serviceVendorReview: $serviceVendorReview
      adjusterComments:    $adjusterComments
      adjusterSubmittedBy: $adjusterSubmittedBy
    ) {
      success
      message
    }
  }
`;

const REVIEW_SERVICE_VENDOR_MUTATION = gql`
  mutation ReviewServiceVendor(
    $uploadId:       String!
    $recordIndex:    Int!
    $roleName:       String!
    $selectedVendor: String!
    $reviewedBy:     String!
    $token:          String
  ) {
    reviewServiceVendor(
      uploadId:       $uploadId
      recordIndex:    $recordIndex
      roleName:       $roleName
      selectedVendor: $selectedVendor
      reviewedBy:     $reviewedBy
      token:          $token
    ) {
      success
      message
    }
  }
`;

const CONFIRM_SUPERVISOR_REVIEW_MUTATION = gql`
  mutation ConfirmSupervisorReview(
    $uploadId:    String!
    $recordIndex: Int!
    $reviews:     [SupervisorReviewDecisionInput!]!
    $reviewedBy:  String!
    $token:       String!
  ) {
    confirmSupervisorReview(
      uploadId:    $uploadId
      recordIndex: $recordIndex
      reviews:     $reviews
      reviewedBy:  $reviewedBy
      token:       $token
    ) {
      success
      message
    }
  }
`;

const GET_SUPERVISOR_REVIEWED_CLAIMS_QUERY = gql`
  query GetSupervisorReviewedClaims($adjusterName: String!) {
    getSupervisorReviewedClaims(adjusterName: $adjusterName) {
      uploadId
      recordIndex
      claimNumber
      insuredName
      claimType
      lastReviewedAt
      items {
        roleName
        changeType
        displayChangeType
        originalValue
        finalValue
        finalBadge
        supervisorComment
        reviewedBy
        reviewedAt
      }
    }
  }
`;

const GET_ALL_CLAIM_RECORDS_QUERY = gql`
  query GetAllClaimRecords {
    getAllClaimRecords {
      uploadId
      recordIndex
      claimNumber
      policyNumber
      insuredName
      claimType
      lossDate
      reportedDate
      claimAmount
      claimStatus
      validationStatus
      planServiceStatus
      existingplanservices
      serviceVendorReview { roleName recommendedVendor selectedVendor status confirmedBy confirmedAt reviewedBy reviewedAt }
    }
  }
`;

const GET_ALL_VENDOR_NAMES_QUERY = gql`
  query GetAllVendorNames { getAllVendorNames }
`;

const GET_VENDORS_BY_ROLE_IDS_QUERY = gql`
  query GetVendorsByRoleIds($roleIds: [String!]!) {
    getVendorsByRoleIds(roleIds: $roleIds)
  }
`;

const SAVE_PLAN_SERVICES_MUTATION = gql`
  mutation SavePlanServices(
    $uploadId:     String!
    $recordIndex:  Int!
    $planServices: [String!]!
    $comments:     String!
  ) {
    savePlanServices(
      uploadId:     $uploadId
      recordIndex:  $recordIndex
      planServices: $planServices
      comments:     $comments
    ) {
      success
      message
    }
  }
`;

// ─── Service Functions ────────────────────────────────────────────────────────

export async function uploadClaim(input: UploadClaimInput): Promise<UploadClaimResponse> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ uploadClaim: UploadClaimResponse }>({
      mutation: UPLOAD_CLAIM_MUTATION,
      variables: {
        uploadType:  input.uploadType,
        fileName:    input.fileName    ?? null,
        jsonPayload: input.jsonPayload ?? null,
        xmlPayload:  input.xmlPayload  ?? null,
        excelBase64: input.excelBase64 ?? null,
        uploadedBy:  input.uploadedBy  ?? 'Admin',
      },
    });
    if (!data?.uploadClaim) throw new Error('No data returned from uploadClaim.');
    return data.uploadClaim;
  } catch (err) {
    logError(err, 'claimIntakeService.uploadClaim');
    throw err;
  }
}

export async function getUploadedClaims(): Promise<UploadedClaimsGridRow[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ uploadedClaims: UploadedClaimsGridRow[] }>({
      query: UPLOADED_CLAIMS_QUERY,
      fetchPolicy: 'network-only',
    });
    return data?.uploadedClaims ?? [];
  } catch (err) {
    logError(err, 'claimIntakeService.getUploadedClaims');
    throw err;
  }
}

export async function getUploadedClaimDetails(uploadId: string): Promise<UploadedClaimDetails> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ uploadedClaimDetails: UploadedClaimDetails }>({
      query: UPLOADED_CLAIM_DETAILS_QUERY,
      variables: { uploadId },
      fetchPolicy: 'network-only',
    });
    if (!data?.uploadedClaimDetails) throw new Error(`No details for uploadId: ${uploadId}`);
    return data.uploadedClaimDetails;
  } catch (err) {
    logError(err, 'claimIntakeService.getUploadedClaimDetails');
    throw err;
  }
}

export async function getAllClaimRecords(): Promise<import('../../models/claimIntakeMaster/claimIntakeModel').IndividualClaimRecord[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getAllClaimRecords: import('../../models/claimIntakeMaster/claimIntakeModel').IndividualClaimRecord[] }>({
      query: GET_ALL_CLAIM_RECORDS_QUERY,
      fetchPolicy: 'network-only',
    });
    return data?.getAllClaimRecords ?? [];
  } catch (err) {
    logError(err, 'claimIntakeService.getAllClaimRecords');
    throw err;
  }
}

export async function saveDraftPlanServices(input: {
  uploadId: string; recordIndex: number; planServices: string[];
}): Promise<{ success: boolean; message: string }> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ saveDraftPlanServices: { success: boolean; message: string } }>({
      mutation: gql`mutation SaveDraftPlanServices($uploadId:String!,$recordIndex:Int!,$planServices:[String!]!){
        saveDraftPlanServices(uploadId:$uploadId,recordIndex:$recordIndex,planServices:$planServices){success message}
      }`,
      variables: input,
    });
    return data?.saveDraftPlanServices ?? { success: false, message: 'No response.' };
  } catch (err) { logError(err, 'claimIntakeService.saveDraftPlanServices'); return { success: false, message: '' }; }
}

export async function saveVendorServices(input: {
  uploadId: string;
  recordIndex: number;
  vendorServices: string[];
  planServices : string[];
  comments: string;
  serviceVendorReview?: ServiceVendorReview[];
  adjusterComments?: string;
  adjusterSubmittedBy?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ saveVendorServices: { success: boolean; message: string } }>({
      mutation: SAVE_VENDOR_SERVICES_MUTATION,
      variables: input,
    });
    if (!data?.saveVendorServices) throw new Error('No data returned from saveVendorServices.');
    return data.saveVendorServices;
  } catch (err) {
    logError(err, 'claimIntakeService.saveVendorServices');
    throw err;
  }
}

export async function reviewServiceVendor(input: {
  uploadId: string;
  recordIndex: number;
  roleName: string;
  selectedVendor: string;
  reviewedBy: string;
  token?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ reviewServiceVendor: { success: boolean; message: string } }>({
      mutation: REVIEW_SERVICE_VENDOR_MUTATION,
      variables: input,
    });
    if (!data?.reviewServiceVendor) throw new Error('No data returned from reviewServiceVendor.');
    return data.reviewServiceVendor;
  } catch (err) {
    logError(err, 'claimIntakeService.reviewServiceVendor');
    return { success: false, message: 'Failed to review service vendor.' };
  }
}

export interface SupervisorReviewDecisionInput {
  roleName: string;
  decision: 'Modified' | 'Included' | 'Rejected';
  finalVendor?: string;
  comment: string;
}

export async function confirmSupervisorReview(input: {
  uploadId: string;
  recordIndex: number;
  reviews: SupervisorReviewDecisionInput[];
  reviewedBy: string;
  token: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ confirmSupervisorReview: { success: boolean; message: string } }>({
      mutation: CONFIRM_SUPERVISOR_REVIEW_MUTATION,
      variables: input,
    });
    if (!data?.confirmSupervisorReview) throw new Error('No data returned from confirmSupervisorReview.');
    return data.confirmSupervisorReview;
  } catch (err) {
    logError(err, 'claimIntakeService.confirmSupervisorReview');
    return { success: false, message: 'Failed to confirm review.' };
  }
}

export async function getSupervisorReviewedClaims(adjusterName: string): Promise<import('../../models/claimIntakeMaster/claimIntakeModel').SupervisorReviewedClaim[]> {
  if (!adjusterName) return [];
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getSupervisorReviewedClaims: import('../../models/claimIntakeMaster/claimIntakeModel').SupervisorReviewedClaim[] }>({
      query: GET_SUPERVISOR_REVIEWED_CLAIMS_QUERY,
      variables: { adjusterName },
      fetchPolicy: 'network-only',
    });
    return data?.getSupervisorReviewedClaims ?? [];
  } catch (err) {
    logError(err, 'claimIntakeService.getSupervisorReviewedClaims');
    return [];
  }
}

export async function getAllVendorNames(): Promise<string[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getAllVendorNames: string[] }>({
      query: GET_ALL_VENDOR_NAMES_QUERY,
      fetchPolicy: 'network-only',
    });
    return data?.getAllVendorNames ?? [];
  } catch (err) {
    logError(err, 'claimIntakeService.getAllVendorNames');
    return [];
  }
}

const SAVE_CHANGE_LOG_MUTATION = gql`
  mutation SaveChangeLog($uploadId:String!,$recordIndex:Int!,$claimNumber:String,$type:String!,$changedItem:String!,$previousValue:String!,$updatedValue:String!,$reason:String!,$updatedBy:String) {
    saveChangeLog(uploadId:$uploadId,recordIndex:$recordIndex,claimNumber:$claimNumber,type:$type,changedItem:$changedItem,previousValue:$previousValue,updatedValue:$updatedValue,reason:$reason,updatedBy:$updatedBy) { success message }
  }
`;
const GET_CHANGE_LOG_QUERY = gql`
  query GetChangeLog($uploadId:String!,$recordIndex:Int!) {
    getChangeLog(uploadId:$uploadId,recordIndex:$recordIndex) { id uploadId recordIndex claimNumber type changedItem previousValue updatedValue reason updatedBy updatedAt }
  }
`;

export async function saveChangeLogEntry(input: { uploadId:string; recordIndex:number; claimNumber?:string; type:string; changedItem:string; previousValue:string; updatedValue:string; reason:string; updatedBy?:string }): Promise<void> {
  try {
    const client = getApolloClient();
    await client.mutate({ mutation: SAVE_CHANGE_LOG_MUTATION, variables: { ...input, updatedBy: input.updatedBy ?? 'admin' } });
  } catch (err) { logError(err, 'claimIntakeService.saveChangeLogEntry'); }
}

export async function getChangeLogEntries(uploadId: string, recordIndex: number): Promise<import('../../models/claimIntakeMaster/claimIntakeModel').ClaimChangeLogEntry[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getChangeLog: import('../../models/claimIntakeMaster/claimIntakeModel').ClaimChangeLogEntry[] }>({ query: GET_CHANGE_LOG_QUERY, variables: { uploadId, recordIndex }, fetchPolicy: 'network-only' });
    return data?.getChangeLog ?? [];
  } catch (err) { logError(err, 'claimIntakeService.getChangeLogEntries'); return []; }
}

const GET_VENDORS_WITH_DETAILS_QUERY = gql`
  query GetVendorsByRoleIdsWithDetails($roleIds: [String!]!) {
    getVendorsByRoleIdsWithDetails(roleIds: $roleIds) { companyName rating boostApplied }
  }
`;

export async function getVendorsByRoleIdsWithDetails(roleIds: string[]): Promise<import('../../models/claimIntakeMaster/claimIntakeModel').VendorOption[]> {
  if (!roleIds.length) return [];
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getVendorsByRoleIdsWithDetails: import('../../models/claimIntakeMaster/claimIntakeModel').VendorOption[] }>({
      query: GET_VENDORS_WITH_DETAILS_QUERY, variables: { roleIds }, fetchPolicy: 'network-only',
    });
    return data?.getVendorsByRoleIdsWithDetails ?? [];
  } catch (err) { logError(err, 'claimIntakeService.getVendorsByRoleIdsWithDetails'); return []; }
}

export async function getVendorsByRoleIds(roleIds: string[]): Promise<string[]> {
  if (!roleIds.length) return [];
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getVendorsByRoleIds: string[] }>({
      query: GET_VENDORS_BY_ROLE_IDS_QUERY,
      variables: { roleIds },
      fetchPolicy: 'network-only',
    });
    return data?.getVendorsByRoleIds ?? [];
  } catch (err) {
    logError(err, 'claimIntakeService.getVendorsByRoleIds');
    return [];
  }
}

export async function completeClaim(input: {
  uploadId: string;
  recordIndex: number;
  completedBy?: string;
  token?: string;
}): Promise<{ success: boolean; message: string; completedAt?: string }> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ completeClaim: { success: boolean; message: string; completedAt?: string } }>({
      mutation: gql`mutation CompleteClaim($uploadId:String!,$recordIndex:Int!,$completedBy:String,$token:String){
        completeClaim(uploadId:$uploadId,recordIndex:$recordIndex,completedBy:$completedBy,token:$token){success message completedAt}
      }`,
      variables: { ...input, completedBy: input.completedBy ?? 'admin' },
    });
    return data?.completeClaim ?? { success: false, message: 'No response.' };
  } catch (err) {
    logError(err, 'claimIntakeService.completeClaim');
    return { success: false, message: 'Failed to complete claim.' };
  }
}

const KPI_BASE = `${(import.meta as any).env.VITE_API_URL}/api/admin/kpi-metrics`;

export async function fetchKpiMetricsForClaim(roleIds: string[]): Promise<import('../../models/kpiMetrics/kpiMetricsModel').KpiGroup[]> {
  if (!roleIds.length) return [];
  try {
    const res  = await fetch(`${KPI_BASE}/for-claim?roleIds=${roleIds.map(encodeURIComponent).join(',')}`);
    const json = await res.json() as { success: boolean; data: import('../../models/kpiMetrics/kpiMetricsModel').KpiGroup[] };
    return json.data ?? [];
  } catch (err) {
    logError(err, 'claimIntakeService.fetchKpiMetricsForClaim');
    return [];
  }
}

export async function generateAiClaimSummary(claim: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${(import.meta as any).env.VITE_API_URL}/api/ai/claim-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(claim),
  });
  const json = await res.json() as { success: boolean; summary?: string; message?: string };
  if (!json.success) throw new Error(json.message ?? 'AI summary failed.');
  return json.summary ?? '';
}

export async function savePlanServices(input: {
  uploadId: string;
  recordIndex: number;
  planServices: string[];
  comments: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ savePlanServices: { success: boolean; message: string } }>({
      mutation: SAVE_PLAN_SERVICES_MUTATION,
      variables: input,
    });
    if (!data?.savePlanServices) throw new Error('No data returned from savePlanServices.');
    return data.savePlanServices;
  } catch (err) {
    logError(err, 'claimIntakeService.savePlanServices');
    throw err;
  }
}
