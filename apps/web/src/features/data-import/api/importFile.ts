import { PreviewImportRequestFormRules } from '@skladburg/contracts/forms/import/v1/import';

import type { ImportTargetValue } from '../model/importTarget';

export type ImportFileErrorValue = 'empty' | 'format' | 'name' | 'read' | 'tooLarge';

interface ImportViolationLocationValue {
  fieldPath: string;
  rowNumber: number;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const readImportFile = async (
  file: File,
  kind: ImportTargetValue['kind'] = 'catalog',
): Promise<ImportFileErrorValue | Uint8Array<ArrayBuffer>> => {
  const pattern = kind === 'warehouse' ? /\.xlsx$/iu : /\.(csv|xlsx)$/iu;
  if (!pattern.test(file.name)) {
    return 'format';
  }
  if (Array.from(file.name).length > PreviewImportRequestFormRules.fields.fileName.maxLen) {
    return 'name';
  }
  if (file.size === 0) {
    return 'empty';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'tooLarge';
  }

  try {
    return new Uint8Array(await file.arrayBuffer());
  }
  catch {
    return 'read';
  }
};

export const readImportViolation = (path: string): ImportViolationLocationValue | undefined => {
  const result = /^rows\[(\d+)\]\.(.+)$/u.exec(path);
  const index = result?.[1];
  const fieldPath = result?.[2];
  return index === undefined || fieldPath === undefined ? undefined : { fieldPath, rowNumber: Number(index) + 2 };
};
