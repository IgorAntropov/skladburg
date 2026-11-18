import type { ContextValues } from '@connectrpc/connect';
import type {
  WarehouseCellInput,
  WarehouseTopology,
} from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  ErrorCode,
  WarehouseLayoutBusyParamsSchema,
} from '@skladburg/contracts/common/v1/error';

import type { PermissionCallerValue } from '../../access/index';
import type { IDomainErrors } from '../../errors/index';
import type { IStateReader } from '../../state/index';
import type { WarehouseLayoutSessionRecordValue } from '../../state/warehouseLayoutSessionRecord';
import type { IModuleRuntime } from '../moduleRuntime';

import { engineTabIdKey } from '../../context/engineRequestContext';
import { normalizeWarehouseCode } from './warehouseCellPlan';

export interface WarehouseLayoutZoneScopeValue {
  tenantId: string;
  warehouseId: string;
  zoneId: string;
}

interface WarehouseLayoutZonesScopeValue {
  tenantId: string;
  warehouseId: string;
  zoneIds: Iterable<string>;
}

export const WAREHOUSE_LAYOUT_SESSION_TTL_MS = 120_000;

export const warehouseLayoutSessionRecordId = ({ tenantId, warehouseId, zoneId }: WarehouseLayoutZoneScopeValue): string =>
  `${tenantId}:${warehouseId}:${zoneId}`;

export const readWarehouseLayoutOwnerKey = (caller: PermissionCallerValue, values: ContextValues, errors: IDomainErrors): string => {
  const tabId = values.get(engineTabIdKey);
  if (tabId === undefined) {
    throw errors.create(ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID);
  }

  const { admission, organizationId, user } = caller;
  const admissionId = admission.kind === 'membership' ? admission.membership.id : admission.session.id;

  return JSON.stringify([organizationId, user.id, admission.kind, admissionId, tabId]);
};

export const readActiveWarehouseLayoutSession = (
  reader: IStateReader,
  scope: WarehouseLayoutZoneScopeValue,
  nowMs: number,
): undefined | WarehouseLayoutSessionRecordValue => {
  const record = reader.get('warehouseLayoutSessions', warehouseLayoutSessionRecordId(scope));

  return record !== undefined && nowMs < record.expiresAtMs ? record : undefined;
};

export const requireOwnedWarehouseLayoutSession = (
  runtime: IModuleRuntime,
  session: undefined | WarehouseLayoutSessionRecordValue,
  ownerKey: string,
  layoutSessionId: string,
): WarehouseLayoutSessionRecordValue => {
  if (session?.layoutSessionId !== layoutSessionId || session.ownerKey !== ownerKey) {
    throw runtime.errors.create(ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID);
  }

  return session;
};

export const assertWarehouseLayoutZonesAvailable = (
  reader: IStateReader,
  runtime: IModuleRuntime,
  { tenantId, warehouseId, zoneIds }: WarehouseLayoutZonesScopeValue,
): void => {
  const nowMs = runtime.getRealTimeMs();
  for (const zoneId of zoneIds) {
    const session = readActiveWarehouseLayoutSession(reader, { tenantId, warehouseId, zoneId }, nowMs);
    if (session !== undefined) {
      throw runtime.errors.create(ErrorCode.WAREHOUSE_LAYOUT_BUSY, {
        case: 'warehouseLayoutBusy',
        value: create(WarehouseLayoutBusyParamsSchema, { expiresAt: timestampFromMs(session.expiresAtMs), zoneId }),
      });
    }
  }
};

export const readWarehouseCellZoneIds = (
  topology: undefined | WarehouseTopology,
  cells: readonly WarehouseCellInput[],
): Set<string> => {
  const codes = new Set(cells.map(cell => normalizeWarehouseCode(cell.zoneCode)));

  return new Set(topology?.storageZones.filter(zone => codes.has(normalizeWarehouseCode(zone.code))).map(zone => zone.id));
};
