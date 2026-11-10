import type { Money } from '@skladburg/contracts/common/v1/money';

import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';

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

export const useConfirmTransportOrder = (tripId: string, expectedVersion: number, onSuccess: () => void): CommandValue => {
  const client = useApiClient();

  return useCommand({
    execute: idempotencyKey => client.service(LogisticsService).confirmTransportOrder({ expectedVersion, idempotencyKey, tripId }),
    method: transportMethods.confirmTransportOrder,
    onSuccess,
  });
};
