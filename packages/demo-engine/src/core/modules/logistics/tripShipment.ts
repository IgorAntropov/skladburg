import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { create } from '@bufbuild/protobuf';
import { CarrierTitleSubmissionSchema } from '@skladburg/contracts/logistics/v1/trip_records';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { publishTripChanges } from './transportEvents';
import { buildTripAssignment } from './tripAssignment';
import { requireDealTrip } from './tripLifecycle';
import {
  advanceTrip,
  requireTripTransition,
} from './tripMachine';

export const markTripShipped = (runtime: IModuleRuntime, transaction: IStateTransaction, deal: Deal): void => {
  const trip = requireDealTrip(runtime, transaction, deal.id);
  requireTripTransition(runtime.errors, 'load', trip, undefined);
  if (trip.assignment === undefined) {
    throw runtime.errors.internal();
  }
  trip.assignment = buildTripAssignment(runtime.errors, transaction, trip, trip.assignment);
  if (transaction.get('warehouseInbound', deal.id) !== undefined) {
    trip.carrierTitle = create(CarrierTitleSubmissionSchema);
  }
  advanceTrip(runtime, transaction, trip, 'load');
  publishTripChanges(runtime, transaction, trip);
};
