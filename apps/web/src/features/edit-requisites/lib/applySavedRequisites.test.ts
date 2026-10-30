import type { DescMessage } from '@bufbuild/protobuf';
import type { CalendarDate } from '@skladburg/contracts/common/v1/date';
import type {
  BankAccount,
  OrganizationRequisites,
  Signatory,
} from '@skladburg/contracts/organization/v1/requisites';

import { create } from '@bufbuild/protobuf';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import {
  BankAccountSchema,
  OrganizationRequisitesSchema,
  SignatoryBasis,
  SignatorySchema,
  VatMode,
} from '@skladburg/contracts/organization/v1/requisites';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  ApplySavedRequisitesOptionsValue,
  RequisitesEditorStateValue,
  RequisitesSavedSourceValue,
} from './applySavedRequisites';

import { applySavedRequisites } from './applySavedRequisites';

interface CaseValue {
  expected: ExpectedValue;
  isFormDirty: boolean;
  isSignatoryEditing: boolean;
  name: string;
  saved: ChangeValue;
  source: RequisitesSavedSourceValue;
}

interface ChangeValue {
  bankName?: string;
  fullName?: string;
  version: bigint;
}

interface ExpectedValue {
  epoch: number;
  formVersion: bigint;
  signatoriesVersion: bigint;
}

const BASE_VERSION = 3n;
const NEXT_VERSION = 4n;
const RELOADED_VERSION = 9n;

const createRequisites = ({ bankName = 'Банк «Север»', fullName = 'Тестов Тест Тестович', version }: ChangeValue): OrganizationRequisites =>
  create(OrganizationRequisitesSchema, {
    bank: create(BankAccountSchema, {
      bankName,
      bik: '040000501',
      correspondentAccount: '30101810600000000501',
      settlementAccount: '40702810300000000001',
    }),
    legalAddress: 'г. Вымышленск, ул. Тестовая, д. 1',
    signatories: [
      create(SignatorySchema, {
        basis: SignatoryBasis.CHARTER,
        fullName,
        id: '0b9c1f3e-6d4a-4e55-8f1d-7a2b3c4d5e6f',
        isDefault: true,
        position: 'Директор',
      }),
    ],
    timeZone: 'Europe/Moscow',
    vatMode: VatMode.GENERAL,
    version,
  });

const createState = (): RequisitesEditorStateValue => ({
  epoch: 0,
  formVersion: BASE_VERSION,
  requisites: createRequisites({ version: BASE_VERSION }),
  signatoriesVersion: BASE_VERSION,
});

const createOptions = (item: CaseValue): ApplySavedRequisitesOptionsValue => ({
  isFormDirty: item.isFormDirty,
  isSignatoryEditing: item.isSignatoryEditing,
  source: item.source,
});

