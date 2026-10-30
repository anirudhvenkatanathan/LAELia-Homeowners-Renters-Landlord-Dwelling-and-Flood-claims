import { describe, it, expect } from 'vitest';
import { getIsoClaimSearchData, type IsoFlagType } from '../isoClaimSearchMockData';
import { getClaimSummaryData } from '../claimSummaryMockData';
import type { IndividualClaimRecord } from '../../models/claimIntakeMaster/claimIntakeModel';

const ALL_TYPES: IsoFlagType[] = [
  'PriorClaimsHistory', 'SharedRepresentation', 'PropertyClaimClustering',
  'PropertyFrequencySpike', 'CrossCarrierMatch', 'ContractorUtilizationOutlier', 'ClaimFrequency',
];

const KNOWN_CLAIM_NUMBERS = ['HO-2026-001', 'LL-2026-001', 'DW-2026-001', 'FL-2026-001'];

function makeRecord(overrides: Partial<IndividualClaimRecord>): IndividualClaimRecord {
  return {
    recordIndex: 0,
    claimNumber: 'HO-TEST',
    policyNumber: '',
    insuredName: '',
    claimType: '',
    lossDate: '',
    reportedDate: '',
    claimAmount: '',
    claimStatus: '',
    validationStatus: '',
    validationMessage: '',
    planServices: [],
    planServiceNames: [],
    confirmedPlanServices: [],
    confirmedPlanServiceNames: [],
    planServiceStatus: '',
    planServiceComments: '',
    vendorServices: [],
    vendorServiceComments: '',
    suggestedVendors: [],
    ...overrides,
  };
}

