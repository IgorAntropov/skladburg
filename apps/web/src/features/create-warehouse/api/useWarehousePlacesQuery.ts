import type { UseQueryResult } from '@tanstack/react-query';

import { useCallback } from 'react';

import type { NetworkDirectoryValue } from '@/entities/network';

import { useNetworkDirectoryQuery } from '@/entities/network';
import { useI18n } from '@/shared/i18n';

import type { WarehousePlacesValue } from '../model/warehousePlacesTypes';

import { sortWarehousePlaces } from '../lib/sortWarehousePlaces';

export const useWarehousePlacesQuery = (): UseQueryResult<WarehousePlacesValue> => {
  const { locale } = useI18n();

  const select = useCallback(
    (directory: NetworkDirectoryValue): WarehousePlacesValue => sortWarehousePlaces(
      { cities: directory.cities, mapNodes: directory.mapNodes },
      locale,
    ),
    [locale],
  );

  return useNetworkDirectoryQuery(select);
};
