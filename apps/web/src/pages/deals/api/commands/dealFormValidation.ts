import type { CalendarDate } from '@skladburg/contracts/common/v1/date';
import type {
  FormFieldIssueValue,
  FormRulesValue,
} from '@skladburg/contracts/forms';

import { validateFormValues } from '@skladburg/contracts/forms';

import { parseIsoCalendarDate } from '@/shared/lib/calendar-date';
import { expandRepeatedFormRules } from '@/shared/lib/form';

export const validateDealDate = (rules: FormRulesValue, value: string): readonly FormFieldIssueValue[] => {
  const date = parseIsoCalendarDate(value);

  if (date === undefined) {
    return [{ field: 'desiredDate', ruleId: 'deal.date.invalid' }];
  }

  const fields = {
    'desiredDate.day': date.day,
    'desiredDate.month': date.month,
    'desiredDate.year': date.year,
  };
  const issues = validateFormValues(rules, fields, Object.keys(fields));
  if (issues.length > 0) {
    return issues.map(issue => ({ ...issue, field: 'desiredDate' }));
  }

  const lastDay = new Date(Date.UTC(date.year, date.month, 0)).getUTCDate();
  return date.day <= lastDay ? [] : [{ field: 'desiredDate', ruleId: 'deal.date.invalid' }];
};

export const requireDealDate = (value: string): Pick<CalendarDate, 'day' | 'month' | 'year'> => {
  const date = parseIsoCalendarDate(value);
  if (date === undefined) {
    throw new Error('The deal date is invalid');
  }

  return date;
};

export const mapDealDatePath = (field: string): string => field.startsWith('desired_date.') ? 'desired_date' : field;

export const createDealLineRules = (
  rules: FormRulesValue,
  lineRules: FormRulesValue,
  count: number,
  requiredFields: readonly string[],
): FormRulesValue => {
  const expanded = expandRepeatedFormRules(rules, 'lines', lineRules, count);
  const fields = { ...expanded.fields };

  for (let index = 0; index < count; index += 1) {
    for (const name of requiredFields) {
      const path = `lines.${String(index)}.${name}`;
      const rule = fields[path];

      if (rule !== undefined) {
        fields[path] = { ...rule, hasPresence: true, ignore: lineRules.fields[name]?.ignore, isRequired: true };
      }
    }
  }

  return { ...expanded, fields };
};
