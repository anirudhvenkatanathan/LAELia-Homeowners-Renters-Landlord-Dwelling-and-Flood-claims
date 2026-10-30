import { Request, Response } from 'express';
import fs from 'fs';
import { resolveTemplatePath } from '../services/templateDownloadService';
import { logError } from '../services/errorLogService';

/**
 * GET /api/templates/download/:templateName
 * Streams the requested template file from the configured template folder.
 */
export async function downloadTemplate(req: Request, res: Response): Promise<void> {
  try {
    const templateName = req.params['templateName'] as string;

    if (!templateName) {
      res.status(400).json({ success: false, message: 'Template name is required.' });
      return;
    }

    const result = await resolveTemplatePath(templateName);

    if (!result.success || !result.filePath || !result.fileName) {
      const httpStatus = result.errorCode === 'FILE_NOT_FOUND' ? 404
                       : result.errorCode === 'INVALID_NAME' || result.errorCode === 'INVALID_EXTENSION' ? 400
                       : 500;
      res.status(httpStatus).json({ success: false, message: result.message });
      return;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('Cache-Control', 'no-store');

    const stream = fs.createReadStream(result.filePath);

    stream.on('error', async (err) => {
      await logError(err, 'templateController.stream');
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Unable to download template.' });
      }
    });

    stream.pipe(res);
  } catch (err) {
    await logError(err as Error, 'templateController.downloadTemplate');
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Unable to download template.' });
    }
  }
}
