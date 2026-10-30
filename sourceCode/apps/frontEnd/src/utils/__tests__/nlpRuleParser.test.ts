import { describe, it, expect } from 'vitest';
import { parseNlpRule, buildConditionExpression, buildFieldDictionary, parseConditionExpression } from '../nlpRuleParser';

// ─── buildFieldDictionary ─────────────────────────────────────────────────────

describe('buildFieldDictionary', () => {
  it('returns built-in mappings when no dynamic entries are provided', () => {
    const dict = buildFieldDictionary([]);
    expect(dict['claim amount']).toBe('claimAmount');
    expect(dict['injury type']).toBe('injuryType');
  });

  it('merges dynamic DB entries over built-ins', () => {
    const dict = buildFieldDictionary([
      { sourceField: 'lossDate', nlpAlias: 'loss date' },
    ]);
    expect(dict['loss date']).toBe('lossDate');
    expect(dict['claim amount']).toBe('claimAmount'); // built-in still present
  });

  it('DB entries can override built-in aliases', () => {
    const dict = buildFieldDictionary([
      { sourceField: 'totalLoss', nlpAlias: 'claim amount' },
    ]);
    expect(dict['claim amount']).toBe('totalLoss');
  });

  it('normalises DB alias to lowercase', () => {
    const dict = buildFieldDictionary([
      { sourceField: 'claimStatus', nlpAlias: 'Claim Status' },
    ]);
    expect(dict['claim status']).toBe('claimStatus');
  });

  it('ignores entries with empty sourceField or nlpAlias', () => {
    const dict = buildFieldDictionary([
      { sourceField: '', nlpAlias: 'empty' },
      { sourceField: 'claimStatus', nlpAlias: '' },
    ]);
    expect(dict['empty']).toBeUndefined();
    expect(dict['']).toBeUndefined();
  });
});

// ─── buildConditionExpression ─────────────────────────────────────────────────

describe('buildConditionExpression', () => {
  it('returns empty string for empty input', () => {
    expect(buildConditionExpression([])).toBe('');
  });

  it('formats a single numeric condition without quotes', () => {
    const result = buildConditionExpression([
      { fieldName: 'claimAmount', operator: '>', value: '10000', conditionType: 'AND' },
    ]);
    expect(result).toBe('(claimAmount > 10000)');
  });

  it('wraps text values in single quotes', () => {
    const result = buildConditionExpression([
      { fieldName: 'injuryType', operator: 'contains', value: 'soft tissue', conditionType: 'AND' },
    ]);
    expect(result).toBe("(injuryType CONTAINS 'soft tissue')");
  });

  it('joins multiple conditions with their connector', () => {
    const result = buildConditionExpression([
      { fieldName: 'claimAmount', operator: '>', value: '10000', conditionType: 'AND' },
      { fieldName: 'injuryType', operator: 'contains', value: 'soft tissue', conditionType: 'AND' },
    ]);
    expect(result).toBe("(claimAmount > 10000) AND (injuryType CONTAINS 'soft tissue')");
  });

  it('uses OR connector correctly', () => {
    const result = buildConditionExpression([
      { fieldName: 'severityScore', operator: '>', value: '75', conditionType: 'OR' },
      { fieldName: 'claimType', operator: '=', value: 'Medical', conditionType: 'AND' },
    ]);
    expect(result).toBe("(severityScore > 75) OR (claimType = 'Medical')");
  });

  it('uppercases operator symbols without change', () => {
    const result = buildConditionExpression([
      { fieldName: 'x', operator: '>=', value: '5', conditionType: 'AND' },
    ]);
    expect(result).toBe('(x >= 5)');
  });
});

// ─── parseNlpRule — basic field/operator matching ─────────────────────────────

describe('parseNlpRule – basic matching', () => {
  it('parses "claim amount greater than 10000"', () => {
    const result = parseNlpRule('claim amount greater than 10000');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ fieldName: 'claimAmount', operator: '>', value: '10000' });
  });

  it('parses "injury type contains soft tissue"', () => {
    const result = parseNlpRule('injury type contains soft tissue');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ fieldName: 'injuryType', operator: 'contains', value: 'soft tissue' });
  });

  it('parses "severity score less than 50"', () => {
    const result = parseNlpRule('severity score less than 50');
    expect(result[0]).toMatchObject({ fieldName: 'severityScore', operator: '<', value: '50' });
  });

  it('parses "claim type equals Medical" preserving value casing', () => {
    const result = parseNlpRule('claim type equals Medical');
    expect(result[0]).toMatchObject({ fieldName: 'claimType', operator: '=', value: 'Medical' });
  });
});

