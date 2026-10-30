import { useState, useCallback } from 'react';

// Lightweight UUID v4 generator (avoids dependency on 'uuid' in the browser bundle)
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import type {
  FieldMappingDetails,
  MappingConfiguration,
  MappingInput,
} from '../../models/FieldMappingMaster/fieldMappingModel';
import {
  getFieldMappingDetails,
  saveFieldMapping,
  downloadTemplate,
} from '../../services/FieldMappingMaster/fieldMappingService';
import { validateMappingRow } from '../../validations/FieldMappingMaster/fieldMappingSchema';
import { logError } from '../../utils/logError';

// ─── State Interface ──────────────────────────────────────────────────────────

export interface UseFieldMappingDetailsReturn {
  detail:       FieldMappingDetails | null;
  editingRows:  Map<string, MappingConfiguration>;
  newRows:      MappingConfiguration[];
  isLoading:    boolean;
  isSaving:     boolean;
  errors:       Record<string, string>;
  rowErrors:    Record<string, Record<string, string>>;

  loadDetail:          (uploadId: string) => Promise<void>;
  handleAddRow:        () => void;
  handleEditRow:       (mappingId: string) => void;
  handleUpdateRow:     (mappingId: string, field: keyof MappingConfiguration, value: string | boolean | number) => void;
  handleSaveRow:       (mappingId: string) => void;
  handleCancelEdit:    (mappingId: string) => void;
  handleSaveAll:       () => Promise<void>;
  handleDeleteRow:     (mappingId: string) => void;
  handleDownloadTemplate: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFieldMappingDetails(): UseFieldMappingDetailsReturn {
  const [detail,      setDetail]      = useState<FieldMappingDetails | null>(null);
  const [editingRows, setEditingRows] = useState<Map<string, MappingConfiguration>>(new Map());
  const [newRows,     setNewRows]     = useState<MappingConfiguration[]>([]);
  const [isLoading,   setIsLoading]   = useState<boolean>(false);
  const [isSaving,    setIsSaving]    = useState<boolean>(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [rowErrors,   setRowErrors]   = useState<Record<string, Record<string, string>>>({});

  // ── Load detail ─────────────────────────────────────────────────────────────

  const loadDetail = useCallback(async (uploadId: string): Promise<void> => {
    setIsLoading(true);
    setErrors({});
    try {
      const data = await getFieldMappingDetails(uploadId);
      setDetail(data);
      setEditingRows(new Map());
      setNewRows([]);
      setRowErrors({});
    } catch (err) {
      logError(err, 'useFieldMappingDetails.loadDetail');
      setErrors((prev) => ({ ...prev, detail: 'Failed to load field mapping details.' }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Add new blank row ───────────────────────────────────────────────────────

  const handleAddRow = useCallback((): void => {
    const tempId = `new-${uuidv4()}`;
    const blankRow: MappingConfiguration = {
      mappingId:   tempId,
      uploadId:    detail?.uploadId ?? '',
      sourceField: '',
      targetField: '',
      dataType:    'String',
      isMandatory: false,
      sortOrder:   (detail?.mappings.length ?? 0) + newRows.length,
    };
    setNewRows((prev) => [...prev, blankRow]);
    setEditingRows((prev) => {
      const next = new Map(prev);
      next.set(tempId, { ...blankRow });
      return next;
    });
  }, [detail, newRows]);

  // ── Mark existing row as being edited ──────────────────────────────────────

  const handleEditRow = useCallback((mappingId: string): void => {
    if (!detail) return;
    const existing = detail.mappings.find((m) => m.mappingId === mappingId);
    if (!existing) return;
    setEditingRows((prev) => {
      const next = new Map(prev);
      next.set(mappingId, { ...existing });
      return next;
    });
  }, [detail]);

  // ── Update a field in an editing row ───────────────────────────────────────

  const handleUpdateRow = useCallback((
    mappingId: string,
    field: keyof MappingConfiguration,
    value: string | boolean | number
  ): void => {
    setEditingRows((prev) => {
      const next = new Map(prev);
      const row  = next.get(mappingId);
      if (!row) return prev;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (row as any)[field] = value;
      next.set(mappingId, { ...row });
      return next;
    });
    // Clear row-level error for that field
    setRowErrors((prev) => {
      const fieldErrors = { ...(prev[mappingId] ?? {}) };
      delete fieldErrors[field as string];
      return { ...prev, [mappingId]: fieldErrors };
    });
  }, []);

  // ── Save (confirm) a single row ─────────────────────────────────────────────

  const handleSaveRow = useCallback((mappingId: string): void => {
    const editedRow = editingRows.get(mappingId);
    if (!editedRow) return;

    const allMappings = [
      ...(detail?.mappings ?? []),
      ...newRows,
    ];

    const { valid, errors: rowErrs } = validateMappingRow(editedRow, allMappings);
    if (!valid) {
      setRowErrors((prev) => ({ ...prev, [mappingId]: rowErrs }));
      return;
    }

    // Clear errors for this row
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[mappingId];
      return next;
    });

    const isNew = mappingId.startsWith('new-');

    if (isNew) {
      // Promote from newRows to detail.mappings
      setNewRows((prev) => prev.filter((r) => r.mappingId !== mappingId));
      setDetail((prev) => {
        if (!prev) return prev;
        return { ...prev, mappings: [...prev.mappings, { ...editedRow }] };
      });
    } else {
      // Update existing mapping in detail
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          mappings: prev.mappings.map((m) =>
            m.mappingId === mappingId ? { ...editedRow } : m
          ),
        };
      });
    }

    // Remove from editing state
    setEditingRows((prev) => {
      const next = new Map(prev);
      next.delete(mappingId);
      return next;
    });
  }, [editingRows, detail, newRows]);

  // ── Cancel edit ─────────────────────────────────────────────────────────────

  const handleCancelEdit = useCallback((mappingId: string): void => {
    const isNew = mappingId.startsWith('new-');

    setEditingRows((prev) => {
      const next = new Map(prev);
      next.delete(mappingId);
      return next;
    });

    if (isNew) {
      setNewRows((prev) => prev.filter((r) => r.mappingId !== mappingId));
    }

    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[mappingId];
      return next;
    });
  }, []);

