import { create } from '@bufbuild/protobuf';
import {
  AssistantAddressForm,
  type Organization,
  OrganizationLogoSchema,
  OrganizationSchema,
  type OrganizationSettings,
  OrganizationSettingsSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';

import {
  SeedOrganizationId,
  SeedSphereId,
} from './seedIds';

export const SEED_DEFAULT_LOCALE = 'ru';

const INFORMAL_ASSISTANT_ORGANIZATION_IDS: ReadonlySet<string> = new Set([SeedOrganizationId.CARRIER_2]);

interface SeedOrganizationDefinitionValue {
  id: string;
  inn: string;
  kpp: string;
  logoKey: string | undefined;
  name: string;
  ogrn: string;
  profiles: readonly SeedProfileValue[];
  sphereIds: readonly string[];
}

interface SeedProfileValue {
  kind: ProfileKind;
  verificationLevel: number;
}

const SEED_ORGANIZATION_DEFINITIONS: readonly SeedOrganizationDefinitionValue[] = [
  {
    id: SeedOrganizationId.CUSTOMER_1,
    inn: '0000001011',
    kpp: '000001001',
    logoKey: 'customer-1',
    name: 'Тёплый угол',
    ogrn: '1000000001011',
    profiles: [{ kind: ProfileKind.CUSTOMER, verificationLevel: 2 }],
    sphereIds: [SeedSphereId.FOOD],
  },
  {
    id: SeedOrganizationId.SUPPLIER_1,
    inn: '0000001029',
    kpp: '000001002',
    logoKey: 'supplier-1',
    name: 'Яблоневый край',
    ogrn: '1000000001022',
    profiles: [{ kind: ProfileKind.SUPPLIER, verificationLevel: 2 }],
    sphereIds: [SeedSphereId.FRUIT_AND_VEGETABLES],
  },
  {
    id: SeedOrganizationId.SUPPLIER_2,
    inn: '0000001036',
    kpp: '000001003',
    logoKey: 'supplier-2',
    name: 'Белое поле',
    ogrn: '1000000001033',
    profiles: [{ kind: ProfileKind.SUPPLIER, verificationLevel: 3 }],
    sphereIds: [SeedSphereId.DAIRY],
  },
  {
    id: SeedOrganizationId.CARRIER_1,
    inn: '0000001043',
    kpp: '000001004',
    logoKey: 'carrier-1',
    name: 'Северный холод',
    ogrn: '1000000001044',
    profiles: [{ kind: ProfileKind.CARRIER, verificationLevel: 1 }],
    sphereIds: [SeedSphereId.FOOD],
  },
  {
    id: SeedOrganizationId.CUSTOMER_2,
    inn: '0000001050',
    kpp: '000001005',
    logoKey: 'customer-2',
    name: 'Каменный двор',
    ogrn: '1000000001055',
    profiles: [{ kind: ProfileKind.CUSTOMER, verificationLevel: 2 }],
    sphereIds: [SeedSphereId.CONSTRUCTION],
  },
  {
    id: SeedOrganizationId.SUPPLIER_3,
    inn: '0000001068',
    kpp: '000001006',
    logoKey: 'supplier-3',
    name: 'Прокатный ряд',
    ogrn: '1000000001066',
    profiles: [{ kind: ProfileKind.SUPPLIER, verificationLevel: 3 }],
    sphereIds: [SeedSphereId.METAL_PRODUCTS],
  },
  {
    id: SeedOrganizationId.SUPPLIER_4,
    inn: '0000001075',
    kpp: '000001007',
    logoKey: 'supplier-4',
    name: 'Серый камень',
    ogrn: '1000000001077',
    profiles: [
      { kind: ProfileKind.SUPPLIER, verificationLevel: 2 },
      { kind: ProfileKind.CARRIER, verificationLevel: 0 },
    ],
    sphereIds: [SeedSphereId.CEMENT_AND_CONCRETE],
  },
  {
    id: SeedOrganizationId.CARRIER_2,
    inn: '0000001082',
    kpp: '000001008',
    logoKey: 'carrier-2',
    name: 'Широкий путь',
    ogrn: '1000000001088',
    profiles: [{ kind: ProfileKind.CARRIER, verificationLevel: 3 }],
    sphereIds: [SeedSphereId.CONSTRUCTION],
  },
  {
    id: SeedOrganizationId.SUPPLIER_5,
    inn: '0000001090',
    kpp: '000001009',
    logoKey: 'supplier-5',
    name: 'Южная грядка',
    ogrn: '1000000001099',
    profiles: [{ kind: ProfileKind.SUPPLIER, verificationLevel: 0 }],
    sphereIds: [SeedSphereId.FRUIT_AND_VEGETABLES],
  },
  {
    id: SeedOrganizationId.SUPPLIER_6,
    inn: '0000001100',
    kpp: '000001010',
    logoKey: undefined,
    name: 'Утиный брод',
    ogrn: '1000000001100',
    profiles: [{ kind: ProfileKind.SUPPLIER, verificationLevel: 2 }],
    sphereIds: [SeedSphereId.MEAT_AND_POULTRY],
  },
  {
    id: SeedOrganizationId.SUPPLIER_7,
    inn: '0000001117',
    kpp: '000001011',
    logoKey: undefined,
    name: 'Ровный брус',
    ogrn: '1000000001110',
    profiles: [{ kind: ProfileKind.SUPPLIER, verificationLevel: 1 }],
    sphereIds: [SeedSphereId.TIMBER],
  },
];

export const createSeedOrganizations = (): Organization[] => SEED_ORGANIZATION_DEFINITIONS.map(definition => create(OrganizationSchema, {
  id: definition.id,
  inn: definition.inn,
  kpp: definition.kpp,
  legalName: `ООО «${definition.name}»`,
  logo: definition.logoKey === undefined
    ? undefined
    : create(OrganizationLogoSchema, {
        darkUrl: `logos/${definition.logoKey}-dark.svg`,
        lightUrl: `logos/${definition.logoKey}-light.svg`,
      }),
  name: definition.name,
  ogrn: definition.ogrn,
  profiles: definition.profiles.map(profile => ({ kind: profile.kind, verificationLevel: profile.verificationLevel })),
  sphereIds: [...definition.sphereIds],
}));

export const createSeedOrganizationSettings = (): OrganizationSettings[] =>
  SEED_ORGANIZATION_DEFINITIONS.map(definition => create(OrganizationSettingsSchema, {
    assistantAddressForm: INFORMAL_ASSISTANT_ORGANIZATION_IDS.has(definition.id)
      ? AssistantAddressForm.INFORMAL
      : AssistantAddressForm.FORMAL,
    availableLocales: [SEED_DEFAULT_LOCALE],
    brandName: definition.name,
    defaultLocale: SEED_DEFAULT_LOCALE,
    organizationId: definition.id,
  }));
