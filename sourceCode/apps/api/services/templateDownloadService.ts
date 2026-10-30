import path from 'path';
import fs   from 'fs';
import { logError } from './errorLogService';

const ALLOWED_EXTENSIONS = ['.xlsx'];

export type TemplateErrorCode =
  | 'FOLDER_MISSING'
  | 'INVALID_NAME'
  | 'INVALID_EXTENSION'
  | 'FILE_NOT_FOUND'
  | 'READ_ERROR';

export interface TemplateResult {
  success:    boolean;
  filePath?:  string;
  fileName?:  string;
  message?:   string;
  errorCode?: TemplateErrorCode;
}

/**
 * Resolves and validates a template file path.
 * Prevents directory traversal and restricts to allowed extensions.
 */
export async function resolveTemplatePath(templateName: string): Promise<TemplateResult> {
  try {
    const folderPath = process.env['TEMPLATE_FOLDER_PATH'] ?? '';

    // Folder config missing
    if (!folderPath.trim()) {
      return { success: false, errorCode: 'FOLDER_MISSING', message: 'Template folder configuration is invalid.' };
    }

    // Security: strip to basename only — reject any path separators or traversal sequences
    const baseName = path.basename(templateName);
    if (
      !baseName ||
      baseName !== templateName ||
      templateName.includes('..') ||
      templateName.includes('/') ||
      templateName.includes('\\')
    ) {
      return { success: false, errorCode: 'INVALID_NAME', message: 'Invalid template requested.' };
    }

    // Extension whitelist
    const ext = path.extname(baseName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return { success: false, errorCode: 'INVALID_EXTENSION', message: 'Invalid template requested.' };
    }

    // Folder existence
    if (!fs.existsSync(folderPath)) {
      return { success: false, errorCode: 'FOLDER_MISSING', message: 'Template folder configuration is invalid.' };
    }

    // Resolve absolute path and confirm it stays inside the template folder
    const resolvedFolder = path.resolve(folderPath);
    const resolvedFile   = path.resolve(folderPath, baseName);

    if (!resolvedFile.startsWith(resolvedFolder + path.sep) &&
        resolvedFile !== resolvedFolder) {
      return { success: false, errorCode: 'INVALID_NAME', message: 'Invalid template requested.' };
    }

    // File existence
    if (!fs.existsSync(resolvedFile)) {
      return { success: false, errorCode: 'FILE_NOT_FOUND', message: 'Template file does not exist.' };
    }

    return { success: true, filePath: resolvedFile, fileName: baseName };
  } catch (err) {
    await logError(err as Error, 'templateDownloadService.resolveTemplatePath');
    return { success: false, errorCode: 'READ_ERROR', message: 'Unable to download template.' };
  }
}
