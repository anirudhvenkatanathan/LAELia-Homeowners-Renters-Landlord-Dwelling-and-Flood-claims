import { useState, useCallback, useEffect } from 'react';
import type { KpiServiceRole, KpiGroup, NewMetricPayload } from '../../models/kpiMetrics/kpiMetricsModel';
import * as svc from '../../services/kpiMetrics/kpiMetricsService';

export function useKpiMetrics() {
  const [roles,        setRoles]        = useState<KpiServiceRole[]>([]);
  const [selectedRole, setSelectedRole] = useState<KpiServiceRole | null>(null);
  const [groups,       setGroups]       = useState<KpiGroup[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const notify = useCallback((type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const data = await svc.fetchRoles();
      setRoles(data);
      if (data.length > 0 && !selectedRole) setSelectedRole(data[0]);
    } catch {
      setError('Failed to load service roles.');
    } finally {
      setRolesLoading(false);
    }
  }, [selectedRole]);

  const loadMetrics = useCallback(async (roleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await svc.fetchKpiMetrics(roleId);
      setGroups(data);
    } catch {
      setError('Failed to load KPI metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRoles(); }, []);
  useEffect(() => { if (selectedRole) void loadMetrics(selectedRole.roleId); }, [selectedRole?.roleId]);

  const selectRole = useCallback((role: KpiServiceRole) => { setSelectedRole(role); }, []);

  const createMetric = useCallback(async (payload: NewMetricPayload) => {
    setSaving(true);
    try {
      await svc.createKpiMetric(payload);
      if (selectedRole) await loadMetrics(selectedRole.roleId);
      notify('success', 'KPI metric created successfully.');
    } catch {
      notify('error', 'Failed to create KPI metric.');
    } finally {
      setSaving(false);
    }
  }, [selectedRole, loadMetrics, notify]);

  const updateMetric = useCallback(async (id: string, payload: Partial<NewMetricPayload>) => {
    setSaving(true);
    try {
      await svc.updateKpiMetric(id, payload);
      if (selectedRole) await loadMetrics(selectedRole.roleId);
      notify('success', 'KPI metric updated.');
    } catch {
      notify('error', 'Failed to update KPI metric.');
    } finally {
      setSaving(false);
    }
  }, [selectedRole, loadMetrics, notify]);

  const toggleMetric = useCallback(async (id: string) => {
    try {
      await svc.toggleKpiMetric(id);
      if (selectedRole) await loadMetrics(selectedRole.roleId);
    } catch {
      notify('error', 'Failed to toggle metric status.');
    }
  }, [selectedRole, loadMetrics, notify]);

  const deleteMetric = useCallback(async (id: string) => {
    setSaving(true);
    try {
      await svc.deleteKpiMetric(id);
      if (selectedRole) await loadMetrics(selectedRole.roleId);
      notify('success', 'KPI metric deleted.');
    } catch {
      notify('error', 'Failed to delete metric.');
    } finally {
      setSaving(false);
    }
  }, [selectedRole, loadMetrics, notify]);

  const setVendorKpiForRole = useCallback(async (roleId: string, isVendorKPI: boolean) => {
    setSaving(true);
    try {
      await svc.setVendorKpiForRole(roleId, isVendorKPI);
      if (selectedRole) await loadMetrics(selectedRole.roleId);
      notify('success', isVendorKPI ? 'Vendor KPI enabled for this service.' : 'Vendor KPI disabled.');
    } catch {
      notify('error', 'Failed to update Vendor KPI flag.');
    } finally {
      setSaving(false);
    }
  }, [selectedRole, loadMetrics, notify]);

  return {
    roles, selectedRole, groups,
    rolesLoading, loading, saving, error, notification,
    selectRole, createMetric, updateMetric, toggleMetric, deleteMetric, setVendorKpiForRole,
    refreshMetrics: () => { if (selectedRole) void loadMetrics(selectedRole.roleId); },
  };
}
