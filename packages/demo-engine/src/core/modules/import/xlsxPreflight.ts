import type { UnzipFile } from 'fflate';

import { ImportFileInvalidReason } from '@skladburg/contracts/common/v1/error';
import {
  Unzip,
  UnzipInflate,
} from 'fflate';
import { Parser } from 'saxen';

import {
  IMPORT_LIMITS,
  ImportFileError,
} from './importLimits';

interface ArchiveEntryValue {
  size: number;
}

interface CellPositionValue {
  columnNumber: number;
  rowNumber: number;
}

interface WorkbookInspectionValue {
  cellErrors: Map<string, CellPositionValue[]>;
  firstSheetId: string | undefined;
  sheetPaths: Map<string, string>;
}

const WORKSHEET_TYPES = new Set([
  'http://purl.oclc.org/ooxml/officeDocument/relationships/worksheet',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
]);

const invalidArchive = (): never => {
  throw new ImportFileError(ImportFileInvalidReason.ARCHIVE_LIMIT, 0, 0, '', IMPORT_LIMITS.archiveBytes);
};

const readDirectory = (bytes: Uint8Array): Map<string, ArchiveEntryValue> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;

  while (end >= Math.max(0, bytes.length - 65557) && view.getUint32(end, true) !== 0x06054b50) {
    end -= 1;
  }
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50 || end + 22 + view.getUint16(end + 20, true) !== bytes.length) {
    return invalidArchive();
  }

  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);

  if (view.getUint32(end + 4, true) !== 0 || count !== view.getUint16(end + 8, true)
    || count > IMPORT_LIMITS.archiveEntries || offset + directorySize !== end) {
    return invalidArchive();
  }

  const entries = new Map<string, ArchiveEntryValue>();
  let declaredTotal = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });

  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) {
      return invalidArchive();
    }
    const flags = view.getUint16(offset + 8, true);
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    declaredTotal += size;

    if (offset + 46 + nameLength + extraLength + commentLength > end || entries.has(name)
      || (flags & 1) !== 0 || (compression !== 0 && compression !== 8) || size > IMPORT_LIMITS.entryBytes
      || declaredTotal > IMPORT_LIMITS.archiveBytes || localOffset + 30 > offset
      || view.getUint32(localOffset, true) !== 0x04034b50) {
      return invalidArchive();
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const localName = decoder.decode(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength));
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;

    if (localName !== name || dataOffset + compressedSize > view.getUint32(end + 16, true)
      || view.getUint16(localOffset + 8, true) !== compression || view.getUint16(localOffset + 6, true) !== flags
      || ((flags & 8) === 0 && (view.getUint32(localOffset + 18, true) !== compressedSize
        || view.getUint32(localOffset + 22, true) !== size))) {
      return invalidArchive();
    }

    entries.set(name, { size });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end) {
    return invalidArchive();
  }

  return entries;
};

const checkReference = (reference: string): CellPositionValue => {
  const match = /^\$?([A-Z]{1,3})\$?([1-9][0-9]{0,6})$/.exec(reference);
  const letters = match?.[1];
  const digits = match?.[2];

  if (letters === undefined || digits === undefined) {
    throw new ImportFileError(ImportFileInvalidReason.XML);
  }
  let column = 0;
  for (const letter of letters) {
    column = column * 26 + letter.charCodeAt(0) - 64;
  }
  if (column > IMPORT_LIMITS.columns) {
    throw new ImportFileError(ImportFileInvalidReason.COLUMN_LIMIT, 0, column, '', IMPORT_LIMITS.columns);
  }
  const rowNumber = Number(digits);
  if (rowNumber > IMPORT_LIMITS.rows + 1) {
    throw new ImportFileError(ImportFileInvalidReason.ROW_LIMIT, rowNumber, 0, '', IMPORT_LIMITS.rows);
  }
  return { columnNumber: column, rowNumber };
};

