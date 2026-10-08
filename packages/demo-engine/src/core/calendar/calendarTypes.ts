import type { CalendarDateValue } from './calendarDate';

export const CalendarDayKind = {
  HOLIDAY: 'holiday',
  SHORTENED: 'shortened',
  WEEKEND: 'weekend',
  WORKING: 'working',
} as const;

export type CalendarDayKindValue = (typeof CalendarDayKind)[keyof typeof CalendarDayKind];

export const CalendarBasisKind = {
  GOVERNMENT_DECREE: 'government_decree',
  LABOR_CODE: 'labor_code',
} as const;

export type CalendarBasisKindValue = (typeof CalendarBasisKind)[keyof typeof CalendarBasisKind];

export type CalendarDayBasisValue = CalendarBasisKindValue;

export const CalendarYearStatus = {
  APPROVED: 'approved',
  DRAFT: 'draft',
} as const;

export interface BusinessCalendarYearValue {
  basis: readonly CalendarBasisDocumentValue[];
  exceptions: readonly CalendarDayExceptionValue[];
  status: CalendarYearStatusValue;
  verifiedBy: readonly string[];
  version: string;
  year: number;
}

export interface CalendarBasisDocumentValue {
  articles: readonly string[];
  date: string;
  kind: CalendarBasisKindValue;
  number: string;
  title: string;
}

export interface CalendarDayExceptionValue {
  basis: CalendarDayBasisValue;
  date: string;
  kind: CalendarDayKindValue;
}

export interface CalendarDayValue {
  basis: CalendarDayBasisValue | undefined;
  date: CalendarDateValue;
  isWorking: boolean;
  kind: CalendarDayKindValue;
  version: string;
  workingHours: number;
}

export type CalendarYearStatusValue = (typeof CalendarYearStatus)[keyof typeof CalendarYearStatus];
