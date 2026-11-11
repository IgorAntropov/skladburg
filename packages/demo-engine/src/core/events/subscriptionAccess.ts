import type { ConnectError } from '@connectrpc/connect';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  type ErrorDetail,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  getPermissionName,
  parseChannel,
} from '@skladburg/contracts/runtime';

import type { IDomainErrors } from '../errors/index';
import type { IStateReader } from '../state/index';

import {
  isWarehouseInScope,
  resolveEffectivePermissions,
} from '../access/index';
import { readActingContext } from '../context/index';
import { isDealVisibleToOrganization } from '../modules/deals/index';
import { isProfileVerified } from '../visibility/index';

export const WAREHOUSE_CHANNEL_PERMISSION = getPermissionName(PermissionCode.WAREHOUSE_VIEW);
const INVENTORY_CHANNEL_PERMISSION = getPermissionName(PermissionCode.INVENTORY_VIEW);
export const MARKET_CHANNEL_PERMISSION = getPermissionName(PermissionCode.MARKETPLACE_VIEW);
export const DEAL_CHANNEL_PERMISSION = getPermissionName(PermissionCode.DEAL_VIEW);

export interface EngineChannelPositionValue {
  epoch: string;
  seq: bigint;
}

export type EngineSubscriptionValue
  = | (EngineChannelPositionValue & { kind: 'subscribed'; unsubscribe: () => void })
    | { detail: ErrorDetail; kind: 'denied' };

export interface ISubscriptionAccess {
  check: (reader: IStateReader, channel: string, headers: Headers) => ErrorDetail | undefined;
}

export const createSubscriptionAccess = (errors: IDomainErrors): ISubscriptionAccess => {
  const readDetail = (error: ConnectError): ErrorDetail => {
    const [detail] = error.findDetails(ErrorDetailSchema);

    if (detail === undefined) {
      throw error;
    }

    return detail;
  };

  const evaluateWarehouse = (
    reader: IStateReader,
    warehouseId: string,
    userId: string,
    permission: string,
    actingOrganizationId: string | undefined,
  ): void => {
    const warehouse = reader.get('warehouses', warehouseId);
    const membership = warehouse === undefined || (actingOrganizationId !== undefined && warehouse.tenantId !== actingOrganizationId)
      ? undefined
      : reader.listBy('memberships', 'userId', userId).find(candidate => candidate.organizationId === warehouse.tenantId);

    if (membership === undefined) {
      throw errors.notFound(EntityKind.WAREHOUSE);
    }

    const effective = resolveEffectivePermissions(reader, membership).find(
      candidate => candidate.permission === permission,
    );

    if (effective === undefined) {
      throw errors.permissionDenied(permission);
    }

    if (!isWarehouseInScope(effective, warehouseId)) {
      throw errors.permissionDenied(permission, warehouseId);
    }
  };

  const evaluateMarket = (reader: IStateReader, headers: Headers, userId: string): void => {
    const { organizationId } = readActingContext(headers);
    const membership = organizationId === undefined
      ? undefined
      : reader.listBy('memberships', 'userId', userId).find(candidate => candidate.organizationId === organizationId);

    if (organizationId === undefined || membership === undefined) {
      throw errors.membershipRequired();
    }

    const isPermitted = resolveEffectivePermissions(reader, membership).some(
      candidate => candidate.permission === MARKET_CHANNEL_PERMISSION && candidate.isOrganizationWide,
    );

    if (!isPermitted) {
      throw errors.permissionDenied(MARKET_CHANNEL_PERMISSION);
    }

    const organization = reader.get('organizations', organizationId);

    if (organization === undefined || !isProfileVerified(organization, ProfileKind.CUSTOMER)) {
      throw errors.notFound(EntityKind.CHANNEL);
    }
  };

  const evaluateDeal = (reader: IStateReader, dealId: string, headers: Headers, userId: string): void => {
    const { organizationId, supportSessionId } = readActingContext(headers);
    const membership = organizationId === undefined || supportSessionId !== undefined
      ? undefined
      : reader.listBy('memberships', 'userId', userId).find(candidate => candidate.organizationId === organizationId);

    if (organizationId === undefined || membership === undefined) {
      throw errors.membershipRequired();
    }

    const deal = reader.get('deals', dealId);

    if (deal === undefined || !isDealVisibleToOrganization(deal, organizationId)) {
      throw errors.notFound(EntityKind.DEAL);
    }

    const canViewDeal = resolveEffectivePermissions(reader, membership).some(
      permission => permission.permission === DEAL_CHANNEL_PERMISSION && permission.isOrganizationWide,
    );

    if (!canViewDeal) {
      throw errors.permissionDenied(DEAL_CHANNEL_PERMISSION);
    }
  };

  const evaluate = (reader: IStateReader, channel: string, headers: Headers): void => {
    const { organizationId, supportSessionId, userId } = readActingContext(headers);

    if (userId === undefined || reader.get('users', userId) === undefined) {
      throw errors.sessionRequired();
    }

    const parsed = parseChannel(channel);

    if (parsed === undefined) {
      throw errors.notFound(EntityKind.CHANNEL);
    }

    if (parsed.kind === 'user') {
      if (parsed.userId !== userId) {
        throw errors.notFound(EntityKind.CHANNEL);
      }

      return;
    }

    if (parsed.kind === 'market') {
      evaluateMarket(reader, headers, userId);

      return;
    }

    if (parsed.kind === 'warehouse') {
      evaluateWarehouse(reader, parsed.warehouseId, userId, WAREHOUSE_CHANNEL_PERMISSION, undefined);

      return;
    }

    if (parsed.kind === 'inventory') {
      if (organizationId === undefined || supportSessionId !== undefined) {
        throw errors.membershipRequired();
      }

      evaluateWarehouse(reader, parsed.warehouseId, userId, INVENTORY_CHANNEL_PERMISSION, organizationId);

      return;
    }

    if (parsed.kind === 'deal') {
      evaluateDeal(reader, parsed.dealId, headers, userId);

      return;
    }

    const isMember = reader.listBy('memberships', 'userId', userId).some(membership => membership.organizationId === parsed.organizationId);

    if (!isMember) {
      throw errors.membershipRequired();
    }
  };

  const check = (reader: IStateReader, channel: string, headers: Headers): ErrorDetail | undefined => {
    try {
      evaluate(reader, channel, headers);
    }
    catch (error) {
      return readDetail(errors.from(error));
    }

    return undefined;
  };

  return { check };
};
