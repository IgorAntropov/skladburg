import type {
  TransportOffer,
  TransportRequestRecord,
} from '@skladburg/contracts/logistics/v1/logistics_records';
import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  type TripPoint,
  TripPointSchema,
  type TripRecord,
  TripRecordSchema,
  TripStatus,
} from '@skladburg/contracts/logistics/v1/trip_records';

import type { IStateReader } from '../../state/index';

const buildTripPoint = (read: IStateReader, warehouse: Warehouse): TripPoint => create(TripPointSchema, {
  address: warehouse.address,
  cityId: warehouse.cityId,
  mapNodeId: warehouse.mapNodeId,
  organizationId: warehouse.tenantId,
  organizationName: read.get('organizations', warehouse.tenantId)?.name ?? '',
  warehouseId: warehouse.id,
});

export const buildTripRecord = (
  read: IStateReader,
  request: TransportRequestRecord,
  offer: TransportOffer,
): TripRecord | undefined => {
  const deal = read.get('deals', request.dealId);
  const pickup = deal === undefined ? undefined : read.get('warehouses', deal.shipFromWarehouseId);
  const delivery = deal === undefined ? undefined : read.get('warehouses', deal.shipToWarehouseId);
  if (deal?.deliveryMethod !== DeliveryMethod.EXCHANGE || deal.status !== DealStatus.AWAITING_LOGISTICS
    || pickup?.tenantId !== deal.supplierOrganizationId || delivery?.tenantId !== deal.customerOrganizationId
    || request.id !== offer.transportRequestId || offer.amount === undefined) {
    return undefined;
  }

  return create(TripRecordSchema, {
    customerOrganizationId: deal.customerOrganizationId,
    dealId: deal.id,
    driveMinutes: request.driveMinutes,
    id: request.id,
    status: TripStatus.AWAITING_CONFIRMATION,
    supplierOrganizationId: deal.supplierOrganizationId,
    transportOrder: {
      amount: offer.amount,
      cargo: request.cargo,
      carrierOrganizationId: offer.carrierOrganizationId,
      delivery: buildTripPoint(read, delivery),
      deliveryWindow: request.deliveryWindow,
      offerId: offer.id,
      pickup: buildTripPoint(read, pickup),
      pickupWindow: request.pickupWindow,
      shipperOrganizationId: request.shipperOrganizationId,
    },
    version: 1,
  });
};

export const readTripForDeal = (read: IStateReader, dealId: string): TripRecord | undefined =>
  read.listBy('trips', 'dealId', dealId)[0];
