import type {
  DeliveryQuote,
  ShowcaseListing,
} from '@skladburg/contracts/catalog/v1/showcase';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';

import { formatIsoCalendarDate } from '@/shared/lib/calendar-date';

import type { OrderDraftFormValue } from '../../api/order/orderDraftValues';

import { parseOrderDate } from '../../api/order/orderDraftValues';

interface OrderCityOptionValue {
  name: string;
  quote: DeliveryQuote;
}

export const getOrderCityOptions = (
  listing: ShowcaseListing,
  cityNames: ReadonlyMap<string, string>,
): readonly OrderCityOptionValue[] => {
  const availableCities = new Set(listing.cityAvailability
    .filter(city => city.status === AvailabilityStatus.ON_ORDER
      || ((city.status === AvailabilityStatus.IN_STOCK || city.status === AvailabilityStatus.LOW) && city.quantity > 0n))
    .map(city => city.cityId));

  return listing.quotes.flatMap((quote) => {
    const name = cityNames.get(quote.shipFromCityId);

    return name !== undefined && availableCities.has(quote.shipFromCityId) && quote.total !== undefined
      ? [{ name, quote }]
      : [];
  });
};

export const getOrderDefaults = (
  listing: ShowcaseListing,
  cityNames: ReadonlyMap<string, string>,
  warehouseId: string,
): OrderDraftFormValue => {
  const quote = getOrderCityOptions(listing, cityNames)[0]?.quote;
  const quantity = quote !== undefined && quote.quantity > 0n ? quote.quantity : listing.minOrderQuantity;
  const date = quote?.etaDate === undefined ? '' : formatIsoCalendarDate(quote.etaDate);

  return {
    desiredDate: parseOrderDate(date) === undefined ? '' : date,
    quantity: quantity.toString(),
    shipFromCityId: quote?.shipFromCityId ?? '',
    shipToWarehouseId: warehouseId,
  };
};
