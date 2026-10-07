import type { EngineSnapshotValue } from '../ports/index';

export const ENGINE_SCHEMA_VERSION = 2;

export const isCurrentSnapshot = (
  snapshot: EngineSnapshotValue | undefined,
  expectedSeedVersion: number,
): snapshot is EngineSnapshotValue =>
  snapshot?.schemaVersion === ENGINE_SCHEMA_VERSION && snapshot.meta.seedVersion === expectedSeedVersion;
