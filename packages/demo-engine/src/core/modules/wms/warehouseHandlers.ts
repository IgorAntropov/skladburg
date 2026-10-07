import type { ServiceImpl } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  CreateWarehouseResponseSchema,
  ListWarehousesResponseSchema,
  OrganizationService,
  WarehouseChange,
  WarehouseChangedSchema,
  WarehouseCreatedSchema,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';
import {
  organizationChannel,
  warehouseChannel,
} from '@skladburg/contracts/runtime';

import type { IModuleRuntime } from '../moduleRuntime';

import { listVisibleWarehouses } from '../../visibility/index';
import { paginate } from '../pagination';

export type WarehouseHandlersValue = Pick<ServiceImpl<typeof OrganizationService>, 'createWarehouse' | 'listWarehouses'>;

export const createWarehouseHandlers = (runtime: IModuleRuntime): WarehouseHandlersValue => {
  const { command, errors, guard, idempotency, outbox, random, read } = runtime;

  return {
    createWarehouse: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(transaction, OrganizationService.method.createWarehouse, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          if (transaction.get('cities', request.cityId) === undefined) {
            throw errors.notFound(EntityKind.CITY);
          }

          if (transaction.get('boardNodes', request.boardNodeId)?.cityId !== request.cityId) {
            throw errors.notFound(EntityKind.BOARD_NODE);
          }

          const warehouse = create(WarehouseSchema, {
            address: request.address,
            boardNodeId: request.boardNodeId,
            capabilities: request.capabilities,
            cityId: request.cityId,
            id: random.uuid(),
            isWmsEnabled: true,
            name: request.name,
            tenantId: caller.organizationId,
            timeZone: request.timeZone,
          });

          transaction.put('warehouses', warehouse);
          outbox.add(transaction, organizationChannel(caller.organizationId), {
            case: 'warehouseChanged',
            value: create(WarehouseChangedSchema, { change: WarehouseChange.CREATED, warehouseId: warehouse.id }),
          });
          outbox.add(transaction, warehouseChannel(warehouse.id), {
            case: 'warehouseCreated',
            value: create(WarehouseCreatedSchema, { warehouse }),
          });

          return create(CreateWarehouseResponseSchema, { warehouse });
        },
        idempotencyKey: request.idempotencyKey,
        method: OrganizationService.method.createWarehouse,
        request,
        scope: caller.organizationId,
      });
    }),
    listWarehouses: (request, context) => {
      const caller = guard.guardScopeFilteredCall(read, OrganizationService.method.listWarehouses, request, context.requestHeader);
      const warehouses = listVisibleWarehouses(read, caller.organizationId, caller.scope);
      const { items, page } = paginate(warehouses, warehouse => warehouse.id, request.page, errors);

      return create(ListWarehousesResponseSchema, { page, warehouses: items });
    },
  };
};
