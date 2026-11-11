import type {
  ImportRow,
  ImportTemplate,
} from '@skladburg/contracts/import/v1/import';
import type { WarehouseCellInput } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import {
  ImportRowErrorSchema,
  ImportRowSchema,
} from '@skladburg/contracts/import/v1/import';
import { WarehouseCellInputSchema } from '@skladburg/contracts/wms/v1/topology';

import type { WarehouseXlsxCellValue } from './xlsxReader';

export interface WarehouseCellImportRowValue {
  cell: WarehouseCellInput;
  row: ImportRow;
}

const MAX_UINT32 = 4_294_967_295;
const UNSIGNED_INTEGER = /^[0-9]+$/u;
const TEXT_FIELDS = new Set(['batch_number', 'cell_code', 'rack_code', 'row_code', 'sku', 'sscc', 'tier_code', 'zone_code']);
const RACK_COLUMNS = ['rack_x_mm', 'rack_z_mm', 'rack_width_mm', 'rack_depth_mm'] as const;

export const addWarehouseRowError = (row: ImportRow, columns: readonly string[], fieldPath: string, ruleId: string): void => {
  const column = fieldPath === 'rack_footprint' ? 'rack_width_mm' : fieldPath;
  const columnNumber = columns.indexOf(column) + 1;
  if (!row.errors.some(error => error.fieldPath === fieldPath && error.ruleId === ruleId)) {
    row.errors.push(create(ImportRowErrorSchema, { columnNumber, fieldPath, rowNumber: row.rowNumber, ruleId }));
  }
};

export const mapWarehouseRows = (
  table: readonly (readonly WarehouseXlsxCellValue[])[],
  columns: readonly string[],
  template: ImportTemplate,
): ImportRow[] => {
  const required = new Set(template.columns.filter(column => column.isRequired).map(column => column.key));
  return table.slice(1).flatMap((source, index) => {
    const values = source.map((cell, columnIndex) => columns[columnIndex] === 'sku' ? cell.text : cell.text.trim());
    if (values.every(value => value.trim() === '') && !source.some(cell => cell.kind === 'error')) {
      return [];
    }

    const row = create(ImportRowSchema, { rowNumber: index + 2, values });
    columns.forEach((column, columnIndex) => {
      const cell = source[columnIndex];
      const value = values[columnIndex] ?? '';
      const hasValue = value.trim() !== '';
      if (cell?.kind === 'error') {
        addWarehouseRowError(row, columns, column, 'import.excel_cell_error');
      }
      else if (!hasValue && required.has(column)) {
        addWarehouseRowError(row, columns, column, 'import.required');
      }
      else if ((hasValue && cell?.kind !== 'text' && TEXT_FIELDS.has(column))
        || (cell?.kind === 'number' && column === 'quantity_base' && (!UNSIGNED_INTEGER.test(value) || value.length > 15))) {
        addWarehouseRowError(row, columns, column, 'import.excel_text_required');
      }
    });
    for (let columnIndex = columns.length; columnIndex < values.length; columnIndex += 1) {
      if (values[columnIndex] !== '' || source[columnIndex]?.kind === 'error') {
        row.errors.push(create(ImportRowErrorSchema, {
          columnNumber: columnIndex + 1, fieldPath: 'rows', rowNumber: row.rowNumber, ruleId: 'import.extra_column',
        }));
      }
    }
    return [row];
  });
};

export const readWarehouseRowValue = (row: ImportRow, columns: readonly string[], key: string): string =>
  row.values[columns.indexOf(key)] ?? '';

const readMillimeters = (row: ImportRow, columns: readonly string[], key: string): number | undefined => {
  const value = readWarehouseRowValue(row, columns, key);
  if (value === '') {
    return undefined;
  }

  const number = Number(value);
  if (!UNSIGNED_INTEGER.test(value) || !Number.isInteger(number) || number > MAX_UINT32) {
    addWarehouseRowError(row, columns, key, 'import.integer');
    return undefined;
  }
  return number;
};

export const mapWarehouseCellRows = (
  rows: readonly ImportRow[],
  columns: readonly string[],
): WarehouseCellImportRowValue[] => rows.flatMap((row) => {
  const hasFootprint = RACK_COLUMNS.some(key => readWarehouseRowValue(row, columns, key) !== '');
  const [xMm, zMm, widthMm, depthMm] = RACK_COLUMNS.map(key => readMillimeters(row, columns, key));
  if (hasFootprint) {
    RACK_COLUMNS.forEach((key) => {
      if (readWarehouseRowValue(row, columns, key) === '') {
        addWarehouseRowError(row, columns, key, 'import.required');
      }
    });
  }

  const cell = create(WarehouseCellInputSchema, {
    cellCode: readWarehouseRowValue(row, columns, 'cell_code'),
    rackCode: readWarehouseRowValue(row, columns, 'rack_code'),
    rackFootprint: hasFootprint ? { depthMm, origin: { xMm, zMm }, widthMm } : undefined,
    rowCode: readWarehouseRowValue(row, columns, 'row_code'),
    tierCode: readWarehouseRowValue(row, columns, 'tier_code'),
    tierElevationMm: readMillimeters(row, columns, 'tier_elevation_mm'),
    widthMm: readMillimeters(row, columns, 'width_mm'),
    xOffsetMm: readMillimeters(row, columns, 'x_offset_mm'),
    zoneCode: readWarehouseRowValue(row, columns, 'zone_code'),
  });
  return row.errors.length === 0 ? [{ cell, row }] : [];
});
