import {
  create,
  fromJson,
  type MessageInitShape,
} from '@bufbuild/protobuf';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  isCorrespondentAccountValid,
  isSettlementAccountValid,
  runFieldCheck,
  validateFormValues,
} from '../forms/index';
import { CalendarDateSchema } from '../gen/common/v1/date_pb';
import {
  SaveSignatoryRequestFormRules,
  UpdateOrganizationRequisitesRequestFormRules,
} from '../gen/forms/organization/v1/requisites_rules';
import {
  type BankAccount,
  BankAccountSchema,
  type OrganizationRequisites,
  OrganizationRequisitesSchema,
  type RemoveSignatoryRequest,
  RemoveSignatoryRequestSchema,
  type SaveSignatoryRequest,
  SaveSignatoryRequestSchema,
  type Signatory,
  SignatoryBasis,
  SignatorySchema,
  type UpdateOrganizationRequisitesRequest,
  UpdateOrganizationRequisitesRequestSchema,
  VatMode,
} from '../gen/organization/v1/requisites_pb';
import { collectViolations } from './collectViolations';

const validUuid = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const otherUuid = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';

const createBank = (overrides: MessageInitShape<typeof BankAccountSchema> = {}): BankAccount =>
  create(BankAccountSchema, {
    bankName: 'АО «Банк Складбург»',
    bik: '040000501',
    correspondentAccount: '30101810600000000501',
    settlementAccount: '40702810300000000001',
    ...overrides,
  });

const createUpdateRequest = (
  overrides: MessageInitShape<typeof UpdateOrganizationRequisitesRequestSchema> = {},
): UpdateOrganizationRequisitesRequest =>
  create(UpdateOrganizationRequisitesRequestSchema, {
    bank: createBank(),
    expectedVersion: 1n,
    idempotencyKey: validUuid,
    legalAddress: '000000, г. Москва, Чайный пер., д. 4',
    vatMode: VatMode.GENERAL,
    ...overrides,
  });

const createSignatory = (overrides: MessageInitShape<typeof SignatorySchema> = {}): Signatory =>
  create(SignatorySchema, {
    basis: SignatoryBasis.CHARTER,
    fullName: 'Смирнова Анна Сергеевна',
    id: validUuid,
    isDefault: true,
    position: 'генеральный директор',
    ...overrides,
  });

const createRequisites = (overrides: MessageInitShape<typeof OrganizationRequisitesSchema> = {}): OrganizationRequisites =>
  create(OrganizationRequisitesSchema, {
    bank: createBank(),
    legalAddress: '000000, г. Москва, Чайный пер., д. 4',
    organizationId: validUuid,
    signatories: [createSignatory()],
    timeZone: 'Europe/Moscow',
    vatMode: VatMode.GENERAL,
    ...overrides,
  });

describe('BankAccount', () => {
  it('accepts a complete bank account', () => {
    expect(collectViolations(BankAccountSchema, createBank())).toEqual([]);
  });

  it.each(['040000501', '040000777'])('accepts BIK %s', (bik) => {
    expect(collectViolations(BankAccountSchema, createBank({ bik }))).toEqual([]);
  });

  it.each(['', '04000050', '0400005011', '050000501', '04000050a'])('rejects BIK "%s"', (bik) => {
    expect(collectViolations(BankAccountSchema, createBank({ bik }))).toEqual([
      { fieldPath: 'bik', ruleId: 'string.pattern' },
    ]);
  });

  it.each(['', '4070281030000000000', '407028103000000000012', '4070281030000000000a'])(
    'rejects settlement account "%s"',
    (settlementAccount) => {
      expect(collectViolations(BankAccountSchema, createBank({ settlementAccount }))).toEqual([
        { fieldPath: 'settlement_account', ruleId: 'string.pattern' },
      ]);
    },
  );

  it.each(['', '3010181060000000050', '301018106000000005011', '3010181060000000050x'])(
    'rejects correspondent account "%s"',
    (correspondentAccount) => {
      expect(collectViolations(BankAccountSchema, createBank({ correspondentAccount }))).toEqual([
        { fieldPath: 'correspondent_account', ruleId: 'string.pattern' },
      ]);
    },
  );

  it('rejects an empty bank name', () => {
    expect(collectViolations(BankAccountSchema, createBank({ bankName: '' }))).toEqual([
      { fieldPath: 'bank_name', ruleId: 'required' },
    ]);
  });

  it('accepts a bank name of 200 characters and rejects 201', () => {
    expect(collectViolations(BankAccountSchema, createBank({ bankName: 'a'.repeat(200) }))).toEqual([]);
    expect(collectViolations(BankAccountSchema, createBank({ bankName: 'a'.repeat(201) }))).toEqual([
      { fieldPath: 'bank_name', ruleId: 'string.max_len' },
    ]);
  });
});

