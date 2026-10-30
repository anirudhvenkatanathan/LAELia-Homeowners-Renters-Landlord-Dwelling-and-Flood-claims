import { useState, useCallback } from 'react';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

import type {
  ServiceRequestRoleDetails,
  ServiceRequestRole,
  RoleCondition,
  RoleInput,
  ConditionInput,
  RoleOperator,
} from '../../models/ServiceRequestRole/serviceRequestRoleModel';
import { OPERATOR_FALLBACK } from '../../models/ServiceRequestRole/serviceRequestRoleModel';
import {
  getServiceRequestRoleDetails,
  saveServiceRequestRole,
  saveRoleConditions,
  getFieldOptions,
  getOperatorOptions,
} from '../../services/ServiceRequestRole/serviceRequestRoleService';
import { validateRole, validateCondition } from '../../validations/ServiceRequestRole/serviceRequestRoleSchema';
import { logError } from '../../utils/logError';

export interface UseServiceRequestRoleDetailsReturn {
  detail:           ServiceRequestRoleDetails | null;
  selectedRoleId:   string | null;
  editingRoles:     Map<string, ServiceRequestRole>;
  newRoles:         ServiceRequestRole[];
  editingConditions: Map<string, RoleCondition>;
  newConditions:    RoleCondition[];
  fieldOptions:     string[];
  operators:        RoleOperator[];
  isLoading:        boolean;
  isSavingRoles:    boolean;
  isSavingConditions: boolean;
  errors:           Record<string, string>;
  rowErrors:        Record<string, Record<string, string>>;

  loadDetail:             (uploadId: string) => Promise<void>;
  selectRole:             (roleId: string | null) => void;

  handleAddRole:          () => void;
  handleEditRole:         (roleId: string) => void;
  handleUpdateRole:       (roleId: string, field: keyof ServiceRequestRole, value: string) => void;
  handleSaveRole:         (roleId: string) => void;
  handleCancelEditRole:   (roleId: string) => void;
  handleDeleteRole:       (roleId: string) => void;
  handleSaveAllRoles:     () => Promise<void>;

  handleAddCondition:     () => void;
  handleEditCondition:    (conditionId: string) => void;
  handleUpdateCondition:  (conditionId: string, field: keyof RoleCondition, value: string) => void;
  handleSaveCondition:    (conditionId: string) => void;
  handleCancelCondition:  (conditionId: string) => void;
  handleDeleteCondition:  (conditionId: string) => void;
  handleSaveAllConditions: () => Promise<void>;
}

