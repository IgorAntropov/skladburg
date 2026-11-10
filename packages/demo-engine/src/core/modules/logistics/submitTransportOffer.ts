import type { HandlerContext } from '@connectrpc/connect';
import type { Money } from '@skladburg/contracts/common/v1/money';
import type {
  SubmitTransportOfferRequest,
  SubmitTransportOfferResponse,
} from '@skladburg/contracts/logistics/v1/logistics';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  LogisticsService,
  SubmitTransportOfferResponseSchema,
} from '@skladburg/contracts/logistics/v1/logistics';
import {
  TransportOfferSchema,
  TransportRequestStatus,
} from '@skladburg/contracts/logistics/v1/logistics_records';

import type { IDomainErrors } from '../../errors/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { SUPPORTED_CURRENCY_CODE } from '../catalog/catalogRules';
import { publishTransportChanges } from './transportEvents';
import { canCarryTransportRequest } from './transportMatching';
import { readOwnTransportOffer } from './transportOfferRecords';

const requirePositiveAmount = (errors: IDomainErrors, amount: Money | undefined): Money => {
  if (amount === undefined) {
    throw errors.internal();
  }
  if (amount.amountMinor <= 0n) {
    throw errors.validationFailed([{ fieldPath: 'amount.amount_minor', ruleId: 'int64.gt' }]);
  }
  if (amount.currencyCode !== SUPPORTED_CURRENCY_CODE) {
    throw errors.validationFailed([{ fieldPath: 'amount.currency_code', ruleId: 'money.currency_unsupported' }]);
  }
  return amount;
};

export const submitTransportOffer = (
  runtime: IModuleRuntime,
  request: SubmitTransportOfferRequest,
  context: HandlerContext,
): Promise<SubmitTransportOfferResponse> => runtime.command((transaction) => {
  const { errors, getWorldTimeMs, guard, idempotency } = runtime;
  const method = LogisticsService.method.submitTransportOffer;
  const { organizationId } = guard.guardPermissionCall(transaction, method, request, context.requestHeader);

  return idempotency.run(transaction, {
    handler: () => {
      const record = transaction.get('transportRequests', request.transportRequestId);
      const now = getWorldTimeMs();
      if (record?.status !== TransportRequestStatus.OPEN || !canCarryTransportRequest(transaction, record, organizationId, now)) {
        throw errors.notFound(EntityKind.TRANSPORT_REQUEST);
      }
      if (readOwnTransportOffer(transaction, record.id, organizationId) !== undefined) {
        throw errors.validationFailed([{ fieldPath: 'transport_request_id', ruleId: 'logistics.offer_exists' }]);
      }

      const offer = create(TransportOfferSchema, {
        amount: requirePositiveAmount(errors, request.amount),
        carrierOrganizationId: organizationId,
        id: runtime.random.uuid(),
        submittedAt: timestampFromMs(now),
        transportRequestId: record.id,
      });
      transaction.put('transportOffers', offer);
      publishTransportChanges(runtime, transaction, [organizationId, record.shipperOrganizationId]);

      return create(SubmitTransportOfferResponseSchema, { offer });
    },
    idempotencyKey: request.idempotencyKey,
    method,
    request,
    scope: organizationId,
  });
});
