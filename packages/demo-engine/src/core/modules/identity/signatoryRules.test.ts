import {
  create,
  type MessageInitShape,
} from '@bufbuild/protobuf';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import {
  SignatoryBasis,
  SignatorySchema,
} from '@skladburg/contracts/organization/v1/requisites';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { toCalendarDate } from '../../calendar/index';
import { collectSignatoryViolations } from './signatoryRules';

const TODAY = { day: 12, month: 10, year: 2026 };

const createAttorneySignatory = (
  overrides: MessageInitShape<typeof SignatorySchema> = {},
): ReturnType<typeof create<typeof SignatorySchema>> =>
  create(SignatorySchema, {
    basis: SignatoryBasis.POWER_OF_ATTORNEY,
    fullName: 'Тестов Тест Тестович',
    id: '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890',
    position: 'менеджер',
    powerOfAttorneyDate: create(CalendarDateSchema, { day: 12, month: 1, year: 2026 }),
    powerOfAttorneyNumber: '№ 7',
    ...overrides,
  });

describe('collectSignatoryViolations', () => {
  it('accepts a signatory by power of attorney with a number and a past date', () => {
    expect(collectSignatoryViolations(createAttorneySignatory(), TODAY)).toEqual([]);
  });

  it('accepts the date of today', () => {
    const signatory = createAttorneySignatory({ powerOfAttorneyDate: create(CalendarDateSchema, TODAY) });

    expect(collectSignatoryViolations(signatory, TODAY)).toEqual([]);
  });

  it.each(['', '   ', '\t'])('requires a number when it is %j', (number) => {
    expect(collectSignatoryViolations(createAttorneySignatory({ powerOfAttorneyNumber: number }), TODAY)).toEqual([
      { fieldPath: 'signatory.power_of_attorney_number', ruleId: 'signatory.power_of_attorney_number_required' },
    ]);
  });

  it('requires a date', () => {
    expect(collectSignatoryViolations(createAttorneySignatory({ powerOfAttorneyDate: undefined }), TODAY)).toEqual([
      { fieldPath: 'signatory.power_of_attorney_date', ruleId: 'signatory.power_of_attorney_date_required' },
    ]);
  });

  it('reports both missing parts at once', () => {
    const signatory = createAttorneySignatory({ powerOfAttorneyDate: undefined, powerOfAttorneyNumber: '' });

    expect(collectSignatoryViolations(signatory, TODAY).map(violation => violation.ruleId)).toEqual([
      'signatory.power_of_attorney_number_required',
      'signatory.power_of_attorney_date_required',
    ]);
  });

  it('rejects a date after today', () => {
    const signatory = createAttorneySignatory({ powerOfAttorneyDate: create(CalendarDateSchema, { day: 13, month: 10, year: 2026 }) });

    expect(collectSignatoryViolations(signatory, TODAY)).toEqual([
      { fieldPath: 'signatory.power_of_attorney_date', ruleId: 'signatory.power_of_attorney_date_not_future' },
    ]);
  });

  it('does not judge a date that does not exist, the request validation does', () => {
    const signatory = createAttorneySignatory({ powerOfAttorneyDate: create(CalendarDateSchema, { day: 31, month: 4, year: 2030 }) });

    expect(collectSignatoryViolations(signatory, TODAY)).toEqual([]);
  });

  it('checks nothing of the power of attorney for a signatory by charter', () => {
    const signatory = createAttorneySignatory({
      basis: SignatoryBasis.CHARTER,
      powerOfAttorneyDate: undefined,
      powerOfAttorneyNumber: '',
    });

    expect(collectSignatoryViolations(signatory, TODAY)).toEqual([]);
  });

  it('takes today in the zone of the organization: at 21:30 UTC it is already tomorrow in Moscow', () => {
    const instantMs = Date.UTC(2026, 9, 12, 21, 30, 0);
    const moscowToday = toCalendarDate(instantMs, 'Europe/Moscow');
    const tomorrowInMoscow = create(CalendarDateSchema, { day: 13, month: 10, year: 2026 });
    const dayAfterInMoscow = create(CalendarDateSchema, { day: 14, month: 10, year: 2026 });

    expect(moscowToday).toEqual({ day: 13, month: 10, year: 2026 });
    expect(collectSignatoryViolations(createAttorneySignatory({ powerOfAttorneyDate: tomorrowInMoscow }), moscowToday)).toEqual([]);
    expect(collectSignatoryViolations(createAttorneySignatory({ powerOfAttorneyDate: dayAfterInMoscow }), moscowToday)).toHaveLength(1);
  });
});
