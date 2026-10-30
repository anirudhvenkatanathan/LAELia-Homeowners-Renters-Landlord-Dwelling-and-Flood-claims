import nlp from 'compromise';
import type { ParsedRuleCondition } from '../models/ServiceRequestRole/serviceRequestRoleModel';

// ─── Built-in field mappings (fallback when DB hasn't loaded yet) ─────────────

const BUILTIN_FIELD_MAPPINGS: Record<string, string> = {
  'claim amount':     'claimAmount',
  'injury type':      'injuryType',
  'claim type':       'claimType',
  'severity score':   'severityScore',
  'employer':         'employerName',
  'body part':        'bodyParts',
  'physician':        'treatingPhysician',
  'medical facility': 'medicalFacility',
  'jurisdiction':     'jurisdiction',
  'reserve amount':   'totalReserve',
};

// ─── Operator mappings — sorted longest-first so specific phrases win ─────────

const OPERATOR_MAPPINGS: [phrase: string, value: string][] = [
  ['greater than or equal to', '>='],
  ['less than or equal to',    '<='],
  ['not equal to',             '!='],
  ['not equals',               '!='],
  ['greater than',             '>'],
  ['less than',                '<'],
  ['equal to',                 '='],
  ['equals',                   '='],
  ['starts with',              'starts_with'],
  ['ends with',                'ends_with'],
  ['contains',                 'contains'],
  // Symbolic operators — multi-char before single-char so ">=" wins over ">"
  ['>=', '>='], ['<=', '<='], ['!=', '!='], ['>', '>'], ['<', '<'], ['=', '='],
];

// ─── Extended operator synonyms used only by the compromise fallback ──────────
// Listed longest-first so more specific phrases win over shorter ones.

const FALLBACK_OPERATOR_SYNONYMS: [phrase: string, value: string][] = [
  ['does not equal',  '!='],
  ['no more than',    '<='],
  ['no less than',    '>='],
  ['more than',       '>'],
  ['less than',       '<'],
  ['fewer than',       '<'],
  ['at least',        '>='],
  ['at most',         '<='],
  ['not equal',       '!='],
  ['exceeds',         '>'],
  ['exceed',          '>'],
  ['above',           '>'],
  ['over',           '>'],
  ['below',           '<'],
  ['includes',        'contains'],
  ['has',        'contains'],
  ['matches',         '='],
  ['is not',          '!='],
  ['is',              '='],
];

// ─── Empty-value check phrases ────────────────────────────────────────────────
// These encode BOTH the operator ("!=") and an implied empty value ("").
// Ordered longest-first so "is not equal empty" wins over "is not empty".

const EMPTY_CHECK_PHRASES: string[] = [
  'is not equal to empty', // longest first — must precede "is not equal empty"
  'is not equal empty',
  'not equal empty',
  'contains value',
  'is not empty',
  'has value',
  'not empty',
];

// ─── Regex constants ──────────────────────────────────────────────────────────

// Strips clause-level starters ("if claim amount …" → "claim amount …")
const LEADING_CLAUSE_RE = /^(if|when|where)\s+/i;

// Trailing filler words/phrases that can appear between the field name and the
// operator: "claimant age data should be greater than …" → "claimant age"
// Applied iteratively so stacked fillers like "data should be" are fully removed.
const TRAILING_FIELD_FILLER_RE = /\s+\b(should\s+be|data|value|field|record|is|the|a|an)\b$/i;

// Leading articles/fillers on the field name after trailing fillers are removed
const LEADING_FIELD_FILLER_RE  = /^(the|a|an|data|field|record)\s+/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strip non-semantic filler words from both ends of a raw field-name fragment.
 * Trailing stripping is repeated until no more fillers can be removed, so
 * stacked phrases like "data should be" are fully eliminated.
 */
function stripFieldFillers(raw: string): string {
  let s = raw.trim();
  let prev: string;
  do {
    prev = s;
    s = s.replace(TRAILING_FIELD_FILLER_RE, '').trim();
  } while (s !== prev);
  return s.replace(LEADING_FIELD_FILLER_RE, '').trim();
}

// Remove stray spaces around "/" so "cumulative/ soft-tissue" → "cumulative/soft-tissue"
function normalizeFieldName(field: string): string {
  return field.replace(/\s*\/\s*/g, '/').trim();
}

