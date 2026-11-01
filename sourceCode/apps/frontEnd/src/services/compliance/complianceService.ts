import type { ComplianceEventsResponse, ComplianceSummary } from '../../models/compliance/complianceModel';

const BASE = `${(import.meta as any).env.VITE_API_URL}/api/compliance`;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) { const t = await res.text().catch(() => res.statusText); throw new Error(t); }
  return res.json() as Promise<T>;
}

export async function fetchCatEvents(): Promise<ComplianceEventsResponse> {
  return json<ComplianceEventsResponse>(await fetch(`${BASE}/events`));
}

export interface SummaryScope { eventId: string; from?: string; to?: string; eventType?: string; }

export async function fetchComplianceSummary(scope: SummaryScope | string): Promise<ComplianceSummary> {
  const sc: SummaryScope = typeof scope === 'string' ? { eventId: scope } : scope;
  const q = new URLSearchParams({ eventId: sc.eventId });
  if (sc.from) q.set('from', sc.from);
  if (sc.to) q.set('to', sc.to);
  if (sc.eventType) q.set('eventType', sc.eventType);
  const data = await json<{ success: boolean; data: ComplianceSummary }>(await fetch(`${BASE}/summary?${q.toString()}`));
  return data.data;
}