// ─── parseNlpRule — filler word stripping ────────────────────────────────────

describe('parseNlpRule – filler word stripping', () => {
  it('strips leading "If" from the clause', () => {
    const result = parseNlpRule('If claim amount is greater than 10000');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ fieldName: 'claimAmount', operator: '>', value: '10000' });
  });

  it('strips trailing "is" between field name and operator', () => {
    const result = parseNlpRule('claim amount is greater than 10000');
    expect(result[0].fieldName).toBe('claimAmount');
    expect(result[0].value).toBe('10000');
  });

  it('strips leading "the" from field phrase', () => {
    const result = parseNlpRule('the claim amount is greater than 5000');
    expect(result[0].fieldName).toBe('claimAmount');
  });

  it('strips leading "When"', () => {
    const result = parseNlpRule('When severity score greater than 75');
    expect(result[0].fieldName).toBe('severityScore');
    expect(result[0].value).toBe('75');
  });
});

// ─── parseNlpRule — compound AND/OR ──────────────────────────────────────────

describe('parseNlpRule – compound conditions', () => {
  it('parses two AND conditions', () => {
    const result = parseNlpRule(
      'claim amount greater than 10000 and injury type contains soft tissue',
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ fieldName: 'claimAmount', operator: '>', value: '10000', conditionType: 'AND' });
    expect(result[1]).toMatchObject({ fieldName: 'injuryType', operator: 'contains', value: 'soft tissue', conditionType: 'AND' });
  });

  it('parses OR conditions', () => {
    const result = parseNlpRule(
      'severity score greater than 75 or claim type equals Medical',
    );
    expect(result).toHaveLength(2);
    expect(result[0].conditionType).toBe('OR');
    expect(result[1].fieldName).toBe('claimType');
    expect(result[1].value).toBe('Medical');
  });

  it('parses mixed AND/OR', () => {
    const result = parseNlpRule(
      'claim amount greater than 1000 and injury type contains soft tissue or claim type equals Medical',
    );
    expect(result).toHaveLength(3);
    expect(result[0].conditionType).toBe('AND');
    expect(result[1].conditionType).toBe('OR');
  });

  it('last condition inherits the preceding connector type', () => {
    const result = parseNlpRule('claim amount greater than 1000 or severity score less than 50');
    expect(result[0].conditionType).toBe('OR');
    expect(result[1].conditionType).toBe('OR'); // inherits last connector
  });

  it('all-OR chain: every condition gets conditionType OR', () => {
    const result = parseNlpRule(
      'claim amount greater than 1000 or severity score less than 50 or claim type equals Medical',
    );
    expect(result).toHaveLength(3);
    expect(result[0].conditionType).toBe('OR');
    expect(result[1].conditionType).toBe('OR');
    expect(result[2].conditionType).toBe('OR');
  });
});

// ─── parseNlpRule — empty-value check phrases ────────────────────────────────

