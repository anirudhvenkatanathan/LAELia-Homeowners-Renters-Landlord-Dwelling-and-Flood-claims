import { useState, useEffect, useCallback } from 'react';
import { UploadType } from '../../models/claimIntakeMaster/claimIntakeModel';
import type {
  UploadedClaimsGridRow,
  UploadedClaimDetails,
} from '../../models/claimIntakeMaster/claimIntakeModel';
import {
  uploadClaim as uploadClaimService,
  getUploadedClaims,
  getUploadedClaimDetails,
} from '../../services/claimIntakeMaster/claimIntakeService';
import { validateClaimIntakeForm } from '../../validations/claimIntakeMaster/claimIntakeSchema';
import { logError } from '../../utils/logError';

export interface UseClaimIntakeState {
  uploadType: UploadType | null;
  file: File | null;
  jsonPayload: string;
  xmlData: string;
  isLoading: boolean;
  errors: Record<string, string>;
  successMessage: string;
  uploadedClaims: UploadedClaimsGridRow[];
  selectedRow: UploadedClaimsGridRow | null;
  claimDetails: UploadedClaimDetails | null;
}

export interface UseClaimIntakeHandlers {
  handleUploadTypeChange: (type: UploadType) => void;
  handleFileChange: (file: File | null) => void;
  handleJsonChange: (value: string) => void;
  handleXmlChange: (value: string) => void;
  handleUpload: () => Promise<void>;
  handleRowSelect: (row: UploadedClaimsGridRow) => Promise<void>;
  fetchUploadedClaims: () => Promise<void>;
  clearSuccess: () => void;
  clearErrors: () => void;
}

export type UseClaimIntakeReturn = UseClaimIntakeState & UseClaimIntakeHandlers;

export function useClaimIntake(): UseClaimIntakeReturn {
  const [uploadType, setUploadType] = useState<UploadType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [jsonPayload, setJsonPayload] = useState<string>('');
  const [xmlData, setXmlData] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [uploadedClaims, setUploadedClaims] = useState<UploadedClaimsGridRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<UploadedClaimsGridRow | null>(null);
  const [claimDetails, setClaimDetails] = useState<UploadedClaimDetails | null>(null);

  // ─── Fetch grid on mount ────────────────────────────────────────────────────
  const fetchUploadedClaims = useCallback(async (): Promise<void> => {
    try {
      const rows = await getUploadedClaims();
      setUploadedClaims(rows);
    } catch (err) {
      logError(err, 'useClaimIntake.fetchUploadedClaims');
      setErrors((prev) => ({
        ...prev,
        grid: 'Failed to load uploaded claims. Please refresh the page.',
      }));
    }
  }, []);

  useEffect(() => {
    fetchUploadedClaims().catch((err) => {
      logError(err, 'useClaimIntake.mount.fetchUploadedClaims');
    });
  }, [fetchUploadedClaims]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleUploadTypeChange = useCallback((type: UploadType): void => {
    setUploadType(type);
    setFile(null);
    setJsonPayload('');
    setXmlData('');
    setErrors({});
    setSuccessMessage('');
    setClaimDetails(null);
    setSelectedRow(null);
  }, []);

  const handleFileChange = useCallback((selectedFile: File | null): void => {
    setFile(selectedFile);
    setErrors((prev) => {
      const next = { ...prev };
      delete next['file'];
      return next;
    });
  }, []);

  const handleJsonChange = useCallback((value: string): void => {
    setJsonPayload(value);
    setErrors((prev) => {
      const next = { ...prev };
      delete next['jsonPayload'];
      return next;
    });
  }, []);

  const handleXmlChange = useCallback((value: string): void => {
    setXmlData(value);
    setErrors((prev) => {
      const next = { ...prev };
      delete next['xmlData'];
      return next;
    });
  }, []);

  const handleUpload = useCallback(async (): Promise<void> => {
    // Validate form
    const validation = validateClaimIntakeForm({
      uploadType,
      file,
      jsonPayload,
      xmlData,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSuccessMessage('');
    setIsLoading(true);

    try {
      // Convert file to base64 for JSON transmission if needed
      // The service layer handles this via the GraphQL mutation directly
      const response = await uploadClaimService({
        uploadType: uploadType!,
        fileName:    file?.name,
        jsonPayload: uploadType === 'JSON' ? jsonPayload : undefined,
        xmlPayload:  uploadType === 'XML'  ? xmlData : undefined,
        uploadedBy:  'Admin', // Would come from auth context in production
      });

      if (response.success) {
        setSuccessMessage(`Claim uploaded successfully. Upload ID: ${response.uploadId}`);
        setFile(null);
        setJsonPayload('');
        setXmlData('');
        setUploadType(null);
        // Refresh grid
        await fetchUploadedClaims();
      } else {
        setErrors({ submit: response.message });
      }
    } catch (err) {
      logError(err, 'useClaimIntake.handleUpload');
      setErrors({ submit: 'Upload failed. Please try again or contact support.' });
    } finally {
      setIsLoading(false);
    }
  }, [uploadType, file, jsonPayload, xmlData, fetchUploadedClaims]);

  const handleRowSelect = useCallback(async (row: UploadedClaimsGridRow): Promise<void> => {
    setSelectedRow(row);
    setClaimDetails(null);

    try {
      const details = await getUploadedClaimDetails(row.uploadId);
      setClaimDetails(details);
    } catch (err) {
      logError(err, 'useClaimIntake.handleRowSelect');
      setErrors((prev) => ({
        ...prev,
        details: 'Failed to load claim details. Please try selecting the row again.',
      }));
    }
  }, []);

  const clearSuccess = useCallback((): void => {
    setSuccessMessage('');
  }, []);

  const clearErrors = useCallback((): void => {
    setErrors({});
  }, []);

  return {
    // State
    uploadType,
    file,
    jsonPayload,
    xmlData,
    isLoading,
    errors,
    successMessage,
    uploadedClaims,
    selectedRow,
    claimDetails,
    // Handlers
    handleUploadTypeChange,
    handleFileChange,
    handleJsonChange,
    handleXmlChange,
    handleUpload,
    handleRowSelect,
    fetchUploadedClaims,
    clearSuccess,
    clearErrors,
  };
}
