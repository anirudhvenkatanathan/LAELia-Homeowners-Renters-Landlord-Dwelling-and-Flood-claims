import fs from 'fs';
import path from 'path';
import { evaluateRoleConditions, type ConditionData } from '../../utils/ruleEvaluator';
import { mapClaimTypeToLOB } from '../../utils/lineOfBusiness';

const dir = path.resolve(__dirname, '../ClaimDB');
const rd = (n: string): any[] => JSON.parse(fs.readFileSync(path.join(dir, `claim_triage.${n}.json`), 'utf8'));
const roles = rd('service_request_roles');
const conds = rd('service_request_role_conditions') as ConditionData[];
const claims = rd('claim_intake_records');
const vendors = rd('vendor_details');

describe('property-lines seed', () => {
  it('has 75 claims, 15 per line of business', () => {
    expect(claims).toHaveLength(75);
    const counts: Record<string, number> = {};
    claims.forEach((c) => { const l = mapClaimTypeToLOB(c.claimType) ?? 'none'; counts[l] = (counts[l] ?? 0) + 1; });
    expect(counts).toEqual({ Homeowners: 15, Renters: 15, Landlord: 15, Dwelling: 15, Flood: 15 });
  });

  it('stored plan services equal what the rule engine computes', () => {
    for (const c of claims) {
      const lob = mapClaimTypeToLOB(c.claimType)!;
      const expected = roles
        .filter((r) => r.lineOfBusiness.includes(lob) && evaluateRoleConditions(c, conds.filter((x) => x.roleId === r.roleId)))
        .map((r) => r.roleId);
      expect([...c.existingplanservices].sort()).toEqual(expected.sort());
    }
  });

  it('fires every rule on at least two claims', () => {
    for (const r of roles) {
      expect(claims.filter((c) => c.existingplanservices.includes(r.roleId)).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('covers every claim and service review status', () => {
    expect(new Set(claims.map((c) => c.planServiceStatus))).toEqual(new Set(['Pending Selection', 'Pending Review', 'Finalized Selection', 'Completed']));
    const svc = new Set(claims.flatMap((c) => c.serviceVendorReview.map((e: any) => e.status)));
    ['Locked', 'Pending Review', 'Modified', 'Included', 'Rejected'].forEach((s) => expect(svc.has(s)).toBe(true));
    expect(claims.some((c) => c.claimStatus === 'Denied')).toBe(true);
  });

  it('only references providers and rules that exist, and every rule has an Active provider', () => {
    const roleIds = new Set(roles.map((r) => r.roleId));
    vendors.forEach((v) => v.serviceRequestRoleId.forEach((id: string) => expect(roleIds.has(id)).toBe(true)));
    for (const r of roles) expect(vendors.some((v) => v.vendorStatus === 'Active' && v.serviceRequestRoleId.includes(r.roleId))).toBe(true);
    const names = new Set(vendors.map((v) => v.companyName));
    claims.forEach((c) => c.serviceVendorReview.forEach((e: any) => { if (e.selectedVendor) expect(names.has(e.selectedVendor)).toBe(true); }));
  });

  it('uses fictional contact details only', () => {
    vendors.forEach((v) => { expect(v.emailId).toMatch(/\.example$/); expect(v.phoneNumber).toMatch(/555-01\d\d$/); });
  });
});
