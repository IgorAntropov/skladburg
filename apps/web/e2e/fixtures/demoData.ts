import type { SectionValue } from './routes.ts';

export type PersonaGroupValue = 'construction' | 'fresh';

export type PersonaKindValue = 'carrier' | 'customer' | 'storekeeper' | 'supplier';

export type PersonaSideValue = 'carrier' | 'customer' | 'supplier';

export interface PersonaValue {
  group: PersonaGroupValue;
  id: string;
  initials: string;
  kind: PersonaKindValue;
  organizationName: string;
  roleName: string;
  sections: readonly SectionValue[];
  side: PersonaSideValue;
  userDisplayName: string;
}

const ALL_SECTIONS: readonly SectionValue[] = ['network', 'catalog', 'deals', 'warehouse'];

const ADMINISTRATOR_ROLE = 'Администратор';

const STOREKEEPER_ROLE = 'Кладовщик';

export const PERSONAS = {
  constructionCarrier: {
    group: 'construction',
    id: '90000007-0000-4000-8000-000000000000',
    initials: 'ПВ',
    kind: 'carrier',
    organizationName: 'Перевозчик 2',
    roleName: ADMINISTRATOR_ROLE,
    sections: ['network', 'deals'],
    side: 'carrier',
    userDisplayName: 'Павел Волков',
  },
  constructionCustomer: {
    group: 'construction',
    id: '90000005-0000-4000-8000-000000000000',
    initials: 'ЕМ',
    kind: 'customer',
    organizationName: 'Заказчик 2',
    roleName: ADMINISTRATOR_ROLE,
    sections: ALL_SECTIONS,
    side: 'customer',
    userDisplayName: 'Елена Морозова',
  },
  constructionStorekeeper: {
    group: 'construction',
    id: '90000008-0000-4000-8000-000000000000',
    initials: 'МЛ',
    kind: 'storekeeper',
    organizationName: 'Заказчик 2',
    roleName: STOREKEEPER_ROLE,
    sections: ['warehouse'],
    side: 'customer',
    userDisplayName: 'Мария Лебедева',
  },
  constructionSupplier: {
    group: 'construction',
    id: '90000006-0000-4000-8000-000000000000',
    initials: 'АН',
    kind: 'supplier',
    organizationName: 'Поставщик 3',
    roleName: ADMINISTRATOR_ROLE,
    sections: ALL_SECTIONS,
    side: 'supplier',
    userDisplayName: 'Андрей Новиков',
  },
  freshCarrier: {
    group: 'fresh',
    id: '90000003-0000-4000-8000-000000000000',
    initials: 'ДВ',
    kind: 'carrier',
    organizationName: 'Перевозчик 1',
    roleName: ADMINISTRATOR_ROLE,
    sections: ['network', 'deals'],
    side: 'carrier',
    userDisplayName: 'Дмитрий Васильев',
  },
  freshCustomer: {
    group: 'fresh',
    id: '90000001-0000-4000-8000-000000000000',
    initials: 'АС',
    kind: 'customer',
    organizationName: 'Заказчик 1',
    roleName: ADMINISTRATOR_ROLE,
    sections: ALL_SECTIONS,
    side: 'customer',
    userDisplayName: 'Анна Смирнова',
  },
  freshStorekeeper: {
    group: 'fresh',
    id: '90000004-0000-4000-8000-000000000000',
    initials: 'ИС',
    kind: 'storekeeper',
    organizationName: 'Заказчик 1',
    roleName: STOREKEEPER_ROLE,
    sections: ['warehouse'],
    side: 'customer',
    userDisplayName: 'Иван Соколов',
  },
  freshSupplier: {
    group: 'fresh',
    id: '90000002-0000-4000-8000-000000000000',
    initials: 'СК',
    kind: 'supplier',
    organizationName: 'Поставщик 1',
    roleName: ADMINISTRATOR_ROLE,
    sections: ALL_SECTIONS,
    side: 'supplier',
    userDisplayName: 'Сергей Кузнецов',
  },
} as const satisfies Record<string, PersonaValue>;

export const PERSONA_GROUPS: readonly {
  group: PersonaGroupValue;
  personas: readonly PersonaValue[];
}[] = [
  {
    group: 'fresh',
    personas: [PERSONAS.freshCustomer, PERSONAS.freshSupplier, PERSONAS.freshCarrier, PERSONAS.freshStorekeeper],
  },
  {
    group: 'construction',
    personas: [
      PERSONAS.constructionCustomer,
      PERSONAS.constructionSupplier,
      PERSONAS.constructionCarrier,
      PERSONAS.constructionStorekeeper,
    ],
  },
];

export const PERSONA_COUNT = 8;

export const PERSONAS_PER_GROUP = 4;

export const DEFAULT_PERSONA: PersonaValue = PERSONAS.freshCustomer;

export const ORGANIZATION_NAME = DEFAULT_PERSONA.organizationName;

export const WAREHOUSE_NAMES = ['Склад 1', 'Склад 2', 'Склад 3'] as const;

export const STOREKEEPER_WAREHOUSE_NAMES = ['Склад 1'] as const;

export const SEED_WORLD_START_MS = Date.UTC(2026, 9, 12, 6, 0, 0);
