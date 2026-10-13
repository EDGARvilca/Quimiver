import { buildXlsx, type Cell } from '../lib/xlsx';

/** Descarga una hoja de Excel armada en el navegador. */
export function downloadXlsx(
  sheet: string,
  rows: Cell[][],
  widths: number[],
  fileName: string,
): void {
  const url = URL.createObjectURL(
    new Blob([buildXlsx(sheet, rows, widths)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
