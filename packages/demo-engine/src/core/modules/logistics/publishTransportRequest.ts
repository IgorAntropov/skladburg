import type { HandlerContext } from '@connectrpc/connect';
import type {
  PublishTransportRequestRequest,
  PublishTransportRequestResponse,
} from '@skladburg/contracts/logistics/v1/logistics';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { DealSchema } from '@skladburg/contracts/deal/v1/deal';
import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import {
  LogisticsService,
  PublishTransportRequestResponseSchema,
} from '@skladburg/contracts/logistics/v1/logistics';
import {
  TransportRequestRecordSchema,
  TransportRequestStatus,
} from '@skladburg/contracts/logistics/v1/logistics_records';

import type { IModuleRuntime } from '../moduleRuntime';

import { runDealCommand } from '../deals/dealCommand';
import { findInterWarehouseRoutes } from '../network/index';
import {
  publishTransportChanges,
  transportRequestAudience,
} from './transportLifecycle';
import {
  findDepartureRange,
  readTransportWindow,
} from './transportMatching';
import { projectTransportRequest } from './transportProjection';

export const publishTransportRequest = (
  runtime: IModuleRuntime,
  request: PublishTransportRequestRequest,
  context: HandlerContext,
): Promise<PublishTransportRequestResponse> => runDealCommand(runtime, {
  command: 'publishTransportRequest',
  handle: (transaction, caller, deal) => {
    const { errors } = runtime;
    const { cargo, deliveryWindow, pickupWindow } = request;
    const origin = transaction.get('warehouses', deal.shipFromWarehouseId);
    const destination = transaction.get('warehouses', deal.shipToWarehouseId);
    if (origin === undefined || destination === undefined) {
      throw errors.notFound(EntityKind.WAREHOUSE);
    }
    const route = findInterWarehouseRoutes(transaction, destination).get(origin.mapNodeId);
    if (route === undefined || route.driveMinutes <= 0) {
      throw errors.validationFailed([{ fieldPath: 'deal_id', ruleId: 'logistics.route_unavailable' }]);
    }

    if (cargo?.temperature === undefined && cargo?.cargoKind === VehicleCargoKind.TEMPERATURE_CONTROLLED) {
      throw errors.validationFailed([{ fieldPath: 'cargo.temperature', ruleId: 'required' }]);
    }
    if (cargo?.temperature !== undefined && cargo.temperature.minCelsius > cargo.temperature.maxCelsius) {
      throw errors.validationFailed([{ fieldPath: 'cargo.temperature.max_celsius', ruleId: 'logistics.temperature_range_order' }]);
    }
    if (readTransportWindow(pickupWindow) === undefined) {
      throw errors.validationFailed([{ fieldPath: 'pickup_window.ends_at', ruleId: 'logistics.window_invalid' }]);
    }
    if (readTransportWindow(deliveryWindow) === undefined) {
      throw errors.validationFailed([{ fieldPath: 'delivery_window.ends_at', ruleId: 'logistics.window_invalid' }]);
    }

    const now = runtime.getWorldTimeMs();
    const record = create(TransportRequestRecordSchema, {
      cargo,
      customerOrganizationId: deal.customerOrganizationId,
      dealId: deal.id,
      deliveryWindow,
      driveMinutes: route.driveMinutes,
      fromCityId: origin.cityId,
      id: runtime.random.uuid(),
      pickupWindow,
      publishedAt: timestampFromMs(now),
      shipperOrganizationId: caller.organizationId,
      status: TransportRequestStatus.OPEN,
      supplierOrganizationId: deal.supplierOrganizationId,
      toCityId: destination.cityId,
      version: 1,
    });
    if (findDepartureRange(record, now) === undefined) {
      throw errors.validationFailed([{ fieldPath: 'delivery_window', ruleId: 'logistics.windows_unreachable' }]);
    }

    transaction.put('transportRequests', record);
    publishTransportChanges(runtime, transaction, transportRequestAudience(runtime, transaction, record));

    const next = clone(DealSchema, deal);
    next.deliveryMethod = DeliveryMethod.EXCHANGE;
    next.deliveryTotal = undefined;

    return next;
  },
  headers: context.requestHeader,
  method: LogisticsService.method.publishTransportRequest,
  notice: undefined,
  request,
  response: (deal, transaction) => {
    const record = transaction.listBy('transportRequests', 'dealId', deal.id).at(0);
    if (record === undefined) {
      throw runtime.errors.internal();
    }

    return create(PublishTransportRequestResponseSchema, {
      transportRequest: projectTransportRequest(transaction, record, record.shipperOrganizationId, runtime.getWorldTimeMs()),
    });
  },
});
