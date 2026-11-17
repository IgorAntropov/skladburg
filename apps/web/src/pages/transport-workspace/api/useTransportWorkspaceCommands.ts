import type { Money } from '@skladburg/contracts/common/v1/money';

import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';
import { TripDocumentsService } from '@skladburg/contracts/logistics/v1/trip_documents';

import type { CommandValue } from '@/shared/api';

import {
  useApiClient,
  useCommand,
} from '@/shared/api';

interface TransportSelectionValue {
  amount: Money;
  expectedVersion: number;
  offerId: string;
  requestId: string;
}

export const transportMethods = LogisticsService.method;
export const tripStepMethods = {
  confirmTransportOrder: LogisticsService.method.confirmTransportOrder,
  submitCarrierTitle: TripDocumentsService.method.submitCarrierTitle,
};

export const useSelectTransportOffer = (
  { amount, expectedVersion, offerId, requestId }: TransportSelectionValue,
  onSuccess: () => void,
): CommandValue => {
  const client = useApiClient();

  return useCommand({
    execute: idempotencyKey => client.service(LogisticsService).selectTransportOffer({
      confirmedAmount: amount,
      expectedVersion,
      idempotencyKey,
      transportOfferId: offerId,
      transportRequestId: requestId,
    }),
    method: transportMethods.selectTransportOffer,
    onSuccess,
  });
};

export const useConfirmTripStep = (
  method: keyof typeof tripStepMethods,
  tripId: string,
  expectedVersion: number,
  onSuccess: () => void,
): CommandValue => {
  const client = useApiClient();

  return useCommand({
    execute: async (idempotencyKey) => {
      const request = { expectedVersion, idempotencyKey, tripId };
      if (method === 'confirmTransportOrder') {
        await client.service(LogisticsService).confirmTransportOrder(request);
      }
      else {
        await client.service(TripDocumentsService).submitCarrierTitle(request);
      }
    },
    method: tripStepMethods[method],
    onSuccess,
  });
};
