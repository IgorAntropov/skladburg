import {
  type BusinessCalendarYearValue,
  type CalendarBasisDocumentValue,
  CalendarBasisKind,
  type CalendarDayExceptionValue,
  CalendarDayKind,
  CalendarYearStatus,
} from './calendarTypes';

const LABOR_CODE_DOCUMENT: CalendarBasisDocumentValue = {
  articles: ['95', '112'],
  date: '2001-12-30',
  kind: CalendarBasisKind.LABOR_CODE,
  number: '197-ФЗ',
  title: 'Трудовой кодекс Российской Федерации',
};

const VERIFIED_BY: readonly string[] = ['КонсультантПлюс', 'Гарант'];

const LABOR_CODE = CalendarBasisKind.LABOR_CODE;
const GOVERNMENT_DECREE = CalendarBasisKind.GOVERNMENT_DECREE;

const EXCEPTIONS_2026: readonly CalendarDayExceptionValue[] = [
  { basis: LABOR_CODE, date: '2026-01-01', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2026-01-02', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2026-01-03', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2026-01-04', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2026-01-05', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2026-01-06', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2026-01-07', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2026-01-08', kind: CalendarDayKind.HOLIDAY },
  { basis: GOVERNMENT_DECREE, date: '2026-01-09', kind: CalendarDayKind.WEEKEND },
  { basis: LABOR_CODE, date: '2026-02-23', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2026-03-08', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2026-03-09', kind: CalendarDayKind.WEEKEND },
  { basis: LABOR_CODE, date: '2026-04-30', kind: CalendarDayKind.SHORTENED },
  { basis: LABOR_CODE, date: '2026-05-01', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2026-05-08', kind: CalendarDayKind.SHORTENED },
  { basis: LABOR_CODE, date: '2026-05-09', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2026-05-11', kind: CalendarDayKind.WEEKEND },
  { basis: LABOR_CODE, date: '2026-06-11', kind: CalendarDayKind.SHORTENED },
  { basis: LABOR_CODE, date: '2026-06-12', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2026-11-03', kind: CalendarDayKind.SHORTENED },
  { basis: LABOR_CODE, date: '2026-11-04', kind: CalendarDayKind.HOLIDAY },
  { basis: GOVERNMENT_DECREE, date: '2026-12-31', kind: CalendarDayKind.WEEKEND },
];

const EXCEPTIONS_2027: readonly CalendarDayExceptionValue[] = [
  { basis: LABOR_CODE, date: '2027-01-01', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2027-01-02', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2027-01-03', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2027-01-04', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2027-01-05', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2027-01-06', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2027-01-07', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2027-01-08', kind: CalendarDayKind.HOLIDAY },
  { basis: GOVERNMENT_DECREE, date: '2027-02-20', kind: CalendarDayKind.SHORTENED },
  { basis: GOVERNMENT_DECREE, date: '2027-02-22', kind: CalendarDayKind.WEEKEND },
  { basis: LABOR_CODE, date: '2027-02-23', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2027-03-08', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2027-04-30', kind: CalendarDayKind.SHORTENED },
  { basis: LABOR_CODE, date: '2027-05-01', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2027-05-03', kind: CalendarDayKind.WEEKEND },
  { basis: LABOR_CODE, date: '2027-05-09', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2027-05-10', kind: CalendarDayKind.WEEKEND },
  { basis: LABOR_CODE, date: '2027-06-11', kind: CalendarDayKind.SHORTENED },
  { basis: LABOR_CODE, date: '2027-06-12', kind: CalendarDayKind.HOLIDAY },
  { basis: LABOR_CODE, date: '2027-06-14', kind: CalendarDayKind.WEEKEND },
  { basis: LABOR_CODE, date: '2027-11-03', kind: CalendarDayKind.SHORTENED },
  { basis: LABOR_CODE, date: '2027-11-04', kind: CalendarDayKind.HOLIDAY },
  { basis: GOVERNMENT_DECREE, date: '2027-11-05', kind: CalendarDayKind.WEEKEND },
  { basis: GOVERNMENT_DECREE, date: '2027-12-31', kind: CalendarDayKind.WEEKEND },
];

export const RU_BUSINESS_CALENDAR_YEARS: readonly BusinessCalendarYearValue[] = [
  {
    basis: [
      LABOR_CODE_DOCUMENT,
      {
        articles: [],
        date: '2025-09-24',
        kind: CalendarBasisKind.GOVERNMENT_DECREE,
        number: '1466',
        title: 'О переносе выходных дней в 2026 году',
      },
    ],
    exceptions: EXCEPTIONS_2026,
    status: CalendarYearStatus.APPROVED,
    verifiedBy: VERIFIED_BY,
    version: '2026.1',
    year: 2026,
  },
  {
    basis: [
      LABOR_CODE_DOCUMENT,
      {
        articles: [],
        date: '2026-09-17',
        kind: CalendarBasisKind.GOVERNMENT_DECREE,
        number: '1187',
        title: 'О переносе выходных дней в 2027 году',
      },
    ],
    exceptions: EXCEPTIONS_2027,
    status: CalendarYearStatus.APPROVED,
    verifiedBy: VERIFIED_BY,
    version: '2027.1',
    year: 2027,
  },
];
