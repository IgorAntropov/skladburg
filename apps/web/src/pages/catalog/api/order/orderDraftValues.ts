import type { MessageInitShape } from '@bufbuild/protobuf';
import type { CreateDealDraftRequestSchema } from '@skladburg/contracts/deal/v1/deal';

import { CreateDealDraftRequestFormRules } from '@skladburg/contracts/forms/deal/v1/deal';

import type { CalendarDateValue } from '@/shared/i18n';

import { parseIsoCalendarDate } from '@/shared/lib/calendar-date';

export interface OrderDraftFormValue {
  desiredDate: string;
  quantity: string;
  shipFromCityId: string;
  shipToWarehouseId: string;
}

export interface OrderDraftIdentityValue {
  dealId: string;
  idempotencyKey: string;
  listingId: string;
  supplierOrganizationId: string;
}

export type OrderDraftOutputValue = Omit<OrderDraftFormValue, 'quantity'> & { quantity: bigint };

const YEAR_RULE = CreateDealDraftRequestFormRules.fields['desiredDate.year'];

export const parseOrderDate = (value: string): CalendarDateValue | undefined => {
  const parts = parseIsoCalendarDate(value);

  if (parts === undefined || parts.year < YEAR_RULE.gte || parts.year > YEAR_RULE.lte) {
    return undefined;
  }

  const { day, month, year } = parts;
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCDate() === day && date.getUTCMonth() === month - 1 ? parts : undefined;
};

export const buildCreateDealDraft = (
  identity: OrderDraftIdentityValue,
  values: OrderDraftOutputValue,
): MessageInitShape<typeof CreateDealDraftRequestSchema> => {
  const desiredDate = parseOrderDate(values.desiredDate);

  if (desiredDate === undefined) {
    throw new Error('Invalid draft delivery date');
  }

  return {
    dealId: identity.dealId,
    desiredDate,
    expectedVersion: 0,
    idempotencyKey: identity.idempotencyKey,
    lines: [{ listingId: identity.listingId, quantity: values.quantity }],
    shipFromCityId: values.shipFromCityId,
    shipToWarehouseId: values.shipToWarehouseId,
    supplierOrganizationId: identity.supplierOrganizationId,
  };
};
