import { Request, Response } from 'express';
import { uploadClaim, getUploadedClaims, UploadType } from '../services/claimIntakeService';
import { getClaimDetails } from '../services/claimDetailsService';
import { logError } from '../services/errorLogService';

/**
 * POST /api/claim-intake/upload
 * Body: { uploadType, fileName?, jsonPayload?, xmlPayload?, uploadedBy? }
 * File uploads: req.body.fileBuffer (base64 string) or multipart (future)
 */
export async function handleUpload(req: Request, res: Response): Promise<void> {
  try {
    const { uploadType, fileName, jsonPayload, xmlPayload, uploadedBy, fileBufferBase64 } = req.body as {
      uploadType?: string;
      fileName?: string;
      jsonPayload?: string;
      xmlPayload?: string;
      uploadedBy?: string;
      fileBufferBase64?: string;
    };

    if (!uploadType) {
      res.status(400).json({ success: false, message: 'uploadType is required.' });
      return;
    }

    const fileBuffer = fileBufferBase64
      ? Buffer.from(fileBufferBase64, 'base64')
      : undefined;

    const result = await uploadClaim({
      uploadType: uploadType as UploadType,
      fileName,
      fileBuffer,
      jsonPayload,
      xmlPayload,
      uploadedBy,
    });

    const httpStatus = result.success ? 201 : 422;
    res.status(httpStatus).json(result);
  } catch (err) {
    await logError(err as Error, 'claimIntakeMasterController.handleUpload');
    res.status(500).json({ success: false, message: 'Internal server error during upload.' });
  }
}

/**
 * GET /api/claim-intake/list
 * Returns the uploaded claims grid rows.
 */
export async function handleList(req: Request, res: Response): Promise<void> {
  try {
    const claims = await getUploadedClaims();
    res.status(200).json({ success: true, data: claims });
  } catch (err) {
    await logError(err as Error, 'claimIntakeMasterController.handleList');
    res.status(500).json({ success: false, message: 'Internal server error while fetching claims.' });
  }
}

/**
 * GET /api/claim-intake/details/:uploadId
 * Returns full claim detail for the given uploadId.
 */
export async function handleDetails(req: Request, res: Response): Promise<void> {
  try {
    const uploadId = req.params['uploadId'] as string;

    if (!uploadId) {
      res.status(400).json({ success: false, message: 'uploadId path parameter is required.' });
      return;
    }

    const details = await getClaimDetails(uploadId);

    if (!details) {
      res.status(404).json({ success: false, message: `No claim found with uploadId: ${uploadId}` });
      return;
    }

    res.status(200).json({ success: true, data: details });
  } catch (err) {
    await logError(err as Error, 'claimIntakeMasterController.handleDetails');
    res.status(500).json({ success: false, message: 'Internal server error while fetching claim details.' });
  }
}
