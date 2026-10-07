import type { ConnectError } from '@connectrpc/connect';

import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  type ErrorDetail,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { parseChannel } from '@skladburg/contracts/runtime';

import type { IDomainErrors } from '../errors/index';
import type { IStateReader } from '../state/index';

import {
  isWarehouseInScope,
  resolveEffectivePermissions,
} from '../access/index';
import { readActingContext } from '../context/index';

export const WAREHOUSE_CHANNEL_PERMISSION = 'warehouse_view';

export type EngineSubscriptionValue
  = | { detail: ErrorDetail; kind: 'denied' }
    | { kind: 'subscribed'; unsubscribe: () => void };

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

  const evaluate = (reader: IStateReader, channel: string, headers: Headers): void => {
    const { userId } = readActingContext(headers);

    if (userId === undefined || reader.get('users', userId) === undefined) {
      throw errors.sessionRequired();
    }

    const parsed = parseChannel(channel);

    if (parsed === undefined) {
      throw errors.notFound(EntityKind.UNSPECIFIED);
    }

    if (parsed.kind === 'user') {
      if (parsed.userId !== userId) {
        throw errors.notFound(EntityKind.UNSPECIFIED);
      }

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
