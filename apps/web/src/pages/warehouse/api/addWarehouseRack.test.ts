import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  OpenWarehouseLayoutSessionResponseSchema,
  ReleaseWarehouseLayoutSessionResponseSchema,
} from '@skladburg/contracts/wms/v1/layout_session';
import { AddWarehouseCellsResponseSchema } from '@skladburg/contracts/wms/v1/topology';
import {
  expect,
  it,
  vi,
} from 'vitest';

import type { WarehouseRackPlacementValue } from '../model/warehouseRackPlacement';

import { addWarehouseRack } from './addWarehouseRack';

const footprint = { depthMm: 1_000, origin: { xMm: 5_700, zMm: 1_000 }, widthMm: 1_200 };
const draft: WarehouseRackPlacementValue = {
  cells: [{ cellCode: 'Z01-R01-S02-Y01-C01', rackCode: 'S02', rackFootprint: footprint, rowCode: 'R01', tierCode: 'Y01',
    tierElevationMm: 0, widthMm: 600, xOffsetMm: 0, zoneCode: 'Z01' }],
  expectedRevision: 1,
  footprint,
  rackCode: 'S02',
  rowId: 'row',
  warehouseId: 'warehouse',
  zoneId: 'zone',
};

const release = { idempotencyKey: 'attempt', layoutSessionId: 'session', warehouseId: 'warehouse', zoneId: 'zone' };

it('saves the displayed draft under the zone session and releases it', async () => {
  const layout = {
    openWarehouseLayoutSession: vi.fn().mockResolvedValue(create(OpenWarehouseLayoutSessionResponseSchema, { layoutSessionId: 'session' })),
    releaseWarehouseLayoutSession: vi.fn().mockResolvedValue(create(ReleaseWarehouseLayoutSessionResponseSchema)),
  };
  const topology = { addWarehouseCells: vi.fn().mockResolvedValue(create(AddWarehouseCellsResponseSchema, { revision: 2 })) };

  await expect(addWarehouseRack(draft, 'attempt', layout, topology)).resolves.toEqual({ draft, revision: 2 });
  expect(layout.openWarehouseLayoutSession).toHaveBeenCalledWith({ idempotencyKey: 'attempt', warehouseId: 'warehouse', zoneId: 'zone' });
  expect(topology.addWarehouseCells).toHaveBeenCalledWith({
    cells: draft.cells, expectedRevision: 1, idempotencyKey: 'attempt', layoutSessionId: 'session', warehouseId: 'warehouse',
  });
  expect(layout.releaseWarehouseLayoutSession).toHaveBeenCalledWith(release);
});

it('retains the session on a retryable save failure and repeats the exact request', async () => {
  const layout = {
    openWarehouseLayoutSession: vi.fn().mockResolvedValue(create(OpenWarehouseLayoutSessionResponseSchema, { layoutSessionId: 'session' })),
    releaseWarehouseLayoutSession: vi.fn().mockResolvedValue(create(ReleaseWarehouseLayoutSessionResponseSchema)),
  };
  const topology = { addWarehouseCells: vi.fn()
    .mockRejectedValueOnce(new ConnectError('lost reply', Code.Unavailable))
    .mockResolvedValueOnce(create(AddWarehouseCellsResponseSchema, { revision: 2 })) };

  await expect(addWarehouseRack(draft, 'attempt', layout, topology)).rejects.toThrow('lost reply');
  expect(layout.releaseWarehouseLayoutSession).not.toHaveBeenCalled();
  await expect(addWarehouseRack(draft, 'attempt', layout, topology)).resolves.toEqual({ draft, revision: 2 });
  expect(topology.addWarehouseCells.mock.calls).toHaveLength(2);
  expect(topology.addWarehouseCells.mock.calls[1]).toEqual(topology.addWarehouseCells.mock.calls[0]);
  expect(layout.releaseWarehouseLayoutSession).toHaveBeenCalledExactlyOnceWith(release);
});

it('releases the zone on a domain refusal and preserves the original error', async () => {
  const layout = {
    openWarehouseLayoutSession: vi.fn().mockResolvedValue(create(OpenWarehouseLayoutSessionResponseSchema, { layoutSessionId: 'session' })),
    releaseWarehouseLayoutSession: vi.fn().mockRejectedValue(new Error('release failed')),
  };
  const error = new ConnectError('draft rejected', Code.Aborted, undefined, [
    { desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code: ErrorCode.VERSION_CONFLICT }) },
  ]);
  const topology = { addWarehouseCells: vi.fn().mockRejectedValue(error) };

  await expect(addWarehouseRack(draft, 'attempt', layout, topology)).rejects.toBe(error);
  expect(layout.releaseWarehouseLayoutSession).toHaveBeenCalledWith(release);
});
