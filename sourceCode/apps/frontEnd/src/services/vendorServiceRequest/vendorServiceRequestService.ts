import {
  CreateVendorServiceRequestInput,
  ServiceCategory,
  UpdateVendorServiceRequestInput,
  VendorServiceRequestDetail,
  VendorServiceRequestListResponse,
} from '../../models/vendorServiceRequest/vendorServiceRequestModel';

const BASE = (import.meta as any).env.VITE_API_URL;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface VendorServiceRequestQuery {
  status?: string;
  search?: string;
  page?:   number;
  limit?:  number;
}

export async function getVendorServiceRequests(
  query: VendorServiceRequestQuery = {},
): Promise<VendorServiceRequestListResponse> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.search) params.set('search', query.search);
  if (query.page)   params.set('page', String(query.page));
  if (query.limit)  params.set('limit', String(query.limit));

  const qs = params.toString();
  const res = await fetch(`${BASE}/api/vendor-service-requests${qs ? `?${qs}` : ''}`);
  return handleResponse<VendorServiceRequestListResponse>(res);
}

export async function getVendorServiceRequestById(requestId: string): Promise<VendorServiceRequestDetail> {
  const res = await fetch(`${BASE}/api/vendor-service-requests/${requestId}`);
  return handleResponse<VendorServiceRequestDetail>(res);
}

export async function createVendorServiceRequest(
  input: CreateVendorServiceRequestInput,
): Promise<VendorServiceRequestDetail> {
  const res = await fetch(`${BASE}/api/vendor-service-requests`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  });
  return handleResponse<VendorServiceRequestDetail>(res);
}

export async function updateVendorServiceRequest(
  requestId: string,
  input: UpdateVendorServiceRequestInput,
): Promise<VendorServiceRequestDetail> {
  const res = await fetch(`${BASE}/api/vendor-service-requests/${requestId}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  });
  return handleResponse<VendorServiceRequestDetail>(res);
}

export async function getServiceCategories(): Promise<ServiceCategory[]> {
  const res = await fetch(`${BASE}/api/vendor-service-requests/categories`);
  return handleResponse<ServiceCategory[]>(res);
}