const normalizeXmlName = (name: string, isAttribute: boolean): string => {
  const separatorIndex = name.indexOf(':', isAttribute && name.startsWith('xmlns:') ? 6 : 0);
  return separatorIndex === -1 ? name : name.slice(separatorIndex + 1);
};

const checkXml = (bytes: Uint8Array, path: string, workbook: undefined | WorkbookInspectionValue): void => {
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const fail = (): never => {
    throw new ImportFileError(ImportFileInvalidReason.XML);
  };
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || /&(?!(?:amp|lt|gt|quot|apos|#[0-9]{1,7}|#x[0-9a-fA-F]{1,6});)/.test(xml)) {
    fail();
  }
  const parser = new Parser();
  const stack: string[] = [];
  let rowCount = 0;
  let cellCount = 0;
  let cellCharacters = 0;
  let sharedCharacters = 0;
  let hasCell = false;
  let hasShared = false;
  let currentCell: CellPositionValue | undefined;
  let hasCellError = false;
  let hasFormula = false;
  let hasStoredValue = false;
  let isStringResult = false;

  parser.on('error', fail);
  parser.on('warn', fail);
  parser.on('attention', fail);
  parser.on('question', (text) => {
    if (!/^<\?xml\s[\s\S]*\?>$/i.test(text)) {
      fail();
    }
  });
  parser.on('openTag', (qualifiedName, getAttributes, decodeEntities) => {
    const name = normalizeXmlName(qualifiedName, false);
    const attributes = new Map<string, string>();
    for (const [attributeName, value] of Object.entries(getAttributes())) {
      const normalized = normalizeXmlName(attributeName, true);
      if (attributes.has(normalized)) {
        fail();
      }
      attributes.set(normalized, decodeEntities(value));
    }
    const parent = stack.at(-1);
    stack.push(name);

    if (workbook !== undefined) {
      if (path === 'xl/workbook.xml' && name === 'sheet' && (attributes.get('name') ?? '') !== '') {
        workbook.firstSheetId ??= attributes.get('id');
      }
      if (path === 'xl/_rels/workbook.xml.rels' && name === 'Relationship' && WORKSHEET_TYPES.has(attributes.get('Type') ?? '')) {
        const id = attributes.get('Id');
        const target = attributes.get('Target');
        if (id !== undefined && target !== undefined) {
          workbook.sheetPaths.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
        }
      }
      if (currentCell !== undefined && parent === 'c' && name === 'f') {
        hasFormula = true;
      }
      if (currentCell !== undefined && parent === 'c' && name === 'v' && isStringResult) {
        hasStoredValue = true;
      }
    }

    if (name === 'row') {
      rowCount += 1;
      cellCount = 0;
      const reference = attributes.get('r');
      if (rowCount > IMPORT_LIMITS.rows + 1 || (reference !== undefined && (!/^[1-9][0-9]{0,6}$/.test(reference)
        || Number(reference) > IMPORT_LIMITS.rows + 1))) {
        throw new ImportFileError(ImportFileInvalidReason.ROW_LIMIT, 0, 0, '', IMPORT_LIMITS.rows);
      }
    }
    if (name === 'c') {
      cellCount += 1;
      hasCell = true;
      cellCharacters = 0;
      if (cellCount > IMPORT_LIMITS.columns) {
        throw new ImportFileError(ImportFileInvalidReason.COLUMN_LIMIT, 0, 0, '', IMPORT_LIMITS.columns);
      }
      const reference = attributes.get('r');
      if (reference !== undefined) {
        const position = checkReference(reference);
        if (workbook !== undefined && stack[0] === 'worksheet' && parent === 'row') {
          currentCell = position;
          hasCellError = attributes.get('t') === 'e';
          hasFormula = false;
          hasStoredValue = false;
          isStringResult = attributes.get('t') === 'str';
        }
      }
    }
    const dimension = attributes.get('ref');
    if (name === 'dimension' && dimension !== undefined) {
      for (const reference of dimension.split(':')) {
        checkReference(reference);
      }
    }
    if (name === 'si') {
      sharedCharacters = 0;
      hasShared = true;
    }
  });
  parser.on('closeTag', (qualifiedName) => {
    const name = normalizeXmlName(qualifiedName, false);
    if (stack.pop() !== name) {
      fail();
    }
    if (name === 'c') {
      hasCell = false;
      if (workbook !== undefined && currentCell !== undefined && (hasCellError || (hasFormula && !hasStoredValue))) {
        const cellErrors = workbook.cellErrors.get(path) ?? [];
        cellErrors.push(currentCell);
        workbook.cellErrors.set(path, cellErrors);
      }
      currentCell = undefined;
    }
    if (name === 'si') {
      hasShared = false;
    }
  });
  const checkText = (text: string): void => {
    if (currentCell !== undefined && stack.at(-1) === 'v' && stack.at(-2) === 'c' && text.trim() !== '') {
      hasStoredValue = true;
    }
    if (hasCell) {
      cellCharacters += text.length;
    }
    if (hasShared) {
      sharedCharacters += text.length;
    }
    if (cellCharacters > IMPORT_LIMITS.cellCharacters || sharedCharacters > IMPORT_LIMITS.cellCharacters) {
      throw new ImportFileError(ImportFileInvalidReason.CELL_LIMIT, 0, 0, '', IMPORT_LIMITS.cellCharacters);
    }
  };
  parser.on('text', checkText);
  parser.on('cdata', checkText);
  parser.parse(xml);
  if (stack.length !== 0) {
    fail();
  }
};

export const preflightXlsx = (bytes: Uint8Array, isWarehouse = false): readonly CellPositionValue[] => {
  if (bytes.length > IMPORT_LIMITS.fileBytes) {
    throw new ImportFileError(ImportFileInvalidReason.FILE_SIZE, 0, 0, '', IMPORT_LIMITS.fileBytes);
  }
  const streams: UnzipFile[] = [];
  const workbook: undefined | WorkbookInspectionValue = isWarehouse
    ? { cellErrors: new Map(), firstSheetId: undefined, sheetPaths: new Map() }
    : undefined;

  try {
    const directory = readDirectory(bytes);
    const seen = new Set<string>();
    let totalBytes = 0;
    let completed = 0;
    const unzip = new Unzip((file) => {
      streams.push(file);
      const entry = directory.get(file.name);
      if (streams.length > IMPORT_LIMITS.archiveEntries || entry === undefined || seen.has(file.name)) {
        return invalidArchive();
      }
      seen.add(file.name);
      let entryBytes = 0;
      const chunks: Uint8Array[] = [];
      const isXml = /\.(xml|rels)$/i.test(file.name);
      file.ondata = (error, chunk, isFinal) => {
        if (error !== null) {
          throw error;
        }
        entryBytes += chunk.length;
        totalBytes += chunk.length;
        if (entryBytes > IMPORT_LIMITS.entryBytes || totalBytes > IMPORT_LIMITS.archiveBytes || entryBytes > entry.size) {
          invalidArchive();
        }
        if (isXml) {
          chunks.push(chunk.slice());
        }
        if (isFinal) {
          if (entryBytes !== entry.size) {
            invalidArchive();
          }
          completed += 1;
          if (isXml) {
            const content = new Uint8Array(entryBytes);
            let offset = 0;
            for (const part of chunks) {
              content.set(part, offset);
              offset += part.length;
            }
            checkXml(content, file.name, workbook);
          }
        }
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    for (let offset = 0; offset < bytes.length; offset += 256) {
      unzip.push(bytes.subarray(offset, offset + 256), offset + 256 >= bytes.length);
    }
    if (completed !== directory.size || seen.size !== directory.size) {
      invalidArchive();
    }
  }
  catch (error) {
    for (const stream of streams) {
      stream.terminate();
    }
    if (error instanceof ImportFileError) {
      throw error;
    }
    throw new ImportFileError(ImportFileInvalidReason.FORMAT);
  }
  const path = workbook?.sheetPaths.get(workbook.firstSheetId ?? '');
  return path === undefined ? [] : workbook?.cellErrors.get(path) ?? [];
};
