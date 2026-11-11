import type { SheetData } from 'read-excel-file/universal';

import { ImportFileInvalidReason } from '@skladburg/contracts/common/v1/error';
import { readSheet } from 'read-excel-file/universal';

import {
  checkImportTable,
  ImportFileError,
} from './importLimits';
import { preflightXlsx } from './xlsxPreflight';

export interface WarehouseXlsxCellValue {
  kind: 'boolean' | 'date' | 'empty' | 'error' | 'number' | 'text';
  text: string;
}

interface NumberCellValue {
  numberText: string;
}

const readSheetValues = async <TNumber>(
  bytes: Uint8Array,
  parseNumber: (value: string) => TNumber,
): Promise<SheetData<TNumber>> => {
  try {
    return await readSheet(bytes.slice().buffer, { parseNumber, trim: false });
  }
  catch {
    throw new ImportFileError(ImportFileInvalidReason.FORMAT);
  }
};

export const readXlsx = async (bytes: Uint8Array): Promise<string[][]> => {
  preflightXlsx(bytes);
  const table = await readSheetValues(bytes, value => value);
  const rows = table.map(row => row.map(cell => cell === null ? '' : String(cell)));
  checkImportTable(rows);
  return rows;
};

export const readWarehouseXlsx = async (bytes: Uint8Array): Promise<WarehouseXlsxCellValue[][]> => {
  const cellErrors = preflightXlsx(bytes, true);
  const table = await readSheetValues(bytes, (numberText): NumberCellValue => ({ numberText }));
  const rows = table.map(row => row.map((cell): WarehouseXlsxCellValue => {
    if (cell === null) {
      return { kind: 'empty', text: '' };
    }
    if (cell instanceof Date) {
      return { kind: 'date', text: Number.isFinite(cell.getTime()) ? cell.toISOString().slice(0, 10) : 'Invalid date' };
    }
    if (typeof cell === 'object') {
      return { kind: 'number', text: cell.numberText };
    }
    return { kind: typeof cell === 'string' ? 'text' : 'boolean', text: String(cell) };
  }));
  for (const { columnNumber, rowNumber } of cellErrors) {
    while (rows.length < rowNumber) {
      rows.push([]);
    }
    const row = rows[rowNumber - 1];
    if (row !== undefined) {
      while (row.length < columnNumber) {
        row.push({ kind: 'empty', text: '' });
      }
      row[columnNumber - 1] = { kind: 'error', text: '' };
    }
  }
  checkImportTable(rows.map(row => row.map(cell => cell.text)));
  return rows;
};
