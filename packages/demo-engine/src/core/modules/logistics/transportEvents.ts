import type { TripRecord } from '@skladburg/contracts/logistics/v1/trip_records';

import { create } from '@bufbuild/protobuf';
import { TransportRequestChangedSchema } from '@skladburg/contracts/logistics/v1/logistics_events';
import { organizationChannel } from '@skladburg/contracts/runtime';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

export const publishTransportChanges = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  organizationIds: Iterable<string>,
): void => {
  for (const organizationId of new Set(organizationIds)) {
    runtime.outbox.add(transaction, organizationChannel(organizationId), {
      case: 'transportRequestChanged',
      value: create(TransportRequestChangedSchema),
    });
  }
};

export const publishTripChanges = (runtime: IModuleRuntime, transaction: IStateTransaction, trip: TripRecord): void => {
  const organizations = [trip.customerOrganizationId, trip.supplierOrganizationId];
  const carrier = trip.transportOrder?.carrierOrganizationId;
  if (carrier !== undefined) {
    organizations.push(carrier);
  }
  publishTransportChanges(runtime, transaction, organizations);
};
