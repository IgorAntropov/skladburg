import type { ImportTemplate } from '@skladburg/contracts/import/v1/import';

import { create } from '@bufbuild/protobuf';
import { ImportTemplateSchema } from '@skladburg/contracts/import/v1/import';

export const WAREHOUSE_CELLS_TEMPLATE_ID = 'warehouse_cells';
export const OPENING_STOCK_TEMPLATE_ID = 'opening_stock';

const CELL_COLUMNS = [
  ['zone_code', 'Зона', true],
  ['row_code', 'Ряд', true],
  ['rack_code', 'Стеллаж', true],
  ['rack_x_mm', 'Координата X мм', false],
  ['rack_z_mm', 'Координата Z мм', false],
  ['rack_width_mm', 'Ширина стеллажа мм', false],
  ['rack_depth_mm', 'Глубина стеллажа мм', false],
  ['tier_code', 'Ярус', true],
  ['tier_elevation_mm', 'Высота яруса мм', false],
  ['cell_code', 'Ячейка', true],
  ['x_offset_mm', 'Смещение ячейки мм', true],
  ['width_mm', 'Ширина ячейки мм', true],
] as const;

const STOCK_COLUMNS = [
  ['cell_code', 'Ячейка', true],
  ['sku', 'Артикул', true],
  ['batch_number', 'Партия', true],
  ['expires_on', 'Годен до', false],
  ['sscc', 'SSCC', true],
  ['kind', 'Вид упаковки', true],
  ['status', 'Статус остатка', true],
  ['quantity_base', 'Количество', true],
] as const;

const createTemplate = (id: string, columns: readonly (readonly [string, string, boolean])[]): ImportTemplate =>
  create(ImportTemplateSchema, {
    columns: columns.map(([key, label, isRequired]) => ({
      aliases: [label], fieldPath: key, isRequired, key, titleKey: `import.column.${key}`,
    })),
    id,
  });

export const CELLS_IMPORT_TEMPLATE = createTemplate(WAREHOUSE_CELLS_TEMPLATE_ID, CELL_COLUMNS);
export const STOCK_IMPORT_TEMPLATE = createTemplate(OPENING_STOCK_TEMPLATE_ID, STOCK_COLUMNS);
