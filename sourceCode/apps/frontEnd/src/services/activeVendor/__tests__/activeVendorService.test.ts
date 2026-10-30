import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getAssignments,
  updateAssignment,
  getPerformance,
} from '../activeVendorService';

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

const sampleAssignment = {
  assignmentId: 'a1', claimId: 'c1', claimNumber: 'CLM-001',
  serviceType: 'Bill Review', status: 'Assigned', dueDate: '2026-07-10',
};

// ─── getAssignments ───────────────────────────────────────────────────────────

describe('getAssignments', () => {
  it('returns the assignments array for a vendor', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, data: [sampleAssignment] }));
    const result = await getAssignments('v1');
    expect(result).toHaveLength(1);
    expect(result[0].assignmentId).toBe('a1');
  });

  it('calls the correct endpoint with vendorId', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, data: [] }));
    await getAssignments('v1');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/vendors/active/v1/assignments');
  });

  it('returns empty array when data is empty', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, data: [] }));
    const result = await getAssignments('v1');
    expect(result).toEqual([]);
  });

  it('throws on error response', async () => {
    mockFetch.mockReturnValue(errorResponse());
    await expect(getAssignments('v1')).rejects.toThrow();
  });
});

// ─── updateAssignment ─────────────────────────────────────────────────────────

describe('updateAssignment', () => {
  it('calls the correct endpoint with PUT', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: 'Accepted', status: 'In Progress' }));
    await updateAssignment('v1', 'a1', 'accept');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/vendors/active/v1/assignments/a1');
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'PUT' });
  });

  it('sends the action in the request body', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: '' }));
    await updateAssignment('v1', 'a1', 'decline');
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.action).toBe('decline');
  });

  it('returns the success response with status', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, message: 'Started', status: 'In Progress' }));
    const result = await updateAssignment('v1', 'a1', 'start');
    expect(result.success).toBe(true);
    expect(result.status).toBe('In Progress');
  });

  it('throws on error response', async () => {
    mockFetch.mockReturnValue(errorResponse(400, 'Invalid action'));
    await expect(updateAssignment('v1', 'a1', 'end')).rejects.toThrow();
  });
});

// ─── getPerformance ───────────────────────────────────────────────────────────

describe('getPerformance', () => {
  it('returns the vendor performance data', async () => {
    const perf = { overallScore: 92.4, slaCompliance: 95.1, completedAssignments: 42, pendingAssignments: 3 };
    mockFetch.mockReturnValue(okJson({ success: true, data: perf }));
    const result = await getPerformance('v1');
    expect(result).toMatchObject({ overallScore: 92.4 });
  });

  it('calls the correct endpoint with vendorId', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, data: {} }));
    await getPerformance('v1');
    expect(mockFetch.mock.calls[0][0]).toContain('/vendors/active/v1/performance');
  });

  it('throws on error response', async () => {
    mockFetch.mockReturnValue(errorResponse(404, 'Not found'));
    await expect(getPerformance('missing')).rejects.toThrow();
  });
});
