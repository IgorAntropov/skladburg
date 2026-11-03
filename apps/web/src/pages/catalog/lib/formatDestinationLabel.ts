import type { CatalogPageTranslate } from '../i18n/catalogSection';
import type { DestinationOptionValue } from './destinationOptions';

export const formatDestinationLabel = (t: CatalogPageTranslate, option: DestinationOptionValue): string => (
  option.cityName === ''
    ? option.warehouseName
    : t('catalog.filter.destinationOption', { city: option.cityName, warehouse: option.warehouseName })
);
