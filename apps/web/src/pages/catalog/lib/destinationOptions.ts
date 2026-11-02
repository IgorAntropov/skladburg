import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import { compareCodeUnits } from '@skladburg/contracts/runtime';

export interface DestinationOptionValue {
  cityName: string;
  id: string;
  warehouseName: string;
}

const NAME_COLLATOR = new Intl.Collator('ru', { numeric: true });

export const buildDestinationOptions = (
  warehouses: readonly Warehouse[],
  cityNames: ReadonlyMap<string, string>,
): readonly DestinationOptionValue[] => warehouses
  .toSorted((current, prev) => NAME_COLLATOR.compare(current.name, prev.name) || compareCodeUnits(current.id, prev.id))
  .map(warehouse => ({
    cityName: cityNames.get(warehouse.cityId) ?? '',
    id: warehouse.id,
    warehouseName: warehouse.name,
  }));

export const resolveDestination = (
  options: readonly DestinationOptionValue[],
  savedWarehouseId: string | undefined,
): DestinationOptionValue | undefined => options.find(option => option.id === savedWarehouseId) ?? options[0];
