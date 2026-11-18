import {
  useEffect,
  useMemo,
} from 'react';

import type { WarehouseLayoutPreviewValue } from '../../api/useWarehouseLayoutDrafts';
import type { WarehouseRackPlacementValue } from '../../model/warehouseRackPlacement';
import type {
  WarehouseConstructionChangeValue,
  WarehouseConstructionPreviewValue,
  WarehouseConstructionRackValue,
} from '../../model/warehouseSceneInteraction';

export const useWarehouseConstructionPreview = (
  onPreviewChange: WarehouseConstructionChangeValue,
  drafts: readonly WarehouseLayoutPreviewValue[],
  placement?: WarehouseRackPlacementValue,
  isBlocked = false,
): void => {
  const baseRevision = placement?.expectedRevision;
  const selectedZoneId = placement?.zoneId;
  const depthMm = placement?.footprint.depthMm;
  const widthMm = placement?.footprint.widthMm;
  const xMm = placement?.footprint.origin.xMm;
  const zMm = placement?.footprint.origin.zMm;
  const preview = useMemo((): undefined | WarehouseConstructionPreviewValue => {
    const racks: WarehouseConstructionRackValue[] = drafts.map(({ baseRevision, footprint, zoneId }) => ({
      baseRevision, footprint, isBlocked: false, zoneId,
    }));
    if (baseRevision !== undefined && selectedZoneId !== undefined && depthMm !== undefined
      && widthMm !== undefined && xMm !== undefined && zMm !== undefined) {
      racks.push({ baseRevision, footprint: { depthMm, origin: { xMm, zMm }, widthMm }, isBlocked, zoneId: selectedZoneId });
    }

    return racks.length === 0 ? undefined : { racks, selectedZoneId };
  }, [baseRevision, depthMm, drafts, isBlocked, selectedZoneId, widthMm, xMm, zMm]);

  useEffect(() => {
    onPreviewChange(preview);
  }, [onPreviewChange, preview]);

  useEffect(() => (): void => {
    onPreviewChange(undefined);
  }, [onPreviewChange]);
};
