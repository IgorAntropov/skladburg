import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type {
  ListYardVehicleMarkingsRequest,
  ListYardVehicleMarkingsResponse,
  YardVehicleBrand,
  YardVehicleMarking,
} from '@skladburg/contracts/wms/v1/receiving';

import { create } from '@bufbuild/protobuf';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { PickingTaskStatus } from '@skladburg/contracts/wms/v1/picking';
import {
  ListYardVehicleMarkingsResponseSchema,
  YardVehicleBrandSchema,
  YardVehicleMarkingSchema,
} from '@skladburg/contracts/wms/v1/receiving';

import type { PermissionCallerValue } from '../../access/index';
import type { IStateReader } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { SEED_YARD_VEHICLE_ACCENTS } from '../../seed/seedYardVehicleAccents';
import { compareIds } from '../../state/index';
import {
  cloneOrganizationLogo,
  isOrganizationVisibleToViewer,
} from '../../visibility/index';
import { readTripForDeal } from '../logistics/tripRecords';
import { paginate } from '../pagination';
import { readInboundTask } from './inboundRecords';
import { readOutboundTask } from './outboundRecords';

interface YardVehicleFactsValue {
  ownerId: string;
  registrationNumber?: string | undefined;
}

interface YardVisitLinkValue {
  dealId: string;
  direction: 'delivery' | 'pickup';
}

const hasOrganizationPermission = (caller: PermissionCallerValue, name: 'fleet_view' | 'network_view' | 'trip_view'): boolean =>
  caller.permissions.some(({ isOrganizationWide, permission }) => isOrganizationWide && permission === name);

const readVisitLink = (
  { errors, read }: IModuleRuntime, taskId: string, organizationId: string, warehouseId: string,
): undefined | YardVisitLinkValue => {
  const inbound = read.get('warehouseInbound', taskId);
  if (inbound?.lookupKey === organizationId && inbound.scopeId === warehouseId) {
    const task = readInboundTask(inbound, errors);
    return task.version > 0 ? { dealId: task.dealId, direction: 'delivery' } : undefined;
  }

  const outbound = read.get('warehouseOutbound', taskId);
  if (outbound?.lookupKey === organizationId && outbound.scopeId === warehouseId) {
    const task = readOutboundTask(outbound, errors);
    return task.version > 0 && task.status !== PickingTaskStatus.CANCELLED ? { dealId: task.dealId, direction: 'pickup' } : undefined;
  }

  return undefined;
};

const isAssignedStatus = (status: TripStatus): boolean => status === TripStatus.ASSIGNED || status === TripStatus.LOADED
  || status === TripStatus.IN_TRANSIT || status === TripStatus.ARRIVED || status === TripStatus.DELIVERED || status === TripStatus.CLOSED;

const readVehicleFacts = (
  read: IStateReader, deal: Deal, direction: YardVisitLinkValue['direction'], organizationId: string, warehouseId: string,
): undefined | YardVehicleFactsValue => {
  if (deal.deliveryMethod === DeliveryMethod.SUPPLIER) {
    return { ownerId: deal.supplierOrganizationId };
  }
  if (deal.deliveryMethod === DeliveryMethod.CUSTOMER) {
    return { ownerId: deal.customerOrganizationId };
  }
  if (deal.deliveryMethod !== DeliveryMethod.EXCHANGE) {
    return undefined;
  }

  const trip = readTripForDeal(read, deal.id);
  const order = trip?.transportOrder;
  const assignment = trip?.assignment;
  const point = order?.[direction];
  if (trip === undefined || !isAssignedStatus(trip.status) || order === undefined || order.carrierOrganizationId === ''
    || trip.customerOrganizationId !== deal.customerOrganizationId || trip.supplierOrganizationId !== deal.supplierOrganizationId
    || point?.organizationId !== organizationId || point.warehouseId !== warehouseId
    || assignment === undefined || assignment.vehicleId === '' || assignment.registrationNumber === '') {
    return undefined;
  }

  return { ownerId: order.carrierOrganizationId, registrationNumber: assignment.registrationNumber };
};

const projectVehicleBrand = (read: IStateReader, caller: PermissionCallerValue, ownerId: string): undefined | YardVehicleBrand => {
  if (ownerId !== caller.organizationId && !hasOrganizationPermission(caller, 'network_view')) {
    return undefined;
  }

  const owner = read.get('organizations', ownerId);
  if (owner === undefined || !isOrganizationVisibleToViewer(read, caller.organizationId, owner)) {
    return undefined;
  }

  return create(YardVehicleBrandSchema, {
    logo: cloneOrganizationLogo(owner), name: owner.name, organizationId: owner.id, yardAccent: SEED_YARD_VEHICLE_ACCENTS.get(owner.id),
  });
};

const projectVisitMarking = (
  runtime: IModuleRuntime, caller: PermissionCallerValue, warehouseId: string, taskId: string,
): undefined | YardVehicleMarking => {
  const { read } = runtime;
  const { organizationId } = caller;
  const link = readVisitLink(runtime, taskId, organizationId, warehouseId);
  const deal = link === undefined ? undefined : read.get('deals', link.dealId);
  if (link === undefined || deal === undefined || deal.status === DealStatus.CANCELLED) {
    return undefined;
  }

  const hasMatchingEndpoint = link.direction === 'delivery'
    ? deal.customerOrganizationId === organizationId && deal.shipToWarehouseId === warehouseId
    : deal.supplierOrganizationId === organizationId && deal.shipFromWarehouseId === warehouseId;
  if (!hasMatchingEndpoint) {
    return undefined;
  }

  const facts = readVehicleFacts(read, deal, link.direction, organizationId, warehouseId);
  if (facts === undefined) {
    return create(YardVehicleMarkingSchema, { taskId });
  }

  const canViewPlate = hasOrganizationPermission(caller, 'trip_view')
    || (facts.ownerId === organizationId && hasOrganizationPermission(caller, 'fleet_view'));
  return create(YardVehicleMarkingSchema, {
    brand: projectVehicleBrand(read, caller, facts.ownerId),
    registrationNumber: canViewPlate ? facts.registrationNumber : undefined,
    taskId,
  });
};

export const listYardVehicleMarkings = (
  runtime: IModuleRuntime, caller: PermissionCallerValue, request: ListYardVehicleMarkingsRequest,
): ListYardVehicleMarkingsResponse => {
  const { taskIds, warehouseId } = request;
  const markings = taskIds.toSorted(compareIds).flatMap((taskId) => {
    const marking = projectVisitMarking(runtime, caller, warehouseId, taskId);
    return marking === undefined ? [] : [marking];
  });
  const { items, page } = paginate(markings, ({ taskId }) => taskId, request.page, runtime.errors);

  return create(ListYardVehicleMarkingsResponseSchema, { markings: items, page });
};
