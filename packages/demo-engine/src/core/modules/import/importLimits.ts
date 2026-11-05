import { ImportFileInvalidReason } from '@skladburg/contracts/common/v1/error';

export const IMPORT_LIMITS = {
  archiveBytes: 32 * 1024 * 1024,
  archiveEntries: 64,
  cellCharacters: 4096,
  columns: 32,
  entryBytes: 16 * 1024 * 1024,
  fileBytes: 5 * 1024 * 1024,
  rows: 10000,
} as const;

export class ImportFileError extends Error {
  constructor(
    public readonly reason: ImportFileInvalidReason,
    public readonly rowNumber = 0,
    public readonly columnNumber = 0,
    public readonly columnKey = '',
    public readonly limit = 0,
  ) {
    super(ImportFileInvalidReason[reason]);
  }
}

export const checkImportTable = (table: readonly (readonly string[])[]): void => {
  if (table.length > IMPORT_LIMITS.rows + 1) {
    throw new ImportFileError(ImportFileInvalidReason.ROW_LIMIT, 0, 0, '', IMPORT_LIMITS.rows);
  }

  table.forEach((row, rowIndex) => {
    if (row.length > IMPORT_LIMITS.columns) {
      throw new ImportFileError(ImportFileInvalidReason.COLUMN_LIMIT, rowIndex + 1, 0, '', IMPORT_LIMITS.columns);
    }

    row.forEach((cell, columnIndex) => {
      if (cell.length > IMPORT_LIMITS.cellCharacters) {
        throw new ImportFileError(ImportFileInvalidReason.CELL_LIMIT, rowIndex + 1, columnIndex + 1, '', IMPORT_LIMITS.cellCharacters);
      }
    });
  });
};
