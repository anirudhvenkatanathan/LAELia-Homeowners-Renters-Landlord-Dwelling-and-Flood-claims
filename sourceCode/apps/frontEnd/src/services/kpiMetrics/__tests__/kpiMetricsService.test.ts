import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchRoles,
  fetchKpiMetrics,
  fetchAiRecommendations,
  acceptAiRecommendation,
  toggleKpiMetric,
  deleteKpiMetric,
  setVendorKpiForRole,
} from '../kpiMetricsService';

// ─── fetch mock ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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

afterEach(() => { mockFetch.mockReset(); });

// ─── fetchRoles ───────────────────────────────────────────────────────────────

describe('fetchRoles', () => {
  it('calls the /roles endpoint', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, data: [] }));
    await fetchRoles();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/roles'));
  });

  it('returns the data array', async () => {
    const roles = [{ roleId: 'r1', roleName: 'Bill Review', roleCode: 'BR' }];
    mockFetch.mockReturnValue(okJson({ success: true, data: roles }));
    const result = await fetchRoles();
    expect(result).toEqual(roles);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValue(errorResponse());
    await expect(fetchRoles()).rejects.toThrow();
  });
});

// ─── fetchKpiMetrics ──────────────────────────────────────────────────────────

describe('fetchKpiMetrics', () => {
  it('encodes roleId in the query string', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, data: [] }));
    await fetchKpiMetrics('role-123');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('roleId=role-123');
  });

  it('returns the data array', async () => {
    const groups = [{ kpiMatricsId: 'k1', kpiGroupTracking: 'G1', serviceRequestRoleId: 'r1', isVendorKPI: false, isActive: true, metrics: [] }];
    mockFetch.mockReturnValue(okJson({ success: true, data: groups }));
    const result = await fetchKpiMetrics('r1');
    expect(result).toEqual(groups);
  });
});

// ─── fetchAiRecommendations ───────────────────────────────────────────────────

describe('fetchAiRecommendations', () => {
  it('calls the /ai-recommendations endpoint', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, data: [] }));
    await fetchAiRecommendations();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/ai-recommendations'));
  });

  it('returns empty array when no recommendations exist', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, data: [] }));
    const result = await fetchAiRecommendations();
    expect(result).toEqual([]);
  });

  it('returns recommendation objects with the expected shape', async () => {
    const rec = {
      ruleId: 'ai-rule-billreview',
      kpiMatricsFieldAndSectionsId: 's1',
      kpiMatricsGroupTrackingId: 'g1',
      serviceName: 'Medical Bill Review',
      metricLabel: 'Review Accuracy Rate',
      currentRule: 'Good ≥ 95%',
      suggestedRule: 'Good ≥ 92%',
      description: 'Test description',
    };
    mockFetch.mockReturnValue(okJson({ success: true, data: [rec] }));
    const result = await fetchAiRecommendations();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ruleId: 'ai-rule-billreview',
      currentRule: 'Good ≥ 95%',
      suggestedRule: 'Good ≥ 92%',
    });
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValue(errorResponse(500, 'Internal Server Error'));
    await expect(fetchAiRecommendations()).rejects.toThrow();
  });
});

// ─── acceptAiRecommendation ───────────────────────────────────────────────────

describe('acceptAiRecommendation', () => {
  it('calls the accept endpoint with POST', async () => {
    mockFetch.mockReturnValue(okJson({ success: true }));
    await acceptAiRecommendation('ai-rule-billreview', 'gt-id-123');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/ai-recommendations/ai-rule-billreview/accept'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends kpiMatricsGroupTrackingId in the request body', async () => {
    mockFetch.mockReturnValue(okJson({ success: true }));
    await acceptAiRecommendation('ai-rule-ime', 'gt-id-456');
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.kpiMatricsGroupTrackingId).toBe('gt-id-456');
  });

  it('URL-encodes the ruleId', async () => {
    mockFetch.mockReturnValue(okJson({ success: true }));
    await acceptAiRecommendation('rule/with/slashes', '');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).not.toContain('rule/with/slashes');
  });

  it('resolves without returning a value on success', async () => {
    mockFetch.mockReturnValue(okJson({ success: true }));
    const result = await acceptAiRecommendation('ai-rule-ncm', 'gt-id-789');
    expect(result).toBeUndefined();
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValue(errorResponse(400, 'Bad Request'));
    await expect(acceptAiRecommendation('bad-id', '')).rejects.toThrow();
  });
});

// ─── toggleKpiMetric ──────────────────────────────────────────────────────────

describe('toggleKpiMetric', () => {
  it('calls /:id/toggle with PUT', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, isActive: false }));
    await toggleKpiMetric('metric-id-1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/metric-id-1/toggle'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('returns the new isActive boolean', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, isActive: false }));
    const result = await toggleKpiMetric('metric-id-1');
    expect(result).toBe(false);
  });
});

// ─── deleteKpiMetric ──────────────────────────────────────────────────────────

describe('deleteKpiMetric', () => {
  it('calls /:id with DELETE', async () => {
    mockFetch.mockReturnValue(okJson({ success: true }));
    await deleteKpiMetric('metric-id-1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/metric-id-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// ─── setVendorKpiForRole ──────────────────────────────────────────────────────

describe('setVendorKpiForRole', () => {
  it('calls /vendor-toggle-role with PUT', async () => {
    mockFetch.mockReturnValue(okJson({ success: true }));
    await setVendorKpiForRole('role-1', true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/vendor-toggle-role'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('sends roleId and isVendorKPI in the body', async () => {
    mockFetch.mockReturnValue(okJson({ success: true }));
    await setVendorKpiForRole('role-1', true);
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.roleId).toBe('role-1');
    expect(body.isVendorKPI).toBe(true);
  });
});
