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
import { isProfileVerified } from '../visibility/index';

export const WAREHOUSE_CHANNEL_PERMISSION = getPermissionName(PermissionCode.WAREHOUSE_VIEW);
export const MARKET_CHANNEL_PERMISSION = getPermissionName(PermissionCode.MARKETPLACE_VIEW);

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

  const evaluateWarehouse = (reader: IStateReader, warehouseId: string, userId: string): void => {
    const warehouse = reader.get('warehouses', warehouseId);
    const membership = warehouse === undefined
      ? undefined
      : reader.listBy('memberships', 'userId', userId).find(candidate => candidate.organizationId === warehouse.tenantId);

    if (membership === undefined) {
      throw errors.notFound(EntityKind.WAREHOUSE);
    }

    const effective = resolveEffectivePermissions(reader, membership).find(
      candidate => candidate.permission === WAREHOUSE_CHANNEL_PERMISSION,
    );

    if (effective === undefined) {
      throw errors.permissionDenied(WAREHOUSE_CHANNEL_PERMISSION);
    }

    if (!isWarehouseInScope(effective, warehouseId)) {
      throw errors.permissionDenied(WAREHOUSE_CHANNEL_PERMISSION, warehouseId);
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
      candidate => candidate.permission === MARKET_CHANNEL_PERMISSION,
    );

    if (!isPermitted) {
      throw errors.permissionDenied(MARKET_CHANNEL_PERMISSION);
    }

    const organization = reader.get('organizations', organizationId);

    if (organization === undefined || !isProfileVerified(organization, ProfileKind.CUSTOMER)) {
      throw errors.notFound(EntityKind.CHANNEL);
    }
  };

  const evaluate = (reader: IStateReader, channel: string, headers: Headers): void => {
    const { userId } = readActingContext(headers);

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
      evaluateWarehouse(reader, parsed.warehouseId, userId);

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