// Capitalize the first letter of an unrecognised field name for display.
function capitalizeFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function toCamelCase(phrase: string): string {
  return phrase
    .trim()
    .split(/\s+/)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function matchOperator(text: string): { phrase: string; value: string; index: number } | null {
  for (const [phrase, value] of OPERATOR_MAPPINGS) {
    const idx = text.indexOf(phrase);
    if (idx !== -1) return { phrase, value, index: idx };
  }
  return null;
}

/**
 * Build a merged field-mapping dictionary from DB-loaded entries + builtins.
 * DB entries take precedence, allowing field aliases to be managed in the database.
 *
 * @param dynamic  Array of { sourceField, nlpAlias } records from the DB
 * @returns        Record<nlpAlias (lowercase), sourceField>
 */
export function buildFieldDictionary(
  dynamic: { sourceField: string; nlpAlias: string }[],
): Record<string, string> {
  const dict: Record<string, string> = { ...BUILTIN_FIELD_MAPPINGS };
  for (const { sourceField, nlpAlias } of dynamic) {
    if (sourceField && nlpAlias) {
      dict[nlpAlias.toLowerCase().trim()] = sourceField;
    }
  }
  return dict;
}

/**
 * Parse a single clause using the provided field dictionary.
 *
 * @param normalizedClause  Fully lowercased clause (used for matching)
 * @param originalClause    Original-cased clause (used for value extraction — preserves casing)
 * @param fieldDict         nlpAlias → sourceField lookup
 */
function parseClause(
  normalizedClause: string,
  originalClause: string,
  fieldDict: Record<string, string>,
): { fieldName: string; operator: string; value: string } | null {
  // Strip leading clause-starters from both strings; indices stay aligned.
  const text     = normalizedClause.replace(LEADING_CLAUSE_RE, '');
  const origText = originalClause.replace(LEADING_CLAUSE_RE, '');

  // Empty-value phrases encode operator + implied value — handle before matchOperator.
  for (const phrase of EMPTY_CHECK_PHRASES) {
    const idx = text.indexOf(phrase);
    if (idx === -1) continue;
    const fieldPart = normalizeFieldName(stripFieldFillers(text.slice(0, idx).trim()));
    if (!fieldPart) continue;
    return { fieldName: fieldDict[fieldPart] ?? capitalizeFirst(fieldPart), operator: '!=', value: '' };
  }

  const op = matchOperator(text);
  if (!op) return null;

  // Field: everything before the operator, with filler words removed
  const fieldRaw  = text.slice(0, op.index).trim();
  const fieldPart = normalizeFieldName(stripFieldFillers(fieldRaw));

  // Value: slice from ORIGINAL text so casing is preserved ("Medical" not "medical")
  const value = origText.slice(op.index + op.phrase.length).trim();

  if (!fieldPart || !value) return null;

  const fieldName = fieldDict[fieldPart] ?? capitalizeFirst(fieldPart);
  return { fieldName, operator: op.value, value };
}

// ─── Compromise fallback ──────────────────────────────────────────────────────

/**
 * Normalise a raw value string using compromise:
 * - Converts spoken numbers ("ten thousand", "seventy five") to digits
 * - Strips thousand-separator commas ("1,000" → "1000")
 * - Returns the original string unchanged when no number is found (e.g. text values)
 */
function normaliseValue(raw: string): string {
  const nums = nlp(raw).numbers().toNumber().out('array') as string[];
  if (nums.length === 0) return raw;
  const cleaned = nums[0].replace(/,/g, '');
  return isNaN(Number(cleaned)) ? raw : cleaned;
}

/**
 * Fallback clause parser using compromise.
 *
 * Handles phrasings the primary parser doesn't recognise:
 *   - Operator synonyms: "more than", "above", "exceeds", "at least", …
 *   - Spoken numbers:    "ten thousand", "seventy five", "one hundred and fifty"
 *   - Comma-formatted:  "1,000"
 *
 * Field identification uses the same dictionary lookup as the primary parser.
 */
function parseClauseWithCompromise(
  originalClause: string,
  fieldDict: Record<string, string>,
): { fieldName: string; operator: string; value: string } | null {
  const stripped = originalClause.replace(LEADING_CLAUSE_RE, '');
  const lower    = stripped.toLowerCase();

  // Empty-value phrases — must come before FALLBACK synonyms ("has", "is not", etc.)
  for (const phrase of EMPTY_CHECK_PHRASES) {
    const idx = lower.indexOf(phrase);
    if (idx === -1) continue;
    const fieldPart = normalizeFieldName(stripFieldFillers(lower.slice(0, idx).trim()));
    if (!fieldPart) continue;
    return { fieldName: fieldDict[fieldPart] ?? capitalizeFirst(fieldPart), operator: '!=', value: '' };
  }

  // Try primary operators first (avoids double-processing clauses that partially parse)
  let op = matchOperator(lower);

  // Try extended synonyms if nothing matched
  if (!op) {
    for (const [phrase, value] of FALLBACK_OPERATOR_SYNONYMS) {
      const idx = lower.indexOf(phrase);
      if (idx !== -1) {
        op = { phrase, value, index: idx };
        break;
      }
    }
  }
  if (!op) return null;

  // Field: text before operator, with filler words removed
  const fieldRaw  = lower.slice(0, op.index).trim();
  const fieldPart = normalizeFieldName(stripFieldFillers(fieldRaw));

  if (!fieldPart) return null;

  // Value: text after operator; use compromise to normalise numbers
  const valueRaw = stripped.slice(op.index + op.phrase.length).trim();
  if (!valueRaw) return null;

  const value    = normaliseValue(valueRaw);
  const fieldName = fieldDict[fieldPart] ?? capitalizeFirst(fieldPart);
  return { fieldName, operator: op.value, value };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a condition expression string back into individual condition records.
 * This is the inverse of buildConditionExpression.
 *
 * Supports single and multi-condition expressions with AND / OR connectors:
 *   "(claimAmount > 10000) AND (injuryType CONTAINS 'Soft Tissue')"
 *   "(Universal Execution = 1)"
 *   "claimAmount > 10000"   ← bare clause without outer parens also works
 *
 * conditionType on condition[i] = the connector that follows it (before condition[i+1]).
 * The last condition always gets 'AND' as its conditionType (unused, consistent default).
 */
export function parseConditionExpression(expression: string): ParsedRuleCondition[] {
  const expr = expression.trim();
  if (!expr) return [];

  // Split on the boundary between two adjacent conditions: ') AND/OR ('
  const SPLIT_RE = /\)\s+(AND|OR)\s+\(/gi;

  const rawClauses:  string[]         = [];
  const connectors: ('AND' | 'OR')[] = [];

  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = SPLIT_RE.exec(expr)) !== null) {
    rawClauses.push(expr.slice(last, m.index + 1).trim()); // up to and incl. ')'
    connectors.push(m[1].toUpperCase() as 'AND' | 'OR');
    last = m.index + m[0].length - 1;                      // position of the next '('
  }
  rawClauses.push(expr.slice(last).trim());

  // Operators longest-first so ">=" wins over ">", "starts_with" over "="
  const OP_RE = /STARTS_WITH|ENDS_WITH|CONTAINS|>=|<=|!=|>|<|=/i;

  const result: ParsedRuleCondition[] = [];

  for (let i = 0; i < rawClauses.length; i++) {
    let clause = rawClauses[i].trim();

    // Strip outer parentheses when present
    if (clause.startsWith('(') && clause.endsWith(')')) {
      clause = clause.slice(1, -1).trim();
    }
    if (!clause) continue;

    const opMatch = OP_RE.exec(clause);
    if (!opMatch) continue;

    const fieldName = clause.slice(0, opMatch.index).trim();
    const operator  = opMatch[0].toUpperCase();
    let   value     = clause.slice(opMatch.index + opMatch[0].length).trim();

    // Strip surrounding single or double quotes from the value
    if (
      value.length >= 2 &&
      ((value[0] === "'" && value[value.length - 1] === "'") ||
       (value[0] === '"' && value[value.length - 1] === '"'))
    ) {
      value = value.slice(1, -1);
    }

    if (!fieldName) continue; // empty string is a valid value (e.g. != '')

    const conditionType = i < connectors.length ? connectors[i] : 'AND';
    result.push({ fieldName, operator, value, conditionType });
  }

  return result;
}

