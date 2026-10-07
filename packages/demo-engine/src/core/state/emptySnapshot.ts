import type { EngineSnapshotValue } from '../ports/index';

import {
  createEmptyCollections,
  createSeededRandom,
} from '../ports/index';
import { ENGINE_SCHEMA_VERSION } from './schemaVersion';

export const createEmptySnapshot = (): EngineSnapshotValue => ({
  collections: createEmptyCollections(),
  meta: {
    channelSeq: {},
    randomState: createSeededRandom(0).getState(),
    seedVersion: 0,
    timeScale: 1,
    traceRandomState: createSeededRandom(1).getState(),
    worldTimeMs: 0,
  },
  schemaVersion: ENGINE_SCHEMA_VERSION,
});
