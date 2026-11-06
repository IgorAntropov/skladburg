import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  type DealDeadlines,
  DealDeadlinesSchema,
} from '@skladburg/contracts/deal/v1/deal';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  addCalendarDays,
  BusinessCalendarRangeError,
  getStartOfDayInstant,
  toCalendarDate,
} from '../../calendar/index';
import { RU_BUSINESS_CALENDAR } from '../../calendar/ruBusinessCalendar';
import { DEAL_DEADLINE_RULES } from './dealDeadlineRules';

export const createDealDeadlines = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  deal: Deal,
  kind: 'clear' | 'confirmation' | 'counterOffer',
): DealDeadlines => {
  if (kind === 'clear') {
    return create(DealDeadlinesSchema, {
      calendarVersion: deal.deadlines?.calendarVersion,
      timeZone: deal.deadlines?.timeZone,
    });
  }

  const warehouse = transaction.get('warehouses', deal.shipToWarehouseId);

  if (warehouse?.tenantId !== deal.customerOrganizationId) {
    throw runtime.errors.notFound(EntityKind.WAREHOUSE);
  }

  const { timeZone } = warehouse;
  const start = toCalendarDate(transaction.worldTimeMs, timeZone);
  const workingDays = kind === 'confirmation'
    ? DEAL_DEADLINE_RULES.confirmationWorkingDays
    : DEAL_DEADLINE_RULES.counterOfferWorkingDays;

  try {
    const due = RU_BUSINESS_CALENDAR.addWorkingDays(start, workingDays);
    const calendarVersion = [...new Set([
      RU_BUSINESS_CALENDAR.getCalendarDay(due).version,
      RU_BUSINESS_CALENDAR.getCalendarDay(start).version,
    ])].sort().join(';');
    const dueAt = timestampFromMs(getStartOfDayInstant(addCalendarDays(due, 1), timeZone) - 1);

    return create(DealDeadlinesSchema, {
      calendarVersion,
      confirmationDueAt: kind === 'confirmation' ? dueAt : undefined,
      counterOfferDueAt: kind === 'counterOffer' ? dueAt : undefined,
      timeZone,
    });
  }
  catch (error) {
    if (error instanceof BusinessCalendarRangeError) {
      throw runtime.errors.unavailable();
    }

    throw error;
  }
};
