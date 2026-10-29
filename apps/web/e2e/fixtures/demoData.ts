import type { SectionValue } from './routes.ts';

export interface PersonaValue {
  id: string;
  organizationName: string;
  sections: readonly SectionValue[];
}

const ALL_SECTIONS: readonly SectionValue[] = ['network', 'catalog', 'deals', 'warehouse'];

export const PERSONAS = {
  constructionCarrier: {
    id: '90000007-0000-4000-8000-000000000000',
    organizationName: 'Широкий путь',
    sections: ['network', 'deals'],
  },
  constructionCustomer: {
    id: '90000005-0000-4000-8000-000000000000',
    organizationName: 'Каменный двор',
    sections: ALL_SECTIONS,
  },
  constructionSupplier: {
    id: '90000006-0000-4000-8000-000000000000',
    organizationName: 'Прокатный ряд',
    sections: ALL_SECTIONS,
  },
  freshCarrier: {
    id: '90000003-0000-4000-8000-000000000000',
    organizationName: 'Северный холод',
    sections: ['network', 'deals'],
  },
  freshCustomer: {
    id: '90000001-0000-4000-8000-000000000000',
    organizationName: 'Тёплый угол',
    sections: ALL_SECTIONS,
  },
  freshStorekeeper: {
    id: '90000004-0000-4000-8000-000000000000',
    organizationName: 'Тёплый угол',
    sections: ['warehouse'],
  },
} as const satisfies Record<string, PersonaValue>;

export const NOTIFICATION_IDS = {
  constructionCustomerSupplier3: 'b0000009-0000-4000-8000-000000000000',
  freshCustomerSupplier1: 'b0000002-0000-4000-8000-000000000000',
  freshCustomerSupplier2: 'b0000001-0000-4000-8000-000000000000',
} as const;

export const RU_CATALOG_DIGEST_GREETING = 'Здравствуйте! Вот что у вас сейчас';

export const RU_INFORMAL_CATALOG_DIGEST_GREETING = 'Привет! Вот что у тебя сейчас';

export const DEFAULT_PERSONA: PersonaValue = PERSONAS.freshCustomer;

export const SUPPORT_TEXTS = {
  assistantName: 'Михалыч',
  categoryMoneyOption: 'Деньги · срочно',
  noPersonalData: 'Имя, телефон и почту не отправляем',
  replyAuthor: 'Поддержка · Ксения Р.',
  tabHelp: 'Помощь',
  tabNotifications: 'Уведомления',
  ticketTitle: 'Обращение №\u00a01001',
} as const;

export const DEFAULT_PERSONA_USER_NAME = 'Анна Смирнова';

export const SUPPORT_FIRST_TICKET_NUMBER = '1001';

export const SUPPORT_REPLY_TIMEOUT_MS = 10_000;

export const SUPPORT_APP_VERSION_PATTERN = /^(dev|[0-9a-f]{7,40})$/;

export const SUPPORT_DEVICE_PATTERN = /^(Компьютер|Планшет|Телефон) · .+ · .+/;

export const SUPPORT_PERSONAL_DATA_PATTERNS = [/@/, /\+?\d[\d\s()-]{8,}\d/] as const;

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
  label: 'Яблоневый край',
  sideName: 'Поставщик',
} as const satisfies NetworkSiteValue & { sideName: string };

export const FAR_NETWORK_SITE = {
  cityName: 'Челябинск',
  cityNodeId: '70000008-0000-4000-8000-000000000000',
  id: '80000009-0000-4000-8000-000000000000',
  label: 'Прокатный ряд',
  sideName: 'Поставщик',
} as const satisfies NetworkSiteValue & { sideName: string };

export const UNKNOWN_NETWORK_SITE_ID = 'f7000001-0000-4000-8000-000000000000';

export const NETWORK_SITE_COUNT = 12;

export const NETWORK_CITY_COUNT = 9;

export interface DirectoryOrganizationValue {
  id: string;
  inn: string;
  logoKey: string;
  name: string;
}

export const DIRECTORY_ORGANIZATIONS = {
  carrier1: { id: '10000004-0000-4000-8000-000000000000', inn: '0000001043', logoKey: 'carrier-1', name: 'Северный холод' },
  carrier2: { id: '10000008-0000-4000-8000-000000000000', inn: '0000001082', logoKey: 'carrier-2', name: 'Широкий путь' },
  customer1: { id: '10000001-0000-4000-8000-000000000000', inn: '0000001011', logoKey: 'customer-1', name: 'Тёплый угол' },
  customer2: { id: '10000005-0000-4000-8000-000000000000', inn: '0000001050', logoKey: 'customer-2', name: 'Каменный двор' },
  supplier1: { id: '10000002-0000-4000-8000-000000000000', inn: '0000001029', logoKey: 'supplier-1', name: 'Яблоневый край' },
  supplier2: { id: '10000003-0000-4000-8000-000000000000', inn: '0000001036', logoKey: 'supplier-2', name: 'Белое поле' },
  supplier3: { id: '10000006-0000-4000-8000-000000000000', inn: '0000001068', logoKey: 'supplier-3', name: 'Прокатный ряд' },
  supplier4: { id: '10000007-0000-4000-8000-000000000000', inn: '0000001075', logoKey: 'supplier-4', name: 'Серый камень' },
  supplier6: { id: '10000010-0000-4000-8000-000000000000', inn: '0000001100', logoKey: '', name: 'Утиный брод' },
  supplier7: { id: '10000011-0000-4000-8000-000000000000', inn: '0000001117', logoKey: '', name: 'Ровный брус' },
} as const satisfies Record<string, DirectoryOrganizationValue>;

export const MULTI_CITY_ORGANIZATION = {
  cityNodeIds: OWN_NETWORK_SITES.map(site => site.cityNodeId),
  organization: DIRECTORY_ORGANIZATIONS.customer1,
} as const;

export const DIRECTORY_VISIBLE_ORGANIZATIONS: readonly DirectoryOrganizationValue[] = [
  DIRECTORY_ORGANIZATIONS.supplier2,
  DIRECTORY_ORGANIZATIONS.customer2,
  DIRECTORY_ORGANIZATIONS.supplier3,
  DIRECTORY_ORGANIZATIONS.supplier7,
  DIRECTORY_ORGANIZATIONS.carrier1,
  DIRECTORY_ORGANIZATIONS.supplier4,
  DIRECTORY_ORGANIZATIONS.customer1,
  DIRECTORY_ORGANIZATIONS.supplier6,
  DIRECTORY_ORGANIZATIONS.carrier2,
  DIRECTORY_ORGANIZATIONS.supplier1,
];

export const DAIRY_SPHERE_ID = '50000002-0000-4000-8000-000000000000';

export const NETWORK_MAP_LOGO_ORGANIZATIONS: readonly DirectoryOrganizationValue[] = [
  DIRECTORY_ORGANIZATIONS.customer1,
  DIRECTORY_ORGANIZATIONS.customer2,
  DIRECTORY_ORGANIZATIONS.supplier1,
  DIRECTORY_ORGANIZATIONS.supplier2,
  DIRECTORY_ORGANIZATIONS.supplier3,
  DIRECTORY_ORGANIZATIONS.supplier4,
];
