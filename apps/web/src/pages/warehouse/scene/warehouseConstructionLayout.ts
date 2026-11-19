import type {
  WarehouseStorageZone,
  WarehouseTopology,
} from '@skladburg/contracts/wms/v1/topology';

import type { WarehouseConstructionPreviewValue } from '../model/warehouseSceneInteraction';
import type {
  WarehouseBoxValue,
  WarehouseFloorValue,
} from './warehouseLayout';

import { WAREHOUSE_RACK_TIER_ELEVATIONS_MM } from '../model/warehouseRackTemplate';
import {
  buildWarehouseRackDeck,
  buildWarehouseRackFrame,
  buildWarehouseRackPosts,
  getWarehouseRackFrameWidth,
  readWarehouseFloor,
  WAREHOUSE_MM_PER_METER,
  WAREHOUSE_RACK_HEADROOM,
  WAREHOUSE_RACK_MIN_HEIGHT,
} from './warehouseRackGeometry';

interface WarehouseConstructionLayoutValue {
  blocked: WarehouseBoxValue[];
  previews: WarehouseBoxValue[];
  zones: readonly WarehouseBoxValue[];
}

interface WarehouseZoneMarkersValue {
  boxes: readonly WarehouseBoxValue[];
  zoneIds: ReadonlySet<string>;
}

const storageZoneMarkers = new WeakMap<WarehouseStorageZone, WarehouseBoxValue[]>();
const zoneMarkers = new WeakMap<WarehouseTopology, WarehouseZoneMarkersValue>();
const MARKER_LINE = 0.045;
const MARKER_PADDING = 0.09;
const MARKER_ELEVATION = 0.028;

const buildOutline = (
  [x, y, z]: WarehouseBoxValue['position'],
  width: number,
  depth: number,
  thickness: number,
): WarehouseBoxValue[] => [
  { position: [x, y, z - (depth - thickness) / 2], size: [width, thickness, thickness] },
  { position: [x, y, z + (depth - thickness) / 2], size: [width, thickness, thickness] },
  { position: [x - (width - thickness) / 2, y, z], size: [thickness, thickness, depth - 2 * thickness] },
  { position: [x + (width - thickness) / 2, y, z], size: [thickness, thickness, depth - 2 * thickness] },
];

const buildRackCorners = ({ depth, width, x, z }: WarehouseFloorValue): WarehouseBoxValue[] => {
  const boxes: WarehouseBoxValue[] = [];
  const xCorners: readonly [number, number][] = [[x - MARKER_PADDING, 1], [x + width + MARKER_PADDING, -1]];
  const zCorners: readonly [number, number][] = [[z - MARKER_PADDING, 1], [z + depth + MARKER_PADDING, -1]];
  const length = Math.min(0.26, (width + 2 * MARKER_PADDING) / 3, (depth + 2 * MARKER_PADDING) / 3);
  for (const [cornerX, directionX] of xCorners) {
    for (const [cornerZ, directionZ] of zCorners) {
      boxes.push(
        { position: [cornerX + directionX * length / 2, MARKER_ELEVATION, cornerZ], size: [length, 0.018, MARKER_LINE] },
        { position: [cornerX, MARKER_ELEVATION, cornerZ + directionZ * length / 2], size: [MARKER_LINE, 0.018, length] },
      );
    }
  }
  return boxes;
};

const getStorageZoneMarkers = (zone: WarehouseStorageZone): readonly WarehouseBoxValue[] => {
  const current = storageZoneMarkers.get(zone);
  if (current !== undefined) {
    return current;
  }

  const bounds = readWarehouseFloor(zone.bounds);
  const boxes = bounds === undefined
    ? []
    : buildOutline([bounds.x + bounds.width / 2, MARKER_ELEVATION, bounds.z + bounds.depth / 2], bounds.width, bounds.depth, MARKER_LINE);
  for (const { racks } of zone.rows) {
    for (const { footprint } of racks) {
      const rect = readWarehouseFloor(footprint);
      if (rect !== undefined) {
        boxes.push(...buildRackCorners(rect));
      }
    }
  }
  storageZoneMarkers.set(zone, boxes);
  return boxes;
};

const getZoneMarkers = (topology: WarehouseTopology, zoneIds: ReadonlySet<string>): readonly WarehouseBoxValue[] => {
  const current = zoneMarkers.get(topology);
  if (current?.zoneIds.size === zoneIds.size && [...zoneIds].every(id => current.zoneIds.has(id))) {
    return current.boxes;
  }

  const boxes = topology.storageZones.flatMap(zone => zoneIds.has(zone.id) ? getStorageZoneMarkers(zone) : []);
  zoneMarkers.set(topology, { boxes, zoneIds });
  return boxes;
};

const buildRackPreview = ({ depth, width, x, z }: WarehouseFloorValue): WarehouseBoxValue[] => {
  const elevations = WAREHOUSE_RACK_TIER_ELEVATIONS_MM.map(elevationMm => elevationMm / WAREHOUSE_MM_PER_METER);
  const height = Math.max(WAREHOUSE_RACK_MIN_HEIGHT, Math.max(...elevations) + WAREHOUSE_RACK_HEADROOM);
  const frameWidth = getWarehouseRackFrameWidth(width);
  const centerX = x + width / 2;
  const centerZ = z + depth / 2;
  const frames = [x, x + width].map(sideX => buildWarehouseRackFrame(sideX, centerZ, frameWidth, depth, height));
  const thickness = Math.min(0.045, width / 4, depth / 4);
  return [
    ...buildWarehouseRackPosts(frames),
    ...elevations.flatMap((elevation) => {
      const { position } = buildWarehouseRackDeck(centerX, centerZ, width, depth, elevation);

      return buildOutline(position, width, depth, thickness);
    }),
  ];
};

export const buildWarehouseConstruction = (
  topology: WarehouseTopology,
  { racks, selectedZoneId }: WarehouseConstructionPreviewValue,
): WarehouseConstructionLayoutValue => {
  const blocked: WarehouseBoxValue[] = [];
  const previews: WarehouseBoxValue[] = [];
  const zones = new Set(selectedZoneId === undefined ? [] : [selectedZoneId]);
  const knownZones = new Set(topology.storageZones.map(({ id }) => id));

  for (const { baseRevision, footprint, isBlocked, zoneId } of racks) {
    if (baseRevision !== topology.revision || !knownZones.has(zoneId)) {
      continue;
    }

    const rect = readWarehouseFloor(footprint);
    if (rect === undefined) {
      continue;
    }
    zones.add(zoneId);

    if (isBlocked) {
      const { depth, width, x, z } = rect;
      blocked.push(...buildOutline(
        [x + width / 2, 0.065, z + depth / 2],
        width + 2 * MARKER_PADDING,
        depth + 2 * MARKER_PADDING,
        0.09,
      ));
    }
    else {
      previews.push(...buildRackPreview(rect));
    }
  }

  return {
    blocked,
    previews,
    zones: getZoneMarkers(topology, zones),
  };
};
