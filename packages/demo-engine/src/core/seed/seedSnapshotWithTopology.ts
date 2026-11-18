import type { EngineSnapshotValue } from '../ports/index';
import type { EngineSeedValue } from './seedConfig';

import { addWarehouseTopologies } from '../engine/migrateWarehouseTopologies';
import { SeedLoadError } from '../engine/SeedLoadError';

export const createSeedSnapshotWithTopology = async (seed: EngineSeedValue | undefined): Promise<EngineSnapshotValue> => {
  const { createSeedSnapshot } = await import('./seedSnapshot').catch((error: unknown) => {
    throw new SeedLoadError(error);
  });

  return addWarehouseTopologies(createSeedSnapshot(seed));
};
