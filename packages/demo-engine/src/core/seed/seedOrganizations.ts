import { create } from '@bufbuild/protobuf';
import {
  type Organization,
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

interface SeedOrganizationDefinitionValue {
  id: string;
  inn: string;
  kpp: string;
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
    id: SeedOrganizationId.BUYER_1,
    inn: '0000001012',
    kpp: '000001001',
    name: 'Покупатель 1',
    ogrn: '1000000010011',
    profiles: [{ kind: ProfileKind.BUYER, verificationLevel: 2 }],
    sphereIds: [SeedSphereId.FOOD],
  },
  {
    id: SeedOrganizationId.SELLER_1,
    inn: '0000001020',
    kpp: '000001002',
    name: 'Продавец 1',
    ogrn: '1000000010021',
    profiles: [{ kind: ProfileKind.SELLER, verificationLevel: 2 }],
    sphereIds: [SeedSphereId.DAIRY, SeedSphereId.FRUIT_AND_VEGETABLES],
  },
  {
    id: SeedOrganizationId.SELLER_2,
    inn: '0000001037',
    kpp: '000001003',
    name: 'Продавец 2',
    ogrn: '1000000010032',
    profiles: [{ kind: ProfileKind.SELLER, verificationLevel: 3 }],
    sphereIds: [SeedSphereId.MEAT_AND_POULTRY],
  },
  {
    id: SeedOrganizationId.CARRIER_1,
    inn: '0000001044',
    kpp: '000001004',
    name: 'Логист 1',
    ogrn: '1000000010043',
    profiles: [{ kind: ProfileKind.CARRIER, verificationLevel: 2 }],
    sphereIds: [SeedSphereId.FOOD],
  },
  {
    id: SeedOrganizationId.BUYER_2,
    inn: '0000001051',
    kpp: '000001005',
    name: 'Покупатель 2',
    ogrn: '1000000010054',
    profiles: [{ kind: ProfileKind.BUYER, verificationLevel: 2 }],
    sphereIds: [SeedSphereId.CONSTRUCTION],
  },
  {
    id: SeedOrganizationId.SELLER_3,
    inn: '0000001069',
    kpp: '000001006',
    name: 'Продавец 3',
    ogrn: '1000000010065',
    profiles: [{ kind: ProfileKind.SELLER, verificationLevel: 3 }],
    sphereIds: [SeedSphereId.METAL_PRODUCTS],
  },
  {
    id: SeedOrganizationId.SELLER_4,
    inn: '0000001076',
    kpp: '000001007',
    name: 'Продавец 4',
    ogrn: '1000000010076',
    profiles: [
      { kind: ProfileKind.SELLER, verificationLevel: 2 },
      { kind: ProfileKind.CARRIER, verificationLevel: 2 },
    ],
    sphereIds: [SeedSphereId.CEMENT_AND_CONCRETE, SeedSphereId.TIMBER],
  },
  {
    id: SeedOrganizationId.CARRIER_2,
    inn: '0000001083',
    kpp: '000001008',
    name: 'Логист 2',
    ogrn: '1000000010087',
    profiles: [{ kind: ProfileKind.CARRIER, verificationLevel: 3 }],
    sphereIds: [SeedSphereId.CONSTRUCTION],
  },
  {
    id: SeedOrganizationId.SELLER_5,
    inn: '0000001091',
    kpp: '000001009',
    name: 'Продавец 5',
    ogrn: '1000000010098',
    profiles: [{ kind: ProfileKind.SELLER, verificationLevel: 0 }],
    sphereIds: [SeedSphereId.FOOD],
  },
];

export const createSeedOrganizations = (): Organization[] => SEED_ORGANIZATION_DEFINITIONS.map(definition => create(OrganizationSchema, {
  id: definition.id,
  inn: definition.inn,
  kpp: definition.kpp,
  legalName: `ООО «${definition.name}»`,
  name: definition.name,
  ogrn: definition.ogrn,
  profiles: definition.profiles.map(profile => ({ kind: profile.kind, verificationLevel: profile.verificationLevel })),
  sphereIds: [...definition.sphereIds],
}));

export const createSeedOrganizationSettings = (): OrganizationSettings[] =>
  SEED_ORGANIZATION_DEFINITIONS.map(definition => create(OrganizationSettingsSchema, {
    availableLocales: [SEED_DEFAULT_LOCALE],
    brandName: definition.name,
    defaultLocale: SEED_DEFAULT_LOCALE,
    organizationId: definition.id,
  }));
