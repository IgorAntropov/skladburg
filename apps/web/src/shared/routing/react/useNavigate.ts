import { useCallback } from 'react';

import type { AppAddressValue } from '../address/addressTypes';
import type { NavigateOptionsValue } from '../location/locationTypes';

import { formatAddressPath } from '../address/formatAddressPath';
import { useLocationSource } from './useLocationSource';

export type NavigateFunction = (address: AppAddressValue, options?: NavigateOptionsValue) => void;

export const useNavigate = (): NavigateFunction => {
  const location = useLocationSource();

  return useCallback(
    (address: AppAddressValue, options?: NavigateOptionsValue): void => {
      const path = formatAddressPath(address);

      console.log('> useNavigate -> navigate:', { isReplace: options?.isReplace === true, path });
      location.navigate(path, options);
    },
    [location],
  );
};
