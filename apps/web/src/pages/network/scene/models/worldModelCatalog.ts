export interface WorldModelEntryValue {
  group: WorldModelGroupValue;
  id: string;
  kit: WorldModelKitValue;
  lod: WorldModelLodValue;
  sourceName: string;
}

export type WorldModelGroupValue = 'house' | 'office' | 'warehouse';

export type WorldModelKitValue = 'commercial' | 'industrial';

export type WorldModelLodValue = 'full' | 'light';

const createEntry = (
  kit: WorldModelKitValue,
  sourceName: string,
  group: WorldModelGroupValue,
  lod: WorldModelLodValue,
): WorldModelEntryValue => ({ group, id: `${kit}/${sourceName}`, kit, lod, sourceName });

export const WORLD_MODEL_CATALOG: readonly WorldModelEntryValue[] = [
  createEntry('commercial', 'building-a', 'house', 'full'),
  createEntry('commercial', 'building-b', 'house', 'full'),
  createEntry('commercial', 'building-c', 'house', 'full'),
  createEntry('commercial', 'building-d', 'house', 'full'),
  createEntry('commercial', 'building-h', 'house', 'full'),
  createEntry('commercial', 'low-detail-building-n', 'house', 'light'),
  createEntry('commercial', 'low-detail-building-wide-a', 'house', 'light'),
  createEntry('commercial', 'low-detail-building-wide-b', 'house', 'light'),
  createEntry('commercial', 'building-f', 'office', 'full'),
  createEntry('commercial', 'building-g', 'office', 'full'),
  createEntry('commercial', 'building-i', 'office', 'full'),
  createEntry('commercial', 'building-k', 'office', 'full'),
  createEntry('commercial', 'building-l', 'office', 'full'),
  createEntry('industrial', 'building-k', 'warehouse', 'full'),
];

export const COMPANY_WAREHOUSE_MODEL_ID = 'industrial/building-k';

export const buildWorldModelPath = ({ kit, sourceName }: WorldModelEntryValue): string => `models/${kit}/${sourceName}.bin`;
