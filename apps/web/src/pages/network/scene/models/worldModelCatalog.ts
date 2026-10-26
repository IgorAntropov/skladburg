export interface WorldModelEntryValue {
  farWalls: WorldModelWallWindowsValue;
  footprint: readonly [number, number];
  group: WorldModelGroupValue;
  id: string;
  kit: WorldModelKitValue;
  lod: WorldModelLodValue;
  sourceName: string;
  walls: undefined | WorldModelWallWindowsValue;
}

export type WorldModelFaceValue = 'negativeX' | 'negativeZ' | 'positiveX' | 'positiveZ';

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

const FACES_WITHOUT_NEGATIVE_Z: readonly WorldModelFaceValue[] = ['positiveZ', 'positiveX', 'negativeX'];

const createFlushFaces = (faces: readonly WorldModelFaceValue[]): readonly WorldModelWallFaceValue[] =>
  faces.map((face): WorldModelWallFaceValue => ({ doorClearance: 0, face, inset: 0 }));

const createFarWalls = (heightShare: number, faces: readonly WorldModelFaceValue[]): WorldModelWallWindowsValue => ({
  faces: createFlushFaces(faces),
  heightShare,
});

const FLUSH_WALL_FACES = createFlushFaces(ALL_FACES);

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

const WAREHOUSE_FAR_WALLS: WorldModelWallWindowsValue = {
  faces: WAREHOUSE_WALLS.faces.map(({ doorClearance, face }): WorldModelWallFaceValue => ({ doorClearance, face, inset: 0 })),
  heightShare: WAREHOUSE_WALLS.heightShare,
};

const createGlassEntry = (
  kit: WorldModelKitValue,
  sourceName: string,
  group: WorldModelGroupValue,
  footprint: readonly [number, number],
  farWalls: WorldModelWallWindowsValue,
): WorldModelEntryValue => ({ farWalls, footprint, group, id: `${kit}/${sourceName}`, kit, lod: 'full', sourceName, walls: undefined });

const createWalledEntry = (
  kit: WorldModelKitValue,
  sourceName: string,
  group: WorldModelGroupValue,
  lod: WorldModelLodValue,
  footprint: readonly [number, number],
  walls: WorldModelWallWindowsValue,
  farWalls: WorldModelWallWindowsValue,
): WorldModelEntryValue => ({ farWalls, footprint, group, id: `${kit}/${sourceName}`, kit, lod, sourceName, walls });

const COMMERCIAL_A_FAR_WALLS = createFarWalls(0.951, FACES_WITHOUT_NEGATIVE_Z);

const COMMERCIAL_B_FAR_WALLS = createFarWalls(0.951, FACES_WITHOUT_NEGATIVE_Z);

const COMMERCIAL_C_FAR_WALLS = createFarWalls(0.929, FACES_WITHOUT_NEGATIVE_Z);

const COMMERCIAL_D_FAR_WALLS = createFarWalls(0.642, ALL_FACES);

const COMMERCIAL_H_FAR_WALLS = createFarWalls(0.951, ALL_FACES);

const COMMERCIAL_F_FAR_WALLS = createFarWalls(0.963, ALL_FACES);

const COMMERCIAL_G_FAR_WALLS = createFarWalls(0.963, ALL_FACES);

const COMMERCIAL_I_FAR_WALLS = createFarWalls(0.97, ALL_FACES);

const COMMERCIAL_K_FAR_WALLS = createFarWalls(0.837, ALL_FACES);

const COMMERCIAL_L_FAR_WALLS = createFarWalls(0.894, FACES_WITHOUT_NEGATIVE_Z);

export const WORLD_MODEL_CATALOG: readonly WorldModelEntryValue[] = [
  createGlassEntry('commercial', 'building-a', 'house', [0.88, 0.94], COMMERCIAL_A_FAR_WALLS),
  createGlassEntry('commercial', 'building-b', 'house', [0.97, 0.94], COMMERCIAL_B_FAR_WALLS),
  createGlassEntry('commercial', 'building-c', 'house', [0.88, 1.09], COMMERCIAL_C_FAR_WALLS),
  createGlassEntry('commercial', 'building-d', 'house', [0.84, 0.9], COMMERCIAL_D_FAR_WALLS),
  createGlassEntry('commercial', 'building-h', 'house', [0.88, 1.01], COMMERCIAL_H_FAR_WALLS),
  createWalledEntry('commercial', 'low-detail-building-n', 'house', 'light', [0.5, 0.5], TALL_HOUSE_WALLS, TALL_HOUSE_WALLS),
  createWalledEntry('commercial', 'low-detail-building-wide-a', 'house', 'light', [1, 0.5], WIDE_HOUSE_WALLS, WIDE_HOUSE_WALLS),
  createWalledEntry('commercial', 'low-detail-building-wide-b', 'house', 'light', [1, 0.5], WIDE_HOUSE_WALLS, WIDE_HOUSE_WALLS),
  createGlassEntry('commercial', 'building-f', 'office', [0.84, 1.03], COMMERCIAL_F_FAR_WALLS),
  createGlassEntry('commercial', 'building-g', 'office', [0.97, 0.92], COMMERCIAL_G_FAR_WALLS),
  createGlassEntry('commercial', 'building-i', 'office', [1.24, 1.3], COMMERCIAL_I_FAR_WALLS),
  createGlassEntry('commercial', 'building-k', 'office', [2.08, 0.94], COMMERCIAL_K_FAR_WALLS),
  createGlassEntry('commercial', 'building-l', 'office', [1.37, 1.4], COMMERCIAL_L_FAR_WALLS),
  createWalledEntry('industrial', 'building-k', 'warehouse', 'full', [1.3, 0.91], WAREHOUSE_WALLS, WAREHOUSE_FAR_WALLS),
];

export const COMPANY_WAREHOUSE_MODEL_ID = 'industrial/building-k';

export const buildWorldModelPath = ({ kit, sourceName }: WorldModelEntryValue): string => `models/${kit}/${sourceName}.bin`;
