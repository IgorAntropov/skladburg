import type { Money } from '@skladburg/contracts/common/v1/money';

import { create } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  LogisticsService,
  SubmitTransportOfferRequestSchema,
} from '@skladburg/contracts/logistics/v1/logistics';
import {
  ACTING_ORGANIZATION_HEADER,
  getMethodAccess,
} from '@skladburg/contracts/runtime';

import type { IStateReader } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { resolveEffectivePermissions } from '../../access/index';
import { DEMO_USER_HEADER } from '../../protocol';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../../seed/seedIds';
import { compareIds } from '../../state/index';
import { submitTransportOfferInTransaction } from '../logistics/submitTransportOffer';
import { canCarryTransportRequest } from '../logistics/transportMatching';
import { readOwnTransportOffer } from '../logistics/transportOfferRecords';
import { isCarrierBotRequestDue } from './requestDue';

interface CarrierBotValue {
  organizationId: string;
  userId: string;
}

const CARRIER_BOTS: readonly CarrierBotValue[] = [
  { organizationId: SeedOrganizationId.CARRIER_1, userId: SeedUserId.ADMIN_4 },
  { organizationId: SeedOrganizationId.CARRIER_2, userId: SeedUserId.ADMIN_8 },
];

const UNAUTHORIZED_ERRORS = new Set([
  ErrorCode.LIMIT_EXCEEDED,
  ErrorCode.MEMBERSHIP_REQUIRED,
  ErrorCode.PERMISSION_DENIED,
  ErrorCode.SESSION_REQUIRED,
]);

const canSubmitOffer = (read: IStateReader, { organizationId, userId }: CarrierBotValue, permissionName: string): boolean => {
  const membership = read.listBy('memberships', 'userId', userId).find(candidate => candidate.organizationId === organizationId);
  return membership !== undefined && read.get('users', userId) !== undefined
    && resolveEffectivePermissions(read, membership).some(permission =>
      permission.isOrganizationWide && permission.permission === permissionName);
};

const readOfferAmount = (
  read: IStateReader,
  requestId: string,
  organizationId: string,
  nowMs: number,
): Money | undefined => {
  const request = read.get('transportRequests', requestId);
  if (request === undefined || !isCarrierBotRequestDue(request, nowMs)
    || readOwnTransportOffer(read, requestId, organizationId) !== undefined) {
    return undefined;
  }

  const amount = read.listBy('carrierLanes', 'tenantId', organizationId).find(lane =>
    lane.isActive && lane.fromCityId === request.fromCityId && lane.toCityId === request.toCityId)?.tariff;
  return amount !== undefined && amount.amountMinor > 0n && canCarryTransportRequest(read, request, organizationId, nowMs)
    ? amount
    : undefined;
};

const respondToRequest = async (
  runtime: IModuleRuntime,
  requestId: string,
  bot: CarrierBotValue,
  permissionName: string,
): Promise<void> => {
  const { organizationId, userId } = bot;
  if (readOfferAmount(runtime.read, requestId, organizationId, runtime.getWorldTimeMs()) === undefined) {
    return;
  }

  try {
    await runtime.command((transaction) => {
      const amount = readOfferAmount(transaction, requestId, organizationId, transaction.worldTimeMs);
      if (amount !== undefined && canSubmitOffer(transaction, bot, permissionName)) {
        submitTransportOfferInTransaction(runtime, transaction, create(SubmitTransportOfferRequestSchema, {
          amount,
          idempotencyKey: runtime.random.uuid(),
          transportRequestId: requestId,
        }), new Headers({
          [ACTING_ORGANIZATION_HEADER]: organizationId,
          [DEMO_USER_HEADER]: userId,
        }));
      }
    });
  }
  catch (error) {
    const [detail] = error instanceof ConnectError ? error.findDetails(ErrorDetailSchema) : [];
    if (detail === undefined || !UNAUTHORIZED_ERRORS.has(detail.code)) {
      throw error;
    }
  }
};

export const runCarrierBots = async (runtime: IModuleRuntime): Promise<void> => {
  const requirement = getMethodAccess(LogisticsService.method.submitTransportOffer)?.requirement;
  if (requirement?.case !== 'permission') {
    throw runtime.errors.internal();
  }

  const permissionName = requirement.value.name;
  const bots = CARRIER_BOTS.filter(bot => canSubmitOffer(runtime.read, bot, permissionName));
  if (bots.length === 0) {
    return;
  }

  const nowMs = runtime.getWorldTimeMs();
  const requests = runtime.read.list('transportRequests').filter(request => isCarrierBotRequestDue(request, nowMs))
    .sort((current, prev) => compareIds(current.id, prev.id));

  for (const { id } of requests) {
    for (const bot of bots) {
      await respondToRequest(runtime, id, bot, permissionName);
    }
  }
};