export function useServiceRequestRoleDetails(): UseServiceRequestRoleDetailsReturn {
  const [detail,             setDetail]             = useState<ServiceRequestRoleDetails | null>(null);
  const [selectedRoleId,     setSelectedRoleId]     = useState<string | null>(null);
  const [editingRoles,       setEditingRoles]       = useState(new Map<string, ServiceRequestRole>());
  const [newRoles,           setNewRoles]           = useState<ServiceRequestRole[]>([]);
  const [editingConditions,  setEditingConditions]  = useState(new Map<string, RoleCondition>());
  const [newConditions,      setNewConditions]      = useState<RoleCondition[]>([]);
  const [fieldOptions,       setFieldOptions]       = useState<string[]>([]);
  const [operators,          setOperators]          = useState<RoleOperator[]>(OPERATOR_FALLBACK);
  const [isLoading,          setIsLoading]          = useState(false);
  const [isSavingRoles,      setIsSavingRoles]      = useState(false);
  const [isSavingConditions, setIsSavingConditions] = useState(false);
  const [errors,             setErrors]             = useState<Record<string, string>>({});
  const [rowErrors,          setRowErrors]          = useState<Record<string, Record<string, string>>>({});

  const loadDetail = useCallback(async (uploadId: string): Promise<void> => {
    setIsLoading(true);
    setErrors({});
    try {
      const [data, fields, ops] = await Promise.all([
        getServiceRequestRoleDetails(uploadId),
        getFieldOptions(),
        getOperatorOptions(),
      ]);
      setDetail(data);
      setFieldOptions(fields);
      if (ops.length > 0) setOperators(ops);
      setSelectedRoleId(data.roles[0]?.roleId ?? null);
      setEditingRoles(new Map());
      setNewRoles([]);
      setEditingConditions(new Map());
      setNewConditions([]);
      setRowErrors({});
    } catch (err) {
      logError(err, 'useServiceRequestRoleDetails.loadDetail');
      setErrors((prev) => ({ ...prev, detail: 'Failed to load details.' }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectRole = useCallback((roleId: string | null) => {
    setSelectedRoleId(roleId);
    setEditingConditions(new Map());
    setNewConditions([]);
    setRowErrors({});
  }, []);

  // ── Roles ──────────────────────────────────────────────────────────────────

  const handleAddRole = useCallback(() => {
    const tempId = `new-${uuidv4()}`;
    const blank: ServiceRequestRole = { roleId: tempId, uploadId: detail?.uploadId ?? '', roleName: '', description: '', status: 'Active', nlpCondition: '', conditionExpression: '' };
    setNewRoles((p) => [...p, blank]);
    setEditingRoles((p) => { const n = new Map(p); n.set(tempId, { ...blank }); return n; });
  }, [detail]);

  const handleEditRole = useCallback((roleId: string) => {
    if (!detail) return;
    const existing = detail.roles.find((r) => r.roleId === roleId);
    if (!existing) return;
    setEditingRoles((p) => { const n = new Map(p); n.set(roleId, { ...existing }); return n; });
  }, [detail]);

  const handleUpdateRole = useCallback((roleId: string, field: keyof ServiceRequestRole, value: string) => {
    setEditingRoles((p) => {
      const n = new Map(p); const row = n.get(roleId); if (!row) return p;
      (row as unknown as Record<string, unknown>)[field] = value; n.set(roleId, { ...row }); return n;
    });
    setRowErrors((p) => { const fe = { ...(p[roleId] ?? {}) }; delete fe[field as string]; return { ...p, [roleId]: fe }; });
  }, []);

  const handleSaveRole = useCallback((roleId: string) => {
    const edited = editingRoles.get(roleId);
    if (!edited) return;
    const allRoles = [...(detail?.roles ?? []), ...newRoles];
    const { valid, errors: rErrs } = validateRole(edited, allRoles);
    if (!valid) { setRowErrors((p) => ({ ...p, [roleId]: rErrs })); return; }
    setRowErrors((p) => { const n = { ...p }; delete n[roleId]; return n; });
    const isNew = roleId.startsWith('new-');
    if (isNew) {
      setNewRoles((p) => p.filter((r) => r.roleId !== roleId));
      setDetail((p) => p ? { ...p, roles: [...p.roles, { ...edited }] } : p);
    } else {
      setDetail((p) => p ? { ...p, roles: p.roles.map((r) => r.roleId === roleId ? { ...edited } : r) } : p);
    }
    setEditingRoles((p) => { const n = new Map(p); n.delete(roleId); return n; });
  }, [editingRoles, detail, newRoles]);

  const handleCancelEditRole = useCallback((roleId: string) => {
    const isNew = roleId.startsWith('new-');
    setEditingRoles((p) => { const n = new Map(p); n.delete(roleId); return n; });
    if (isNew) setNewRoles((p) => p.filter((r) => r.roleId !== roleId));
    setRowErrors((p) => { const n = { ...p }; delete n[roleId]; return n; });
  }, []);

  const handleDeleteRole = useCallback((roleId: string) => {
    const isNew = roleId.startsWith('new-');
    if (isNew) { setNewRoles((p) => p.filter((r) => r.roleId !== roleId)); }
    else { setDetail((p) => p ? { ...p, roles: p.roles.filter((r) => r.roleId !== roleId) } : p); }
    setEditingRoles((p) => { const n = new Map(p); n.delete(roleId); return n; });
    setRowErrors((p) => { const n = { ...p }; delete n[roleId]; return n; });
    if (selectedRoleId === roleId) setSelectedRoleId(null);
  }, [selectedRoleId]);

  const handleSaveAllRoles = useCallback(async () => {
    if (!detail) return;
    if (editingRoles.size > 0) { setErrors({ saveRoles: 'Please save or cancel all open rows first.' }); return; }
    setIsSavingRoles(true); setErrors({});
    try {
      const inputs: RoleInput[] = detail.roles.map((r) => ({
        roleId: r.roleId.startsWith('new-') ? undefined : r.roleId,
        roleName: r.roleName, description: r.description, status: r.status,
      }));
      const result = await saveServiceRequestRole(detail.uploadId, inputs);
      if (result.success) { await loadDetail(detail.uploadId); }
      else { setErrors({ saveRoles: result.message || 'Failed to save roles.' }); }
    } catch (err) {
      logError(err, 'useServiceRequestRoleDetails.handleSaveAllRoles');
      setErrors({ saveRoles: 'An error occurred. Please try again.' });
    } finally { setIsSavingRoles(false); }
  }, [detail, editingRoles, loadDetail]);

  // ── Conditions ─────────────────────────────────────────────────────────────

  const conditionsForRole = useCallback((roleId: string | null) => {
    if (!roleId || !detail) return [];
    return detail.conditions.filter((c) => c.roleId === roleId);
  }, [detail]);

  const handleAddCondition = useCallback(() => {
    if (!selectedRoleId) return;
    const tempId = `new-${uuidv4()}`;
    const blank: RoleCondition = { conditionId: tempId, roleId: selectedRoleId, fieldName: '', operator: 'equals', value: '', conditionType: 'AND', sortOrder: conditionsForRole(selectedRoleId).length + newConditions.length };
    setNewConditions((p) => [...p, blank]);
    setEditingConditions((p) => { const n = new Map(p); n.set(tempId, { ...blank }); return n; });
  }, [selectedRoleId, conditionsForRole, newConditions]);

  const handleEditCondition = useCallback((conditionId: string) => {
    const existing = detail?.conditions.find((c) => c.conditionId === conditionId);
    if (!existing) return;
    setEditingConditions((p) => { const n = new Map(p); n.set(conditionId, { ...existing }); return n; });
  }, [detail]);

  const handleUpdateCondition = useCallback((conditionId: string, field: keyof RoleCondition, value: string) => {
    setEditingConditions((p) => {
      const n = new Map(p); const row = n.get(conditionId); if (!row) return p;
      (row as unknown as Record<string, unknown>)[field] = value; n.set(conditionId, { ...row }); return n;
    });
    setRowErrors((p) => { const fe = { ...(p[conditionId] ?? {}) }; delete fe[field as string]; return { ...p, [conditionId]: fe }; });
  }, []);

  const handleSaveCondition = useCallback((conditionId: string) => {
    const edited = editingConditions.get(conditionId);
    if (!edited) return;
    const existing = conditionsForRole(selectedRoleId);
    const { valid, errors: rErrs } = validateCondition(edited, existing);
    if (!valid) { setRowErrors((p) => ({ ...p, [conditionId]: rErrs })); return; }
    setRowErrors((p) => { const n = { ...p }; delete n[conditionId]; return n; });
    const isNew = conditionId.startsWith('new-');
    if (isNew) {
      setNewConditions((p) => p.filter((c) => c.conditionId !== conditionId));
      setDetail((p) => p ? { ...p, conditions: [...p.conditions, { ...edited }] } : p);
    } else {
      setDetail((p) => p ? { ...p, conditions: p.conditions.map((c) => c.conditionId === conditionId ? { ...edited } : c) } : p);
    }
    setEditingConditions((p) => { const n = new Map(p); n.delete(conditionId); return n; });
  }, [editingConditions, conditionsForRole, selectedRoleId]);

  const handleCancelCondition = useCallback((conditionId: string) => {
    const isNew = conditionId.startsWith('new-');
    setEditingConditions((p) => { const n = new Map(p); n.delete(conditionId); return n; });
    if (isNew) setNewConditions((p) => p.filter((c) => c.conditionId !== conditionId));
    setRowErrors((p) => { const n = { ...p }; delete n[conditionId]; return n; });
  }, []);

  const handleDeleteCondition = useCallback((conditionId: string) => {
    const isNew = conditionId.startsWith('new-');
    if (isNew) { setNewConditions((p) => p.filter((c) => c.conditionId !== conditionId)); }
    else { setDetail((p) => p ? { ...p, conditions: p.conditions.filter((c) => c.conditionId !== conditionId) } : p); }
    setEditingConditions((p) => { const n = new Map(p); n.delete(conditionId); return n; });
    setRowErrors((p) => { const n = { ...p }; delete n[conditionId]; return n; });
  }, []);

  const handleSaveAllConditions = useCallback(async () => {
    if (!selectedRoleId) return;
    if (editingConditions.size > 0) { setErrors({ saveConditions: 'Please save or cancel all open rows first.' }); return; }
    setIsSavingConditions(true); setErrors({});
    try {
      const allConds = conditionsForRole(selectedRoleId);
      const inputs: ConditionInput[] = allConds.map((c, idx) => ({
        conditionId:   c.conditionId.startsWith('new-') ? undefined : c.conditionId,
        fieldName:     c.fieldName, operator: c.operator, value: c.value,
        conditionType: c.conditionType, sortOrder: idx,
      }));
      const result = await saveRoleConditions(selectedRoleId, inputs);
      if (result.success) { await loadDetail(detail!.uploadId); }
      else { setErrors({ saveConditions: result.message || 'Failed to save conditions.' }); }
    } catch (err) {
      logError(err, 'useServiceRequestRoleDetails.handleSaveAllConditions');
      setErrors({ saveConditions: 'An error occurred. Please try again.' });
    } finally { setIsSavingConditions(false); }
  }, [selectedRoleId, editingConditions, conditionsForRole, detail, loadDetail]);

  return {
    detail, selectedRoleId, editingRoles, newRoles,
    editingConditions, newConditions, fieldOptions, operators,
    isLoading, isSavingRoles, isSavingConditions, errors, rowErrors,
    loadDetail, selectRole,
    handleAddRole, handleEditRole, handleUpdateRole, handleSaveRole, handleCancelEditRole, handleDeleteRole, handleSaveAllRoles,
    handleAddCondition, handleEditCondition, handleUpdateCondition, handleSaveCondition, handleCancelCondition, handleDeleteCondition, handleSaveAllConditions,
  };
}
