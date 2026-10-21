import type { WarehousePlacesValue } from '../model/warehousePlacesTypes';

export const sortWarehousePlaces = (places: WarehousePlacesValue, locale: string): WarehousePlacesValue => {
  const collator = new Intl.Collator(locale);

  return {
    cities: places.cities.toSorted((current, prev) => collator.compare(current.name, prev.name)),
    mapNodes: places.mapNodes,
  };
};
