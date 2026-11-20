import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import type { WorldPaletteKeyValue } from '@/shared/3d';

import type {
  WarehouseSceneStaffAreaValue,
  WarehouseSceneStaffPersonValue,
} from '../model/warehouseSceneInteraction';
import type {
  WarehouseBoxValue,
  WarehouseFloorValue,
  WarehouseLayoutValue,
} from './warehouseLayout';

import { readWarehouseFloor } from './warehouseRackGeometry';

export interface WarehouseStaffActorValue extends WarehouseSceneStaffPersonValue {
  areaId: string;
  x: number;
  z: number;
}

export interface WarehouseStaffLayoutValue {
  actors: WarehouseStaffActorValue[];
  floor: WarehouseLayoutValue['floor'];
  markers: WarehouseStaffMarkerValue[];
}

export interface WarehouseStaffMarkerValue {
  areaId: string;
  counter: WarehouseSceneStaffAreaValue['counter'];
  overflow: number;
  x: number;
  z: number;
}

const ACTOR_SPACING = 0.72;
const ACTOR_RADIUS = 0.31;
const MAX_GRID_AXIS = 16;

const storageBounds = (zone: WarehouseTopology['storageZones'][number]): undefined | WarehouseFloorValue => {
  const bounds = readWarehouseFloor(zone.bounds);
  if (bounds !== undefined) {
    return bounds;
  }
  let aisle: undefined | WarehouseFloorValue;
  for (const row of zone.rows) {
    for (const rack of row.racks) {
      const floor = readWarehouseFloor(rack.footprint);
      if (floor === undefined) {
        continue;
      }
      const front = floor.z + floor.depth + 0.1;
      if (aisle === undefined || front > aisle.z) {
        aisle = { depth: ACTOR_SPACING, width: floor.width, x: floor.x, z: front };
      }
    }
  }
  return aisle;
};

const centeredIndex = (index: number, length: number): number =>
  Math.floor((length - 1) / 2) + (index % 2 === 0 ? -index / 2 : (index + 1) / 2);

const placeStaff = (
  area: WarehouseSceneStaffAreaValue, bounds: WarehouseFloorValue, layout: WarehouseLayoutValue,
): WarehouseStaffActorValue[] => {
  if (area.staff.length === 0 || Math.min(bounds.depth, bounds.width) < 2 * ACTOR_RADIUS) {
    return [];
  }
  const people = [...area.staff].sort((first, second) => first.staffId.localeCompare(second.staffId));
  const actors: WarehouseStaffActorValue[] = [];
  const columns = Math.max(1, Math.min(MAX_GRID_AXIS, Math.floor(bounds.width / ACTOR_SPACING)));
  const rows = Math.max(1, Math.min(MAX_GRID_AXIS, Math.floor(bounds.depth / ACTOR_SPACING)));
  const obstacles = layout.navigation.obstacles.filter(obstacle =>
    obstacle.maxX > bounds.x - ACTOR_RADIUS && obstacle.minX < bounds.x + bounds.width + ACTOR_RADIUS
    && obstacle.maxZ > bounds.z - ACTOR_RADIUS && obstacle.minZ < bounds.z + bounds.depth + ACTOR_RADIUS);
  for (let row = 0; row < rows && actors.length < people.length; row += 1) {
    const z = bounds.z + bounds.depth * (centeredIndex(row, rows) + 0.5) / rows;
    for (let column = 0; column < columns && actors.length < people.length; column += 1) {
      const x = bounds.x + bounds.width * (centeredIndex(column, columns) + 0.5) / columns;
      const isBlocked = obstacles.some(obstacle =>
        x + ACTOR_RADIUS > obstacle.minX && x - ACTOR_RADIUS < obstacle.maxX
        && z + ACTOR_RADIUS > obstacle.minZ && z - ACTOR_RADIUS < obstacle.maxZ);
      const person = people[actors.length];
      if (!isBlocked && person !== undefined) {
        actors.push({ ...person, areaId: area.areaId, x, z });
      }
    }
  }
  return actors;
};

const VEST_MATERIALS: Readonly<Record<string, undefined | WorldPaletteKeyValue>> = {
  controller: 'plaza',
  forklift_operator: 'buildingRoofAlt',
  picker: 'road',
  shift_lead: 'warehouseWall',
  storekeeper: 'warehouseRoof',
};

const addActorParts = (batches: Map<WorldPaletteKeyValue, WarehouseBoxValue[]>, actor: WarehouseStaffActorValue): void => {
  const add = (
    key: WorldPaletteKeyValue, dx: number, y: number, dz: number, width: number, height: number, depth: number,
  ): void => {
    const box: WarehouseBoxValue = { position: [actor.x + dx, y, actor.z + dz], size: [width, height, depth] };
    const group = batches.get(key);
    if (group === undefined) {
      batches.set(key, [box]);
    }
    else {
      group.push(box);
    }
  };
  const vest = VEST_MATERIALS[actor.avatarKey] ?? 'buildingRoofAlt';
  for (const side of [-1, 1]) {
    add('road', side * 0.104, 0.33, 0, 0.17, 0.64, 0.23);
    add('warehouseRoof', side * 0.25, 0.86, 0, 0.105, 0.41, 0.16);
  }
  add(vest, 0, 0.89, 0, 0.4, 0.5, 0.26);
  add('sand', 0, 0.83, 0, 0.41, 0.048, 0.27);
  add('sand', 0, 1.26, 0, 0.25, 0.25, 0.24);
  add('buildingRoofAlt', 0, 1.40, 0.005, 0.33, 0.055, 0.32);
  add('buildingRoofAlt', 0, 1.46, 0, 0.275, 0.1, 0.25);
};

export const buildWarehouseStaffLayout = (
  areas: readonly WarehouseSceneStaffAreaValue[], topology: WarehouseTopology, layout: WarehouseLayoutValue,
): WarehouseStaffLayoutValue => {
  const bounds = new Map<string, undefined | WarehouseFloorValue>();
  if (layout.receiving !== undefined) {
    bounds.set(layout.receiving.id, layout.receiving);
  }
  for (const zone of topology.storageZones) {
    bounds.set(zone.id, storageBounds(zone));
  }
  const actors: WarehouseStaffActorValue[] = [];
  const markers: WarehouseStaffMarkerValue[] = [];
  for (const area of areas) {
    const floor = bounds.get(area.areaId);
    if (floor === undefined) {
      continue;
    }
    const placed = placeStaff(area, floor, layout);
    actors.push(...placed);
    const overflow = area.staff.length - placed.length;
    if (area.counter !== undefined || overflow > 0) {
      markers.push({ areaId: area.areaId, counter: area.counter, overflow, x: floor.x + floor.width / 2, z: floor.z + floor.depth / 2 });
    }
  }
  if (actors.length === 0) {
    return { actors, floor: layout.floor, markers };
  }
  const parts = new Map<WorldPaletteKeyValue, WarehouseBoxValue[]>();
  for (const actor of actors) {
    addActorParts(parts, actor);
  }
  const floor = new Map(layout.floor);
  for (const [key, boxes] of parts) {
    floor.set(key, [...layout.floor.get(key) ?? [], ...boxes]);
  }
  return { actors, floor, markers };
};