/**
 * Convert an array of parsed conditions into a condition expression string.
 *
 * The `conditionType` on condition[i] is the connector that follows it, i.e. the
 * connector placed *before* condition[i+1]. So condition[i-1].conditionType is the
 * correct separator to place between condition[i-1] and condition[i].
 *
 * Example:
 *   [{ fieldName: 'claimAmount', operator: '>', value: '10000', conditionType: 'AND' }]
 *   → "(claimAmount > 10000)"
 */
export function buildConditionExpression(conditions: ParsedRuleCondition[]): string {
  if (conditions.length === 0) return '';
  return conditions.map((c, i) => {
    const op  = c.operator.toUpperCase();
    const val = (c.value === '' || isNaN(Number(c.value))) ? `'${c.value}'` : c.value;
    const clause = `(${c.fieldName} ${op} ${val})`;
    return i === 0 ? clause : `${conditions[i - 1].conditionType} ${clause}`;
  }).join(' ');
}

/**
 * Parse an NLP rule statement into structured conditions.
 *
 * @param text          Plain-English rule, e.g. "If claim amount is greater than 10000 and injury type contains soft tissue"
 * @param dynamicFields Optional DB-loaded field mappings ({ sourceField, nlpAlias }[]).
 *                      When provided they are merged with the built-in dictionary.
 *
 * @example
 *   parseNlpRule("claim amount greater than 10000")
 *   // → [{ fieldName: 'claimAmount', operator: '>', value: '10000', conditionType: 'AND' }]
 */
