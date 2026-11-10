import { createCatalogSection } from '@/shared/i18n';

const networkTripsCatalog = {
  'networkTrips.arrived': 'Прибыл',
  'networkTrips.delivery': 'Выгрузка',
  'networkTrips.loading': 'Груз загружен',
  'networkTrips.moving': 'В пути',
  'networkTrips.pickup': 'Погрузка',
  'networkTrips.route': '{from} → {to}',
} as const;

export const networkTripsSection = createCatalogSection<typeof networkTripsCatalog>({
  loaders: { ru: () => Promise.resolve(networkTripsCatalog) },
  prefix: 'networkTrips',
});
