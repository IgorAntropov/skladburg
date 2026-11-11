import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  readImportFile,
  readImportViolation,
} from './importFile';

describe('readImportFile', () => {
  it('rejects empty and oversized files before opening them', async () => {
    const empty = new File([], 'empty.csv');
    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.xlsx');

    await expect(readImportFile(empty)).resolves.toBe('empty');
    await expect(readImportFile(oversized)).resolves.toBe('tooLarge');
  });

  it('accepts both formats without relying on the browser media type', async () => {
    for (const name of ['products.CSV', 'products.XLSX']) {
      await expect(readImportFile(new File(['a'], name))).resolves.toEqual(new Uint8Array([97]));
    }

    await expect(readImportFile(new File(['a'], 'products.xls'))).resolves.toBe('format');
  });

  it('accepts only XLSX for a warehouse import', async () => {
    await expect(readImportFile(new File(['a'], 'cells.csv'), 'warehouse')).resolves.toBe('format');
    await expect(readImportFile(new File(['a'], 'cells.XLSX'), 'warehouse')).resolves.toEqual(new Uint8Array([97]));
  });
});

describe('readImportViolation', () => {
  it('converts the zero-based data index to the source line after the header', () => {
    expect(readImportViolation('rows[116].gtin')).toEqual({ fieldPath: 'gtin', rowNumber: 118 });
    expect(readImportViolation('file_name')).toBeUndefined();
  });
});