describe('Signatory', () => {
  it('accepts a signatory by charter', () => {
    expect(collectViolations(SignatorySchema, createSignatory())).toEqual([]);
  });

  it('accepts a signatory by power of attorney with number and date', () => {
    const signatory = createSignatory({
      basis: SignatoryBasis.POWER_OF_ATTORNEY,
      isDefault: false,
      powerOfAttorneyDate: create(CalendarDateSchema, { day: 12, month: 1, year: 2026 }),
      powerOfAttorneyNumber: '7',
    });

    expect(collectViolations(SignatorySchema, signatory)).toEqual([]);
  });

  it('rejects an id that is not a UUID', () => {
    expect(collectViolations(SignatorySchema, createSignatory({ id: 'sign-1' }))).toEqual([
      { fieldPath: 'id', ruleId: 'string.uuid' },
    ]);
  });

  it('rejects an empty full name and an empty position', () => {
    const signatory = createSignatory({ fullName: '', position: '' });

    expect(collectViolations(SignatorySchema, signatory)).toEqual([
      { fieldPath: 'full_name', ruleId: 'required' },
      { fieldPath: 'position', ruleId: 'required' },
    ]);
  });

  it('rejects a full name of 201 characters and a position of 121', () => {
    const signatory = createSignatory({ fullName: 'a'.repeat(201), position: 'a'.repeat(121) });

    expect(collectViolations(SignatorySchema, signatory)).toEqual([
      { fieldPath: 'full_name', ruleId: 'string.max_len' },
      { fieldPath: 'position', ruleId: 'string.max_len' },
    ]);
  });

  it('rejects the unspecified basis', () => {
    const signatory = createSignatory({ basis: SignatoryBasis.UNSPECIFIED });

    expect(collectViolations(SignatorySchema, signatory)).toEqual([
      { fieldPath: 'basis', ruleId: 'enum.not_in' },
    ]);
  });

  it('rejects a basis outside the enum', () => {
    const signatory = fromJson(SignatorySchema, {
      basis: 99,
      fullName: 'Иванов Иван',
      id: validUuid,
      position: 'директор',
    });

    expect(collectViolations(SignatorySchema, signatory)).toEqual([
      { fieldPath: 'basis', ruleId: 'enum.defined_only' },
    ]);
  });

  it('rejects a power of attorney number of 41 characters', () => {
    const signatory = createSignatory({ powerOfAttorneyNumber: 'a'.repeat(41) });

    expect(collectViolations(SignatorySchema, signatory)).toEqual([
      { fieldPath: 'power_of_attorney_number', ruleId: 'string.max_len' },
    ]);
  });

  it('validates the power of attorney date inside the signatory', () => {
    const signatory = createSignatory({
      powerOfAttorneyDate: create(CalendarDateSchema, { day: 32, month: 1, year: 2026 }),
    });

    expect(collectViolations(SignatorySchema, signatory)).toEqual([
      { fieldPath: 'power_of_attorney_date.day', ruleId: 'int32.gte_lte' },
    ]);
  });
});