describe('parseNlpRule – empty-value check phrases', () => {
  it('"is not equal empty" → operator != with empty value', () => {
    const r = parseNlpRule('prior no-show history is not equal empty');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ operator: '!=', value: '' });
    expect(r[0].fieldName).toBe('Prior no-show history');
  });

  it('"is not empty" → operator != with empty value', () => {
    const r = parseNlpRule('prior no-show history is not empty');
    expect(r[0]).toMatchObject({ operator: '!=', value: '' });
  });

  it('"not empty" → operator != with empty value', () => {
    const r = parseNlpRule('prior no-show history not empty');
    expect(r[0]).toMatchObject({ operator: '!=', value: '' });
  });

  it('"has value" → operator != with empty value', () => {
    const r = parseNlpRule('prior no-show history has value');
    expect(r[0]).toMatchObject({ operator: '!=', value: '' });
  });

  it('"contains value" → operator != with empty value', () => {
    const r = parseNlpRule('prior no-show history contains value');
    expect(r[0]).toMatchObject({ operator: '!=', value: '' });
  });

  it('"not equal empty" → operator != with empty value', () => {
    const r = parseNlpRule('prior no-show history not equal empty');
    expect(r[0]).toMatchObject({ operator: '!=', value: '' });
  });

  it('"is not equal to empty" → operator != with empty value', () => {
    const r = parseNlpRule('prior history is not equal to empty');
    expect(r[0]).toMatchObject({ operator: '!=', value: '' });
    expect(r[0].fieldName).toBe('Prior history');
  });

  it('four-condition mixed AND/OR chain with "is not equal to empty"', () => {
    const input =
      'prior history is not equal to empty and cumulative trauma is not equal to empty or contested claim is not equal to empty or high-prior-treatment body part is not equal to empty';
    const r = parseNlpRule(input);
    expect(r).toHaveLength(4);
    expect(r[0]).toMatchObject({ fieldName: 'Prior history',                   operator: '!=', value: '', conditionType: 'AND' });
    expect(r[1]).toMatchObject({ fieldName: 'Cumulative trauma',               operator: '!=', value: '', conditionType: 'OR'  });
    expect(r[2]).toMatchObject({ fieldName: 'Contested claim',                 operator: '!=', value: '', conditionType: 'OR'  });
    expect(r[3]).toMatchObject({ fieldName: 'High-prior-treatment body part',  operator: '!=', value: '', conditionType: 'OR'  });
  });

  it('round-trip: four-condition mixed AND/OR produces expected expression', () => {
    const input =
      'prior history is not equal to empty and cumulative trauma is not equal to empty or contested claim is not equal to empty or high-prior-treatment body part is not equal to empty';
    const expr = buildConditionExpression(parseNlpRule(input));
    expect(expr).toBe(
      "(Prior history != '') AND (Cumulative trauma != '') OR (Contested claim != '') OR (High-prior-treatment body part != '')",
    );
  });

  it('buildConditionExpression quotes empty value as \'\'', () => {
    const expr = buildConditionExpression([
      { fieldName: 'Prior no-show history', operator: '!=', value: '', conditionType: 'OR' },
    ]);
    expect(expr).toBe("(Prior no-show history != '')");
  });

  it('full OR chain: three-condition mixed empty-check and symbolic', () => {
    const r = parseNlpRule(
      'prior no-show history is not equal empty or appointment distance > 25 miles or no documented transport is not equal empty',
    );
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ fieldName: 'Prior no-show history', operator: '!=', value: '', conditionType: 'OR' });
    expect(r[1]).toMatchObject({ fieldName: 'Appointment distance',  operator: '>',  value: '25 miles', conditionType: 'OR' });
    expect(r[2]).toMatchObject({ fieldName: 'No documented transport', operator: '!=', value: '', conditionType: 'OR' });
  });

  it('round-trip: three-condition OR chain produces expected expression', () => {
    const parsed = parseNlpRule(
      'prior no-show history is not equal empty or appointment distance > 25 miles or no documented transport is not equal empty',
    );
    const expr = buildConditionExpression(parsed);
    expect(expr).toBe(
      "(Prior no-show history != '') OR (Appointment distance > '25 miles') OR (No documented transport != '')",
    );
  });
});

// ─── parseNlpRule — symbolic operators ───────────────────────────────────────

describe('parseNlpRule – symbolic operators', () => {
  it('handles bare ">" symbol', () => {
    const r = parseNlpRule('claimant age > 100');
    expect(r[0]).toMatchObject({ operator: '>', value: '100' });
  });

  it('handles bare ">=" symbol', () => {
    const r = parseNlpRule('claimant age >= 100');
    expect(r[0]).toMatchObject({ operator: '>=', value: '100' });
  });

  it('handles bare "<" symbol', () => {
    const r = parseNlpRule('claimant age < 100');
    expect(r[0]).toMatchObject({ operator: '<', value: '100' });
  });

  it('handles bare "<=" symbol', () => {
    const r = parseNlpRule('claimant age <= 100');
    expect(r[0]).toMatchObject({ operator: '<=', value: '100' });
  });

  it('handles bare "!=" symbol', () => {
    const r = parseNlpRule('claimant age != 100');
    expect(r[0]).toMatchObject({ operator: '!=', value: '100' });
  });

  it('mixes symbolic and NLP operators in one statement', () => {
    const r = parseNlpRule(
      'claimant age > 100 and cumulative/soft-tissue injury is equal to 1000',
    );
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ operator: '>', value: '100' });
    expect(r[1]).toMatchObject({ operator: '=', value: '1000' });
  });

  it('normalises space after "/" in field name', () => {
    const r = parseNlpRule('cumulative/ soft-tissue injury is equal to 1000');
    expect(r[0].fieldName).toBe('Cumulative/soft-tissue injury');
  });
});

