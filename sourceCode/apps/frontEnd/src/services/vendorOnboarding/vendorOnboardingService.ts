import type { VendorOnboardingRow, VendorOnboardingDetails, VendorOnboardingCounts, VendorOnboardingTab, PendingApprovalDetails, WaiveReason } from '../../models/vendorOnboarding/vendorOnboardingModel';

const BASE = (import.meta as any).env.VITE_API_URL;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getOnboardingList(
  page: number,
  limit: number,
  tab: VendorOnboardingTab = 'inProgress',
): Promise<{ totalRecords: number; data: VendorOnboardingRow[]; counts: VendorOnboardingCounts }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding?page=${page}&limit=${limit}&tab=${tab}`);
  const json = await handleResponse<{
    success: boolean;
    totalRecords: number;
    data: VendorOnboardingRow[];
    counts: VendorOnboardingCounts;
  }>(res);
  return { totalRecords: json.totalRecords, data: json.data, counts: json.counts };
}

export async function getPendingApprovalDetails(vendorId: string): Promise<PendingApprovalDetails> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/pending/${vendorId}`);
  const json = await handleResponse<{ success: boolean; data: PendingApprovalDetails }>(res);
  return json.data;
}

export async function approveVendorRequest(
  vendorId: string,
  approvedServiceRoleIds: string[],
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/approve-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId, approvedServiceRoleIds }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function rejectVendorRequest(vendorId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/reject-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function getOnboardingDetails(vendorId: string): Promise<VendorOnboardingDetails> {
const res = await fetch(`${BASE}/api/vendors/onboarding/${vendorId}`, { cache: 'no-store' });
const json = await handleResponse<{ success: boolean; data: VendorOnboardingDetails }>(res);
  return json.data;
}

export interface UploadPayload {
  vendorId: string;
  vendorStageId: string;
  vendorConfirmationId: string;
  fileName: string;
  fileBase64: string;
  uploadedBy: string;
  approvalStatus?: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
}

export function getDocumentUrl(docId: string): string {
  return `${BASE}/api/vendors/onboarding/document/${docId}`;
}

export async function removeDraftDocument(
  vendorId: string,
  vendorConfirmationId: string,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/remove-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId, vendorConfirmationId }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function submitDraftDocument(
  vendorId: string,
  vendorConfirmationId: string,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/submit-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId, vendorConfirmationId }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function uploadDocument(payload: UploadPayload): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function approveDocument(
  vendorId: string,
  vendorConfirmationId: string,
  comments: string,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId, vendorConfirmationId, comments }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function rejectDocument(
  vendorId: string,
  vendorConfirmationId: string,
  comments: string,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId, vendorConfirmationId, comments }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function recallDocument(
  vendorId: string,
  vendorConfirmationId: string,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/recall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId, vendorConfirmationId }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function finalApproveVendor(
  vendorId: string,
  performedBy?: string,
  resetBoost?: boolean,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/final-approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId, performedBy, resetBoost }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export interface PriorityBoostPayload {
  vendorId:           string;
  states:              string[];
  serviceDisciplines:  string[];
  assignmentLimit:     number | null;
  reasonForBoost:      string;
  performedBy?:        string;
}

export async function applyPriorityBoost(payload: PriorityBoostPayload): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/apply-priority-boost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function suspendVendor(vendorId: string, reason: string, performedBy?: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/suspend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId, reason, performedBy }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function disqualifyVendor(vendorId: string, reason: string, performedBy?: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/disqualify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId, reason, performedBy }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export interface VendorStatusHistoryEntry {
  historyId:   string;
  vendorId:    string;
  action:      'Suspended' | 'Disqualified' | 'Activated' | 'Reactivated';
  reason:      string;
  remarks:     string;
  performedBy: string;
  performedAt: string;
}

export async function getVendorStatusHistory(vendorId: string): Promise<VendorStatusHistoryEntry[]> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/history/${vendorId}`, { cache: 'no-store' });
  const json = await handleResponse<{ success: boolean; data: VendorStatusHistoryEntry[] }>(res);
  return json.data;
}

export async function setAvailability(
  vendorId: string,
  vendorStageId: string,
  vendorConfirmationId: string,
  status: 'Available' | 'Not Available',
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/set-availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId, vendorStageId, vendorConfirmationId, status }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function getWaiveReasons(): Promise<WaiveReason[]> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/waive-reasons`);
  const json = await handleResponse<{ success: boolean; data: WaiveReason[] }>(res);
  return json.data;
}

export interface WaivePayload {
  vendorId:             string;
  vendorStageId:        string;
  vendorConfirmationId: string;
  waiveReasonId:        string;
  waiveReasonName:      string;
  waivedBy:             string;
}

export async function waiveConfirmation(payload: WaivePayload): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/waive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function clearWaive(
  vendorId: string,
  vendorConfirmationId: string,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/clear-waive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId, vendorConfirmationId }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function sendBackDocument(
  vendorId: string,
  vendorConfirmationId: string,
  comments: string,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/send-back`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId, vendorConfirmationId, comments }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function resubmitApplication(vendorId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/resubmit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export interface VendorRedFlag {
  severity:    'HIGH' | 'MODERATE' | 'LOW';
  category:    string;
  description: string;
  reference:   string;
}

export interface VendorIntelligenceResult {
  summary:  string;
  redFlags: VendorRedFlag[];
}

export async function updateServiceRoles(
  vendorId: string,
  roleIds: string[],
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/update-service-roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId, roleIds }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export interface VendorProfileUpdatePayload {
  companyName?:          string;
  emailId?:              string;
  phoneNumber?:          string;
  address?:              string;
  website?:              string;
  contactPersonName?:    string;
  contactPersonEmail?:   string;
  contactPersonPhone?:   string;
  coverageStates?:       string[];
}

export async function updateVendorProfile(
  vendorId: string,
  payload: VendorProfileUpdatePayload,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/vendors/onboarding/${vendorId}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function generateVendorIntelligence(
  vendor: Record<string, unknown>,
): Promise<VendorIntelligenceResult> {
  const res = await fetch(`${BASE}/api/ai/vendor-intelligence`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(vendor),
  });
  const json = await res.json() as { success: boolean; summary?: string; redFlags?: VendorRedFlag[]; message?: string };
  if (!json.success) throw new Error(json.message ?? 'Vendor intelligence failed.');
  return { summary: json.summary ?? '', redFlags: json.redFlags ?? [] };
}
