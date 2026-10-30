import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getVendorServiceRequests,
  getVendorServiceRequestById,
  createVendorServiceRequest,
  updateVendorServiceRequest,
  getServiceCategories,
} from '../vendorServiceRequestService';
import type { CreateVendorServiceRequestInput } from '../../../models/vendorServiceRequest/vendorServiceRequestModel';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

afterEach(() => { mockFetch.mockReset(); });

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
}

function errorResponse(status = 500, text = 'Error') {
  return Promise.resolve({
    ok: false,
    status,
    statusText: text,
    text: () => Promise.resolve(text),
  } as unknown as Response);
}

const sampleRequest = {
  requestId: 'req-1', vendorId: 'v1', claimId: 'c1', serviceType: 'Bill Review',
  status: 'Pending', createdAt: '2026-01-01', updatedAt: '2026-01-01',
};

const sampleCreateInput: CreateVendorServiceRequestInput = {
  companyName: 'MedReview Inc', address: '123 Main St', email: 'contact@medreview.com',
  phone: '555-0001', website: '', contactPerson: 'Jane Doe',
  contactPersonName: 'Jane Doe', contactPersonPhone: '555-0002', contactPersonEmail: 'jane@medreview.com',
  services: ['Bill Review'], coverage: ['TX'], status: 'submitted',
};

// ─── getVendorServiceRequests ─────────────────────────────────────────────────

describe('getVendorServiceRequests', () => {
  it('calls the vendor-service-requests endpoint', async () => {
    mockFetch.mockReturnValue(okJson({ data: [], totalRecords: 0 }));
    await getVendorServiceRequests();
    expect(mockFetch.mock.calls[0][0]).toContain('/api/vendor-service-requests');
  });

  it('appends status query param when provided', async () => {
    mockFetch.mockReturnValue(okJson({ data: [], totalRecords: 0 }));
    await getVendorServiceRequests({ status: 'Pending' });
    expect(mockFetch.mock.calls[0][0]).toContain('status=Pending');
  });

  it('appends search query param when provided', async () => {
    mockFetch.mockReturnValue(okJson({ data: [], totalRecords: 0 }));
    await getVendorServiceRequests({ search: 'claim-123' });
    expect(mockFetch.mock.calls[0][0]).toContain('search=claim-123');
  });

  it('appends page and limit params when provided', async () => {
    mockFetch.mockReturnValue(okJson({ data: [], totalRecords: 0 }));
    await getVendorServiceRequests({ page: 2, limit: 20 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('limit=20');
  });

  it('throws on error response', async () => {
    mockFetch.mockReturnValue(errorResponse());
    await expect(getVendorServiceRequests()).rejects.toThrow();
  });
});

// ─── getVendorServiceRequestById ─────────────────────────────────────────────

describe('getVendorServiceRequestById', () => {
  it('calls the correct endpoint with requestId', async () => {
    mockFetch.mockReturnValue(okJson(sampleRequest));
    await getVendorServiceRequestById('req-1');
    expect(mockFetch.mock.calls[0][0]).toContain('/req-1');
  });

  it('returns the request detail', async () => {
    mockFetch.mockReturnValue(okJson(sampleRequest));
    const result = await getVendorServiceRequestById('req-1');
    expect(result).toMatchObject({ requestId: 'req-1' });
  });

  it('throws on error response', async () => {
    mockFetch.mockReturnValue(errorResponse(404, 'Not found'));
    await expect(getVendorServiceRequestById('missing')).rejects.toThrow();
  });
});

// ─── createVendorServiceRequest ───────────────────────────────────────────────

describe('createVendorServiceRequest', () => {
  it('calls the endpoint with POST', async () => {
    mockFetch.mockReturnValue(okJson(sampleRequest));
    await createVendorServiceRequest(sampleCreateInput);
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('sends the input in the request body', async () => {
    mockFetch.mockReturnValue(okJson(sampleRequest));
    const input = { ...sampleCreateInput, services: ['IME'] };
    await createVendorServiceRequest(input);
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.services).toEqual(['IME']);
  });

  it('returns the created request', async () => {
    mockFetch.mockReturnValue(okJson(sampleRequest));
    const result = await createVendorServiceRequest({ ...sampleCreateInput, services: ['NCM'] });
    expect(result).toMatchObject({ requestId: 'req-1' });
  });
});

// ─── updateVendorServiceRequest ───────────────────────────────────────────────

describe('updateVendorServiceRequest', () => {
  it('calls the correct endpoint with PATCH', async () => {
    mockFetch.mockReturnValue(okJson(sampleRequest));
    await updateVendorServiceRequest('req-1', { status: 'approved' });
    expect(mockFetch.mock.calls[0][0]).toContain('/req-1');
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'PATCH' });
  });

  it('sends the update payload in the body', async () => {
    mockFetch.mockReturnValue(okJson(sampleRequest));
    await updateVendorServiceRequest('req-1', { status: 'rejected' });
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.status).toBe('rejected');
  });
});

// ─── getServiceCategories ─────────────────────────────────────────────────────

describe('getServiceCategories', () => {
  it('calls the categories endpoint', async () => {
    mockFetch.mockReturnValue(okJson([{ id: 'cat-1', name: 'Medical' }]));
    await getServiceCategories();
    expect(mockFetch.mock.calls[0][0]).toContain('/categories');
  });

  it('returns the service categories array', async () => {
    const cats = [{ id: 'cat-1', name: 'Medical' }, { id: 'cat-2', name: 'Legal' }];
    mockFetch.mockReturnValue(okJson(cats));
    const result = await getServiceCategories();
    expect(result).toHaveLength(2);
  });
});
