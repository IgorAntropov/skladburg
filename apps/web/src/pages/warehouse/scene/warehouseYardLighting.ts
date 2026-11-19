import type { Matrix4 } from 'three';

import type { WarehouseDockPointValue } from './warehouseLayout';
import type { WarehouseParkingPoseValue } from './warehouseYardMotion';
import type { WarehouseYardRoadsValue } from './warehouseYardRoads';
import type { WarehouseYardTrafficValue } from './warehouseYardTraffic';

import { WAREHOUSE_TRUCK_FRONT_Z } from './warehouseTruckDimensions';

export interface WarehouseYardLampValue extends WarehouseDockPointValue {
  hasMast: boolean;
  height: number;
  isEssential: boolean;
  poolX: number;
  poolZ: number;
  radius: number;
}

const MAST_HEIGHT = 2.75;
const MAST_SPACING = 17;
const CAB_LENS_HEIGHT = 0.47;
const CAB_LENS_OFFSET = 0.55;
const CAB_LENS_FRONT_Z = WAREHOUSE_TRUCK_FRONT_Z - 0.025;
const BEAM_DEPTH_OFFSET = WAREHOUSE_TRUCK_FRONT_Z - 0.12;
const BEAM_HEIGHT = 0.057;

export const buildWarehouseYardLamps = (
  primary: WarehouseDockPointValue,
  docks: readonly WarehouseDockPointValue[],
  { apron, entrance, parking, parkingMouthZ }: WarehouseYardRoadsValue,
): WarehouseYardLampValue[] => {
  const sideX = primary.x + apron.minX + 0.18;
  const otherSideX = primary.x + Math.max(0, ...parking.map(spot => spot.x)) + 1.65;
  const entryX = primary.x + entrance.x;
  const entryZ = primary.z + apron.minZ + 1.25;
  const lamps: WarehouseYardLampValue[] = [{
    hasMast: true, height: MAST_HEIGHT, isEssential: true, poolX: entryX - 1.1, poolZ: entryZ + 0.8,
    radius: 4.4, x: sideX, z: entryZ,
  }];
  const sorted = docks.toSorted((current, prev) => current.x - prev.x);
  for (let index = 0; index < sorted.length; index += 2) {
    const dock = sorted[index];
    if (dock === undefined) {
      continue;
    }
    const next = sorted[index + 1] ?? dock;
    const x = (dock.x + next.x) / 2;
    const z = Math.min(dock.z, next.z);
    lamps.push({
      hasMast: false, height: 2.38, isEssential: true, poolX: x, poolZ: z - 3.7,
      radius: Math.max(3.1, Math.min(5.1, 1.6 + (next.x - dock.x) / 2)), x: dock.x, z: dock.z - 0.6,
    });
  }
  const parkingEndZ = primary.z + parkingMouthZ - 3.8;
  for (let z = parkingEndZ; z > entryZ + 6; z -= MAST_SPACING) {
    const isOpposite = lamps.length % 2 === 0;
    const x = isOpposite ? otherSideX : sideX;
    lamps.push({
      hasMast: true, height: MAST_HEIGHT, isEssential: false, poolX: x + (isOpposite ? -2.8 : 3.4), poolZ: z,
      radius: 4.8, x, z,
    });
  }
  return lamps;
};

const isAdvancingInParkingQueue = ({ offsetZ, targetZ }: WarehouseParkingPoseValue): boolean => offsetZ !== targetZ;

export const isWarehouseParkingTruckMoving = (
  truck: WarehouseParkingPoseValue,
  { reservation, yard }: WarehouseYardTrafficValue,
  isCompactYard: boolean,
): boolean => truck === reservation || (isCompactYard && yard.isMoving && isAdvancingInParkingQueue(truck));

export const readWarehouseYardHeadlightBeamOwner = (
  { reservation, yard }: WarehouseYardTrafficValue,
  isCompactYard: boolean,
): WarehouseYardTrafficValue['reservation'] =>
  reservation ?? (isCompactYard && yard.isMoving ? yard.parked.find(isAdvancingInParkingQueue) : undefined);

export const writeWarehouseHeadlightMatrix = (matrix: Matrix4, x: number, z: number, yaw: number, side: -1 | 0 | 1): void => {
  const isLens = side !== 0;
  const lateral = side * CAB_LENS_OFFSET;
  const offsetZ = isLens ? CAB_LENS_FRONT_Z : BEAM_DEPTH_OFFSET;
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  matrix.makeRotationY(yaw).setPosition(
    x + cosine * lateral + sine * offsetZ,
    isLens ? CAB_LENS_HEIGHT : BEAM_HEIGHT,
    z + cosine * offsetZ - sine * lateral,
  );
};
