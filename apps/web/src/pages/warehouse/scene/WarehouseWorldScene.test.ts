import { create } from '@bufbuild/protobuf';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import {
  expect,
  it,
  vi,
} from 'vitest';

import { prepare } from './WarehouseWorldScene';

const racks = vi.hoisted(() => {
  let complete: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  return { loaded: vi.fn(), pending, release: (): void => complete?.() };
});

vi.mock('./WarehouseRacks', async () => {
  racks.loaded();
  await racks.pending;
  return { default: (): null => null };
});

it('prepares an empty floor independently and awaits one rack module for all stocked layouts', async () => {
  await prepare({ parkingCapacity: 0, topology: create(WarehouseTopologySchema) });
  expect(racks.loaded).not.toHaveBeenCalled();
  const topology = create(WarehouseTopologySchema, {
    storageZones: [{ rows: [{ racks: [{ footprint: { depthMm: 1_000, origin: {}, widthMm: 2_000 } }] }] }],
  });
  const isReady = vi.fn();
  const requests = Promise.all([
    prepare({ parkingCapacity: 0, topology }), prepare({ parkingCapacity: 3, topology }),
  ]).then(isReady);
  await vi.waitFor(() => {
    expect(racks.loaded).toHaveBeenCalledOnce();
  });
  expect(isReady).not.toHaveBeenCalled();
  racks.release();
  await requests;
  await prepare({ parkingCapacity: 6, topology });
  expect(racks.loaded).toHaveBeenCalledOnce();
  expect(isReady).toHaveBeenCalledOnce();
});
