import type { SectionValue } from './routes.ts';

export interface PersonaValue {
  id: string;
  organizationName: string;
  sections: readonly SectionValue[];
}

const ALL_SECTIONS: readonly SectionValue[] = ['network', 'catalog', 'deals', 'warehouse'];

export const PERSONAS = {
  constructionSupplier: {
    id: '90000006-0000-4000-8000-000000000000',
    organizationName: 'Поставщик 3',
    sections: ALL_SECTIONS,
  },
  freshCarrier: {
    id: '90000003-0000-4000-8000-000000000000',
    organizationName: 'Перевозчик 1',
    sections: ['network', 'deals'],
  },
  freshCustomer: {
    id: '90000001-0000-4000-8000-000000000000',
    organizationName: 'Заказчик 1',
    sections: ALL_SECTIONS,
  },
  freshStorekeeper: {
    id: '90000004-0000-4000-8000-000000000000',
    organizationName: 'Заказчик 1',
    sections: ['warehouse'],
  },
} as const satisfies Record<string, PersonaValue>;

export const DEFAULT_PERSONA: PersonaValue = PERSONAS.freshCustomer;

export const ORGANIZATION_NAME = DEFAULT_PERSONA.organizationName;

export const WAREHOUSE_NAMES = ['Склад 1', 'Склад 2', 'Склад 3'] as const;

export const NEW_WAREHOUSE = {
  address: 'ул. Южная, 12',
  cityName: 'Казань',
  name: 'Склад на Южной',
} as const;

export interface NetworkSiteValue {
  cityName: string;
  cityNodeId: string;
  id: string;
  label: string;
}

export const OWN_NETWORK_SITES = [
  {
    cityName: 'Москва',
    cityNodeId: '70000001-0000-4000-8000-000000000000',
    id: '80000001-0000-4000-8000-000000000000',
    label: 'Склад 1',
  },
  {
    cityName: 'Санкт-Петербург',
    cityNodeId: '70000002-0000-4000-8000-000000000000',
    id: '80000002-0000-4000-8000-000000000000',
    label: 'Склад 2',
  },
  {
    cityName: 'Казань',
    cityNodeId: '70000003-0000-4000-8000-000000000000',
    id: '80000003-0000-4000-8000-000000000000',
    label: 'Склад 3',
  },
] as const satisfies readonly NetworkSiteValue[];

export const FOREIGN_NETWORK_SITE = {
  cityName: 'Краснодар',
  cityNodeId: '70000004-0000-4000-8000-000000000000',
  id: '80000004-0000-4000-8000-000000000000',
  label: 'Поставщик 1',
  sideName: 'Поставщик',
} as const satisfies NetworkSiteValue & { sideName: string };

export const FAR_NETWORK_SITE = {
  cityName: 'Челябинск',
  cityNodeId: '70000008-0000-4000-8000-000000000000',
  id: '80000009-0000-4000-8000-000000000000',
  label: 'Поставщик 3',
  sideName: 'Поставщик',
} as const satisfies NetworkSiteValue & { sideName: string };

export const UNKNOWN_NETWORK_SITE_ID = 'f7000001-0000-4000-8000-000000000000';

export const NETWORK_SITE_COUNT = 9;

export const NETWORK_CITY_COUNT = 9;

export interface DirectoryOrganizationValue {
  id: string;
  inn: string;
  name: string;
}

export const DIRECTORY_ORGANIZATIONS = {
  carrier1: { id: '10000004-0000-4000-8000-000000000000', inn: '0000001044', name: 'Перевозчик 1' },
  carrier2: { id: '10000008-0000-4000-8000-000000000000', inn: '0000001083', name: 'Перевозчик 2' },
  customer1: { id: '10000001-0000-4000-8000-000000000000', inn: '0000001012', name: 'Заказчик 1' },
  customer2: { id: '10000005-0000-4000-8000-000000000000', inn: '0000001051', name: 'Заказчик 2' },
  supplier1: { id: '10000002-0000-4000-8000-000000000000', inn: '0000001020', name: 'Поставщик 1' },
  supplier2: { id: '10000003-0000-4000-8000-000000000000', inn: '0000001037', name: 'Поставщик 2' },
  supplier3: { id: '10000006-0000-4000-8000-000000000000', inn: '0000001069', name: 'Поставщик 3' },
  supplier4: { id: '10000007-0000-4000-8000-000000000000', inn: '0000001076', name: 'Поставщик 4' },
} as const satisfies Record<string, DirectoryOrganizationValue>;

export const DIRECTORY_VISIBLE_ORGANIZATIONS: readonly DirectoryOrganizationValue[] = [
  DIRECTORY_ORGANIZATIONS.customer1,
  DIRECTORY_ORGANIZATIONS.customer2,
  DIRECTORY_ORGANIZATIONS.carrier1,
  DIRECTORY_ORGANIZATIONS.carrier2,
  DIRECTORY_ORGANIZATIONS.supplier1,
  DIRECTORY_ORGANIZATIONS.supplier2,
  DIRECTORY_ORGANIZATIONS.supplier3,
  DIRECTORY_ORGANIZATIONS.supplier4,
];

export const DAIRY_SPHERE_ID = '50000002-0000-4000-8000-000000000000';