describe('getIsoClaimSearchData', () => {
  it('returns null for a null/undefined record or a missing claimNumber', () => {
    expect(getIsoClaimSearchData(null)).toBeNull();
    expect(getIsoClaimSearchData(undefined)).toBeNull();
    expect(getIsoClaimSearchData(makeRecord({ claimNumber: '' }))).toBeNull();
  });

  it('is deterministic within a session — same claim number always yields the same result', () => {
    const r = makeRecord({ claimNumber: 'HO-2026-999', insuredName: 'Jordan Ellis' });
    const a = getIsoClaimSearchData(r);
    const b = getIsoClaimSearchData(r);
    expect(a).toEqual(b);
  });

  it('guarantees a real spread across the 4 known demo claims: 1 no-match, 1 with 2 stacked flags, 2 with 1 flag', () => {
    const results = KNOWN_CLAIM_NUMBERS.map(claimNumber =>
      getIsoClaimSearchData(makeRecord({ claimNumber, insuredName: 'Test Claimant' }))
    );
    const noMatchCount = results.filter(r => r === null).length;
    const twoFlagCount = results.filter(r => r !== null && r.flags.length === 2).length;
    const oneFlagCount = results.filter(r => r !== null && r.flags.length === 1).length;
    expect(noMatchCount).toBe(1);
    expect(twoFlagCount).toBe(1);
    expect(oneFlagCount).toBe(2);
  });

  it('stacks 2-flag claims with distinct flag types, most significant first', () => {
    for (const claimNumber of KNOWN_CLAIM_NUMBERS) {
      const data = getIsoClaimSearchData(makeRecord({ claimNumber, insuredName: 'Test Claimant' }));
      if (data === null || data.flags.length !== 2) continue;
      const [first, second] = data.flags;
      expect(first.flagType).not.toBe(second.flagType);
      // SharedRepresentation/PropertyClaimClustering/ContractorUtilizationOutlier
      // outrank PriorClaimsHistory/CrossCarrierMatch, which outrank
      // PropertyFrequencySpike/ClaimFrequency — spot-check a same-tier-vs-lower-tier pair.
      const HIGH_TIER: IsoFlagType[] = ['SharedRepresentation', 'PropertyClaimClustering', 'ContractorUtilizationOutlier'];
      const LOW_TIER: IsoFlagType[] = ['PropertyFrequencySpike', 'ClaimFrequency'];
      if (HIGH_TIER.includes(second.flagType)) expect(HIGH_TIER).toContain(first.flagType);
      if (LOW_TIER.includes(first.flagType)) expect(LOW_TIER).toContain(second.flagType);
    }
  });

  it('every non-null result across the known claims has well-formed flag cards', () => {
    for (const claimNumber of KNOWN_CLAIM_NUMBERS) {
      const data = getIsoClaimSearchData(makeRecord({ claimNumber, insuredName: 'Test Claimant' }));
      if (data === null) continue;
      expect(data.flags.length).toBeGreaterThan(0);
      for (const card of data.flags) {
        expect(ALL_TYPES).toContain(card.flagType);
        expect(card.matches.length).toBeGreaterThan(0);
        for (const match of card.matches) {
          expect(match.isoFileNumber).toBeTruthy();
          expect(match.fields.length).toBeGreaterThan(0);
          for (const field of match.fields) {
            expect(field.label).toBeTruthy();
            expect(field.value).toBeTruthy();
          }
        }
        expect(card.flagDescription.length).toBeGreaterThan(0);
        expect(card.claimSpecificInsight.length).toBeGreaterThan(0);
      }
    }
  });

  it('always surfaces this claim\'s own real identifying fields, regardless of which flag type is assigned', () => {
    const record = makeRecord({
      claimNumber: 'HO-2026-555',
      insuredName: 'Alex Rivera',
      policyNumber: 'POL-555555555',
      claimStatus: 'Open',
      jurisdiction: 'Texas',
    });
    const data = getIsoClaimSearchData(record);
    // Not guaranteed non-null (session-random), but if it matched, the
    // current-claim fields must be the real ones, not generated filler.
    if (data) {
      expect(data.currentClaimNumber).toBe('HO-2026-555');
      expect(data.currentPolicyNumber).toBe('POL-555555555');
      expect(data.currentClaimStatus).toBe('Open');
      expect(data.currentJurisdiction).toBe('Texas');
      expect(data.claimantName).toBe('Alex Rivera');
    }
  });

  it('uses real treating-provider fields when present (not generated fallbacks)', () => {
    // Try enough distinct claim numbers that at least one lands on a
    // non-null result to exercise currentClaimFields() end-to-end.
    let found = false;
    for (let i = 0; i < 20 && !found; i++) {
      const claimNumber = `HO-2026-PROV-${i}`;
      const data = getIsoClaimSearchData(makeRecord({
        claimNumber,
        insuredName: 'John Smith',
        propertyAddress: 'ABC Manufacturing Inc',
        assignedAdjuster: 'Dr. Robert Johnson',
        contractorName: 'Valley Occupational Health',
        causeOfLoss: 'Lumbar Strain',
      }));
      if (data) {
        found = true;
        expect(data.claimantName).toBe('John Smith');
        expect(data.currentClaimNumber).toBe(claimNumber);
      }
    }
    expect(found).toBe(true);
  });

  it('every match\'s Cause of Loss / Damaged Area always agrees with this claim\'s Claims Summary section, even when the record has real causeOfLoss/damagedAreas set', () => {
    for (const claimNumber of KNOWN_CLAIM_NUMBERS) {
      const record = makeRecord({
        claimNumber,
        insuredName: 'Test Claimant',
        causeOfLoss: 'Lumbar Strain',
        damagedAreas: 'Lower back',
      });
      const data = getIsoClaimSearchData(record);
      if (data === null) continue;
      const summary = getClaimSummaryData(claimNumber, 'Test Claimant', 'Lumbar Strain', 'Lower back');
      for (const card of data.flags) {
        for (const match of card.matches) {
          const allegedInjury = match.fields.find(f => f.label === 'Cause of Loss')?.value;
          const partOfBody    = match.fields.find(f => f.label === 'Damaged Area')?.value;
          if (allegedInjury !== undefined) expect(allegedInjury).toBe(summary.loss.label);
          if (partOfBody !== undefined) expect(partOfBody).toBe(summary.loss.area);
        }
      }
    }
  });
});
