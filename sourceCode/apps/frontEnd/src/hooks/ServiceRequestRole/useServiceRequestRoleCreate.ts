import { useState, useCallback, useEffect } from 'react';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

import type { ServiceRequestRole, RoleCondition, RoleOperator, NlpFieldMapping, ConditionInput } from '../../models/ServiceRequestRole/serviceRequestRoleModel';
import { OPERATOR_FALLBACK } from '../../models/ServiceRequestRole/serviceRequestRoleModel';
import {
  getAllServiceRequestRoles,
  getServiceRequestRoleById,
  getRoleConditions,
  createServiceRequestRole,
  updateServiceRequestRole,
  deleteServiceRequestRole,
  saveRoleConditions,
  getFieldOptions,
  getOperatorOptions,
  getNlpFieldMappings,
} from '../../services/ServiceRequestRole/serviceRequestRoleService';
import { parseNlpRule, buildConditionExpression, parseConditionExpression } from '../../utils/nlpRuleParser';
import { logError } from '../../utils/logError';

export interface RoleForm {
  roleName:             string;
  description:          string;
  status:               string;
  nlpCondition:         string;
  conditionExpression:  string;
  nlpConditionInWords:  string;
  lineOfBusiness:       string[];
}

const BLANK_FORM: RoleForm = { roleName: '', description: '', status: 'Active', nlpCondition: '', conditionExpression: '', nlpConditionInWords: '', lineOfBusiness: [] };

export interface UseServiceRequestRoleCreateReturn {
  roles:            ServiceRequestRole[];
  selectedRoleId:   string | null;
  roleForm:         RoleForm;
  conditions:       RoleCondition[];
  fieldOptions:     string[];
  operators:        RoleOperator[];
  nlpFieldMappings: NlpFieldMapping[];
  isLoading:        boolean;
  isSaving:         boolean;
  errors:           Record<string, string>;
  isDirty:          boolean;
  nlpSaveSuccess:   string;

  loadAll:         () => Promise<void>;
  selectRole:      (roleId: string | null) => Promise<void>;
  startNewRole:    () => void;
  updateForm:      <K extends keyof RoleForm>(field: K, value: RoleForm[K]) => void;

  generateConditionsFromNlp: () => void;

  saveRole:        () => Promise<boolean>;
  handleDeleteRole:(roleId: string) => Promise<void>;
  cancel:          () => void;
}

