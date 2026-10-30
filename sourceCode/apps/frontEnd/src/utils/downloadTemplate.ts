import { logError } from './logError';

const API_BASE = (import.meta as any).env.VITE_API_URL;

export type DownloadTemplateResult =
  | { success: true }
  | { success: false; message: string };

/**
 * Downloads a template file from the backend template folder.
 * Triggers a browser file-save dialog.
 */
export async function downloadTemplateFile(
  templateName: string
): Promise<DownloadTemplateResult> {
  try {
    const url  = `${API_BASE}/api/templates/download/${encodeURIComponent(templateName)}`;
    const resp = await fetch(url, { method: 'GET' });

    if (!resp.ok) {
      let message = 'Unable to download template.';
      try {
        const json = await resp.json() as { message?: string };
        if (json.message) message = json.message;
      } catch { /* response body may not be JSON */ }
      return { success: false, message };
    }

    const blob     = await resp.blob();
    const blobUrl  = URL.createObjectURL(blob);
    const anchor   = Object.assign(document.createElement('a'), {
      href:     blobUrl,
      download: templateName,
    });
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(blobUrl);

    return { success: true };
  } catch (err) {
    logError(err, `downloadTemplateFile(${templateName})`);
    return { success: false, message: 'Unable to download template.' };
  }
}
