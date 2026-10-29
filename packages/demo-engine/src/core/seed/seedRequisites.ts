import { create } from '@bufbuild/protobuf';
import {
  BankAccountSchema,
  type OrganizationRequisites,
  OrganizationRequisitesSchema,
  SignatoryBasis,
  SignatorySchema,
  VatMode,
} from '@skladburg/contracts/organization/v1/requisites';

import { PLATFORM_OPERATOR_ORGANIZATION_ID } from '../platform/index';
import { SeedOrganizationId } from './seedIds';
import {
  MOSCOW_TIME_ZONE,
  NOVOSIBIRSK_TIME_ZONE,
  YEKATERINBURG_TIME_ZONE,
} from './seedNetwork';

interface SeedCalendarDateValue {
  day: number;
  month: number;
  year: number;
}

interface SeedRequisitesDefinitionValue {
  legalAddress: string;
  organizationId: string;
  settlementAccount: string;
  signatories: readonly SeedSignatoryDefinitionValue[];
  timeZone: string;
}

interface SeedSignatoryDefinitionValue {
  basis: SignatoryBasis;
  fullName: string;
  id: string;
  isDefault: boolean;
  position: string;
  powerOfAttorneyDate?: SeedCalendarDateValue;
  powerOfAttorneyNumber?: string;
}

export const SEED_BANK_NAME = 'АО «Банк Складбург»';
export const SEED_BANK_BIK = '040000501';
export const SEED_BANK_CORRESPONDENT_ACCOUNT = '30101810600000000501';

const SEED_REQUISITES_VERSION = 1n;