describe('CalendarDate', () => {
  it.each([
    { day: 1, month: 1, year: 2000 },
    { day: 31, month: 12, year: 2100 },
    { day: 12, month: 1, year: 2026 },
  ])('accepts %o', (value) => {
    expect(collectViolations(CalendarDateSchema, create(CalendarDateSchema, value))).toEqual([]);
  });

  it.each([
    { expected: { fieldPath: 'year', ruleId: 'int32.gte_lte' }, value: { day: 1, month: 1, year: 1999 } },
    { expected: { fieldPath: 'year', ruleId: 'int32.gte_lte' }, value: { day: 1, month: 1, year: 2101 } },
    { expected: { fieldPath: 'month', ruleId: 'int32.gte_lte' }, value: { day: 1, month: 0, year: 2026 } },
    { expected: { fieldPath: 'month', ruleId: 'int32.gte_lte' }, value: { day: 1, month: 13, year: 2026 } },
    { expected: { fieldPath: 'day', ruleId: 'int32.gte_lte' }, value: { day: 0, month: 1, year: 2026 } },
    { expected: { fieldPath: 'day', ruleId: 'int32.gte_lte' }, value: { day: 32, month: 1, year: 2026 } },
  ])('rejects $expected.fieldPath with $expected.ruleId', ({ expected, value }) => {
    expect(collectViolations(CalendarDateSchema, create(CalendarDateSchema, value))).toEqual([expected]);
  });
});

describe('OrganizationRequisites', () => {
  it('accepts complete requisites', () => {
    expect(collectViolations(OrganizationRequisitesSchema, createRequisites())).toEqual([]);
  });

  it('rejects an organization id that is not a UUID', () => {
    const requisites = createRequisites({ organizationId: 'org-1' });

    expect(collectViolations(OrganizationRequisitesSchema, requisites)).toEqual([
      { fieldPath: 'organization_id', ruleId: 'string.uuid' },
    ]);
  });

  it('rejects an empty legal address and accepts 500 characters', () => {
    expect(collectViolations(OrganizationRequisitesSchema, createRequisites({ legalAddress: '' }))).toEqual([
      { fieldPath: 'legal_address', ruleId: 'required' },
    ]);
    expect(collectViolations(OrganizationRequisitesSchema, createRequisites({ legalAddress: 'a'.repeat(500) }))).toEqual([]);
    expect(collectViolations(OrganizationRequisitesSchema, createRequisites({ legalAddress: 'a'.repeat(501) }))).toEqual([
      { fieldPath: 'legal_address', ruleId: 'string.max_len' },
    ]);
  });

  it.each(['Europe/Moscow', 'Asia/Yekaterinburg', 'Asia/Novosibirsk'])('accepts time zone %s', (timeZone) => {
    expect(collectViolations(OrganizationRequisitesSchema, createRequisites({ timeZone }))).toEqual([]);
  });

  it.each(['Moscow', 'UTC+3'])('rejects time zone "%s"', (timeZone) => {
    expect(collectViolations(OrganizationRequisitesSchema, createRequisites({ timeZone }))).toEqual([
      { fieldPath: 'time_zone', ruleId: 'string.pattern' },
    ]);
  });

  it('rejects an empty time zone as missing', () => {
    expect(collectViolations(OrganizationRequisitesSchema, createRequisites({ timeZone: '' }))).toEqual([
      { fieldPath: 'time_zone', ruleId: 'required' },
    ]);
  });

  it('rejects requisites without a bank', () => {
    expect(collectViolations(OrganizationRequisitesSchema, createRequisites({ bank: undefined }))).toEqual([
      { fieldPath: 'bank', ruleId: 'required' },
    ]);
  });

  it('validates the bank inside the requisites', () => {
    const requisites = createRequisites({ bank: createBank({ bik: '123' }) });

    expect(collectViolations(OrganizationRequisitesSchema, requisites)).toEqual([
      { fieldPath: 'bank.bik', ruleId: 'string.pattern' },
    ]);
  });

  it('rejects the unspecified VAT mode', () => {
    const requisites = createRequisites({ vatMode: VatMode.UNSPECIFIED });

    expect(collectViolations(OrganizationRequisitesSchema, requisites)).toEqual([
      { fieldPath: 'vat_mode', ruleId: 'enum.not_in' },
    ]);
  });

  it.each([VatMode.GENERAL, VatMode.SIMPLIFIED_WITH_VAT, VatMode.WITHOUT_VAT])('accepts VAT mode %s', (vatMode) => {
    expect(collectViolations(OrganizationRequisitesSchema, createRequisites({ vatMode }))).toEqual([]);
  });

  it('rejects requisites without signatories', () => {
    expect(collectViolations(OrganizationRequisitesSchema, createRequisites({ signatories: [] }))).toEqual([
      { fieldPath: 'signatories', ruleId: 'repeated.min_items' },
    ]);
  });

  it('accepts ten signatories and rejects eleven', () => {
    const buildSignatories = (count: number): Signatory[] =>
      Array.from({ length: count }, (_, index) => createSignatory({ id: index % 2 === 0 ? validUuid : otherUuid, isDefault: index === 0 }));

    expect(collectViolations(OrganizationRequisitesSchema, createRequisites({ signatories: buildSignatories(10) }))).toEqual([]);
    expect(collectViolations(OrganizationRequisitesSchema, createRequisites({ signatories: buildSignatories(11) }))).toEqual([
      { fieldPath: 'signatories', ruleId: 'repeated.max_items' },
    ]);
  });

  it('validates every signatory with the index of the element', () => {
    const requisites = createRequisites({
      signatories: [createSignatory(), createSignatory({ fullName: '' })],
    });

    expect(collectViolations(OrganizationRequisitesSchema, requisites)).toEqual([
      { fieldPath: 'signatories[1].full_name', ruleId: 'required' },
    ]);
  });
});

