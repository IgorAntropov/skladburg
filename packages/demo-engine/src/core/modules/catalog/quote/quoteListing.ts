import type {
  OwnDeliveryTerms,
  PriceTier,
} from '@skladburg/contracts/catalog/v1/catalog';

import type {
  CalendarDateValue,
  IBusinessCalendar,
} from '../../../calendar/index';
import type { RouteValue } from '../../network/index';
import type { CityAvailabilityValue } from './cityAvailability';

import { compareIds } from '../../../state/index';
import { computeEtaDate } from './etaDate';
import {
  computeDeliveryPrice,
  computeGoodsTotal,
  resolveTier,
} from './tierPricing';

export interface QuoteListingInputValue {
  calendar: IBusinessCalendar;
  cities: readonly CityAvailabilityValue[];
  ownDelivery: OwnDeliveryTerms | undefined;
  preparationWorkingDays: number;
  priceUnitBaseQuantity: bigint;
  quantity: bigint;
  routes: ReadonlyMap<string, RouteValue>;
  tiers: readonly PriceTier[];
  timeZone: string;
  worldTimeMs: number;
}

export interface QuoteValue {
  deliveryPriceMinor: bigint;
  distanceKm: number;
  etaDate: CalendarDateValue | undefined;
  goodsTotalMinor: bigint;
  isSupplierDelivery: boolean;
  quantity: bigint;
  shipFromCityId: string;
  totalMinor: bigint;
  unitPriceMinor: bigint;
}

const compareAmounts = (current: bigint, prev: bigint): number => {
  if (current === prev) {
    return 0;
  }

  return current < prev ? -1 : 1;
};

const compareQuotes = (current: QuoteValue, prev: QuoteValue): number =>
  compareAmounts(current.totalMinor, prev.totalMinor) || compareIds(current.shipFromCityId, prev.shipFromCityId);

export const quoteListing = (input: QuoteListingInputValue): QuoteValue[] => {
  const unitPriceMinor = resolveTier(input.tiers, input.quantity)?.price?.amountMinor;

  if (unitPriceMinor === undefined) {
    return [];
  }

  const goodsTotalMinor = computeGoodsTotal(input.quantity, unitPriceMinor, input.priceUnitBaseQuantity);
  const quotes: QuoteValue[] = [];

  for (const city of input.cities) {
    const route = input.routes.get(city.mapNodeId);

    if (route === undefined) {
      continue;
    }

    const deliveryPriceMinor = computeDeliveryPrice(input.ownDelivery, route.distanceKm);

    quotes.push({
      deliveryPriceMinor,
      distanceKm: route.distanceKm,
      etaDate: computeEtaDate({
        calendar: input.calendar,
        driveMinutes: route.driveMinutes,
        preparationWorkingDays: input.preparationWorkingDays,
        timeZone: input.timeZone,
        worldTimeMs: input.worldTimeMs,
      }),
      goodsTotalMinor,
      isSupplierDelivery: input.ownDelivery !== undefined,
      quantity: input.quantity,
      shipFromCityId: city.cityId,
      totalMinor: goodsTotalMinor + deliveryPriceMinor,
      unitPriceMinor,
    });
  }

  return quotes.sort(compareQuotes);
};
