import { useCallback } from 'react';

import { useLocationSource } from './useLocationSource';

export const useReloadPage = (): () => void => {
  const locationSource = useLocationSource();

  return useCallback((): void => {
    console.log('> useReloadPage -> reload:', {});
    locationSource.reload();
  }, [locationSource]);
};
