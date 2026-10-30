import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getOnboardingList,
  getPendingApprovalDetails,
  approveVendorRequest,
  rejectVendorRequest,
  getOnboardingDetails,
  uploadDocument,
  approveDocument,
  rejectDocument,
  finalApproveVendor,
  suspendVendor,
  disqualifyVendor,
  getWaiveReasons,
  waiveConfirmation,
  resubmitApplication,
  getDocumentUrl,
  generateVendorIntelligence,
} from '../vendorOnboardingService';

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

function errorResponse(status = 500, text = 'Server Error') {
  return Promise.resolve({
    ok: false,
    status,
    statusText: text,
    text: () => Promise.resolve(text),
  } as unknown as Response);
}

// ─── getOnboardingList ────────────────────────────────────────────────────────

describe('getOnboardingList', () => {
  it('returns totalRecords, data, and counts', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, totalRecords: 1, data: [], counts: { inProgress: 1, completed: 0, rejected: 0 } }));
    const result = await getOnboardingList(1, 10);
    expect(result.totalRecords).toBe(1);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('calls the correct endpoint with page, limit, tab params', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, totalRecords: 0, data: [], counts: {} }));
    await getOnboardingList(2, 25, 'requalification');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('limit=25');
    expect(url).toContain('tab=requalification');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValue(errorResponse());
    await expect(getOnboardingList(1, 10)).rejects.toThrow();
  });
});

// ─── getPendingApprovalDetails ────────────────────────────────────────────────

describe('getPendingApprovalDetails', () => {
  it('returns the pending approval detail', async () => {
    const detail = { vendorId: 'v1', companyName: 'Med Inc' };
    mockFetch.mockReturnValue(okJson({ success: true, data: detail }));
    const result = await getPendingApprovalDetails('v1');
    expect(result).toMatchObject({ vendorId: 'v1' });
  });

  it('calls the correct endpoint', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, data: {} }));
    await getPendingApprovalDetails('v1');
    expect(mockFetch.mock.calls[0][0]).toContain('/onboarding/pending/v1');
  });
});

// ─── approveVendorRequest ─────────────────────────────────────────────────────

describe('approveVendorRequest', () => {
  it('calls approve-request with POST', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: 'Approved' }));
    await approveVendorRequest('v1', ['role-1']);
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(mockFetch.mock.calls[0][0]).toContain('approve-request');
  });

  it('sends vendorId and approvedServiceRoleIds in the body', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: '' }));
    await approveVendorRequest('v1', ['role-1', 'role-2']);
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.vendorId).toBe('v1');
    expect(body.approvedServiceRoleIds).toEqual(['role-1', 'role-2']);
  });
});

// ─── rejectVendorRequest ──────────────────────────────────────────────────────

describe('rejectVendorRequest', () => {
  it('calls reject-request with POST', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: 'Rejected' }));
    const result = await rejectVendorRequest('v1');
    expect(result.success).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain('reject-request');
  });
});

// ─── getOnboardingDetails ─────────────────────────────────────────────────────

describe('getOnboardingDetails', () => {
  it('returns the onboarding detail object', async () => {
    const detail = { vendorId: 'v1', status: 'inProgress' };
    mockFetch.mockReturnValue(okJson({ success: true, data: detail }));
    const result = await getOnboardingDetails('v1');
    expect(result).toMatchObject({ vendorId: 'v1' });
  });

  it('throws on error response', async () => {
    mockFetch.mockReturnValue(errorResponse(404, 'Not found'));
    await expect(getOnboardingDetails('missing')).rejects.toThrow();
  });
});

// ─── uploadDocument ───────────────────────────────────────────────────────────

