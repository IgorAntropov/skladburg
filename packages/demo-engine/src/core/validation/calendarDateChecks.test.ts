import { create } from '@bufbuild/protobuf';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import {
  OrganizationRequisitesSchema,
  SaveSignatoryRequestSchema,
  SignatoryBasis,
  SignatorySchema,
} from '@skladburg/contracts/organization/v1/requisites';
import { getContractRegistry } from '@skladburg/contracts/registry';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createDomainErrors } from '../errors/index';
import { createSeededRandom } from '../ports/index';
import { collectCalendarDateViolations } from './calendarDateChecks';
import { createRequestValidator } from './requestValidator';

const UUID = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const OTHER_UUID = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';
const DATE_PATH = 'signatory.power_of_attorney_date';

const validator = createRequestValidator(createDomainErrors(createSeededRandom(1)), getContractRegistry());

const createSignatory = (year: number, month: number, day: number): ReturnType<typeof create<typeof SignatorySchema>> =>
  create(SignatorySchema, {
    basis: SignatoryBasis.POWER_OF_ATTORNEY,
    fullName: 'Тестов Тест Тестович',
    id: OTHER_UUID,
    position: 'менеджер',
    powerOfAttorneyDate: create(CalendarDateSchema, { day, month, year }),
    powerOfAttorneyNumber: '№ 1',
  });

const createSaveRequest = (year: number, month: number, day: number): ReturnType<typeof create<typeof SaveSignatoryRequestSchema>> =>
  create(SaveSignatoryRequestSchema, {
    expectedVersion: 1n,
    idempotencyKey: UUID,
    signatory: createSignatory(year, month, day),
  });

describe('collectCalendarDateViolations', () => {
  it.each([
    [2026, 2, 30],
    [2026, 4, 31],
    [2027, 2, 29],
    [2100, 2, 29],
  ])('rejects the date %i-%i-%i that does not exist', (year, month, day) => {
    expect(validator.collect(SaveSignatoryRequestSchema, createSaveRequest(year, month, day))).toEqual([
      { fieldPath: DATE_PATH, ruleId: 'calendar_date.exists' },
    ]);
  });

  it.each([
    [2028, 2, 29],
    [2026, 4, 30],
    [2026, 12, 31],
    [2000, 1, 1],
  ])('accepts the existing date %i-%i-%i', (year, month, day) => {
    expect(validator.collect(SaveSignatoryRequestSchema, createSaveRequest(year, month, day))).toEqual([]);
  });

  it('reports only the range violation when a part of the date is out of its range', () => {
    expect(validator.collect(SaveSignatoryRequestSchema, createSaveRequest(1999, 2, 30))).toEqual([
      { fieldPath: `${DATE_PATH}.year`, ruleId: 'int32.gte_lte' },
    ]);
  });

  it('skips a date whose path is already violated', () => {
    const request = createSaveRequest(2026, 2, 30);

    expect(collectCalendarDateViolations(SaveSignatoryRequestSchema, request, new Set([DATE_PATH]))).toEqual([]);
    expect(collectCalendarDateViolations(SaveSignatoryRequestSchema, request, new Set([`${DATE_PATH}.day`]))).toEqual([]);
  });

  it('does not take a neighbour path with a common prefix for the same date', () => {
    const request = createSaveRequest(2026, 2, 30);

    expect(collectCalendarDateViolations(SaveSignatoryRequestSchema, request, new Set([`${DATE_PATH}_other`]))).toEqual([
      { fieldPath: DATE_PATH, ruleId: 'calendar_date.exists' },
    ]);
  });

  it('ignores a request without a date', () => {
    const request = create(SaveSignatoryRequestSchema, {
      expectedVersion: 1n,
      idempotencyKey: UUID,
      signatory: create(SignatorySchema, { basis: SignatoryBasis.CHARTER, id: OTHER_UUID }),
    });

    expect(collectCalendarDateViolations(SaveSignatoryRequestSchema, request, new Set())).toEqual([]);
  });

  it('finds dates inside the elements of a list and indexes them', () => {
    const requisites = create(OrganizationRequisitesSchema, {
      signatories: [
        createSignatory(2026, 1, 12),
        createSignatory(2026, 6, 31),
        createSignatory(2027, 2, 29),
      ],
    });

    expect(collectCalendarDateViolations(OrganizationRequisitesSchema, requisites, new Set())).toEqual([
      { fieldPath: 'signatories[1].power_of_attorney_date', ruleId: 'calendar_date.exists' },
      { fieldPath: 'signatories[2].power_of_attorney_date', ruleId: 'calendar_date.exists' },
    ]);
  });

  it('checks a date message that is the request itself', () => {
    const date = create(CalendarDateSchema, { day: 31, month: 11, year: 2026 });

    expect(collectCalendarDateViolations(CalendarDateSchema, date, new Set())).toEqual([
      { fieldPath: '', ruleId: 'calendar_date.exists' },
    ]);
  });
});
