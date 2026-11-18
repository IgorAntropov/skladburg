import {
  cleanup,
  renderHook,
} from '@testing-library/react';
import {
  afterEach,
  expect,
  it,
  vi,
} from 'vitest';

import type { WarehouseLayoutPreviewValue } from '../../api/useWarehouseLayoutDrafts';
import type { WarehouseRackPlacementValue } from '../../model/warehouseRackPlacement';
import type { WarehouseConstructionChangeValue } from '../../model/warehouseSceneInteraction';

import { useWarehouseConstructionPreview } from './useWarehouseConstructionPreview';

const FOOTPRINT = { depthMm: 1_000, origin: { xMm: 500, zMm: 300 }, widthMm: 2_400 };
const DRAFTS = [
  { baseRevision: 2, expiresAtMs: 100, footprint: FOOTPRINT, rowId: 'row-1', zoneId: 'zone-1' },
] satisfies readonly WarehouseLayoutPreviewValue[];
const PLACEMENT = {
  cells: [], expectedRevision: 2, footprint: FOOTPRINT, rackCode: 'S01', rowId: 'row-2', warehouseId: 'warehouse-1', zoneId: 'zone-2',
} satisfies WarehouseRackPlacementValue;

afterEach(cleanup);

it('publishes local and remote footprints and clears the preview on unmount', () => {
  const onChange = vi.fn<WarehouseConstructionChangeValue>();
  const { unmount } = renderHook(() => {
    useWarehouseConstructionPreview(onChange, DRAFTS, PLACEMENT, true);
  });

  expect(onChange).toHaveBeenLastCalledWith({
    racks: [
      { baseRevision: 2, footprint: FOOTPRINT, isBlocked: false, zoneId: 'zone-1' },
      { baseRevision: 2, footprint: FOOTPRINT, isBlocked: true, zoneId: 'zone-2' },
    ],
    selectedZoneId: 'zone-2',
  });

  unmount();
  expect(onChange).toHaveBeenLastCalledWith(undefined);
});

it('publishes a local placement again only when the rendered position changes', () => {
  const onChange = vi.fn<WarehouseConstructionChangeValue>();
  const { rerender } = renderHook(
    ({ xMm }) => {
      useWarehouseConstructionPreview(onChange, DRAFTS, {
        ...PLACEMENT, footprint: { ...FOOTPRINT, origin: { ...FOOTPRINT.origin, xMm } },
      });
    },
    { initialProps: { xMm: 500 } },
  );

  rerender({ xMm: 500 });
  expect(onChange).toHaveBeenCalledTimes(1);

  rerender({ xMm: 600 });
  expect(onChange).toHaveBeenCalledTimes(2);
  expect(onChange.mock.lastCall?.[0]?.racks[1]?.footprint.origin.xMm).toBe(600);
});
