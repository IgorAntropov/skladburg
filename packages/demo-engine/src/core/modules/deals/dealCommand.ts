import type {
  DescMessage,
  DescMethodUnary,
  MessageShape,
} from '@bufbuild/protobuf';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { DealNotice } from '@skladburg/contracts/notification/v1/notification';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { DealTransitionSchema } from '@skladburg/contracts/deal/v1/deal';
import { DealChange } from '@skladburg/contracts/deal/v1/deal_events';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type { PermissionCallerValue } from '../../access/index';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';
import type { DealCommand } from './dealMachine';

import {
  dealActorRoleName,
  readVisibleDeal,
  requireDealPartyProfiles,
} from './dealAccess';
import { publishDealEffects } from './dealEffects';
import { dealMachine } from './dealMachine';
import { projectDeal } from './dealProjection';

export interface DealCommandInputValue<TInput extends DescMessage, TOutput extends DescMessage> {
  command: DealCommand;
  handle: (transaction: IStateTransaction, caller: PermissionCallerValue, deal: Deal) => Deal;
  headers: Headers;
  method: DescMethodUnary<TInput, TOutput>;
  notice: DealNotice | undefined;
  reason?: string;
  request: MessageShape<TInput> & VersionedDealRequestValue;
  response: (deal: Deal, transaction: IStateTransaction) => MessageShape<TOutput>;
}

interface VersionedDealRequestValue {
  dealId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export const runDealCommand = <TInput extends DescMessage, TOutput extends DescMessage>(
  runtime: IModuleRuntime,
  input: DealCommandInputValue<TInput, TOutput>,
): Promise<MessageShape<TOutput>> => runtime.command((transaction) => {
  const caller = runtime.guard.guardPermissionCall(transaction, input.method, input.request, input.headers);
  return runtime.idempotency.run(transaction, {
    handler: () => {
      const deal = readVisibleDeal(transaction, runtime.errors, input.request.dealId, caller);
      const transition = dealMachine.requireTransition(runtime.errors, input.command, deal, input.request.expectedVersion);
      const actorSide = deal.customerOrganizationId === caller.organizationId ? 'customer' : 'supplier';
      if (transition.side !== 'either' && transition.side !== actorSide) {
        throw runtime.errors.permissionDenied(transition.permission);
      }
      if (input.command !== 'cancelDeal' && input.command !== 'rejectDeal' && input.command !== 'rejectCounterOffer') {
        requireDealPartyProfiles(transaction, runtime.errors, deal.supplierOrganizationId, deal.customerOrganizationId);
      }
      const next = input.handle(transaction, caller, deal);
      if (deal.version >= 2_147_483_647) {
        throw runtime.errors.unavailable();
      }
      const at = timestampFromMs(runtime.getWorldTimeMs());
      next.status = transition.status;
      next.version = deal.version + 1;
      next.updatedAt = at;
      next.transitions.push(create(DealTransitionSchema, {
        actorRoleName: dealActorRoleName(transaction, caller),
        actorSide: actorSide === 'customer' ? ProfileKind.CUSTOMER : ProfileKind.SUPPLIER,
        at,
        from: deal.status,
        reason: input.reason ?? '',
        to: transition.status,
      }));
      transaction.put('deals', next);
      publishDealEffects(runtime, transaction, next, input.notice,
        input.command === 'updateDealDraft' ? DealChange.LINES : DealChange.STATUS, caller.organizationId);
      return input.response(projectDeal(next, caller.organizationId), transaction);
    },
    idempotencyKey: input.request.idempotencyKey,
    method: input.method,
    request: input.request,
    scope: caller.organizationId,
  });
});
