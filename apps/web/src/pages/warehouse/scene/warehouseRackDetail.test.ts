import {
  expect,
  it,
} from 'vitest';

import type { WarehouseBoxValue } from './warehouseLayout';

import { pickWarehouseRackDetail } from './warehouseRackDetail';

const BOX: WarehouseBoxValue = { position: [0, 0, 0], size: [1, 1, 1] };

const buildLayout = (racks: number): { decks: WarehouseBoxValue[]; frames: WarehouseBoxValue[] } => ({
  decks: Array.from({ length: racks }, () => BOX),
  frames: Array.from({ length: racks * 2 }, () => BOX),
});

it('keeps full parts for a compact warehouse, simplifies larger plans and uses posts for a full import', () => {
  expect(pickWarehouseRackDetail(buildLayout(1), 'low')).toBe('detailed');
  expect(pickWarehouseRackDetail(buildLayout(80), 'low')).toBe('light');
  expect(pickWarehouseRackDetail(buildLayout(80), 'high')).toBe('detailed');
  expect(pickWarehouseRackDetail(buildLayout(10_000), 'high')).toBe('posts');
});
