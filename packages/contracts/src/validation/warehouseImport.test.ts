import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  expect,
  it,
} from 'vitest';

import {
  GetImportTemplateRequestSchema,
  ImportJobSchema,
  PreviewImportRequestSchema,
} from '../gen/import/v1/import_pb';
import {
  AddWarehouseCellsRequestSchema,
  WarehouseTopologyService,
} from '../gen/wms/v1/topology_pb';
import { getMethodAccess } from '../runtime/methodAccess';
import { collectViolations } from './collectViolations';

const warehouseId = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const scope = { templateId: 'opening_stock', warehouseId };

it('preserves old catalog requests and accepts exactly one warehouse template selection', () => {
  const catalog = create(GetImportTemplateRequestSchema, { templateId: 'catalog' });
  expect([...toBinary(GetImportTemplateRequestSchema, catalog)]).toEqual([10, 7, 99, 97, 116, 97, 108, 111, 103]);
  expect(collectViolations(GetImportTemplateRequestSchema, catalog)).toEqual([]);
  expect(collectViolations(GetImportTemplateRequestSchema, create(GetImportTemplateRequestSchema, { warehouseScope: scope }))).toEqual([]);
  const invalid = [{}, { templateId: 'catalog', warehouseScope: scope }];
  for (const input of invalid) {
    expect(collectViolations(GetImportTemplateRequestSchema, create(GetImportTemplateRequestSchema, input)))
      .toContainEqual(expect.objectContaining({ ruleId: 'import.template_scope' }));
  }
});

it('validates template and warehouse together for a preview', () => {
  const base = { fileBytes: Uint8Array.of(1), fileName: 'stock.xlsx', idempotencyKey: warehouseId };
  const preview = create(PreviewImportRequestSchema, { ...base, warehouseScope: scope });
  expect(collectViolations(PreviewImportRequestSchema, preview)).toEqual([]);
  const invalid = create(PreviewImportRequestSchema, { ...base, warehouseScope: { templateId: 'catalog', warehouseId: '' } });
  const failures = collectViolations(PreviewImportRequestSchema, invalid);
  expect(failures.map(violation => violation.fieldPath)).toEqual(expect.arrayContaining([
    'warehouse_scope.warehouse_id', 'warehouse_scope.template_id',
  ]));
  const job = create(ImportJobSchema, { id: warehouseId, warehouseId });
  expect(fromBinary(ImportJobSchema, toBinary(ImportJobSchema, job)).warehouseId).toBe(warehouseId);
});

it('requires an explicit revision for layout edits and accepts revision zero for a new layout', () => {
  const base = {
    cells: [{ cellCode: 'Z01-R01-S01-Y01-C01', rackCode: 'S01', rowCode: 'R01', tierCode: 'Y01', widthMm: 600, zoneCode: 'Z01' }],
    idempotencyKey: warehouseId,
    warehouseId,
  };
  const missing = create(AddWarehouseCellsRequestSchema, base);
  expect(collectViolations(AddWarehouseCellsRequestSchema, missing)).toContainEqual(
    expect.objectContaining({ fieldPath: 'expected_revision' }),
  );
  const initial = create(AddWarehouseCellsRequestSchema, { ...base, expectedRevision: 0 });
  expect(collectViolations(AddWarehouseCellsRequestSchema, initial)).toEqual([]);
  expect(getMethodAccess(WarehouseTopologyService.method.addWarehouseCells)?.requirement).toMatchObject({
    case: 'permission',
    value: { name: 'layout_edit', scopeField: 'warehouse_id' },
  });
});
