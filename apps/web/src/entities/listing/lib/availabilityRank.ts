import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';

export const AVAILABILITY_RANK: Readonly<Record<AvailabilityStatus, number>> = {
  [AvailabilityStatus.IN_STOCK]: 3,
  [AvailabilityStatus.LOW]: 2,
  [AvailabilityStatus.ON_ORDER]: 1,
  [AvailabilityStatus.UNSPECIFIED]: 0,
};
