import type { WarehouseImportScope } from '@skladburg/contracts/import/v1/import';

export type ImportTargetValue
  = | { kind: 'catalog' }
    | { kind: 'warehouse'; templateId: WarehouseImportTemplateId; warehouseId: string };

export type WarehouseImportTemplateId = 'opening_stock' | 'warehouse_cells';

export const getImportWarehouseScope = (target: ImportTargetValue): Pick<WarehouseImportScope, 'templateId' | 'warehouseId'> | undefined =>
  target.kind === 'warehouse' ? { templateId: target.templateId, warehouseId: target.warehouseId } : undefined;

export const getImportTemplateSelection = (target: ImportTargetValue): {
  templateId?: string | undefined;
  warehouseScope?: ReturnType<typeof getImportWarehouseScope>;
} => target.kind === 'catalog' ? { templateId: 'catalog' } : { warehouseScope: getImportWarehouseScope(target) };