// Phrases that contain " or " or " and " but must NOT be split at those words.
// Includes compound operators and number-word connectors ("one hundred and fifty").
const COMPOUND_TOKENS: [phrase: string, token: string][] = [
  ['greater than or equal to', '\x01GTE\x01'],
  ['less than or equal to',    '\x01LTE\x01'],
  // Number-word connectors — "and" inside spelled-out numbers is not a clause separator
  ['billion and',  '\x01BILLAND\x01'],
  ['million and',  '\x01MILLAND\x01'],
  ['thousand and', '\x01THOAND\x01'],
  ['hundred and',  '\x01HUNDAND\x01'],
];

export function parseNlpRule(
  text: string,
  dynamicFields: { sourceField: string; nlpAlias: string }[] = [],
): ParsedRuleCondition[] {
  const fieldDict  = buildFieldDictionary(dynamicFields);
  // normalized and original always have the same length (toLowerCase preserves it)
  // so index positions are interchangeable between the two strings.
  let safeNorm = text.trim().toLowerCase();
  let safeOrig = text.trim();

  // Protect compound operators: replace with fixed-width tokens so the connector
  // regex cannot fire inside a phrase like "greater than or equal to".
  for (const [phrase, token] of COMPOUND_TOKENS) {
    let idx = safeNorm.indexOf(phrase);
    while (idx !== -1) {
      safeNorm = safeNorm.slice(0, idx) + token + safeNorm.slice(idx + phrase.length);
      safeOrig = safeOrig.slice(0, idx) + token + safeOrig.slice(idx + phrase.length);
      idx = safeNorm.indexOf(phrase);
    }
  }

  // Split on " and " / " or ", capturing which connector was used.
  const connectorRe  = /\s+(and|or)\s+/gi;
  const clauses:      string[] = [];
  const origClauses:  string[] = [];
  const connectors: ('AND' | 'OR')[] = [];

  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = connectorRe.exec(safeNorm)) !== null) {
    clauses.push(safeNorm.slice(lastIdx, m.index).trim());
    origClauses.push(safeOrig.slice(lastIdx, m.index).trim());
    connectors.push(m[1].toUpperCase() as 'AND' | 'OR');
    lastIdx = m.index + m[0].length;
  }
  clauses.push(safeNorm.slice(lastIdx).trim());
  origClauses.push(safeOrig.slice(lastIdx).trim());

  // Restore compound operator phrases in every clause after splitting.
  for (const [phrase, token] of COMPOUND_TOKENS) {
    for (let i = 0; i < clauses.length; i++) {
      clauses[i]     = clauses[i].split(token).join(phrase);
      origClauses[i] = origClauses[i].split(token).join(phrase);
    }
  }

  const result: ParsedRuleCondition[] = [];
  // Last condition inherits the most-recent connector so all-OR chains stay "OR".
  const lastConnector: 'AND' | 'OR' = connectors.length > 0 ? connectors[connectors.length - 1] : 'AND';

  for (let i = 0; i < clauses.length; i++) {
    // Primary parser runs first; compromise fallback activates only when primary fails.
    const parsed =
      parseClause(clauses[i], origClauses[i], fieldDict) ??
      parseClauseWithCompromise(origClauses[i], fieldDict);

    if (!parsed) continue;
    const conditionType: 'AND' | 'OR' = i < connectors.length ? connectors[i] : lastConnector;
    result.push({ ...parsed, conditionType });
  }

  return result;
}
