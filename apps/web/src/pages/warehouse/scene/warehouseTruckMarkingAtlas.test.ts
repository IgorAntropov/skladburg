import { InstancedBufferAttribute } from 'three';
import {
  expect,
  it,
} from 'vitest';

import type { WarehouseYardVehicleMarkingVisualValue } from '../model/warehouseYardVehicleMarkingVisual';

import { createWarehouseTruckMarkingLayout } from './warehouseTruckMarkingAtlas';
import { paintWarehouseTruckMarkingCell } from './warehouseTruckMarkingCell';

const WITHOUT_NUMBER: WarehouseYardVehicleMarkingVisualValue = {
  accent: 'ochre', brandName: 'Маяк', logoPath: undefined, registrationNumber: undefined,
};
const WITH_NUMBER: WarehouseYardVehicleMarkingVisualValue = {
  accent: undefined, brandName: undefined, logoPath: undefined, registrationNumber: 'А001АА 000',
};

it('leaves the unknown cell empty and keys the other cells by the authorized visit', () => {
  const markings = new Map([['first', WITHOUT_NUMBER], ['second', WITH_NUMBER]]);
  const layout = createWarehouseTruckMarkingLayout(markings);
  expect([...layout.cells]).toEqual([['first', 1], ['second', 2]]);
  expect(layout.columns).toBe(2);
  expect(layout.rows).toBe(2);
});

it('keeps the prioritized visits in a single texture within the atlas budget', () => {
  const markings = new Map(Array.from({ length: 140 }, (_, index) => [String(index), WITH_NUMBER]));
  const layout = createWarehouseTruckMarkingLayout(markings);
  expect(layout).toMatchObject({ columns: 8, rows: 16 });
  expect(layout.cells.get('126')).toBe(127);
  expect(layout.cells.has('127')).toBe(false);
});

it('retains markings for a departing actor when older visits fill the atlas', () => {
  const markings = new Map(Array.from({ length: 140 }, (_, index) => [String(index), WITH_NUMBER]));
  const layout = createWarehouseTruckMarkingLayout(markings, ['139', '138', 'never authorized', '139']);
  expect(layout.cells.get('139')).toBe(1);
  expect(layout.cells.get('138')).toBe(2);
  expect(layout.cells.has('126')).toBe(false);
  expect(layout.cells.has('never authorized')).toBe(false);
});

it('clears the previously painted cell when an instance changes visits or permission', () => {
  const color = new InstancedBufferAttribute(new Float32Array(6), 3);
  paintWarehouseTruckMarkingCell(color, new Map([['assigned', 3]]), 'assigned', 1);
  expect(color.getX(1)).toBe(3);
  expect(color.version).toBe(1);
  paintWarehouseTruckMarkingCell(color, new Map([['assigned', 3]]), 'assigned', 1);
  expect(color.version).toBe(1);
  paintWarehouseTruckMarkingCell(color, new Map([['assigned', 3]]), 'unassigned', 1);
  expect(color.getX(1)).toBe(0);
  expect(color.version).toBe(2);
  paintWarehouseTruckMarkingCell(color, new Map([['assigned', 4]]), 'assigned', 1);
  paintWarehouseTruckMarkingCell(color, undefined, 'assigned', 1);
  expect(color.getX(1)).toBe(0);
});
