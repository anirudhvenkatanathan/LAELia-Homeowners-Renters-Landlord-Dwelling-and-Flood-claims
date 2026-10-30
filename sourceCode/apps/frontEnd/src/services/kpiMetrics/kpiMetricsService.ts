import type { KpiServiceRole, KpiGroup, NewMetricPayload, AiRecommendation } from '../../models/kpiMetrics/kpiMetricsModel';

const BASE = `${(import.meta as any).env.VITE_API_URL}/api/admin/kpi-metrics`;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) { const t = await res.text().catch(() => res.statusText); throw new Error(t); }
  return res.json() as Promise<T>;
}

export async function fetchRoles(): Promise<KpiServiceRole[]> {
  const data = await json<{ success: boolean; data: KpiServiceRole[] }>(await fetch(`${BASE}/roles`));
  return data.data;
}

export async function fetchKpiMetrics(roleId: string): Promise<KpiGroup[]> {
  const data = await json<{ success: boolean; data: KpiGroup[] }>(await fetch(`${BASE}?roleId=${encodeURIComponent(roleId)}`));
  return data.data;
}

export async function createKpiMetric(payload: NewMetricPayload): Promise<void> {
  await json(await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
}

export async function updateKpiMetric(id: string, payload: Partial<NewMetricPayload> & { conditions?: NewMetricPayload['conditions'] }): Promise<void> {
  await json(await fetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
}

export async function toggleKpiMetric(id: string): Promise<boolean> {
  const data = await json<{ success: boolean; isActive: boolean }>(
    await fetch(`${BASE}/${id}/toggle`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } }),
  );
  return data.isActive;
}

export async function deleteKpiMetric(id: string): Promise<void> {
  await json(await fetch(`${BASE}/${id}`, { method: 'DELETE' }));
}

export async function setVendorKpiForRole(roleId: string, isVendorKPI: boolean): Promise<void> {
  await json(await fetch(`${BASE}/vendor-toggle-role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId, isVendorKPI }),
  }));
}

export async function fetchAiRecommendations(): Promise<AiRecommendation[]> {
  const data = await json<{ success: boolean; data: AiRecommendation[] }>(
    await fetch(`${BASE}/ai-recommendations`),
  );
  return data.data;
}

export async function acceptAiRecommendation(ruleId: string, kpiMatricsGroupTrackingId: string): Promise<void> {
  await json<{ success: boolean }>(
    await fetch(`${BASE}/ai-recommendations/${encodeURIComponent(ruleId)}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kpiMatricsGroupTrackingId }),
    }),
  );
}