const CASES: CaseValue[] = [
  {
    expected: { epoch: 0, formVersion: NEXT_VERSION, signatoriesVersion: NEXT_VERSION },
    isFormDirty: false,
    isSignatoryEditing: false,
    name: 'the form saved its data: both parts move to the new version',
    saved: { bankName: 'Банк «Юг»', version: NEXT_VERSION },
    source: 'form',
  },
  {
    expected: { epoch: 0, formVersion: NEXT_VERSION, signatoriesVersion: NEXT_VERSION },
    isFormDirty: false,
    isSignatoryEditing: true,
    name: 'the form saved its data while a signatory is being edited and the list is the same',
    saved: { bankName: 'Банк «Юг»', version: NEXT_VERSION },
    source: 'form',
  },
  {
    expected: { epoch: 0, formVersion: NEXT_VERSION, signatoriesVersion: BASE_VERSION },
    isFormDirty: false,
    isSignatoryEditing: true,
    name: 'the form saved its data while the list was changed in another tab and a signatory is being edited: the list keeps its version',
    saved: { bankName: 'Банк «Юг»', fullName: 'Образцов Образец Образцович', version: NEXT_VERSION },
    source: 'form',
  },
  {
    expected: { epoch: 0, formVersion: NEXT_VERSION, signatoriesVersion: NEXT_VERSION },
    isFormDirty: false,
    isSignatoryEditing: false,
    name: 'the form saved its data and the list was changed in another tab, no editing: the list moves to the new version',
    saved: { bankName: 'Банк «Юг»', fullName: 'Образцов Образец Образцович', version: NEXT_VERSION },
    source: 'form',
  },
  {
    expected: { epoch: 0, formVersion: NEXT_VERSION, signatoriesVersion: NEXT_VERSION },
    isFormDirty: true,
    isSignatoryEditing: false,
    name: 'a signatory was saved, the form has edits and its data did not change: the form moves to the new version',
    saved: { fullName: 'Образцов Образец Образцович', version: NEXT_VERSION },
    source: 'signatories',
  },
  {
    expected: { epoch: 0, formVersion: BASE_VERSION, signatoriesVersion: NEXT_VERSION },
    isFormDirty: true,
    isSignatoryEditing: false,
    name: 'a signatory was saved, the form has edits and its data was changed in another tab: the form keeps its version and its values',
    saved: { bankName: 'Банк «Юг»', fullName: 'Образцов Образец Образцович', version: NEXT_VERSION },
    source: 'signatories',
  },
  {
    expected: { epoch: 1, formVersion: NEXT_VERSION, signatoriesVersion: NEXT_VERSION },
    isFormDirty: false,
    isSignatoryEditing: false,
    name: 'a signatory was saved, the form has no edits and its data was changed in another tab: the form is created again',
    saved: { bankName: 'Банк «Юг»', fullName: 'Образцов Образец Образцович', version: NEXT_VERSION },
    source: 'signatories',
  },
  {
    expected: { epoch: 0, formVersion: NEXT_VERSION, signatoriesVersion: NEXT_VERSION },
    isFormDirty: false,
    isSignatoryEditing: false,
    name: 'a signatory was saved, the form has no edits and its data is the same: the form is kept',
    saved: { fullName: 'Образцов Образец Образцович', version: NEXT_VERSION },
    source: 'signatories',
  },
  {
    expected: { epoch: 0, formVersion: NEXT_VERSION, signatoriesVersion: NEXT_VERSION },
    isFormDirty: true,
    isSignatoryEditing: true,
    name: 'a signatory was saved from the editor while the form has edits and the form data did not change',
    saved: { fullName: 'Образцов Образец Образцович', version: NEXT_VERSION },
    source: 'signatories',
  },
  {
    expected: { epoch: 1, formVersion: RELOADED_VERSION, signatoriesVersion: RELOADED_VERSION },
    isFormDirty: true,
    isSignatoryEditing: true,
    name: 'the actual data were requested: both parts move to the new version and the form is created again',
    saved: { bankName: 'Банк «Юг»', fullName: 'Образцов Образец Образцович', version: RELOADED_VERSION },
    source: 'reload',
  },
];

describe('applySavedRequisites', () => {
  it.each(CASES)('$name', (item) => {
    const saved = createRequisites(item.saved);

    const next = applySavedRequisites(createState(), saved, createOptions(item));

    expect(next.requisites).toBe(saved);
    expect({
      epoch: next.epoch,
      formVersion: next.formVersion,
      signatoriesVersion: next.signatoriesVersion,
    }).toEqual(item.expected);
  });

  it('does not change the state it was given', () => {
    const state = createState();
    const snapshot = { ...state };

    applySavedRequisites(state, createRequisites({ bankName: 'Банк «Юг»', version: NEXT_VERSION }), {
      isFormDirty: true,
      isSignatoryEditing: true,
      source: 'signatories',
    });

    expect(state).toEqual(snapshot);
  });
});

type FieldChangeValue<TMessage> = (message: TMessage) => void;

const UNCOMPARED_REQUISITES_FIELDS = ['organizationId', 'signatories', 'timeZone', 'version'];

const REQUISITES_FIELD_CHANGES: Readonly<Record<string, FieldChangeValue<OrganizationRequisites>>> = {
  bank: (requisites) => {
    requisites.bank = undefined;
  },
  legalAddress: (requisites) => {
    requisites.legalAddress = 'г. Вымышленск, ул. Новая, д. 2';
  },
  vatMode: (requisites) => {
    requisites.vatMode = VatMode.WITHOUT_VAT;
  },
};

const BANK_FIELD_CHANGES: Readonly<Record<string, FieldChangeValue<BankAccount>>> = {
  bankName: (bank) => {
    bank.bankName = 'Банк «Юг»';
  },
  bik: (bank) => {
    bank.bik = '040000777';
  },
  correspondentAccount: (bank) => {
    bank.correspondentAccount = '30101810600000000777';
  },
  settlementAccount: (bank) => {
    bank.settlementAccount = '40702810300000000002';
  },
};

const SIGNATORY_FIELD_CHANGES: Readonly<Record<string, FieldChangeValue<Signatory>>> = {
  basis: (signatory) => {
    signatory.basis = SignatoryBasis.POWER_OF_ATTORNEY;
  },
  fullName: (signatory) => {
    signatory.fullName = 'Образцов Образец Образцович';
  },
  id: (signatory) => {
    signatory.id = '5d2e8a41-3b7c-4f60-9a1e-2c4b6d8f0a13';
  },
  isDefault: (signatory) => {
    signatory.isDefault = false;
  },
  position: (signatory) => {
    signatory.position = 'Бухгалтер';
  },
  powerOfAttorneyDate: (signatory) => {
    signatory.powerOfAttorneyDate = undefined;
  },
  powerOfAttorneyNumber: (signatory) => {
    signatory.powerOfAttorneyNumber = 'Д-0001';
  },
};

