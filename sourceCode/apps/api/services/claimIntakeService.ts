import { v4 as uuidv4 } from 'uuid';
import { ClaimIntakeModel, ClaimIntakeAuditModel } from '../graphQL/claimIntakeEntity';
import { parseExcelFile } from './excelParserService';
import { validateJsonPayload } from './jsonValidatorService';
import { validateXmlPayload } from './xmlValidatorService';
import { logError } from './errorLogService';

export type UploadType = 'EXCEL' | 'JSON' | 'XML';

export interface UploadClaimInput {
  uploadType: UploadType;
  fileName?: string;
  fileBuffer?: Buffer;
  jsonPayload?: string;
  xmlPayload?: string;
  uploadedBy?: string;
}

export interface UploadClaimResult {
  success: boolean;
  uploadId?: string;
  claimNumber?: string;
  status: string;
  validationResult: string;
  message: string;
}

/**
 * Orchestrates the full claim upload flow:
 * 1. Determine upload type
 * 2. Call the appropriate parser/validator
 * 3. Create claim_intake record
 * 4. Create audit record
 * 5. Return result
 */
export async function uploadClaim(input: UploadClaimInput): Promise<UploadClaimResult> {
  const uploadId = uuidv4();
  const now = new Date();
  const uploadedBy = input.uploadedBy ?? 'System';

  try {
    let claimNumber = '';
    let policyNumber = '';
    let insuredName = '';
    let lossDate = '';
    let reportedDate = '';
    let claimType = '';
    let validationResult = '';
    let processingMessages = '';
    let payloadString = '';
    let status = 'Pending';

    if (input.uploadType === 'EXCEL') {
      if (!input.fileBuffer || !input.fileName) {
        return {
          success: false,
          status: 'Failed',
          validationResult: 'CI-001',
          message: 'Excel file and file name are required for EXCEL upload type.',
        };
      }

      const result = await parseExcelFile(input.fileBuffer, input.fileName);
      if (!result.success) {
        return {
          success: false,
          status: 'Failed',
          validationResult: result.validationResult,
          message: result.message,
        };
      }

      claimNumber      = result.data?.claimNumber ?? '';
      policyNumber     = result.data?.policyNumber ?? '';
      insuredName      = result.data?.insuredName ?? '';
      lossDate         = result.data?.lossDate ?? '';
      reportedDate     = result.data?.reportedDate ?? '';
      claimType        = result.data?.claimType ?? '';
      validationResult = result.validationResult;
      processingMessages = result.message;
      payloadString    = JSON.stringify(result.data?.rawData ?? []);
      status           = 'Processed';

    } else if (input.uploadType === 'JSON') {
      if (!input.jsonPayload) {
        return {
          success: false,
          status: 'Failed',
          validationResult: 'CI-002',
          message: 'JSON payload is required for JSON upload type.',
        };
      }

      const result = await validateJsonPayload(input.jsonPayload);
      if (!result.success) {
        return {
          success: false,
          status: 'Failed',
          validationResult: result.validationResult,
          message: result.message,
        };
      }

      claimNumber      = result.data?.claimNumber ?? '';
      policyNumber     = result.data?.policyNumber ?? '';
      insuredName      = result.data?.insuredName ?? '';
      lossDate         = result.data?.lossDate ?? '';
      reportedDate     = result.data?.reportedDate ?? '';
      claimType        = result.data?.claimType ?? '';
      validationResult = result.validationResult;
      processingMessages = result.message;
      payloadString    = input.jsonPayload;
      status           = 'Processed';

    } else if (input.uploadType === 'XML') {
      if (!input.xmlPayload) {
        return {
          success: false,
          status: 'Failed',
          validationResult: 'CI-002',
          message: 'XML payload is required for XML upload type.',
        };
      }

      const result = await validateXmlPayload(input.xmlPayload);
      if (!result.success) {
        return {
          success: false,
          status: 'Failed',
          validationResult: result.validationResult,
          message: result.message,
        };
      }

      claimNumber      = result.data?.claimNumber ?? '';
      policyNumber     = result.data?.policyNumber ?? '';
      insuredName      = result.data?.insuredName ?? '';
      lossDate         = result.data?.lossDate ?? '';
      reportedDate     = result.data?.reportedDate ?? '';
      claimType        = result.data?.claimType ?? '';
      validationResult = result.validationResult;
      processingMessages = result.message;
      payloadString    = input.xmlPayload;
      status           = 'Processed';

    } else {
      return {
        success: false,
        status: 'Failed',
        validationResult: 'CI-001',
        message: `Unsupported upload type: ${String(input.uploadType)}`,
      };
    }

    // Persist claim_intake record
    const doc = new ClaimIntakeModel({
      uploadId,
      fileName:          input.fileName ?? '',
      uploadType:        input.uploadType,
      claimNumber,
      policyNumber,
      insuredName,
      lossDate,
      reportedDate,
      claimType,
      claimStatus:       'Active',
      uploadedBy,
      uploadDate:        now,
      status,
      payload:           payloadString,
      validationResults: validationResult,
      processingMessages,
    });

    await doc.save();

    // Persist audit record
    await new ClaimIntakeAuditModel({
      uploadId,
      action:    'UPLOAD',
      user:      uploadedBy,
      timestamp: now,
      status,
      remarks:   `Upload type: ${input.uploadType}. ${processingMessages}`,
    }).save();

    return {
      success:         true,
      uploadId,
      claimNumber,
      status,
      validationResult,
      message:         `Claim intake record created successfully. Upload ID: ${uploadId}`,
    };

  } catch (err) {
    await logError(err as Error, 'claimIntakeService.uploadClaim');
    return {
      success:         false,
      status:          'Error',
      validationResult:'CI-007',
      message:         'A database error occurred while processing the claim upload.',
    };
  }
}

/**
 * Retrieves the uploaded claims grid rows — newest first.
 * Uses in-memory sort — no $skip.
 */
export async function getUploadedClaims(): Promise<{
  uploadId:    string;
  fileName:    string;
  uploadType:  string;
  totalClaims: number;
  uploadedBy:  string;
  uploadDate:  string;
  status:      string;
}[]> {
  try {
    const docs = await ClaimIntakeModel
      .find({})
      .sort({ uploadDate: -1 })
      .lean()
      .exec();

    return docs.map((d) => ({
      uploadId:    d.uploadId,
      fileName:    d.fileName,
      uploadType:  d.uploadType,
      totalClaims: d.totalClaims ?? 0,
      uploadedBy:  d.uploadedBy,
      uploadDate:  d.uploadDate ? new Date(d.uploadDate).toISOString() : '',
      status:      d.status,
    }));
  } catch (err) {
    await logError(err as Error, 'claimIntakeService.getUploadedClaims');
    return [];
  }
}