// ─── parseNlpRule — operator variations ──────────────────────────────────────

describe('parseNlpRule – operator variations', () => {
  it('handles "equal to"', () => {
    const r = parseNlpRule('claim type equal to Medical');
    expect(r[0]).toMatchObject({ operator: '=', value: 'Medical' });
  });

  it('handles "not equal to"', () => {
    const r = parseNlpRule('claim type not equal to Medical');
    expect(r[0]).toMatchObject({ operator: '!=', value: 'Medical' });
  });

  it('handles "greater than or equal to"', () => {
    const r = parseNlpRule('severity score greater than or equal to 80');
    expect(r[0]).toMatchObject({ operator: '>=', value: '80' });
  });

  it('handles "starts with"', () => {
    const r = parseNlpRule('injury type starts with soft');
    expect(r[0]).toMatchObject({ operator: 'starts_with', value: 'soft' });
  });

  it('handles "ends with"', () => {
    const r = parseNlpRule('injury type ends with tissue');
    expect(r[0]).toMatchObject({ operator: 'ends_with', value: 'tissue' });
  });
});

// ─── parseNlpRule — dynamic field mappings ───────────────────────────────────

describe('parseNlpRule – dynamic field mappings', () => {
  const dynamic = [
    { sourceField: 'lossDate',     nlpAlias: 'loss date' },
    { sourceField: 'policyNumber', nlpAlias: 'policy number' },
  ];

  it('resolves a DB-loaded field alias', () => {
    const result = parseNlpRule('loss date greater than 2024-01-01', dynamic);
    expect(result[0].fieldName).toBe('lossDate');
  });

  it('still resolves built-in fields alongside dynamic ones', () => {
    const result = parseNlpRule(
      'claim amount greater than 5000 and loss date greater than 2024-01-01',
      dynamic,
    );
    expect(result[0].fieldName).toBe('claimAmount');
    expect(result[1].fieldName).toBe('lossDate');
  });

  it('falls back to sentence-case when alias is not in any mapping', () => {
    // "field" is a filler word and gets stripped; remaining "unknown" is capitalised.
    const result = parseNlpRule('unknown field greater than 5');
    expect(result[0].fieldName).toBe('Unknown');
  });

  it('falls back to sentence-case for multi-word unrecognised field', () => {
    const result = parseNlpRule('prior claims count greater than 5');
    expect(result[0].fieldName).toBe('Prior claims count');
  });
});

// ─── parseNlpRule — compromise fallback ──────────────────────────────────────

