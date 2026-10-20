import type { UseQueryResult } from '@tanstack/react-query';

import { useQuery } from '@tanstack/react-query';
import {
  useCallback,
  useMemo,
} from 'react';

import { useApiClient } from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import type { WarehousePlacesValue } from '../model/warehousePlacesTypes';

import { sortWarehousePlaces } from '../lib/sortWarehousePlaces';
import { createWarehousePlacesQueryOptions } from './warehousePlacesQueryOptions';

export const useWarehousePlacesQuery = (): UseQueryResult<WarehousePlacesValue> => {
  const client = useApiClient();
  const { locale } = useI18n();

  const options = useMemo(() => createWarehousePlacesQueryOptions(client), [client]);
  const select = useCallback((places: WarehousePlacesValue): WarehousePlacesValue => sortWarehousePlaces(places, locale), [locale]);

  return useQuery({ ...options, select });
};
