import { evaluateRoleConditions, ConditionData } from '../ruleEvaluator';

const cond = (fieldName: string, operator: string, value: string, conditionType: string, sortOrder: number): ConditionData =>
  ({ roleId: 'r', fieldName, operator, value, conditionType, sortOrder });

describe('evaluateRoleConditions', () => {
  it('returns false when a rule has no conditions', () => {
    expect(evaluateRoleConditions({ a: 1 }, [])).toBe(false);
  });

  it('matches snake_case rule fields against camelCase claim keys', () => {
    const c = [cond('days_since_loss', '>=', '45', 'AND', 0)];
    expect(evaluateRoleConditions({ daysSinceLoss: 50 }, c)).toBe(true);
    expect(evaluateRoleConditions({ daysSinceLoss: 10 }, c)).toBe(false);
  });

  it('treats a non-empty flag as present and an empty/missing flag as absent', () => {
    const c = [cond('wind_hail_flag', '!=', '', 'AND', 0)];
    expect(evaluateRoleConditions({ windHailFlag: 'present' }, c)).toBe(true);
    expect(evaluateRoleConditions({ windHailFlag: '' }, c)).toBe(false);
    expect(evaluateRoleConditions({}, c)).toBe(false);
  });

  it('ORs flat OR lists', () => {
    const c = [cond('a_flag', '!=', '', 'AND', 0), cond('b_flag', '!=', '', 'OR', 1)];
    expect(evaluateRoleConditions({ bFlag: 'x' }, c)).toBe(true);
    expect(evaluateRoleConditions({}, c)).toBe(false);
  });

  it('gives AND higher precedence than OR: (A AND B) OR (C AND D) OR (E AND F)', () => {
    // Statutory Deadline Watch shape
    const c = [
      cond('days_since_notice', '>', '7', 'AND', 0), cond('acknowledged_flag', '=', '', 'AND', 1),
      cond('days_since_proof_of_loss', '>=', '23', 'OR', 2), cond('inspection_completed_flag', '=', '', 'AND', 3),
      cond('days_since_notice', '>=', '50', 'OR', 4), cond('payment_decision_issued_flag', '=', '', 'AND', 5),
    ];
    // Only the 3rd group holds: notice 55 days ago, no decision issued
    expect(evaluateRoleConditions({ daysSinceNotice: 55, acknowledgedFlag: 'yes', daysSinceProofOfLoss: 0, inspectionCompletedFlag: 'yes', paymentDecisionIssuedFlag: '' }, c)).toBe(true);
    // Strict left-to-right would wrongly require group 1 AND the later terms; here nothing holds
    expect(evaluateRoleConditions({ daysSinceNotice: 3, acknowledgedFlag: 'yes', daysSinceProofOfLoss: 0, inspectionCompletedFlag: 'yes', paymentDecisionIssuedFlag: 'yes' }, c)).toBe(false);
    // Group 1 alone holds: noticed 10 days ago, never acknowledged
    expect(evaluateRoleConditions({ daysSinceNotice: 10, acknowledgedFlag: '', daysSinceProofOfLoss: 0, inspectionCompletedFlag: 'yes', paymentDecisionIssuedFlag: 'yes' }, c)).toBe(true);
  });

  it('keeps an AND-run-first-then-ORs list (Subrogation shape) equivalent to left-to-right', () => {
    const c = [
      cond('liability_evidence_flag', '!=', '', 'AND', 0), cond('potential_recovery_amount', '>', '35000', 'AND', 1),
      cond('jurisdiction', 'IN', 'CA,TX,FL', 'AND', 2), cond('product_involvement_flag', '!=', '', 'OR', 3),
    ];
    expect(evaluateRoleConditions({ liabilityEvidenceFlag: 'y', potentialRecoveryAmount: 40000, jurisdiction: 'FL' }, c)).toBe(true);
    expect(evaluateRoleConditions({ liabilityEvidenceFlag: 'y', potentialRecoveryAmount: 100, jurisdiction: 'FL' }, c)).toBe(false);
    expect(evaluateRoleConditions({ productInvolvementFlag: 'y' }, c)).toBe(true);
  });

  it('compares formatted currency numerically', () => {
    const c = [cond('building_loss_amount', '>', '250000', 'AND', 0)];
    expect(evaluateRoleConditions({ buildingLossAmount: '$260,000.00' }, c)).toBe(true);
  });
});
