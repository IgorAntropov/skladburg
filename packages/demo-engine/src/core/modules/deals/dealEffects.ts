import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  ObjectKind,
  ObjectLinkSchema,
} from '@skladburg/contracts/common/v1/object_link';
import { DealTransitionSchema } from '@skladburg/contracts/deal/v1/deal';
import {
  DealChange,
  DealChangedSchema,
} from '@skladburg/contracts/deal/v1/deal_events';
import {
  type DealNotice,
  DealUpdateParamsSchema,
  NotificationImportance,
  NotificationKind,
} from '@skladburg/contracts/notification/v1/notification';
import {
  dealChannel,
  getPermissionName,
  organizationChannel,
} from '@skladburg/contracts/runtime';

import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { resolveEffectivePermissions } from '../../access/index';
import { compareIds } from '../../state/index';
import {
  type DealCommand,
  dealMachine,
} from './dealMachine';

const DEAL_VIEW_PERMISSION = getPermissionName(PermissionCode.DEAL_VIEW);

const resolveDealRecipients = (reader: IStateReader, organizationId: string): string[] => {
  const recipients = new Set<string>();

  for (const membership of reader.listBy('memberships', 'organizationId', organizationId)) {
    const canViewDeal = resolveEffectivePermissions(reader, membership).some(
      permission => permission.permission === DEAL_VIEW_PERMISSION && permission.isOrganizationWide,
    );

    if (canViewDeal) {
      recipients.add(membership.userId);
    }
  }

  return [...recipients].sort(compareIds);
};

export const postDealNotice = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  deal: Deal,
  notice: DealNotice,
  organizationId: string,
): void => {
  if (deal.submittedAt === undefined) {
    return;
  }

  const counterpartyOrganizationId = organizationId === deal.customerOrganizationId
    ? deal.supplierOrganizationId
    : deal.customerOrganizationId;

  runtime.notifier.post(transaction, {
    importance: NotificationImportance.IMPORTANT,
    kind: NotificationKind.DEAL_UPDATE,
    links: [create(ObjectLinkSchema, { target: { id: deal.id, kind: ObjectKind.DEAL } })],
    organizationId,
    params: {
      case: 'dealUpdate',
      value: create(DealUpdateParamsSchema, {
        counterpartyName: transaction.get('organizations', counterpartyOrganizationId)?.name ?? '',
        counterpartyOrganizationId,
        dealId: deal.id,
        dealNumber: deal.number,
        notice,
      }),
    },
    recipients: resolveDealRecipients(transaction, organizationId),
  });
};

export const publishDealEffects = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  deal: Deal,
  notice: DealNotice | undefined,
  change: DealChange,
  actingOrganizationId: string,
): void => {
  const channels = [organizationChannel(deal.customerOrganizationId), dealChannel(deal.id)];

  if (deal.submittedAt !== undefined) {
    channels.push(organizationChannel(deal.supplierOrganizationId));
  }

  for (const channel of channels) {
    runtime.outbox.add(transaction, channel, {
      case: 'dealChanged',
      value: create(DealChangedSchema, { change, dealId: deal.id }),
    });
  }

  if (notice !== undefined) {
    const recipientOrganizationId = actingOrganizationId === deal.customerOrganizationId
      ? deal.supplierOrganizationId
      : deal.customerOrganizationId;

    postDealNotice(runtime, transaction, deal, notice, recipientOrganizationId);
  }
};

export const advanceSystemDeal = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  deal: Deal,
  command: DealCommand,
  notice?: DealNotice,
  actingOrganizationId: string = deal.customerOrganizationId,
): void => {
  const transition = dealMachine.requireTransition(runtime.errors, command, deal, undefined);
  if (transition.side !== 'system' || deal.version >= 2_147_483_647) {
    throw runtime.errors.unavailable();
  }
  const at = timestampFromMs(transaction.worldTimeMs);
  deal.transitions.push(create(DealTransitionSchema, { at, from: deal.status, to: transition.status }));
  deal.status = transition.status;
  deal.updatedAt = at;
  deal.version++;
  if (command === 'arrive' && transaction.get('warehouseInbound', deal.id) !== undefined) {
    if (deal.deadlines !== undefined) {
      deal.deadlines.acceptanceDueAt = undefined;
    }
    runtime.openInboundTask?.(transaction, runtime, deal.id);
  }
  transaction.put('deals', deal);
  publishDealEffects(runtime, transaction, deal, notice, DealChange.STATUS, actingOrganizationId);
};
