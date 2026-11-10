import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { transportRequestAudience } from './transportAudience';
import { publishTransportChanges } from './transportEvents';
import { advanceTrip } from './tripMachine';

export const cancelTransportRequest = (runtime: IModuleRuntime, transaction: IStateTransaction, dealId: string): void => {
  const request = transaction.listBy('transportRequests', 'dealId', dealId).find(
    current => current.status === TransportRequestStatus.OPEN || current.status === TransportRequestStatus.SELECTED,
  );
  if (request === undefined) {
    return;
  }

  const audience = transportRequestAudience(transaction, request);
  transaction.put('transportRequests', { ...request, status: TransportRequestStatus.CANCELLED, version: request.version + 1 });
  const trip = transaction.get('trips', request.id);
  if (trip !== undefined) {
    advanceTrip(runtime, transaction, trip, 'cancel');
  }
  publishTransportChanges(runtime, transaction, audience);
};
