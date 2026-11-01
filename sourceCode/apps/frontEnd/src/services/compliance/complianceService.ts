import type { ComplianceEventsResponse, ComplianceSummary } from '../../models/compliance/complianceModel';

const BASE = `${(import.meta as any).env.VITE_API_URL}/api/compliance`;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) { const t = await res.text().catch(() => res.statusText); throw new Error(t); }
  return res.json() as Promise<T>;
}

export async function fetchCatEvents(): Promise<ComplianceEventsResponse> {
  return json<ComplianceEventsResponse>(await fetch(`${BASE}/events`));
}

export async function fetchComplianceSummary(eventId: string): Promise<ComplianceSummary> {
  const data = await json<{ success: boolean; data: ComplianceSummary }>(await fetch(`${BASE}/summary?eventId=${encodeURIComponent(eventId)}`));
  return data.data;
}
