import { ImportFileInvalidReason } from '@skladburg/contracts/common/v1/error';
import { readSheet } from 'read-excel-file/universal';

import {
  checkImportTable,
  ImportFileError,
} from './importLimits';
import { preflightXlsx } from './xlsxPreflight';

export const readXlsx = async (bytes: Uint8Array): Promise<string[][]> => {
  preflightXlsx(bytes);

  try {
    const table = await readSheet(bytes.slice().buffer, { parseNumber: value => value, trim: false });
    const rows = table.map(row => row.map(cell => cell === null ? '' : String(cell)));
    checkImportTable(rows);

    return rows;
  }
  catch (error) {
    if (error instanceof ImportFileError) {
      throw error;
    }
    throw new ImportFileError(ImportFileInvalidReason.FORMAT);
  }
};