describe('UpdateOrganizationRequisitesRequest', () => {
  it('accepts a complete request', () => {
    expect(collectViolations(UpdateOrganizationRequisitesRequestSchema, createUpdateRequest())).toEqual([]);
  });

  it('rejects an idempotency key that is not a UUID', () => {
    expect(collectViolations(UpdateOrganizationRequisitesRequestSchema, createUpdateRequest({ idempotencyKey: 'key-1' }))).toEqual([
      { fieldPath: 'idempotency_key', ruleId: 'string.uuid' },
    ]);
  });

  it.each([0n, -1n])('rejects the expected version %s', (expectedVersion) => {
    expect(collectViolations(UpdateOrganizationRequisitesRequestSchema, createUpdateRequest({ expectedVersion }))).toEqual([
      { fieldPath: 'expected_version', ruleId: 'int64.gte' },
    ]);
  });

  it('rejects an empty legal address and accepts 500 characters', () => {
    expect(collectViolations(UpdateOrganizationRequisitesRequestSchema, createUpdateRequest({ legalAddress: '' }))).toEqual([
      { fieldPath: 'legal_address', ruleId: 'required' },
    ]);
    expect(collectViolations(
      UpdateOrganizationRequisitesRequestSchema,
      createUpdateRequest({ legalAddress: 'a'.repeat(500) }),
    )).toEqual([]);
    expect(collectViolations(UpdateOrganizationRequisitesRequestSchema, createUpdateRequest({ legalAddress: 'a'.repeat(501) }))).toEqual([
      { fieldPath: 'legal_address', ruleId: 'string.max_len' },
    ]);
  });

  it('rejects the unspecified VAT mode', () => {
    expect(collectViolations(UpdateOrganizationRequisitesRequestSchema, createUpdateRequest({ vatMode: VatMode.UNSPECIFIED }))).toEqual([
      { fieldPath: 'vat_mode', ruleId: 'enum.not_in' },
    ]);
  });

  it('rejects a request without a bank and validates the bank inside', () => {
    expect(collectViolations(UpdateOrganizationRequisitesRequestSchema, createUpdateRequest({ bank: undefined }))).toEqual([
      { fieldPath: 'bank', ruleId: 'required' },
    ]);
    expect(collectViolations(
      UpdateOrganizationRequisitesRequestSchema,
      createUpdateRequest({ bank: createBank({ bankName: '' }) }),
    )).toEqual([
      { fieldPath: 'bank.bank_name', ruleId: 'required' },
    ]);
  });
});

