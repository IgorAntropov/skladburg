import type { LocationSnapshotValue } from '@/shared/routing';

export const removeSearchParam = (snapshot: LocationSnapshotValue, name: string): string => {
  const remaining = new URLSearchParams(snapshot.searchParams);

  remaining.delete(name);

  const query = remaining.toString();

  return query === '' ? snapshot.path : `${snapshot.path}?${query}`;
};
