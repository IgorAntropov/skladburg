import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type {
  FormFieldIssueValue,
  FormRulesValue,
} from '@skladburg/contracts/forms';

import { DealService } from '@skladburg/contracts/deal/v1/deal';
import {
  CreateDealDraftRequestFormRules,
  DraftDealLineFormRules,
} from '@skladburg/contracts/forms/deal/v1/deal';
import { useState } from 'react';

import type { CommandFormValue } from '@/shared/lib/form';

import {
  createUuid,
  useApiClient,
} from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';

import type { OrderTranslate } from '../../i18n/order/orderSection';
import type {
  OrderDraftFormValue,
  OrderDraftOutputValue,
} from './orderDraftValues';

import { CREATE_DEAL_DRAFT_METHOD } from './createDealDraftMethod';
import {
  buildCreateDealDraft,
  parseOrderDate,
} from './orderDraftValues';

interface CreateDealDraftFormOptions {
  defaultValues: OrderDraftFormValue;
  listingId: string;
  onCreated: (deal: Deal) => void;
  supplierOrganizationId: string;
  t: OrderTranslate;
}

const RULES = {
  fields: {
    desiredDate: { ...CreateDealDraftRequestFormRules.fields.desiredDate, isServerOnly: false, kind: 'string' },
    quantity: DraftDealLineFormRules.fields.quantity,
    shipFromCityId: CreateDealDraftRequestFormRules.fields.shipFromCityId,
    shipToWarehouseId: CreateDealDraftRequestFormRules.fields.shipToWarehouseId,
  },
} as const satisfies FormRulesValue;

const WATCHED_FIELDS = ['shipToWarehouseId'] satisfies (keyof OrderDraftFormValue)[];

const validateValues = (values: OrderDraftOutputValue): readonly FormFieldIssueValue[] => (
  parseOrderDate(values.desiredDate) === undefined ? [{ field: 'desiredDate', ruleId: 'calendar_date.exists' }] : []
);

const mapViolationPath = (path: string): string => path === 'lines[0].quantity' ? 'quantity' : path;

export const useCreateDealDraftForm = ({
  defaultValues,
  listingId,
  onCreated,
  supplierOrganizationId,
  t,
}: CreateDealDraftFormOptions): CommandFormValue<OrderDraftFormValue> => {
  const client = useApiClient();
  const [dealId] = useState(createUuid);

  const execute = async (values: OrderDraftOutputValue, idempotencyKey: string): Promise<Deal> => {
    const response = await client.service(DealService).createDealDraft(
      buildCreateDealDraft({ dealId, idempotencyKey, listingId, supplierOrganizationId }, values),
    );

    if (response.deal === undefined) {
      throw new Error('CreateDealDraft response has no deal');
    }

    return response.deal;
  };

  const translateViolation = (ruleId: string): string | undefined => {
    switch (ruleId) {
      case 'calendar_date.exists':
      case 'deal.date.invalid':
        return t('order.validation.date');
      case 'catalog.quantity_above_limit':
        return t('order.validation.quantityLimit');
      case 'catalog.quantity_below_minimum':
        return t('order.validation.quantityMinimum');
      case 'catalog.quantity_not_multiple_of_step':
        return t('order.validation.quantityStep');
      case 'deal.quantity.unavailable':
        return t('order.validation.quantityUnavailable');
      case 'deal.warehouse.unavailable':
        return t('order.validation.route');
      default:
        return undefined;
    }
  };

  return useCommandForm<OrderDraftFormValue, Deal, OrderDraftOutputValue>({
    defaultValues,
    execute,
    mapViolationPath,
    method: CREATE_DEAL_DRAFT_METHOD,
    onSuccess: onCreated,
    rules: RULES,
    translateViolation,
    validateValues,
    watchedFields: WATCHED_FIELDS,
  });
};
