// ─── Rule condition evaluation (pure, no DB) ────────────────────────────────────
// Used by the claim intake resolvers and by the seed consistency check.
//
// Conditions are an ordered list: the first one starts the expression and each
// later one is joined to the PREVIOUS result by its own conditionType (AND/OR).
// AND binds tighter than OR (standard precedence), so the list
//   A, AND B, OR C, AND D   means   (A AND B) OR (C AND D).
// For lists that only OR together, or that put a run of ANDs first followed by
// ORs, this gives exactly the same answer as strict left-to-right evaluation.

export interface ConditionData {
  roleId:        string;
  fieldName:     string;
  operator:      string;
  value:         string;
  conditionType: string;
  sortOrder:     number;
}

// Maps human-readable operator labels → symbolic values so both formats work.
const OPERATOR_LABEL_MAP: Record<string, string> = {
  'equals':                   '=',
  '= (equals)':               '=',
  'not equals':               '!=',
  '!= (not equals)':          '!=',
  'greater than':             '>',
  '> (greater than)':         '>',
  'greater than or equal to': '>=',
  'greater or equal':         '>=',
  '>= (greater or equal)':    '>=',
  'less than':                '<',
  '< (less than)':            '<',
  'less than or equal to':    '<=',
  'less or equal':            '<=',
  '<= (less or equal)':       '<=',
  'in (in list)':             'IN',
  'not in':                   'NOT IN',
  'contains':                 'contains',
  'starts with':              'starts_with',
  'starts_with':              'starts_with',
  'ends with':                'ends_with',
  'ends_with':                'ends_with',
};

function normalizeOperator(op: string): string {
  return OPERATOR_LABEL_MAP[op.toLowerCase().trim()] ?? op.trim();
}

export function getClaimField(record: Record<string, unknown>, fieldName: string): string {
  // Normalize: lowercase, strip spaces/underscores/hyphens for lookup
  const n = fieldName.toLowerCase().replace(/[_\s-]/g, '');
  const fieldMap: Record<string, string> = {
    claimnumber:       'claimNumber',
    policynumber:      'policyNumber',
    insuredname:       'insuredName',
    claimtype:         'claimType',
    lossdate:          'lossDate',
    reporteddate:      'reportedDate',
    claimamount:       'claimAmount',
    amount:            'claimAmount',
    claimstatus:       'claimStatus',
    status:            'claimStatus',
    validationstatus:  'validationStatus',
    validationmessage: 'validationMessage',
  };
  // 1. Normalized map lookup
  const mappedKey = fieldMap[n];
  if (mappedKey && record[mappedKey] !== undefined && record[mappedKey] !== null)
    return String(record[mappedKey]).trim();
  // 2. Exact key in record
  if (record[fieldName] !== undefined && record[fieldName] !== null)
    return String(record[fieldName]).trim();
  // 3. Case-insensitive scan of all keys
  const directKey = Object.keys(record).find((k) => k.toLowerCase().replace(/[_\s-]/g, '') === n);
  return directKey && record[directKey] != null ? String(record[directKey]).trim() : '';
}

// Strip currency symbols, commas, spaces so "$8,500.00" → "8500"
function toNumericString(s: string): string {
  return s.replace(/[$,£€¥\s]/g, '');
}

export function evalCondition(recordValue: string, rawOp: string, condValue: string): boolean {
  const op  = normalizeOperator(rawOp);
  const rv  = (recordValue ?? '').toLowerCase().trim();
  const cv  = (condValue ?? '').toLowerCase().trim();
  // Parse numerics after stripping formatting (handles "$8,500.00" etc.)
  const rvN = parseFloat(toNumericString(rv));
  const cvN = parseFloat(toNumericString(cv));
  switch (op) {
    case '=':  {
      // Try exact string match first; if both look numeric, compare as numbers
      if (!isNaN(rvN) && !isNaN(cvN)) return rvN === cvN;
      return rv === cv;
    }
    case '!=': {
      if (!isNaN(rvN) && !isNaN(cvN)) return rvN !== cvN;
      return rv !== cv;
    }
    case '>':           return !isNaN(rvN) && !isNaN(cvN) && rvN > cvN;
    case '>=':          return !isNaN(rvN) && !isNaN(cvN) && rvN >= cvN;
    case '<':           return !isNaN(rvN) && !isNaN(cvN) && rvN < cvN;
    case '<=':          return !isNaN(rvN) && !isNaN(cvN) && rvN <= cvN;
    case 'IN':          return cv.split(',').map((s) => s.trim()).includes(rv);
    case 'NOT IN':      return !cv.split(',').map((s) => s.trim()).includes(rv);
    case 'contains':    return rv.includes(cv);
    case 'starts_with': return rv.startsWith(cv);
    case 'ends_with':   return rv.endsWith(cv);
    default:            return false;
  }
}

export function evaluateRoleConditions(record: Record<string, unknown>, conditions: ConditionData[]): boolean {
  if (conditions.length === 0) return false;
  const sorted = [...conditions].sort((a, b) => a.sortOrder - b.sortOrder);
  // Split into OR-separated groups of AND-ed conditions.
  const groups: boolean[][] = [[evalCondition(getClaimField(record, sorted[0].fieldName), sorted[0].operator, sorted[0].value)]];
  for (let i = 1; i < sorted.length; i++) {
    const c = sorted[i];
    const cur = evalCondition(getClaimField(record, c.fieldName), c.operator, c.value);
    if (c.conditionType === 'OR') groups.push([cur]);
    else groups[groups.length - 1].push(cur);
  }
  return groups.some((g) => g.every(Boolean));
}
