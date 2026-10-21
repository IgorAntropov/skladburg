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
