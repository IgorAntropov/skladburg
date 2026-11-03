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
  freshSupplier: {
    id: '90000002-0000-4000-8000-000000000000',
    organizationName: 'Яблоневый край',
    sections: ALL_SECTIONS,
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

export interface ShowcaseQuoteValue {
  etaText: string;
  site: NetworkSiteValue;
  totalText: string;
}

export const SHOWCASE_SPHERE = {
  id: '50000003-0000-4000-8000-000000000000',
  name: 'Овощи и фрукты',
} as const;

export const SHOWCASE_SEARCH_TEXT = 'яблоки';

export const SHOWCASE_SEARCH_RESULT_COUNT = 6;

export const GOLDEN_APPLES = {
  id: 'd1010001-0000-4000-8000-000000000000',
  name: 'Яблоки Голден, 1 сорт',
  supplierCityName: FOREIGN_NETWORK_SITE.cityName,
} as const;

export const GOLDEN_APPLES_QUOTES = {
  kazan: { etaText: 'пт, 16 октября', site: OWN_NETWORK_SITES[2], totalText: '67\u00a0800\u00a0₽' },
  moscow: { etaText: 'чт, 15 октября', site: OWN_NETWORK_SITES[0], totalText: '57\u00a0960\u00a0₽' },
  saintPetersburg: { etaText: 'пт, 16 октября', site: OWN_NETWORK_SITES[1], totalText: '66\u00a0480\u00a0₽' },
} as const satisfies Record<string, ShowcaseQuoteValue>;

export const GOLDEN_APPLES_REPRICED = {
  moscow: { ...GOLDEN_APPLES_QUOTES.moscow, totalText: '60\u00a0840\u00a0₽' },
  tierPriceInput: '95',
  unitPriceText: '95\u00a0₽/кг',
} as const satisfies { moscow: ShowcaseQuoteValue; tierPriceInput: string; unitPriceText: string };

export const GOLDEN_APPLES_INITIAL_UNIT_PRICE_TEXT = '89\u00a0₽/кг';

export const SALES_TERMS_AUTO_CONFIRM_TEXTS = {
  off: 'Выключено',
  on: 'Включено',
} as const;

export const GLOBAL_SEARCH_AXE_QUERY = {
  groupIds: ['organizations', 'showcase-listings'],
  text: 'ябло',
} as const;
