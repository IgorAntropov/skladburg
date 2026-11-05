import { ImportFileInvalidReason } from '@skladburg/contracts/common/v1/error';

import {
  IMPORT_LIMITS,
  ImportFileError,
} from './importLimits';

const decodeCsv = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  catch {
    try {
      const source = new TextDecoder('windows-1251', { fatal: true }).decode(bytes);

      if (source.includes('\uFFFD')) {
        throw new ImportFileError(ImportFileInvalidReason.ENCODING);
      }

      return source;
    }
    catch {
      throw new ImportFileError(ImportFileInvalidReason.ENCODING);
    }
  }
};

const detectDelimiter = (source: string): string => {
  let isQuoted = false;
  let commas = 0;
  let semicolons = 0;

  for (const character of source) {
    if (character === '"') {
      isQuoted = !isQuoted;
    }
    else if (!isQuoted) {
      if (character === '\r' || character === '\n') {
        break;
      }
      if (character === ',') {
        commas += 1;
      }
      if (character === ';') {
        semicolons += 1;
      }
    }
  }

  return semicolons > commas ? ';' : ',';
};

export const readCsv = (bytes: Uint8Array): string[][] => {
  if (bytes.length > IMPORT_LIMITS.fileBytes) {
    throw new ImportFileError(ImportFileInvalidReason.FILE_SIZE, 0, 0, '', IMPORT_LIMITS.fileBytes);
  }

  const source = decodeCsv(bytes);
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let isQuoted = false;
  let isClosed = false;

  const pushCell = (): void => {
    row.push(cell);
    cell = '';
    isClosed = false;

    if (row.length > IMPORT_LIMITS.columns) {
      throw new ImportFileError(ImportFileInvalidReason.COLUMN_LIMIT, rows.length + 1, row.length, '', IMPORT_LIMITS.columns);
    }
  };
  const pushRow = (): void => {
    pushCell();
    rows.push(row);
    row = [];

    if (rows.length > IMPORT_LIMITS.rows + 1) {
      throw new ImportFileError(ImportFileInvalidReason.ROW_LIMIT, rows.length, 0, '', IMPORT_LIMITS.rows);
    }
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? '';

    if (character === '\0') {
      throw new ImportFileError(ImportFileInvalidReason.ENCODING);
    }

    if (character === '"') {
      if (isQuoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      }
      else if (isQuoted) {
        isQuoted = false;
        isClosed = true;
      }
      else if (cell === '' && !isClosed) {
        isQuoted = true;
      }
      else {
        throw new ImportFileError(ImportFileInvalidReason.FORMAT, rows.length + 1, row.length + 1);
      }
    }
    else if (!isQuoted && character === delimiter) {
      pushCell();
    }
    else if (!isQuoted && (character === '\r' || character === '\n')) {
      if (character === '\r' && source[index + 1] === '\n') {
        index += 1;
      }
      pushRow();
    }
    else {
      if (isClosed) {
        throw new ImportFileError(ImportFileInvalidReason.FORMAT, rows.length + 1, row.length + 1);
      }
      cell += character;
    }

    if (cell.length > IMPORT_LIMITS.cellCharacters) {
      throw new ImportFileError(ImportFileInvalidReason.CELL_LIMIT, rows.length + 1, row.length + 1, '', IMPORT_LIMITS.cellCharacters);
    }
  }

  if (isQuoted) {
    throw new ImportFileError(ImportFileInvalidReason.FORMAT, rows.length + 1, row.length + 1);
  }
  if (cell !== '' || row.length > 0 || isClosed) {
    pushRow();
  }

  return rows;
};
