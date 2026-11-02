import type { CityAvailability } from '@skladburg/contracts/catalog/v1/showcase';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';

import { AVAILABILITY_RANK } from './availabilityRank';

export const pickBestAvailability = (items: readonly CityAvailability[]): AvailabilityStatus | undefined => {
  let best = AvailabilityStatus.UNSPECIFIED;

  for (const { status } of items) {
    if (AVAILABILITY_RANK[status] > AVAILABILITY_RANK[best]) {
      best = status;
    }
  }

  return best === AvailabilityStatus.UNSPECIFIED ? undefined : best;
};
