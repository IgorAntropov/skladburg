import type { WorldModelFaceValue } from './listWorldModelWindows';

export interface WorldModelEntryValue {
  footprint: readonly [number, number];
  group: WorldModelGroupValue;
  id: string;
  kit: WorldModelKitValue;
  lod: WorldModelLodValue;
  sourceName: string;
  walls: undefined | WorldModelWallWindowsValue;
}

export type WorldModelGroupValue = 'house' | 'office' | 'warehouse';

export type WorldModelKitValue = 'commercial' | 'industrial';

export type WorldModelLodValue = 'full' | 'light';

export interface WorldModelWallFaceValue {
  doorClearance: number;
  face: WorldModelFaceValue;
  inset: number;
}

export interface WorldModelWallWindowsValue {
  faces: readonly WorldModelWallFaceValue[];
  heightShare: number;
}

const ALL_FACES: readonly WorldModelFaceValue[] = ['positiveZ', 'positiveX', 'negativeZ', 'negativeX'];

const FLUSH_WALL_FACES: readonly WorldModelWallFaceValue[] = ALL_FACES.map(face => ({ doorClearance: 0, face, inset: 0 }));

const TALL_HOUSE_WALLS: WorldModelWallWindowsValue = { faces: FLUSH_WALL_FACES, heightShare: 0.7 };

const WIDE_HOUSE_WALLS: WorldModelWallWindowsValue = { faces: FLUSH_WALL_FACES, heightShare: 0.9 };

const WAREHOUSE_WALLS: WorldModelWallWindowsValue = {
  faces: [
    { doorClearance: 0, face: 'positiveX', inset: 0.058 },
    { doorClearance: 0.125, face: 'positiveZ', inset: 0.05 },
    { doorClearance: 0.125, face: 'negativeZ', inset: 0.064 },
  ],
  heightShare: 0.43,
};

const createEntry = (
  kit: WorldModelKitValue,
  sourceName: string,
  group: WorldModelGroupValue,
  lod: WorldModelLodValue,
  footprint: readonly [number, number],
  walls?: WorldModelWallWindowsValue,
): WorldModelEntryValue => ({ footprint, group, id: `${kit}/${sourceName}`, kit, lod, sourceName, walls });

export const WORLD_MODEL_CATALOG: readonly WorldModelEntryValue[] = [
  createEntry('commercial', 'building-a', 'house', 'full', [0.88, 0.94]),
  createEntry('commercial', 'building-b', 'house', 'full', [0.97, 0.94]),
  createEntry('commercial', 'building-c', 'house', 'full', [0.88, 1.09]),
  createEntry('commercial', 'building-d', 'house', 'full', [0.84, 0.9]),
  createEntry('commercial', 'building-h', 'house', 'full', [0.88, 1.01]),
  createEntry('commercial', 'low-detail-building-n', 'house', 'light', [0.5, 0.5], TALL_HOUSE_WALLS),
  createEntry('commercial', 'low-detail-building-wide-a', 'house', 'light', [1, 0.5], WIDE_HOUSE_WALLS),
  createEntry('commercial', 'low-detail-building-wide-b', 'house', 'light', [1, 0.5], WIDE_HOUSE_WALLS),
  createEntry('commercial', 'building-f', 'office', 'full', [0.84, 1.03]),
  createEntry('commercial', 'building-g', 'office', 'full', [0.97, 0.92]),
  createEntry('commercial', 'building-i', 'office', 'full', [1.24, 1.3]),
  createEntry('commercial', 'building-k', 'office', 'full', [2.08, 0.94]),
  createEntry('commercial', 'building-l', 'office', 'full', [1.37, 1.4]),
  createEntry('industrial', 'building-k', 'warehouse', 'full', [1.3, 0.91], WAREHOUSE_WALLS),
];

export const COMPANY_WAREHOUSE_MODEL_ID = 'industrial/building-k';

export const buildWorldModelPath = ({ kit, sourceName }: WorldModelEntryValue): string => `models/${kit}/${sourceName}.bin`;
