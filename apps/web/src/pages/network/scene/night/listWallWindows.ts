import type { ModelWindowSourceValue } from '../mix/createModelWindowSources';
import type { WorldModelFitValue } from '../models/fitWorldModelToFootprint';
import type { WorldModelWindowValue } from '../models/listWorldModelWindows';
import type { WorldModelWallWindowsValue } from '../models/worldModelCatalog';
import type { WindowSlotValue } from './wallWindowSlots';

import { getWallSlots } from './wallWindowSlots';

export interface WallWindowOptionsValue {
  isClippedToWallLength: boolean;
  scale: number;
}

const VERTICAL_AXIS = 1;

const clampRise = (slot: WindowSlotValue, wallHeight: number): number => {
  const half = slot.height / 2;

  return Math.max(half, Math.min(slot.rise, wallHeight - half));
};

const scaleSlot = (slot: WindowSlotValue, scale: number): WindowSlotValue => ({
  height: slot.height * scale,
  offset: slot.offset,
  rise: slot.rise,
  width: slot.width * scale,
});

export const listWallWindows = (
  source: ModelWindowSourceValue,
  walls: WorldModelWallWindowsValue,
  fit: WorldModelFitValue,
  { isClippedToWallLength, scale }: WallWindowOptionsValue,
): WorldModelWindowValue[] => {
  const { bounds, group } = source;
  const [scaleX, scaleY, scaleZ] = fit.scale;
  const wallHeight = (bounds.max[VERTICAL_AXIS] - bounds.min[VERTICAL_AXIS]) * scaleY * walls.heightShare;

  return walls.faces.flatMap(({ doorClearance, face, inset }) => {
    const isOnZWall = face === 'positiveZ' || face === 'negativeZ';
    const isPositive = face === 'positiveX' || face === 'positiveZ';
    const outwardAxis = isOnZWall ? 2 : 0;
    const horizontalAxis = isOnZWall ? 0 : 2;
    const horizontalScale = isOnZWall ? scaleX : scaleZ;
    const wallLength = (bounds.max[horizontalAxis] - bounds.min[horizontalAxis]) * horizontalScale;
    const outward = isPositive ? bounds.max[outwardAxis] - inset : bounds.min[outwardAxis] + inset;

    return getWallSlots(group, wallLength, wallHeight)
      .map(slot => scaleSlot(slot, scale))
      .filter(slot => slot.height <= wallHeight)
      .filter(slot => !isClippedToWallLength || Math.abs(slot.offset) + slot.width / 2 <= wallLength / 2)
      .filter(slot => doorClearance === 0 || Math.abs(slot.offset) - slot.width / 2 >= doorClearance * horizontalScale)
      .map((slot): WorldModelWindowValue => {
        const horizontal = slot.offset / horizontalScale;
        const rise = bounds.min[VERTICAL_AXIS] + clampRise(slot, wallHeight) / scaleY;

        return {
          center: isOnZWall ? [horizontal, rise, outward] : [outward, rise, horizontal],
          face,
          height: slot.height / scaleY,
          width: slot.width / horizontalScale,
        };
      });
  });
};
