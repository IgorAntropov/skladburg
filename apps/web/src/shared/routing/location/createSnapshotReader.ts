import type { LocationSnapshotValue } from './locationTypes';

import { splitPathAndQuery } from '../address/splitPathAndQuery';

interface CachedSnapshotValue {
  focusRequest: number;
  raw: string;
  snapshot: LocationSnapshotValue;
}

export const createSnapshotReader = (): (raw: string, focusRequest: number) => LocationSnapshotValue => {
  let cached: CachedSnapshotValue | undefined;

  return (raw: string, focusRequest: number): LocationSnapshotValue => {
    if (cached?.raw === raw && cached.focusRequest === focusRequest) {
      return cached.snapshot;
    }

    const { path, query } = splitPathAndQuery(raw);
    const snapshot: LocationSnapshotValue = {
      focusRequest,
      path: path === '' ? '/' : path,
      searchParams: new URLSearchParams(query),
    };

    cached = { focusRequest, raw, snapshot };

    return snapshot;
  };
};
