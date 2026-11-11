import type { EngineSnapshotValue } from '../ports/index';
import type { EngineSeedValue } from './seedConfig';

import { SeedLoadError } from '../engine/SeedLoadError';

export const createSeedSnapshotWithTopology = async (seed: EngineSeedValue | undefined): Promise<EngineSnapshotValue> => {
  const [{ createSeedSnapshot }, { addWarehouseTopologies }] = await Promise.all([
    import('./seedSnapshot'),
    import('../engine/migrateWarehouseTopologies'),
  ]).catch((error: unknown) => {
    throw new SeedLoadError(error);
  });

  return addWarehouseTopologies(createSeedSnapshot(seed));
};