describe('the bank checks in the table of UpdateOrganizationRequisitesRequest', () => {
  const names = ['bank.bik', 'bank.settlementAccount', 'bank.correspondentAccount'];
  const values = {
    'bank.bik': '040000501',
    'bank.correspondentAccount': '30101810600000000501',
    'bank.settlementAccount': '40702810300000000001',
  };

  it('accepts the accounts of the test bank', () => {
    expect(isSettlementAccountValid(values['bank.bik'], values['bank.settlementAccount'])).toBe(true);
    expect(isCorrespondentAccountValid(values['bank.bik'], values['bank.correspondentAccount'])).toBe(true);
    expect(validateFormValues(UpdateOrganizationRequisitesRequestFormRules, values, names, { runCheck: runFieldCheck })).toEqual([]);
  });

  it('reports a wrong key of the settlement account on the nested field', () => {
    expect(validateFormValues(
      UpdateOrganizationRequisitesRequestFormRules,
      { ...values, 'bank.settlementAccount': '40702810400000000001' },
      names,
      { runCheck: runFieldCheck },
    )).toEqual([{ field: 'bank.settlementAccount', ruleId: 'field_check.settlement_account' }]);
  });

  it('reports a wrong key of the correspondent account on the nested field', () => {
    expect(validateFormValues(
      UpdateOrganizationRequisitesRequestFormRules,
      { ...values, 'bank.correspondentAccount': '30101810700000000501' },
      names,
      { runCheck: runFieldCheck },
    )).toEqual([{ field: 'bank.correspondentAccount', ruleId: 'field_check.correspondent_account' }]);
  });

  it('keeps silent about the accounts while the BIK is wrong', () => {
    expect(validateFormValues(
      UpdateOrganizationRequisitesRequestFormRules,
      { ...values, 'bank.bik': '04000050', 'bank.settlementAccount': '40702810400000000001' },
      names,
      { runCheck: runFieldCheck },
    )).toEqual([{ field: 'bank.bik', ruleId: 'string.pattern' }]);
  });
});

const createSaveSignatoryRequest = (
  overrides: MessageInitShape<typeof SaveSignatoryRequestSchema> = {},
): SaveSignatoryRequest =>
  create(SaveSignatoryRequestSchema, {
    expectedVersion: 1n,
    idempotencyKey: validUuid,
    signatory: createSignatory(),
    ...overrides,
  });

const createRemoveSignatoryRequest = (
  overrides: MessageInitShape<typeof RemoveSignatoryRequestSchema> = {},
): RemoveSignatoryRequest =>
  create(RemoveSignatoryRequestSchema, {
    expectedVersion: 1n,
    idempotencyKey: validUuid,
    signatoryId: otherUuid,
    ...overrides,
  });

describe('SaveSignatoryRequest', () => {
  it('accepts a complete request', () => {
    expect(collectViolations(SaveSignatoryRequestSchema, createSaveSignatoryRequest())).toEqual([]);
  });

  it('rejects an idempotency key that is not a UUID', () => {
    expect(collectViolations(SaveSignatoryRequestSchema, createSaveSignatoryRequest({ idempotencyKey: 'key-1' }))).toEqual([
      { fieldPath: 'idempotency_key', ruleId: 'string.uuid' },
    ]);
  });

  it.each([0n, -1n])('rejects the expected version %s', (expectedVersion) => {
    expect(collectViolations(SaveSignatoryRequestSchema, createSaveSignatoryRequest({ expectedVersion }))).toEqual([
      { fieldPath: 'expected_version', ruleId: 'int64.gte' },
    ]);
  });

  it('rejects a request without a signatory', () => {
    expect(collectViolations(SaveSignatoryRequestSchema, createSaveSignatoryRequest({ signatory: undefined }))).toEqual([
      { fieldPath: 'signatory', ruleId: 'required' },
    ]);
  });

  it('validates the signatory inside with the nested path', () => {
    expect(collectViolations(
      SaveSignatoryRequestSchema,
      createSaveSignatoryRequest({ signatory: createSignatory({ fullName: '', id: 'new' }) }),
    )).toEqual([
      { fieldPath: 'signatory.id', ruleId: 'string.uuid' },
      { fieldPath: 'signatory.full_name', ruleId: 'required' },
    ]);
  });

  it('validates the parts of the power of attorney date inside the signatory', () => {
    expect(collectViolations(
      SaveSignatoryRequestSchema,
      createSaveSignatoryRequest({
        signatory: createSignatory({ powerOfAttorneyDate: create(CalendarDateSchema, { day: 1, month: 1, year: 1999 }) }),
      }),
    )).toEqual([
      { fieldPath: 'signatory.power_of_attorney_date.year', ruleId: 'int32.gte_lte' },
    ]);
  });
});

