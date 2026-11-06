import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import { useWarehousesQuery } from '@/entities/warehouse';

export interface DealWarehouseOptionsValue {
  data: readonly Warehouse[] | undefined;
  error: Error | null;
  isFetching: boolean;
  retry: () => void;
}

export const useDealWarehouseOptions = (cityId: string | undefined): DealWarehouseOptionsValue => {
  const { data, error, isFetching, refetch } = useWarehousesQuery();
  const warehouses = cityId === undefined ? data : data?.filter(warehouse => warehouse.cityId === cityId);

  const retry = (): void => {
    void refetch();
  };

  return { data: warehouses, error, isFetching, retry };
};
