import type { VendorAssignment, VendorPerformance } from '../../models/activeVendor/activeVendorModel';

const BASE = (import.meta as any).env.VITE_API_URL;

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getAssignments(vendorId: string): Promise<VendorAssignment[]> {
  const res = await fetch(`${BASE}/api/vendors/active/${vendorId}/assignments`, { cache: 'no-store' });
  const json = await handle<{ success: boolean; data: VendorAssignment[] }>(res);
  return json.data;
}

export async function updateAssignment(
  vendorId: string,
  assignmentId: string,
  action: 'accept' | 'decline' | 'start' | 'end',
): Promise<{ success: boolean; message: string; status?: string }> {
  const res = await fetch(`${BASE}/api/vendors/active/${vendorId}/assignments/${assignmentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  return handle<{ success: boolean; message: string; status?: string }>(res);
}

export async function getPerformance(vendorId: string): Promise<VendorPerformance> {
  const res = await fetch(`${BASE}/api/vendors/active/${vendorId}/performance`, { cache: 'no-store' });
  const json = await handle<{ success: boolean; data: VendorPerformance }>(res);
  return json.data;
}
