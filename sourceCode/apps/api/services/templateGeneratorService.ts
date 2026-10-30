import * as XLSX from 'xlsx';

/**
 * Generates an Excel template file from an array of header strings.
 * Returns the file as a base64-encoded string.
 */
export function generateTemplate(headers: string[]): string {
  const wb = XLSX.utils.book_new();

  // Create a worksheet with headers in row 1
  const ws = XLSX.utils.aoa_to_sheet([headers]);

  // Apply bold style to header row cells
  headers.forEach((_header, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!ws[cellRef]) return;
    ws[cellRef].s = { font: { bold: true } };
  });

  // Set column widths based on header length
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 12) }));

  XLSX.utils.book_append_sheet(wb, ws, 'Field Mapping Template');

  // Write as base64
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
