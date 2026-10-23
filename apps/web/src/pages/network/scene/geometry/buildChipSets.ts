import type { MapSideValue } from '@/entities/network';

import type { NetworkSceneBuildingValue } from '../layout';

import { applyChipAzimuth } from './chipOrientation';
import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeInstanceMatrix,
} from './composeInstanceMatrix';
import {
  CHIP_CENTER_HEIGHT_METERS,
  CHIP_POST_TOP_METERS,
  CHIP_POST_WIDTH_METERS,
  OWN_MARKER_OFFSET_RIGHT_METERS,
  OWN_MARKER_OFFSET_UP_METERS,
  PLAZA_HEIGHT_METERS,
} from './networkSceneMetrics';
import { NETWORK_SIDES } from './networkSides';

export interface ChipMarkersValue {
  count: number;
  matrices: Float32Array;
  sources: readonly ChipSlotValue[];
}

export interface ChipSetsValue {
  markers: ChipMarkersValue;
  postMatrices: Float32Array;
  sets: readonly ChipSetValue[];
}

export interface ChipSetValue {
  count: number;
  matrices: Float32Array;
  side: MapSideValue;
  siteIds: readonly string[];
}

export interface ChipSlotValue {
  index: number;
  setIndex: number;
}

const RIGHT_COLUMN_OFFSET = 0;
const UP_COLUMN_OFFSET = 4;
const POSITION_OFFSET = 12;
const COLUMNS_END_OFFSET = 12;

export const findChipSlot = (sets: readonly ChipSetValue[], siteId: string | undefined): ChipSlotValue | undefined => {
  if (siteId === undefined) {
    return undefined;
  }

  for (const [setIndex, set] of sets.entries()) {
    const index = set.siteIds.indexOf(siteId);

    if (index >= 0) {
      return { index, setIndex };
    }
  }

  return undefined;
};

export const createChipHoverMasks = (sets: readonly ChipSetValue[]): readonly Uint8Array[] => (
  sets.map(set => new Uint8Array(set.count))
);

export const fillChipHoverMasks = (
  masks: readonly Uint8Array[],
  sets: readonly ChipSetValue[],
  hoveredId: string | undefined,
  hoveredSiteIds: readonly string[],
): void => {
  for (const mask of masks) {
    mask.fill(0);
  }

  const hoveredSlot = findChipSlot(sets, hoveredId);

  if (hoveredSlot !== undefined) {
    masks[hoveredSlot.setIndex]?.fill(1, hoveredSlot.index, hoveredSlot.index + 1);
  }

  for (const siteId of hoveredSiteIds) {
    const slot = findChipSlot(sets, siteId);

    if (slot !== undefined) {
      masks[slot.setIndex]?.fill(1, slot.index, slot.index + 1);
    }
  }
};

export const writeChipMarkerMatrices = (markers: ChipMarkersValue, sets: readonly ChipSetValue[]): void => {
  const target = markers.matrices;

  for (let markerIndex = 0; markerIndex < markers.sources.length; markerIndex += 1) {
    const source = markers.sources[markerIndex];
    const chip = source === undefined ? undefined : sets[source.setIndex]?.matrices;

    if (source === undefined || chip === undefined) {
      continue;
    }

    const from = source.index * INSTANCE_MATRIX_ITEM_SIZE;
    const to = markerIndex * INSTANCE_MATRIX_ITEM_SIZE;

    for (let offset = 0; offset < COLUMNS_END_OFFSET; offset += 1) {
      target[to + offset] = chip[from + offset] ?? 0;
    }

    for (let axis = 0; axis < 3; axis += 1) {
      target[to + POSITION_OFFSET + axis] = (chip[from + POSITION_OFFSET + axis] ?? 0)
        + (chip[from + RIGHT_COLUMN_OFFSET + axis] ?? 0) * OWN_MARKER_OFFSET_RIGHT_METERS
        + (chip[from + UP_COLUMN_OFFSET + axis] ?? 0) * OWN_MARKER_OFFSET_UP_METERS;
    }

    target[to + 15] = 1;
  }
};

export const buildChipSets = (buildings: readonly NetworkSceneBuildingValue[]): ChipSetsValue => {
  const companies = buildings.filter(building => building.isCompany && building.side !== undefined);
  const postMatrices = new Float32Array(companies.length * INSTANCE_MATRIX_ITEM_SIZE);
  const markerSources: ChipSlotValue[] = [];

  for (const [index, building] of companies.entries()) {
    writeInstanceMatrix(postMatrices, index, {
      rotationY: 0,
      scale: [CHIP_POST_WIDTH_METERS, CHIP_POST_TOP_METERS - PLAZA_HEIGHT_METERS, CHIP_POST_WIDTH_METERS],
      x: building.x,
      y: PLAZA_HEIGHT_METERS,
      z: building.z,
    });
  }

  const sets = NETWORK_SIDES.map((side, setIndex): ChipSetValue => {
    const sideBuildings = companies.filter(building => building.side === side);
    const matrices = new Float32Array(sideBuildings.length * INSTANCE_MATRIX_ITEM_SIZE);

    for (const [index, building] of sideBuildings.entries()) {
      matrices[index * INSTANCE_MATRIX_ITEM_SIZE + 12] = building.x;
      matrices[index * INSTANCE_MATRIX_ITEM_SIZE + 13] = CHIP_CENTER_HEIGHT_METERS;
      matrices[index * INSTANCE_MATRIX_ITEM_SIZE + 14] = building.z;

      if (building.isOwn) {
        markerSources.push({ index, setIndex });
      }
    }

    applyChipAzimuth(matrices, sideBuildings.length, 0, undefined);

    return {
      count: sideBuildings.length,
      matrices,
      side,
      siteIds: sideBuildings.map(building => building.siteId ?? building.id),
    };
  });

  const markers: ChipMarkersValue = {
    count: markerSources.length,
    matrices: new Float32Array(markerSources.length * INSTANCE_MATRIX_ITEM_SIZE),
    sources: markerSources,
  };

  writeChipMarkerMatrices(markers, sets);

  return { markers, postMatrices, sets };
};
