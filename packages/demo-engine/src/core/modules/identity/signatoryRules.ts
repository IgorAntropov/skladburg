import {
  type Signatory,
  SignatoryBasis,
} from '@skladburg/contracts/organization/v1/requisites';

import type { CalendarDateValue } from '../../calendar/calendarDate';
import type { ViolationValue } from '../../errors/index';

import {
  compareCalendarDates,
  isCalendarDateExisting,
} from '../../calendar/calendarDate';

export const SIGNATORY_NUMBER_PATH = 'signatory.power_of_attorney_number';
export const SIGNATORY_DATE_PATH = 'signatory.power_of_attorney_date';
export const SIGNATORY_NUMBER_REQUIRED_RULE_ID = 'signatory.power_of_attorney_number_required';
export const SIGNATORY_DATE_REQUIRED_RULE_ID = 'signatory.power_of_attorney_date_required';
export const SIGNATORY_DATE_NOT_FUTURE_RULE_ID = 'signatory.power_of_attorney_date_not_future';

export const collectSignatoryViolations = (signatory: Signatory, today: CalendarDateValue): ViolationValue[] => {
  if (signatory.basis !== SignatoryBasis.POWER_OF_ATTORNEY) {
    return [];
  }

  const violations: ViolationValue[] = [];
  const attorneyDate = signatory.powerOfAttorneyDate;

  if (signatory.powerOfAttorneyNumber.trim() === '') {
    violations.push({ fieldPath: SIGNATORY_NUMBER_PATH, ruleId: SIGNATORY_NUMBER_REQUIRED_RULE_ID });
  }

  if (attorneyDate === undefined) {
    violations.push({ fieldPath: SIGNATORY_DATE_PATH, ruleId: SIGNATORY_DATE_REQUIRED_RULE_ID });

    return violations;
  }

  const date: CalendarDateValue = { day: attorneyDate.day, month: attorneyDate.month, year: attorneyDate.year };

  if (isCalendarDateExisting(date) && compareCalendarDates(date, today) > 0) {
    violations.push({ fieldPath: SIGNATORY_DATE_PATH, ruleId: SIGNATORY_DATE_NOT_FUTURE_RULE_ID });
  }

  return violations;
};