export function useServiceRequestRoleCreate(): UseServiceRequestRoleCreateReturn {
  const [roles,            setRoles]            = useState<ServiceRequestRole[]>([]);
  const [selectedRoleId,   setSelectedRoleId]   = useState<string | null>(null);
  const [roleForm,         setRoleForm]         = useState<RoleForm>(BLANK_FORM);
  const [conditions,       setConditions]       = useState<RoleCondition[]>([]);
  const [fieldOptions,     setFieldOptions]     = useState<string[]>([]);
  const [operators,        setOperators]        = useState<RoleOperator[]>(OPERATOR_FALLBACK);
  const [nlpFieldMappings, setNlpFieldMappings] = useState<NlpFieldMapping[]>([]);
  const [isLoading,        setIsLoading]        = useState(false);
  const [isSaving,         setIsSaving]         = useState(false);
  const [errors,           setErrors]           = useState<Record<string, string>>({});
  const [isDirty,          setIsDirty]          = useState(false);
  const [nlpSaveSuccess,   setNlpSaveSuccess]   = useState('');

  // ── Load all roles + field options ─────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setErrors({});
    try {
      const [allRoles, fields, ops, nlpMappings] = await Promise.all([
        getAllServiceRequestRoles(),
        getFieldOptions(),
        getOperatorOptions(),
        getNlpFieldMappings(),
      ]);
      setRoles(allRoles);
      setFieldOptions(fields);
      if (ops.length > 0) setOperators(ops);
      if (nlpMappings.length > 0) setNlpFieldMappings(nlpMappings);
    } catch (err) {
      logError(err, 'useServiceRequestRoleCreate.loadAll');
      setErrors((p) => ({ ...p, load: 'Failed to load roles.' }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll().catch(() => {}); }, [loadAll]);

  // ── Select an existing role ─────────────────────────────────────────────────

  const selectRole = useCallback(async (roleId: string | null) => {
    setErrors({});
    setIsDirty(false);
    setNlpSaveSuccess('');
    if (!roleId) {
      setSelectedRoleId(null);
      setRoleForm(BLANK_FORM);
      setConditions([]);
      return;
    }
    const listRole = roles.find((r) => r.roleId === roleId);
    if (!listRole) return;
    setSelectedRoleId(roleId);

    try {
      const [fullRole, conds] = await Promise.all([
        getServiceRequestRoleById(roleId),
        getRoleConditions(roleId),
      ]);
      const role = fullRole ?? listRole;
      setRoleForm({ roleName: role.roleName, description: role.description, status: role.status, nlpCondition: role.nlpCondition ?? '', conditionExpression: role.conditionExpression ?? '', nlpConditionInWords: role.nlpConditionInWords ?? '', lineOfBusiness: role.lineOfBusiness?.length ? role.lineOfBusiness : ['WCM'] });
      setConditions(conds);
    } catch (err) {
      logError(err, 'useServiceRequestRoleCreate.selectRole');
      setRoleForm({ roleName: listRole.roleName, description: listRole.description, status: listRole.status, nlpCondition: listRole.nlpCondition ?? '', conditionExpression: '', nlpConditionInWords: listRole.nlpConditionInWords ?? '', lineOfBusiness: listRole.lineOfBusiness?.length ? listRole.lineOfBusiness : ['WCM'] });
      setConditions([]);
    }
  }, [roles]);

  // ── Start creating a new role ───────────────────────────────────────────────

  const startNewRole = useCallback(() => {
    setSelectedRoleId(null);
    setRoleForm(BLANK_FORM);
    setConditions([]);
    setErrors({});
    setIsDirty(false);
    setNlpSaveSuccess('');
  }, []);

  // ── Update role form ────────────────────────────────────────────────────────

  const updateForm = useCallback(<K extends keyof RoleForm>(field: K, value: RoleForm[K]) => {
    setRoleForm((p) => ({ ...p, [field]: value }));
    setIsDirty(true);
    setNlpSaveSuccess('');
    setErrors((p) => { const n = { ...p }; delete n[field as string]; return n; });
  }, []);

  // ── NLP: detect direct expressions vs plain-English statements ────────────────

  function isDirectConditionExpression(text: string): boolean {
    // Only bypass NLP when the text is already a fully-formed expression:
    // parenthesised clauses like (field > value) are the output of buildConditionExpression.
    // Do NOT bypass for mixed inputs like "age > 100 and x is equal to 1000".
    if (/\(.*\)/.test(text)) return true;
    if (/\b(CONTAINS|STARTS_WITH|ENDS_WITH)\b/.test(text)) return true;
    return false;
  }

  // ── NLP: parse locally → populate conditionExpression (no backend call) ───────

  const generateConditionsFromNlp = useCallback(() => {
    const text = roleForm.nlpCondition.trim();
    if (!text) return;

    // If the input already contains expression-syntax operators, pass it through
    // directly without any NLP transformation.
    if (isDirectConditionExpression(text)) {
      setErrors((p) => { const n = { ...p }; delete n['nlp']; delete n['nlpCondition']; return n; });
      setRoleForm((p) => ({ ...p, conditionExpression: text }));
      setIsDirty(true);
      setNlpSaveSuccess('Expression used directly. Review, then click Save Role.');
      return;
    }

    setErrors((p) => { const n = { ...p }; delete n['nlp']; delete n['nlpCondition']; return n; });
    setNlpSaveSuccess('');

    const parsed = parseNlpRule(text, nlpFieldMappings);
    if (parsed.length === 0) {
      setErrors((p) => ({ ...p, nlp: 'Unable to parse the NLP statement. Please revise and try again.' }));
      return;
    }

    const expression = buildConditionExpression(parsed);
    setRoleForm((p) => ({ ...p, conditionExpression: expression }));
    setIsDirty(true);
    setNlpSaveSuccess(`${parsed.length} condition${parsed.length !== 1 ? 's' : ''} parsed. Review the expression, then click Save Role.`);
  }, [roleForm.nlpCondition, nlpFieldMappings]);

  // ── Save role metadata + parse conditionExpression into individual records ───

  const saveRole = useCallback(async (): Promise<boolean> => {
    const errs: Record<string, string> = {};
    if (!roleForm.roleName.trim())     errs['roleName']     = 'Rule Name is required.';
    if (!roleForm.description.trim())  errs['description']  = 'Description is required.';
    if (!roleForm.nlpCondition.trim()) errs['nlpCondition'] = 'NLP Rule Condition is required.';
    if (!roleForm.lineOfBusiness.length) errs['lineOfBusiness'] = 'At least one Line of Business is required.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return false; }

    setIsSaving(true);
    setErrors({});
    try {
      let savedRoleId: string;

      if (!selectedRoleId) {
        const result = await createServiceRequestRole(
          roleForm.roleName, roleForm.description, roleForm.nlpCondition, roleForm.conditionExpression, undefined, roleForm.nlpConditionInWords, roleForm.lineOfBusiness,
        );
        if (!result.success || !result.roleId) {
          setErrors({ save: result.message || 'Failed to create role.' });
          return false;
        }
        savedRoleId = result.roleId;
        setSelectedRoleId(savedRoleId);
      } else {
        const result = await updateServiceRequestRole(
          selectedRoleId, roleForm.roleName, roleForm.description, roleForm.status, roleForm.nlpCondition, roleForm.conditionExpression, roleForm.nlpConditionInWords, roleForm.lineOfBusiness,
        );
        if (!result.success) {
          setErrors({ save: result.message || 'Failed to update role.' });
          return false;
        }
        savedRoleId = selectedRoleId;
      }

      // Parse conditionExpression into individual records and persist them
      if (roleForm.conditionExpression.trim()) {
        const parsed = parseConditionExpression(roleForm.conditionExpression);
        if (parsed.length > 0) {
          const inputs: ConditionInput[] = parsed.map((c, idx) => ({
            fieldName:     c.fieldName,
            operator:      c.operator,
            value:         c.value,
            conditionType: c.conditionType,
            sortOrder:     idx,
          }));
          await saveRoleConditions(savedRoleId, inputs);
        }
      }

      setIsDirty(false);
      await loadAll();
      return true;
    } catch (err) {
      logError(err, 'useServiceRequestRoleCreate.saveRole');
      setErrors({ save: 'An error occurred. Please try again.' });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [roleForm, selectedRoleId, loadAll]);

  // ── Delete role ─────────────────────────────────────────────────────────────

  const handleDeleteRole = useCallback(async (roleId: string) => {
    try {
      await deleteServiceRequestRole(roleId);
      if (selectedRoleId === roleId) {
        setSelectedRoleId(null);
        setRoleForm(BLANK_FORM);
        setConditions([]);
      }
      await loadAll();
    } catch (err) {
      logError(err, 'useServiceRequestRoleCreate.handleDeleteRole');
      setErrors({ save: 'Failed to delete role.' });
    }
  }, [selectedRoleId, loadAll]);

  const cancel = useCallback(() => {
    if (selectedRoleId) {
      selectRole(selectedRoleId).catch(() => {});
    } else {
      startNewRole();
    }
  }, [selectedRoleId, selectRole, startNewRole]);

  return {
    roles, selectedRoleId, roleForm, conditions, fieldOptions, operators, nlpFieldMappings,
    isLoading, isSaving, errors, isDirty, nlpSaveSuccess,
    loadAll, selectRole, startNewRole, updateForm,
    generateConditionsFromNlp,
    saveRole, handleDeleteRole, cancel,
  };
}
