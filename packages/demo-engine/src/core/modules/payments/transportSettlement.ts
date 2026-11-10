import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { TripRecord } from '@skladburg/contracts/logistics/v1/trip_records';
import type {
  SafeDealPayment,
  SafeDealPaymentRecord,
  TransportPaymentBreakdown,
  TransportSettlement,
} from '@skladburg/contracts/payment/v1/payment';

import { create } from '@bufbuild/protobuf';
import {
  TransportPaymentBreakdownSchema,
  TransportSettlementSchema,
} from '@skladburg/contracts/payment/v1/payment';

import type { IDomainErrors } from '../../errors/index';
import type { IStateReader } from '../../state/index';

import { SUPPORTED_CURRENCY_CODE } from '../catalog/catalogRules';
import {
  checkDealInteger,
  failDealValidation,
  rub,
} from '../deals/dealRules';
import {
  calculateCommissionMinor,
  COMMISSION_RATE_BASIS_POINTS,
} from './paymentRules';

export const buildTransportSettlement = (errors: IDomainErrors, deal: Deal, trip: TripRecord): TransportSettlement => {
  const { customerOrganizationId, goodsTotal, supplierOrganizationId } = deal;
  const order = trip.transportOrder;
  if (trip.dealId !== deal.id || goodsTotal === undefined || order?.amount === undefined
    || order.carrierOrganizationId === '' || order.carrierOrganizationId === customerOrganizationId
    || order.carrierOrganizationId === supplierOrganizationId) {
    throw errors.internal();
  }
  const { amount: rate, carrierOrganizationId, shipperOrganizationId } = order;
  if (shipperOrganizationId !== customerOrganizationId && shipperOrganizationId !== supplierOrganizationId) {
    throw errors.internal();
  }
  if (goodsTotal.currencyCode !== SUPPORTED_CURRENCY_CODE || rate.currencyCode !== SUPPORTED_CURRENCY_CODE) {
    failDealValidation(errors, 'confirmed_amount.currency_code', 'money.currency_unsupported');
  }
  if (rate.amountMinor <= 0n) {
    throw errors.validationFailed([{ fieldPath: 'confirmed_amount.amount_minor', ruleId: 'int64.gt' }]);
  }

  const goods = checkDealInteger(errors, goodsTotal.amountMinor, 'goods_total.amount_minor');
  const shipping = checkDealInteger(errors, rate.amountMinor, 'confirmed_amount.amount_minor');
  const goodsCommission = calculateCommissionMinor(goods);
  const carrierCommission = calculateCommissionMinor(shipping);
  const isBuyerPayer = shipperOrganizationId === customerOrganizationId;
  const funded = checkDealInteger(errors, goods + (isBuyerPayer ? shipping : 0n), 'confirmed_amount.amount_minor');
  const supplierPayout = checkDealInteger(
    errors, goods - goodsCommission - (isBuyerPayer ? 0n : shipping), 'confirmed_amount.amount_minor',
  );
  const carrierPayout = shipping - carrierCommission;
  if (supplierPayout + carrierPayout + goodsCommission + carrierCommission !== funded) {
    throw errors.internal();
  }

  return create(TransportSettlementSchema, {
    carrierCommission: rub(carrierCommission),
    carrierOrganizationId,
    carrierPayout: rub(carrierPayout),
    fundedAmount: rub(funded),
    payerOrganizationId: shipperOrganizationId,
    shippingAmount: rate,
    supplierPayout: rub(supplierPayout),
    tripId: trip.id,
  });
};

const buildTransportBreakdown = (settlement: TransportSettlement, payment: SafeDealPayment): TransportPaymentBreakdown =>
  create(TransportPaymentBreakdownSchema, {
    carrierPayout: payment.payouts.find(payout => payout.organizationId === settlement.carrierOrganizationId),
    commissionAmount: settlement.carrierCommission,
    commissionRateBasisPoints: COMMISSION_RATE_BASIS_POINTS,
    shippingAmount: settlement.shippingAmount,
  });

export const projectPayment = (record: SafeDealPaymentRecord, deal: Deal, organizationId: string): SafeDealPayment | undefined => {
  const { payment, transportSettlement } = record;
  const isBuyer = organizationId === deal.customerOrganizationId;
  if (!isBuyer && organizationId !== deal.supplierOrganizationId) {
    return undefined;
  }
  if (payment === undefined || transportSettlement === undefined) {
    return payment;
  }

  const isPayer = organizationId === transportSettlement.payerOrganizationId;
  return {
    ...payment,
    deliveryAmount: isBuyer || isPayer ? payment.deliveryAmount : undefined,
    fundedAmount: isBuyer ? payment.fundedAmount : undefined,
    payouts: isPayer ? payment.payouts : payment.payouts.filter(payout => payout.organizationId === organizationId),
    transport: isPayer ? buildTransportBreakdown(transportSettlement, payment) : undefined,
  };
};

export const readCarrierTripPayment = (reader: IStateReader, trip: TripRecord): TransportPaymentBreakdown | undefined => {
  const record = reader.get('payments', trip.dealId);
  const { payment, transportSettlement } = record ?? {};
  if (payment === undefined || transportSettlement?.tripId !== trip.id
    || transportSettlement.carrierOrganizationId !== trip.transportOrder?.carrierOrganizationId) {
    return undefined;
  }

  return buildTransportBreakdown(transportSettlement, payment);
};