describe('parseNlpRule – compromise fallback (operator synonyms + number normalisation)', () => {
  it('"more than" operator synonym', () => {
    const r = parseNlpRule('claim amount more than 10000');
    expect(r[0]).toMatchObject({ fieldName: 'claimAmount', operator: '>', value: '10000' });
  });

  it('"above" operator synonym', () => {
    const r = parseNlpRule('severity score above 75');
    expect(r[0]).toMatchObject({ fieldName: 'severityScore', operator: '>', value: '75' });
  });

  it('"below" operator synonym', () => {
    const r = parseNlpRule('severity score below 50');
    expect(r[0]).toMatchObject({ fieldName: 'severityScore', operator: '<', value: '50' });
  });

  it('"exceeds" operator synonym', () => {
    const r = parseNlpRule('claim amount exceeds 5000');
    expect(r[0]).toMatchObject({ fieldName: 'claimAmount', operator: '>', value: '5000' });
  });

  it('"at least" operator synonym → >=', () => {
    const r = parseNlpRule('severity score at least 80');
    expect(r[0]).toMatchObject({ fieldName: 'severityScore', operator: '>=', value: '80' });
  });

  it('"at most" operator synonym → <=', () => {
    const r = parseNlpRule('severity score at most 30');
    expect(r[0]).toMatchObject({ fieldName: 'severityScore', operator: '<=', value: '30' });
  });

  it('"no more than" operator synonym → <=', () => {
    const r = parseNlpRule('claim amount no more than 1000');
    expect(r[0]).toMatchObject({ fieldName: 'claimAmount', operator: '<=', value: '1000' });
  });

  it('normalises spoken number "ten thousand"', () => {
    const r = parseNlpRule('claim amount exceeds ten thousand');
    expect(r[0]).toMatchObject({ fieldName: 'claimAmount', operator: '>', value: '10000' });
  });

  it('normalises spoken number "seventy five"', () => {
    const r = parseNlpRule('severity score above seventy five');
    expect(r[0]).toMatchObject({ fieldName: 'severityScore', operator: '>', value: '75' });
  });

  it('normalises "one hundred and fifty"', () => {
    const r = parseNlpRule('severity score at least one hundred and fifty');
    expect(r[0]).toMatchObject({ fieldName: 'severityScore', operator: '>=', value: '150' });
  });

  it('normalises comma-formatted number "1,000"', () => {
    const r = parseNlpRule('claim amount more than 1,000');
    expect(r[0]).toMatchObject({ fieldName: 'claimAmount', operator: '>', value: '1000' });
  });

  it('preserves text values unchanged (no number normalisation)', () => {
    const r = parseNlpRule('injury type includes soft tissue');
    expect(r[0]).toMatchObject({ fieldName: 'injuryType', operator: 'contains', value: 'soft tissue' });
  });

  it('mixes primary-parsed and compromise-fallback clauses in one statement', () => {
    const r = parseNlpRule(
      'claim amount greater than 5000 and severity score above 80',
    );
    expect(r).toHaveLength(2);
    // First clause: primary parser handles "greater than"
    expect(r[0]).toMatchObject({ fieldName: 'claimAmount', operator: '>', value: '5000' });
    // Second clause: compromise fallback handles "above"
    expect(r[1]).toMatchObject({ fieldName: 'severityScore', operator: '>', value: '80' });
  });
});

// ─── round-trip: parse → expression ──────────────────────────────────────────

describe('round-trip: parseNlpRule → buildConditionExpression', () => {
  it('Example 1: If claim amount is greater than 10000', () => {
    const expr = buildConditionExpression(
      parseNlpRule('If claim amount is greater than 10000'),
    );
    expect(expr).toBe('(claimAmount > 10000)');
  });

  it('Example 2: compound AND', () => {
    const expr = buildConditionExpression(
      parseNlpRule('Claim amount greater than 10000 and injury type contains soft tissue'),
    );
    expect(expr).toBe("(claimAmount > 10000) AND (injuryType CONTAINS 'soft tissue')");
  });

  it('Example 3: compound OR with text value casing preserved', () => {
    const expr = buildConditionExpression(
      parseNlpRule('Severity score greater than 75 or claim type equals Medical'),
    );
    expect(expr).toBe("(severityScore > 75) OR (claimType = 'Medical')");
  });

  it('returns empty string for unparseable input', () => {
    const parsed = parseNlpRule('hello world');
    expect(parsed).toHaveLength(0);
    expect(buildConditionExpression(parsed)).toBe('');
  });
});

// ─── parseConditionExpression ─────────────────────────────────────────────────

describe('parseConditionExpression', () => {
  it('parses a single numeric condition', () => {
    const result = parseConditionExpression('(claimAmount > 10000)');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ fieldName: 'claimAmount', operator: '>', value: '10000' });
  });

  it('parses a single empty-string condition — value must not be filtered out', () => {
    const result = parseConditionExpression("(Prior no-show history != '')");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ fieldName: 'Prior no-show history', operator: '!=', value: '' });
  });

  it('parses three-condition OR expression including empty-value conditions', () => {
    const expr = "(Prior no-show history != '') OR (Appointment distance > '25 miles') OR (No documented transport != '')";
    const result = parseConditionExpression(expr);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ fieldName: 'Prior no-show history',   operator: '!=', value: '',         conditionType: 'OR' });
    expect(result[1]).toMatchObject({ fieldName: 'Appointment distance',    operator: '>',  value: '25 miles', conditionType: 'OR' });
    expect(result[2]).toMatchObject({ fieldName: 'No documented transport', operator: '!=', value: '',         conditionType: 'AND' });
  });

  it('strips surrounding quotes from text values', () => {
    const result = parseConditionExpression("(injuryType CONTAINS 'soft tissue')");
    expect(result[0].value).toBe('soft tissue');
  });
});