const SEED_REQUISITES_DEFINITIONS: readonly SeedRequisitesDefinitionValue[] = [
  {
    legalAddress: '000000, г. Москва, Чайный пер., д. 4',
    organizationId: SeedOrganizationId.CUSTOMER_1,
    settlementAccount: '40702810300000000001',
    signatories: [
      {
        basis: SignatoryBasis.CHARTER,
        fullName: 'Смирнова Анна Сергеевна',
        id: 'c0000001-0000-4000-8000-000000000000',
        isDefault: true,
        position: 'генеральный директор',
      },
    ],
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    legalAddress: '000000, г. Краснодар, ул. Садовая Межа, д. 12',
    organizationId: SeedOrganizationId.SUPPLIER_1,
    settlementAccount: '40702810600000000002',
    signatories: [
      {
        basis: SignatoryBasis.CHARTER,
        fullName: 'Кузнецов Сергей Петрович',
        id: 'c0000002-0000-4000-8000-000000000000',
        isDefault: true,
        position: 'генеральный директор',
      },
      {
        basis: SignatoryBasis.POWER_OF_ATTORNEY,
        fullName: 'Гусева Лидия Андреевна',
        id: 'c0000012-0000-4000-8000-000000000000',
        isDefault: false,
        position: 'коммерческий директор',
        powerOfAttorneyDate: { day: 12, month: 1, year: 2026 },
        powerOfAttorneyNumber: '7',
      },
    ],
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    legalAddress: '000000, г. Воронеж, ул. Сливочная, д. 1',
    organizationId: SeedOrganizationId.SUPPLIER_2,
    settlementAccount: '40702810900000000003',
    signatories: [
      {
        basis: SignatoryBasis.CHARTER,
        fullName: 'Попова Ольга Николаевна',
        id: 'c0000003-0000-4000-8000-000000000000',
        isDefault: true,
        position: 'генеральный директор',
      },
    ],
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    legalAddress: '000000, г. Санкт-Петербург, Ледовый пр., д. 9',
    organizationId: SeedOrganizationId.CARRIER_1,
    settlementAccount: '40702810200000000004',
    signatories: [
      {
        basis: SignatoryBasis.CHARTER,
        fullName: 'Васильев Дмитрий Игоревич',
        id: 'c0000004-0000-4000-8000-000000000000',
        isDefault: true,
        position: 'генеральный директор',
      },
    ],
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    legalAddress: '000000, г. Екатеринбург, ул. Кладочная, д. 15',
    organizationId: SeedOrganizationId.CUSTOMER_2,
    settlementAccount: '40702810500000000005',
    signatories: [
      {
        basis: SignatoryBasis.CHARTER,
        fullName: 'Морозова Елена Викторовна',
        id: 'c0000005-0000-4000-8000-000000000000',
        isDefault: true,
        position: 'генеральный директор',
      },
    ],
    timeZone: YEKATERINBURG_TIME_ZONE,
  },
  {
    legalAddress: '000000, г. Челябинск, ул. Арматурная, д. 6',
    organizationId: SeedOrganizationId.SUPPLIER_3,
    settlementAccount: '40702810800000000006',
    signatories: [
      {
        basis: SignatoryBasis.CHARTER,
        fullName: 'Новиков Андрей Михайлович',
        id: 'c0000006-0000-4000-8000-000000000000',
        isDefault: true,
        position: 'генеральный директор',
      },
    ],
    timeZone: YEKATERINBURG_TIME_ZONE,
  },
  {
    legalAddress: '000000, г. Нижний Новгород, Цементный пр., д. 2',
    organizationId: SeedOrganizationId.SUPPLIER_4,
    settlementAccount: '40702810100000000007',
    signatories: [
      {
        basis: SignatoryBasis.CHARTER,
        fullName: 'Фёдорова Татьяна Алексеевна',
        id: 'c0000007-0000-4000-8000-000000000000',
        isDefault: true,
        position: 'генеральный директор',
      },
    ],
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    legalAddress: '000000, г. Екатеринбург, Трактовый пер., д. 21',
    organizationId: SeedOrganizationId.CARRIER_2,
    settlementAccount: '40702810400000000008',
    signatories: [
      {
        basis: SignatoryBasis.CHARTER,
        fullName: 'Волков Павел Андреевич',
        id: 'c0000008-0000-4000-8000-000000000000',
        isDefault: true,
        position: 'генеральный директор',
      },
    ],
    timeZone: YEKATERINBURG_TIME_ZONE,
  },
  {
    legalAddress: '000000, г. Краснодар, ул. Огородная, д. 3',
    organizationId: SeedOrganizationId.SUPPLIER_5,
    settlementAccount: '40702810700000000009',
    signatories: [
      {
        basis: SignatoryBasis.CHARTER,
        fullName: 'Козлова Наталья Ивановна',
        id: 'c0000009-0000-4000-8000-000000000000',
        isDefault: true,
        position: 'генеральный директор',
      },
    ],
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    legalAddress: '000000, г. Москва, ул. Птичья Слобода, д. 8',
    organizationId: SeedOrganizationId.SUPPLIER_6,
    settlementAccount: '40702810100000000010',
    signatories: [
      {
        basis: SignatoryBasis.CHARTER,
        fullName: 'Зуев Григорий Олегович',
        id: 'c0000010-0000-4000-8000-000000000000',
        isDefault: true,
        position: 'генеральный директор',
      },
    ],
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    legalAddress: '000000, г. Новосибирск, ул. Стропильная, д. 11',
    organizationId: SeedOrganizationId.SUPPLIER_7,
    settlementAccount: '40702810400000000011',
    signatories: [
      {
        basis: SignatoryBasis.CHARTER,
        fullName: 'Ершов Степан Ильич',
        id: 'c0000011-0000-4000-8000-000000000000',
        isDefault: true,
        position: 'генеральный директор',
      },
    ],
    timeZone: NOVOSIBIRSK_TIME_ZONE,
  },
  {
    legalAddress: '000000, г. Москва, Складбургский пр., д. 1',
    organizationId: PLATFORM_OPERATOR_ORGANIZATION_ID,
    settlementAccount: '40702810000000000000',
    signatories: [
      {
        basis: SignatoryBasis.CHARTER,
        fullName: 'Тихонов Артём Сергеевич',
        id: 'c0000000-0000-4000-8000-000000000000',
        isDefault: true,
        position: 'генеральный директор',
      },
    ],
    timeZone: MOSCOW_TIME_ZONE,
  },
];

export const createSeedRequisites = (): OrganizationRequisites[] => SEED_REQUISITES_DEFINITIONS.map(definition =>
  create(OrganizationRequisitesSchema, {
    bank: create(BankAccountSchema, {
      bankName: SEED_BANK_NAME,
      bik: SEED_BANK_BIK,
      correspondentAccount: SEED_BANK_CORRESPONDENT_ACCOUNT,
      settlementAccount: definition.settlementAccount,
    }),
    legalAddress: definition.legalAddress,
    organizationId: definition.organizationId,
    signatories: definition.signatories.map(signatory => create(SignatorySchema, signatory)),
    timeZone: definition.timeZone,
    vatMode: VatMode.GENERAL,
    version: SEED_REQUISITES_VERSION,
  }));
