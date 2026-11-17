import type { Document } from '@skladburg/contracts/document/v1/document';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { YardAdmissionStatus } from '@skladburg/contracts/wms/v1/receiving';

import type { IStateReader } from '../../state/index';

import { readTripForDeal } from '../logistics/tripRecords';

export const isInboundYardBlocked = (status: YardAdmissionStatus): boolean =>
  status === YardAdmissionStatus.PASS_REJECTED || status === YardAdmissionStatus.WAITING_DOCUMENTS;

const isIssuedDocument = (document: Document, dealId: string, issuerId: string): boolean =>
  document.dealId === dealId && document.issuerOrganizationId === issuerId && document.displayNumber !== ''
  && (document.status === DocumentStatus.APPROVED || document.status === DocumentStatus.SIGNED);

export const readInboundYardGate = (reader: IStateReader, task: ReceivingTask, tenantId: string): YardAdmissionStatus => {
  const { dealId, updDocumentId, warehouseId } = task;
  const deal = reader.get('deals', dealId);
  if (deal?.deliveryMethod !== DeliveryMethod.EXCHANGE) {
    return YardAdmissionStatus.UNSPECIFIED;
  }

  const trip = readTripForDeal(reader, dealId);
  const order = trip?.transportOrder;
  const assignment = trip?.assignment;
  if (deal.customerOrganizationId !== tenantId || deal.shipToWarehouseId !== warehouseId
    || trip?.status !== TripStatus.ARRIVED || trip.arrivedAt === undefined || trip.customerOrganizationId !== tenantId
    || trip.supplierOrganizationId !== deal.supplierOrganizationId
    || order?.delivery?.organizationId !== tenantId || order.delivery.warehouseId !== warehouseId
    || assignment === undefined || assignment.vehicleId === '' || assignment.driverId === '' || assignment.registrationNumber === '') {
    return YardAdmissionStatus.PASS_REJECTED;
  }

  const upd = updDocumentId === undefined ? undefined : reader.get('documents', updDocumentId);
  const isCarrierTitlePending = trip.carrierTitle !== undefined && trip.carrierTitle.submittedAt === undefined;
  if (isCarrierTitlePending || order.confirmedAt === undefined || upd?.type !== DocumentType.UPD || upd.content?.terms.case !== 'upd'
    || !isIssuedDocument(upd, dealId, deal.supplierOrganizationId)) {
    return YardAdmissionStatus.WAITING_DOCUMENTS;
  }

  const hasDispatchTitle = reader.listBy('documents', 'dealId', dealId).some((document) => {
    const terms = document.content?.terms;
    return document.type === DocumentType.DISPATCH_TITLE && terms?.case === 'dispatchTitle' && terms.value.updDocumentId === upd.id
      && terms.value.shippedAt !== undefined && isIssuedDocument(document, dealId, deal.supplierOrganizationId);
  });
  return hasDispatchTitle ? YardAdmissionStatus.ADMITTED : YardAdmissionStatus.WAITING_DOCUMENTS;
};