const DATE_FIELD_CHANGES: Readonly<Record<string, FieldChangeValue<CalendarDate>>> = {
  day: (date) => {
    date.day = 15;
  },
  month: (date) => {
    date.month = 4;
  },
  year: (date) => {
    date.year = 2024;
  },
};

const readFieldNames = (schema: DescMessage): string[] => schema.fields.map(field => field.localName).toSorted();

const readFirstSignatory = (requisites: OrganizationRequisites): Signatory => {
  const [signatory] = requisites.signatories;

  if (signatory === undefined) {
    throw new Error('the requisites have no signatory');
  }

  return signatory;
};

const createRequisitesWithDate = (version: bigint): OrganizationRequisites => {
  const requisites = createRequisites({ version });

  readFirstSignatory(requisites).powerOfAttorneyDate = create(CalendarDateSchema, { day: 14, month: 3, year: 2025 });

  return requisites;
};

const isFormChangeNoticed = (saved: OrganizationRequisites): boolean =>
  applySavedRequisites(createState(), saved, {
    isFormDirty: true,
    isSignatoryEditing: false,
    source: 'signatories',
  }).formVersion === BASE_VERSION;

const isSignatoryChangeNoticed = (state: RequisitesEditorStateValue, saved: OrganizationRequisites): boolean =>
  applySavedRequisites(state, saved, {
    isFormDirty: false,
    isSignatoryEditing: true,
    source: 'form',
  }).signatoriesVersion === BASE_VERSION;

describe('applySavedRequisites field coverage', () => {
  it('compares or deliberately skips every field of the requisites, the bank, the signatory and the date', () => {
    const requisitesFields = [...Object.keys(REQUISITES_FIELD_CHANGES), ...UNCOMPARED_REQUISITES_FIELDS];

    expect(readFieldNames(OrganizationRequisitesSchema)).toEqual(requisitesFields.toSorted());
    expect(readFieldNames(BankAccountSchema)).toEqual(Object.keys(BANK_FIELD_CHANGES).toSorted());
    expect(readFieldNames(SignatorySchema)).toEqual(Object.keys(SIGNATORY_FIELD_CHANGES).toSorted());
    expect(readFieldNames(CalendarDateSchema)).toEqual(Object.keys(DATE_FIELD_CHANGES).toSorted());
  });

  it.each(Object.entries(REQUISITES_FIELD_CHANGES))('notices a change of the requisites field %s', (_name, change) => {
    const saved = createRequisites({ version: NEXT_VERSION });

    change(saved);

    expect(isFormChangeNoticed(saved)).toBe(true);
  });

  it.each(Object.entries(BANK_FIELD_CHANGES))('notices a change of the bank field %s', (_name, change) => {
    const saved = createRequisites({ version: NEXT_VERSION });

    if (saved.bank === undefined) {
      throw new Error('the requisites have no bank');
    }

    change(saved.bank);

    expect(isFormChangeNoticed(saved)).toBe(true);
  });

  it.each(Object.entries(SIGNATORY_FIELD_CHANGES))('notices a change of the signatory field %s', (_name, change) => {
    const state = { ...createState(), requisites: createRequisitesWithDate(BASE_VERSION) };
    const saved = createRequisitesWithDate(NEXT_VERSION);

    change(readFirstSignatory(saved));

    expect(isSignatoryChangeNoticed(state, saved)).toBe(true);
  });

  it.each(Object.entries(DATE_FIELD_CHANGES))('notices a change of the power of attorney date field %s', (_name, change) => {
    const state = { ...createState(), requisites: createRequisitesWithDate(BASE_VERSION) };
    const saved = createRequisitesWithDate(NEXT_VERSION);
    const date = readFirstSignatory(saved).powerOfAttorneyDate;

    if (date === undefined) {
      throw new Error('the signatory has no power of attorney date');
    }

    change(date);

    expect(isSignatoryChangeNoticed(state, saved)).toBe(true);
  });

  it('does not notice a change when only the version moved', () => {
    const state = { ...createState(), requisites: createRequisitesWithDate(BASE_VERSION) };
    const saved = createRequisitesWithDate(NEXT_VERSION);

    expect(isFormChangeNoticed(saved)).toBe(false);
    expect(isSignatoryChangeNoticed(state, saved)).toBe(false);
  });
});