  // ── Save all confirmed mappings ─────────────────────────────────────────────

  const handleSaveAll = useCallback(async (): Promise<void> => {
    if (!detail) return;

    const pendingEdits = Array.from(editingRows.keys());
    if (pendingEdits.length > 0) {
      setErrors({ saveAll: 'Please save or cancel all open rows before saving.' });
      return;
    }

    setIsSaving(true);
    setErrors({});

    try {
      const mappingInputs: MappingInput[] = detail.mappings.map((m, idx) => ({
        mappingId:   m.mappingId.startsWith('new-') ? undefined : m.mappingId,
        sourceField: m.sourceField,
        targetField: m.targetField,
        dataType:    m.dataType,
        isMandatory: m.isMandatory,
        sortOrder:   idx,
      }));

      const result = await saveFieldMapping(detail.uploadId, mappingInputs);

      if (result.success) {
        // Reload to get server-assigned IDs
        await loadDetail(detail.uploadId);
      } else {
        setErrors({ saveAll: result.message || 'Failed to save mappings.' });
      }
    } catch (err) {
      logError(err, 'useFieldMappingDetails.handleSaveAll');
      setErrors({ saveAll: 'An error occurred while saving. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  }, [detail, editingRows, loadDetail]);

  // ── Delete a row ────────────────────────────────────────────────────────────

  const handleDeleteRow = useCallback((mappingId: string): void => {
    const isNew = mappingId.startsWith('new-');

    if (isNew) {
      setNewRows((prev) => prev.filter((r) => r.mappingId !== mappingId));
    } else {
      setDetail((prev) => {
        if (!prev) return prev;
        return { ...prev, mappings: prev.mappings.filter((m) => m.mappingId !== mappingId) };
      });
    }

    setEditingRows((prev) => {
      const next = new Map(prev);
      next.delete(mappingId);
      return next;
    });

    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[mappingId];
      return next;
    });
  }, []);

  // ── Download template ───────────────────────────────────────────────────────

  const handleDownloadTemplate = useCallback(async (): Promise<void> => {
    try {
      const result = await downloadTemplate(detail?.uploadId);

      if (!result.success || !result.base64) {
        setErrors((prev) => ({ ...prev, download: result.message || 'Failed to download template.' }));
        return;
      }

      // Decode base64 and trigger browser download
      const byteChars   = atob(result.base64);
      const byteNumbers = new Array(byteChars.length).fill(0).map((_, i) => byteChars.charCodeAt(i));
      const byteArray   = new Uint8Array(byteNumbers);
      const blob        = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url         = URL.createObjectURL(blob);
      const anchor      = Object.assign(document.createElement('a'), {
        href:     url,
        download: result.fileName ?? 'field-mapping-template.xlsx',
      });
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      logError(err, 'useFieldMappingDetails.handleDownloadTemplate');
      setErrors((prev) => ({ ...prev, download: 'An error occurred while downloading the template.' }));
    }
  }, [detail]);

  return {
    detail,
    editingRows,
    newRows,
    isLoading,
    isSaving,
    errors,
    rowErrors,
    loadDetail,
    handleAddRow,
    handleEditRow,
    handleUpdateRow,
    handleSaveRow,
    handleCancelEdit,
    handleSaveAll,
    handleDeleteRow,
    handleDownloadTemplate,
  };
}
