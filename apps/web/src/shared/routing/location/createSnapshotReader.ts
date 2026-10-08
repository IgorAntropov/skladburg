import type { LocationSnapshotValue } from './locationTypes';

import { splitPathAndQuery } from '../address/splitPathAndQuery';

interface CachedSnapshotValue {
  raw: string;
  snapshot: LocationSnapshotValue;
}

export const createSnapshotReader = (): (raw: string) => LocationSnapshotValue => {
  let cached: CachedSnapshotValue | undefined;

  return (raw: string): LocationSnapshotValue => {
    if (cached?.raw === raw) {
      return cached.snapshot;
    }

    const { path, query } = splitPathAndQuery(raw);
    const snapshot: LocationSnapshotValue = {
      path: path === '' ? '/' : path,
      searchParams: new URLSearchParams(query),
    };

    cached = { raw, snapshot };

    return snapshot;
  };
};