describe('uploadDocument', () => {
  it('calls the upload endpoint with POST', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: 'Uploaded' }));
    await uploadDocument({
      vendorId: 'v1', vendorStageId: 's1', vendorConfirmationId: 'c1',
      fileName: 'doc.pdf', fileBase64: 'abc==', uploadedBy: 'admin',
    });
    expect(mockFetch.mock.calls[0][0]).toContain('/onboarding/upload');
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('returns success response', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: 'OK' }));
    const result = await uploadDocument({
      vendorId: 'v1', vendorStageId: 's1', vendorConfirmationId: 'c1',
      fileName: 'doc.pdf', fileBase64: '', uploadedBy: 'admin',
    });
    expect(result.success).toBe(true);
  });
});

// ─── approveDocument / rejectDocument ────────────────────────────────────────

describe('approveDocument', () => {
  it('calls approve endpoint and returns success', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: 'Approved' }));
    const result = await approveDocument('v1', 'c1', 'Looks good');
    expect(result.success).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain('/onboarding/approve');
  });
});

describe('rejectDocument', () => {
  it('calls reject endpoint and returns success', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: 'Rejected' }));
    const result = await rejectDocument('v1', 'c1', 'Missing signature');
    expect(result.success).toBe(true);
  });
});

// ─── finalApproveVendor ───────────────────────────────────────────────────────

describe('finalApproveVendor', () => {
  it('calls final-approve and returns success', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: 'Final approved' }));
    const result = await finalApproveVendor('v1');
    expect(result.success).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain('final-approve');
  });
});

// ─── suspendVendor / disqualifyVendor ─────────────────────────────────────────

describe('suspendVendor', () => {
  it('sends vendorId and reason', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: 'Suspended' }));
    await suspendVendor('v1', 'Non-compliant');
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.vendorId).toBe('v1');
    expect(body.reason).toBe('Non-compliant');
  });
});

describe('disqualifyVendor', () => {
  it('sends vendorId and reason', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: 'Disqualified' }));
    await disqualifyVendor('v1', 'Failed audit');
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.reason).toBe('Failed audit');
  });
});

// ─── getWaiveReasons ──────────────────────────────────────────────────────────

describe('getWaiveReasons', () => {
  it('returns array of waive reasons', async () => {
    const reasons = [{ id: 'w1', reason: 'Insurance coverage in place' }];
    mockFetch.mockReturnValue(okJson({ success: true, data: reasons }));
    const result = await getWaiveReasons();
    expect(result).toEqual(reasons);
  });
});

// ─── waiveConfirmation ────────────────────────────────────────────────────────

describe('waiveConfirmation', () => {
  it('sends the waive payload', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: 'Waived' }));
    const result = await waiveConfirmation({
      vendorId: 'v1', vendorStageId: 's1', vendorConfirmationId: 'c1',
      waiveReasonId: 'w1', waiveReasonName: 'Insurance coverage', waivedBy: 'admin',
    });
    expect(result.success).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain('/waive');
  });
});

// ─── resubmitApplication ─────────────────────────────────────────────────────

describe('resubmitApplication', () => {
  it('sends POST with vendorId', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: 'Resubmitted' }));
    await resubmitApplication('v1');
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.vendorId).toBe('v1');
  });
});

// ─── getDocumentUrl ───────────────────────────────────────────────────────────

describe('getDocumentUrl', () => {
  it('returns the document URL with docId', () => {
    const url = getDocumentUrl('doc-123');
    expect(url).toContain('doc-123');
    expect(url).toContain('/onboarding/document/');
  });
});

// ─── generateVendorIntelligence ───────────────────────────────────────────────

describe('generateVendorIntelligence', () => {
  it('returns summary and redFlags on success', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, summary: 'Reliable vendor', redFlags: [] }));
    const result = await generateVendorIntelligence({ companyName: 'Med Inc' });
    expect(result.summary).toBe('Reliable vendor');
    expect(result.redFlags).toEqual([]);
  });

  it('throws when success is false', async () => {
    mockFetch.mockReturnValue(Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: false, message: 'AI error' }),
    } as Response));
    await expect(generateVendorIntelligence({})).rejects.toThrow('AI error');
  });
});
