import type { MessageInitShape } from '@bufbuild/protobuf';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import {
  WarehouseStorageZoneSchema,
  WarehouseTopologySchema,
} from '@skladburg/contracts/wms/v1/topology';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createWarehouseRackPlacement } from './warehouseRackPlacement';

const footprint = (xMm: number, zMm: number, widthMm: number, depthMm: number): {
  depthMm: number;
  origin: { xMm: number; zMm: number };
  widthMm: number;
} => ({ depthMm, origin: { xMm, zMm }, widthMm });

const defaultZone = {
  code: 'Z01',
  id: 'zone-1',
  rows: [{
    code: 'R01',
    id: 'row-1',
    racks: [{ code: 'S01', footprint: footprint(2_400, 1_000, 1_200, 1_000) }],
  }],
} satisfies MessageInitShape<typeof WarehouseStorageZoneSchema>;

const makeTopology = (overrides?: MessageInitShape<typeof WarehouseTopologySchema>): WarehouseTopology =>
  create(WarehouseTopologySchema, {
    revision: 5,
    storageZones: [defaultZone],
    warehouseId: 'warehouse-1',
    ...overrides,
  });

describe('createWarehouseRackPlacement', () => {
  it('uses the same four addresses and geometry for preview and saving', () => {
    const result = createWarehouseRackPlacement(makeTopology(), 'row-1');

    expect(result).toMatchObject({
      cells: [
        { cellCode: 'Z01-R01-S02-Y01-C01', tierCode: 'Y01', tierElevationMm: 0, widthMm: 600, xOffsetMm: 0 },
        { cellCode: 'Z01-R01-S02-Y01-C02', tierCode: 'Y01', tierElevationMm: 0, widthMm: 600, xOffsetMm: 600 },
        { cellCode: 'Z01-R01-S02-Y02-C01', tierCode: 'Y02', tierElevationMm: 1_500, widthMm: 600, xOffsetMm: 0 },
        { cellCode: 'Z01-R01-S02-Y02-C02', tierCode: 'Y02', tierElevationMm: 1_500, widthMm: 600, xOffsetMm: 600 },
      ],
      expectedRevision: 5,
      footprint: footprint(4_100, 1_000, 1_200, 1_000),
      rackCode: 'S02',
      rowId: 'row-1',
      warehouseId: 'warehouse-1',
      zoneId: 'zone-1',
    });
    expect(result?.cells.map(({ rackCode, rackFootprint }) => ({ rackCode, rackFootprint }))).toEqual(
      Array.from({ length: 4 }, () => ({ rackCode: 'S02', rackFootprint: footprint(4_100, 1_000, 1_200, 1_000) })),
    );
  });

  it('advances past receiving and racks in the same depth band and stops before a distant rack', () => {
    const topology = makeTopology({
      receivingArea: { footprint: footprint(4_000, 1_200, 1_050, 900) },
      storageZones: [
        defaultZone,
        {
          code: 'Z02',
          id: 'zone-2',
          rows: [{
            code: 'R02',
            id: 'row-2',
            racks: [
              { code: 'S01', footprint: footprint(6_050, 900, 1_200, 1_000) },
              { code: 'S02', footprint: footprint(7_000, 2_000, 1_200, 1_000) },
              { code: 'S03', footprint: footprint(12_000, 1_000, 1_200, 1_000) },
            ],
          }],
        },
      ],
    });

    expect(createWarehouseRackPlacement(topology, 'row-1')?.footprint.origin).toEqual({ xMm: 7_800, zMm: 1_000 });
  });

  it('bases the suggestion on the rightmost rack and aligns imported coordinates to 100 millimetres', () => {
    const topology = makeTopology({
      storageZones: [{
        ...defaultZone,
        rows: [{
          code: 'R01',
          id: 'row-1',
          racks: [
            { code: 'S01', footprint: footprint(3_525, 1_042, 1_250, 950) },
            { code: 'S02', footprint: footprint(1_000, 2_000, 1_200, 1_000) },
          ],
        }],
      }],
    });

    expect(createWarehouseRackPlacement(topology, 'row-1')?.footprint.origin).toEqual({ xMm: 5_300, zMm: 1_000 });
  });

  it('keeps imported row and zone codes in the command and chooses legal unique addresses', () => {
    const topology = makeTopology({
      storageZones: [
        {
          code: '  Мороз  ',
          id: 'zone-1',
          rows: [{
            code: '  Дальний  ',
            id: 'row-1',
            racks: [{ code: ' S01 ', footprint: footprint(0, 1_000, 1_200, 1_000) }],
          }],
        },
        {
          code: 'Z02',
          rows: [{
            code: 'R02',
            racks: [{ code: 'S90', tiers: [{ cells: [{ code: 'Z-R-S02-Y02-C02' }] }] }],
          }],
        },
      ],
    });

    expect(createWarehouseRackPlacement(topology, 'row-1')).toMatchObject({
      cells: [
        { cellCode: 'Z-R-S03-Y01-C01', rowCode: 'Дальний', zoneCode: 'Мороз' },
        { cellCode: 'Z-R-S03-Y01-C02', rowCode: 'Дальний', zoneCode: 'Мороз' },
        { cellCode: 'Z-R-S03-Y02-C01', rowCode: 'Дальний', zoneCode: 'Мороз' },
        { cellCode: 'Z-R-S03-Y02-C02', rowCode: 'Дальний', zoneCode: 'Мороз' },
      ],
      rackCode: 'S03',
    });
  });

  it('fits long zone and row names in the address field with no dangling separators', () => {
    const topology = makeTopology({
      storageZones: [{
        code: 'a'.repeat(20) + '-retail-area',
        id: 'zone-1',
        rows: [{ code: 'b '.repeat(16).trim(), id: 'row-1' }],
      }],
    });
    const cells = createWarehouseRackPlacement(topology, 'row-1')?.cells;

    expect(cells).toHaveLength(4);
    expect(cells?.every(({ cellCode }) => cellCode.length <= 64 && /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/u.test(cellCode))).toBe(true);
  });

  it('places a first rack into an existing empty row using the remaining floor geometry', () => {
    const topology = makeTopology({
      receivingArea: { footprint: footprint(0, 0, 1_245, 1_000) },
      storageZones: [{ code: 'Z01', id: 'zone-1', rows: [{ code: 'R01', id: 'row-1' }] }],
    });

    expect(createWarehouseRackPlacement(topology, 'row-1')?.footprint.origin).toEqual({ xMm: 1_800, zMm: 0 });
  });

  it('does not produce cells for an absent row or when the next footprint exceeds the coordinate range', () => {
    const topology = makeTopology({
      storageZones: [{
        ...defaultZone,
        rows: [{ code: 'R01', id: 'row-1', racks: [{ code: 'S01', footprint: footprint(4_294_966_000, 0, 1_200, 1_000) }] }],
      }],
    });

    expect(createWarehouseRackPlacement(topology, 'missing')).toBeUndefined();
    expect(createWarehouseRackPlacement(topology, 'row-1')).toBeUndefined();
  });
});
