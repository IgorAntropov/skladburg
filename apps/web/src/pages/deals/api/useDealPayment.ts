import type { Money } from '@skladburg/contracts/common/v1/money';
import type {
  GetDealPaymentResponse,
  SafeDealPayment,
} from '@skladburg/contracts/payment/v1/payment';
import type { UseQueryResult } from '@tanstack/react-query';

import { create } from '@bufbuild/protobuf';
import {
  GetDealPaymentResponseSchema,
  PaymentService,
} from '@skladburg/contracts/payment/v1/payment';
import {
  skipToken,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { CommandValue } from '@/shared/api';

import {
  getOrganizationScope,
  isReadAccessDenied,
  useActingContext,
  useApiClient,
  useCommand,
} from '@/shared/api';

import { useDealConflictRefresh } from './commands/useDealConflictRefresh';
import { createDealQueryMeta } from './dealQueryScope';

const paymentKey = (organizationId: string | undefined, userId: string | undefined, dealId: string): readonly string[] =>
  ['deal', 'payment', getOrganizationScope(organizationId), userId ?? '', dealId];

export const fundDealMethod = PaymentService.method.fundDeal;

export const getDealPaymentMethod = PaymentService.method.getDealPayment;

export const useDealPayment = (dealId: string, isEnabled: boolean): UseQueryResult<GetDealPaymentResponse> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();

  return useQuery({
    meta: createDealQueryMeta(isEnabled ? organizationId : undefined, dealId),
    queryFn: isEnabled && organizationId !== undefined && userId !== undefined
      ? ({ signal }) => client.service(PaymentService).getDealPayment({ dealId }, { signal })
      : skipToken,
    queryKey: paymentKey(organizationId, userId, dealId),
  });
};

interface FundDealOptionsValue {
  amount: Money;
  onFunded: () => void;
  onRefresh: () => void;
  payment: SafeDealPayment;
}

export const useFundDeal = ({ amount, onFunded, onRefresh, payment }: FundDealOptionsValue): CommandValue => {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { organizationId, userId } = useActingContext();
  const queryKey = paymentKey(organizationId, userId, payment.dealId);

  const command = useCommand({
    execute: idempotencyKey => client.service(PaymentService).fundDeal({
      amount,
      dealId: payment.dealId,
      expectedVersion: payment.version,
      idempotencyKey,
    }),
    method: fundDealMethod,
    onSuccess: ({ payment: updated }) => {
      onFunded();
      const current = queryClient.getQueryState(queryKey);
      if (updated !== undefined && current !== undefined && !isReadAccessDenied(current.error)) {
        queryClient.setQueryData<GetDealPaymentResponse>(queryKey, prev =>
          (prev?.payment?.version ?? 0) > updated.version
            ? prev
            : create(GetDealPaymentResponseSchema, { payment: updated }));
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  useDealConflictRefresh(command, onRefresh);
  return command;
};
