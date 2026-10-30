import { useState, useEffect, useCallback } from 'react';
import type { UploadedFileRow } from '../../models/FieldMappingMaster/fieldMappingModel';
import { getUploadedFiles } from '../../services/FieldMappingMaster/fieldMappingService';
import { logError } from '../../utils/logError';

// ─── State Interface ──────────────────────────────────────────────────────────

export interface UseFieldMappingState {
  uploadedFiles: UploadedFileRow[];
  isLoading:     boolean;
  errors:        Record<string, string>;
}

export interface UseFieldMappingHandlers {
  fetchUploadedFiles:  () => Promise<void>;
  handleUploadSuccess: () => void;
}

export type UseFieldMappingReturn = UseFieldMappingState & UseFieldMappingHandlers;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFieldMapping(): UseFieldMappingReturn {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRow[]>([]);
  const [isLoading,     setIsLoading]     = useState<boolean>(false);
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  // ── Fetch on mount ──────────────────────────────────────────────────────────

  const fetchUploadedFiles = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const rows = await getUploadedFiles();
      setUploadedFiles(rows);
      setErrors({});
    } catch (err) {
      logError(err, 'useFieldMapping.fetchUploadedFiles');
      setErrors((prev) => ({
        ...prev,
        grid: 'Failed to load uploaded files. Please refresh the page.',
      }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUploadedFiles().catch((err) => {
      logError(err, 'useFieldMapping.mount.fetchUploadedFiles');
    });
  }, [fetchUploadedFiles]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleUploadSuccess = useCallback((): void => {
    fetchUploadedFiles().catch((err) => {
      logError(err, 'useFieldMapping.handleUploadSuccess');
    });
  }, [fetchUploadedFiles]);

  return {
    uploadedFiles,
    isLoading,
    errors,
    fetchUploadedFiles,
    handleUploadSuccess,
  };
}