describe('RemoveSignatoryRequest', () => {
  it('accepts a complete request', () => {
    expect(collectViolations(RemoveSignatoryRequestSchema, createRemoveSignatoryRequest())).toEqual([]);
  });

  it('rejects an idempotency key and a signatory id that are not UUIDs', () => {
    expect(collectViolations(
      RemoveSignatoryRequestSchema,
      createRemoveSignatoryRequest({ idempotencyKey: 'key-1', signatoryId: 'new' }),
    )).toEqual([
      { fieldPath: 'idempotency_key', ruleId: 'string.uuid' },
      { fieldPath: 'signatory_id', ruleId: 'string.uuid' },
    ]);
  });

  it.each([0n, -1n])('rejects the expected version %s', (expectedVersion) => {
    expect(collectViolations(RemoveSignatoryRequestSchema, createRemoveSignatoryRequest({ expectedVersion }))).toEqual([
      { fieldPath: 'expected_version', ruleId: 'int64.gte' },
    ]);
  });
});

describe('the table of SaveSignatoryRequest', () => {
  const names = [
    'signatory.fullName',
    'signatory.position',
    'signatory.basis',
    'signatory.powerOfAttorneyNumber',
    'signatory.powerOfAttorneyDate.year',
    'signatory.powerOfAttorneyDate.month',
    'signatory.powerOfAttorneyDate.day',
  ];

  it('checks the parts of an absent ancestor as before when the values do not mention it', () => {
    expect(validateFormValues(
      SaveSignatoryRequestFormRules,
      { 'signatory.basis': SignatoryBasis.CHARTER, 'signatory.fullName': 'Тестов Тест Тестович', 'signatory.position': 'директор' },
      names,
    )).toEqual([
      { field: 'signatory.powerOfAttorneyDate.year', ruleId: 'int32.gte_lte' },
      { field: 'signatory.powerOfAttorneyDate.month', ruleId: 'int32.gte_lte' },
      { field: 'signatory.powerOfAttorneyDate.day', ruleId: 'int32.gte_lte' },
    ]);
  });

  it('skips the parts of the date while the date is not set', () => {
    expect(validateFormValues(
      SaveSignatoryRequestFormRules,
      {
        'signatory.basis': SignatoryBasis.CHARTER,
        'signatory.fullName': 'Тестов Тест Тестович',
        'signatory.position': 'директор',
        'signatory.powerOfAttorneyDate': undefined,
      },
      names,
    )).toEqual([]);
  });

  it('checks the parts of the date once the date is set', () => {
    expect(validateFormValues(
      SaveSignatoryRequestFormRules,
      {
        'signatory.basis': SignatoryBasis.POWER_OF_ATTORNEY,
        'signatory.fullName': 'Тестов Тест Тестович',
        'signatory.position': 'менеджер',
        'signatory.powerOfAttorneyDate': {},
        'signatory.powerOfAttorneyDate.day': 12,
        'signatory.powerOfAttorneyDate.month': 1,
        'signatory.powerOfAttorneyDate.year': 1999,
      },
      names,
    )).toEqual([{ field: 'signatory.powerOfAttorneyDate.year', ruleId: 'int32.gte_lte' }]);
  });
});
