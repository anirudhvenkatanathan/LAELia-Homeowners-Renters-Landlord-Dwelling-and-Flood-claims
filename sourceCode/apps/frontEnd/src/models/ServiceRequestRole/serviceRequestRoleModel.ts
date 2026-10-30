// ─── Service Request Role Domain Models ───────────────────────────────────────

export interface ServiceRequestRoleUploadRow {
  uploadId:     string;
  fileName:     string;
  uploadType:   string;
  totalRecords: number;
  uploadedBy:   string;
  uploadDate:   string;
  status:       string;
}

export interface ServiceRequestRole {
  roleId:               string;
  uploadId:             string;
  roleName:             string;
  description:          string;
  status:               string;
  nlpCondition:         string;
  conditionExpression:  string;
  nlpConditionInWords?: string;
  lineOfBusiness?:      string[];
}

export interface ParsedRuleCondition {
  fieldName:     string;
  operator:      string;
  value:         string;
  conditionType: string;
}

export interface RoleCondition {
  conditionId:   string;
  roleId:        string;
  fieldName:     string;
  operator:      string;
  value:         string;
  conditionType: string;
  sortOrder:     number;
}

export interface ServiceRequestRoleDetails {
  uploadId:     string;
  fileName:     string;
  uploadType:   string;
  totalRecords: number;
  uploadedBy:   string;
  uploadDate:   string;
  status:       string;
  roles:        ServiceRequestRole[];
  conditions:   RoleCondition[];
}

export interface UploadServiceRequestRoleResponse {
  uploadId:     string;
  totalRecords: number;
  status:       string;
  message:      string;
  success:      boolean;
}

export interface RoleInput {
  roleId?:         string;
  roleName:        string;
  description:     string;
  status:          string;
  nlpCondition?:   string;
  lineOfBusiness?: string[];
}

export interface ConditionInput {
  conditionId?:  string;
  fieldName:     string;
  operator:      string;
  value:         string;
  conditionType: string;
  sortOrder?:    number;
}

export interface SaveRoleResponse {
  success:    boolean;
  message:    string;
  savedCount: number;
}

export interface SaveConditionsResponse {
  success:    boolean;
  message:    string;
  savedCount: number;
}

export type StatusBadgeVariant = 'badge-green' | 'badge-yellow' | 'badge-red' | 'badge-gray';

export function resolveStatusBadge(status: string): StatusBadgeVariant {
  const s = status?.toLowerCase() ?? '';
  if (s === 'processed' || s === 'success' || s === 'active') return 'badge-green';
  if (s === 'pending'   || s === 'processing')                 return 'badge-yellow';
  if (s === 'failed'    || s === 'error'    || s === 'inactive') return 'badge-red';
  return 'badge-gray';
}

// Operator type — loaded from service_request_role_operators_configuration
export interface RoleOperator {
  operatorId: string;
  label:      string;
  value:      string;
  sortOrder:  number;
}

// Fallback used only when the DB query has not resolved yet
export const OPERATOR_FALLBACK: RoleOperator[] = [
  { operatorId: 'op-01', label: '=',           value: '=',           sortOrder: 1  },
  { operatorId: 'op-02', label: '!=',          value: '!=',          sortOrder: 2  },
  { operatorId: 'op-03', label: '>',           value: '>',           sortOrder: 3  },
  { operatorId: 'op-04', label: '>=',          value: '>=',          sortOrder: 4  },
  { operatorId: 'op-05', label: '<',           value: '<',           sortOrder: 5  },
  { operatorId: 'op-06', label: '<=',          value: '<=',          sortOrder: 6  },
  { operatorId: 'op-07', label: 'IN',          value: 'IN',          sortOrder: 7  },
  { operatorId: 'op-08', label: 'NOT IN',      value: 'NOT IN',      sortOrder: 8  },
  { operatorId: 'op-09', label: 'contains',    value: 'contains',    sortOrder: 9  },
  { operatorId: 'op-10', label: 'starts_with', value: 'starts_with', sortOrder: 10 },
];

export interface NlpFieldMapping {
  sourceField: string;
  nlpAlias:    string;
}

export const CONDITION_TYPES     = ['AND', 'OR'] as const;
export const ROLE_STATUS_OPTIONS = ['Active', 'Inactive'] as const;
export const LINE_OF_BUSINESS_OPTIONS = ['WCM', 'Auto', 'General Liability', 'Property'] as const;

// ─── Condition Summary Builder ────────────────────────────────────────────────

export function buildConditionSummary(conditions: RoleCondition[]): string {
  if (conditions.length === 0) return 'No conditions configured.';

  // Split into groups wherever conditionType === 'OR'
  const groups: RoleCondition[][] = [[]];
  for (const c of conditions) {
    groups[groups.length - 1].push(c);
    if (c.conditionType === 'OR') groups.push([]);
  }
  if (groups[groups.length - 1].length === 0) groups.pop();

  return groups
    .map((group) => {
      const parts = group.map((c) => `${c.fieldName} ${c.operator} "${c.value}"`);
      return group.length > 1 ? `(${parts.join(' AND ')})` : (parts[0] ?? '');
    })
    .join('\nOR ');
}
