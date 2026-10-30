import { Request, Response } from 'express';
import { logError } from '../services/errorLogService';
import {
  uploadFieldMappingFile,
  getUploadedFiles,
  getFieldMappingDetails,
  saveFieldMapping,
  downloadTemplate,
} from '../services/fieldMappingService';

/**
 * POST /api/field-mapping/upload
 * Body: { excelBase64: string, fileName?: string, uploadedBy?: string }
 */
export async function handleFieldMappingUpload(req: Request, res: Response): Promise<void> {
  try {
    const { excelBase64, fileName, uploadedBy } = req.body as {
      excelBase64?: string;
      fileName?: string;
      uploadedBy?: string;
    };

    if (!excelBase64) {
      res.status(400).json({ success: false, message: 'excelBase64 is required.' });
      return;
    }

    const result = await uploadFieldMappingFile(
      excelBase64,
      fileName ?? 'upload.xlsx',
      uploadedBy ?? 'System'
    );

    const httpStatus = result.success ? 201 : 422;
    res.status(httpStatus).json(result);
  } catch (err) {
    await logError(err as Error, 'fieldMappingMasterController.handleFieldMappingUpload');
    res.status(500).json({ success: false, message: 'Internal server error during upload.' });
  }
}

/**
 * GET /api/field-mapping/files
 * Returns all uploaded file rows sorted by uploadDate desc.
 */
export async function handleGetUploadedFiles(req: Request, res: Response): Promise<void> {
  try {
    const files = await getUploadedFiles();
    res.status(200).json({ success: true, data: files });
  } catch (err) {
    await logError(err as Error, 'fieldMappingMasterController.handleGetUploadedFiles');
    res.status(500).json({ success: false, message: 'Internal server error while fetching files.' });
  }
}

/**
 * GET /api/field-mapping/details/:uploadId
 * Returns full field mapping detail for the given uploadId.
 */
export async function handleGetFieldMappingDetails(req: Request, res: Response): Promise<void> {
  try {
    const uploadId = req.params['uploadId'] as string;

    if (!uploadId) {
      res.status(400).json({ success: false, message: 'uploadId path parameter is required.' });
      return;
    }

    const details = await getFieldMappingDetails(uploadId);

    if (!details) {
      res.status(404).json({ success: false, message: `No record found with uploadId: ${uploadId}` });
      return;
    }

    res.status(200).json({ success: true, data: details });
  } catch (err) {
    await logError(err as Error, 'fieldMappingMasterController.handleGetFieldMappingDetails');
    res.status(500).json({ success: false, message: 'Internal server error while fetching details.' });
  }
}

/**
 * POST /api/field-mapping/save-mapping
 * Body: { uploadId: string, mappings: MappingInput[] }
 */
export async function handleSaveMapping(req: Request, res: Response): Promise<void> {
  try {
    const { uploadId, mappings } = req.body as {
      uploadId?: string;
      mappings?: unknown[];
    };

    if (!uploadId) {
      res.status(400).json({ success: false, message: 'uploadId is required.' });
      return;
    }

    if (!Array.isArray(mappings)) {
      res.status(400).json({ success: false, message: 'mappings must be an array.' });
      return;
    }

    const result = await saveFieldMapping(uploadId, mappings as Parameters<typeof saveFieldMapping>[1]);
    const httpStatus = result.success ? 200 : 422;
    res.status(httpStatus).json(result);
  } catch (err) {
    await logError(err as Error, 'fieldMappingMasterController.handleSaveMapping');
    res.status(500).json({ success: false, message: 'Internal server error while saving mappings.' });
  }
}

/**
 * GET /api/field-mapping/download-template
 * Query: uploadId? (optional)
 */
export async function handleDownloadTemplate(req: Request, res: Response): Promise<void> {
  try {
    const uploadId = req.query['uploadId'] as string | undefined;
    const result   = await downloadTemplate(uploadId);
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    await logError(err as Error, 'fieldMappingMasterController.handleDownloadTemplate');
    res.status(500).json({ success: false, message: 'Internal server error while generating template.' });
  }
}
