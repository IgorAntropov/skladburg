import type { TripRecord } from '@skladburg/contracts/logistics/v1/trip_records';

import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type { IDomainErrors } from '../../errors/index';
import type { IStateReader } from '../../state/index';

import { isProfileVerified } from '../../visibility/index';

export const readCarrierTrip = (
  errors: IDomainErrors,
  read: IStateReader,
  tripId: string,
  organizationId: string,
): TripRecord => {
  const trip = read.get('trips', tripId);
  const organization = read.get('organizations', organizationId);
  if (trip?.transportOrder?.carrierOrganizationId !== organizationId
    || organization === undefined || !isProfileVerified(organization, ProfileKind.CARRIER)) {
    throw errors.notFound(EntityKind.TRIP);
  }

  return trip;
};
