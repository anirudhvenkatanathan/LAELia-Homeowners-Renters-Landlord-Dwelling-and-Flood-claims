import { ClaimIntakeModel, ClaimRecordModel } from '../graphQL/claimIntakeEntity';
import { logError } from './errorLogService';

export interface ClaimDetails {
  uploadId:     string;
  fileName:     string;
  uploadType:   string;
  uploadedBy:   string;
  uploadDate:   string;
  status:       string;
  totalClaims:  number;
  successCount: number;
  failedCount:  number;
  validationResults:  string;
  processingMessages: string;
}

export async function getClaimDetails(uploadId: string): Promise<ClaimDetails | null> {
  try {
    if (!uploadId?.trim()) return null;

    const doc = await ClaimIntakeModel
      .findOne({ uploadId: uploadId.trim() })
      .lean()
      .exec();

    if (!doc) return null;

    return {
      uploadId:           doc.uploadId,
      fileName:           doc.fileName,
      uploadType:         doc.uploadType,
      uploadedBy:         doc.uploadedBy,
      uploadDate:         doc.uploadDate ? new Date(doc.uploadDate).toISOString() : '',
      status:             doc.status,
      totalClaims:        doc.totalClaims  ?? 0,
      successCount:       doc.successCount ?? 0,
      failedCount:        doc.failedCount  ?? 0,
      validationResults:  doc.validationResults,
      processingMessages: doc.processingMessages,
    };
  } catch (err) {
    await logError(err as Error, 'claimDetailsService.getClaimDetails');
    return null;
  }
}

export async function getClaimRecords(uploadId: string) {
  try {
    return await ClaimRecordModel
      .find({ uploadId }) 
      .sort({ recordIndex: 1 })
      .lean()
      .exec();
  } catch (err) {
    await logError(err as Error, 'claimDetailsService.getClaimRecords');
    return [];
  }
}
