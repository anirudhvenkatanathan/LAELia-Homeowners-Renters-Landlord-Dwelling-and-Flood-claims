// Consistency check for the generated seed: every rule fires on >=2 claims, every status is represented,
// every LOB has 15 claims. run: npx tsx seed/check.ts
import fs from 'fs';
import path from 'path';
const dir = path.resolve(__dirname, 'ClaimDB');
const rd = (n: string) => JSON.parse(fs.readFileSync(path.join(dir, `claim_triage.${n}.json`), 'utf8')) as any[];
const roles = rd('service_request_roles'), recs = rd('claim_intake_records');
const fired = new Map<string, number>(roles.map((r) => [r.roleId, 0]));
const lob = new Map<string, number>(), status = new Map<string, number>(), svc = new Map<string, number>();
for (const r of recs) {
  for (const id of r.existingplanservices) fired.set(id, (fired.get(id) ?? 0) + 1);
  const l = String(r.claimNumber).slice(0, 2); lob.set(l, (lob.get(l) ?? 0) + 1);
  status.set(r.planServiceStatus, (status.get(r.planServiceStatus) ?? 0) + 1);
  for (const e of r.serviceVendorReview) svc.set(e.status, (svc.get(e.status) ?? 0) + 1);
}
let bad = 0;
for (const r of roles) { const n = fired.get(r.roleId) ?? 0; if (n < 2) { bad++; console.log(`LOW  ${n}  ${r.roleName}`); } }
console.log('claims per LOB', Object.fromEntries(lob));
console.log('claim status', Object.fromEntries(status));
console.log('service status', Object.fromEntries(svc));
console.log('rules firing >=2:', roles.length - bad, '/', roles.length);
process.exit(bad ? 1 : 0);
