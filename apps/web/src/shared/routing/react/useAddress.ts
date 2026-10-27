import {
  useMemo,
  useSyncExternalStore,
} from 'react';

import type { AppAddressValue } from '../address/addressTypes';

import { parseAddressPath } from '../address/parseAddressPath';
import { useLocationSource } from './useLocationSource';

export interface CurrentAddressValue {
  address: AppAddressValue | undefined;
  focusRequest: number;
  path: string;
  searchParams: URLSearchParams;
}

export const useAddress = (): CurrentAddressValue => {
  const location = useLocationSource();
  const snapshot = useSyncExternalStore(location.subscribe, location.read);

  return useMemo(
    (): CurrentAddressValue => ({
      address: parseAddressPath(snapshot.path),
      focusRequest: snapshot.focusRequest,
      path: snapshot.path,
      searchParams: snapshot.searchParams,
    }),
    [snapshot],
  );
};
