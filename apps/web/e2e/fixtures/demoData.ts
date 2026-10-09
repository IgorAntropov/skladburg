import type { SectionValue } from './routes.ts';

export type PersonaGroupValue = 'construction' | 'fresh';

export type PersonaKindValue = 'buyer' | 'carrier' | 'seller' | 'storekeeper';

export type PersonaSideValue = 'buyer' | 'carrier' | 'seller';

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
  constructionBuyer: {
    group: 'construction',
    id: '90000005-0000-4000-8000-000000000000',
    initials: 'ЕМ',
    kind: 'buyer',
    organizationName: 'Покупатель 2',
    roleName: ADMINISTRATOR_ROLE,
    sections: ALL_SECTIONS,
    side: 'buyer',
    userDisplayName: 'Елена Морозова',
  },
  constructionCarrier: {
    group: 'construction',
    id: '90000007-0000-4000-8000-000000000000',
    initials: 'ПВ',
    kind: 'carrier',
    organizationName: 'Логист 2',
    roleName: ADMINISTRATOR_ROLE,
    sections: ['network', 'deals'],
    side: 'carrier',
    userDisplayName: 'Павел Волков',
  },
  constructionSeller: {
    group: 'construction',
    id: '90000006-0000-4000-8000-000000000000',
    initials: 'АН',
    kind: 'seller',
    organizationName: 'Продавец 3',
    roleName: ADMINISTRATOR_ROLE,
    sections: ALL_SECTIONS,
    side: 'seller',
    userDisplayName: 'Андрей Новиков',
  },
  constructionStorekeeper: {
    group: 'construction',
    id: '90000008-0000-4000-8000-000000000000',
    initials: 'МЛ',
    kind: 'storekeeper',
    organizationName: 'Покупатель 2',
    roleName: STOREKEEPER_ROLE,
    sections: ['warehouse'],
    side: 'buyer',
    userDisplayName: 'Мария Лебедева',
  },
  freshBuyer: {
    group: 'fresh',
    id: '90000001-0000-4000-8000-000000000000',
    initials: 'АС',
    kind: 'buyer',
    organizationName: 'Покупатель 1',
    roleName: ADMINISTRATOR_ROLE,
    sections: ALL_SECTIONS,
    side: 'buyer',
    userDisplayName: 'Анна Смирнова',
  },
  freshCarrier: {
    group: 'fresh',
    id: '90000003-0000-4000-8000-000000000000',
    initials: 'ДВ',
    kind: 'carrier',
    organizationName: 'Логист 1',
    roleName: ADMINISTRATOR_ROLE,
    sections: ['network', 'deals'],
    side: 'carrier',
    userDisplayName: 'Дмитрий Васильев',
  },
  freshSeller: {
    group: 'fresh',
    id: '90000002-0000-4000-8000-000000000000',
    initials: 'СК',
    kind: 'seller',
    organizationName: 'Продавец 1',
    roleName: ADMINISTRATOR_ROLE,
    sections: ALL_SECTIONS,
    side: 'seller',
    userDisplayName: 'Сергей Кузнецов',
  },
  freshStorekeeper: {
    group: 'fresh',
    id: '90000004-0000-4000-8000-000000000000',
    initials: 'ИС',
    kind: 'storekeeper',
    organizationName: 'Покупатель 1',
    roleName: STOREKEEPER_ROLE,
    sections: ['warehouse'],
    side: 'buyer',
    userDisplayName: 'Иван Соколов',
  },
} as const satisfies Record<string, PersonaValue>;

export const PERSONA_GROUPS: readonly {
  group: PersonaGroupValue;
  personas: readonly PersonaValue[];
}[] = [
  {
    group: 'fresh',
    personas: [PERSONAS.freshBuyer, PERSONAS.freshSeller, PERSONAS.freshCarrier, PERSONAS.freshStorekeeper],
  },
  {
    group: 'construction',
    personas: [
      PERSONAS.constructionBuyer,
      PERSONAS.constructionSeller,
      PERSONAS.constructionCarrier,
      PERSONAS.constructionStorekeeper,
    ],
  },
];

export const PERSONA_COUNT = 8;

export const PERSONAS_PER_GROUP = 4;

export const DEFAULT_PERSONA: PersonaValue = PERSONAS.freshBuyer;

export const ORGANIZATION_NAME = DEFAULT_PERSONA.organizationName;

export const WAREHOUSE_NAMES = ['Склад 1', 'Склад 2', 'Склад 3'] as const;

export const STOREKEEPER_WAREHOUSE_NAMES = ['Склад 1'] as const;

export const SEED_WORLD_START_MS = Date.UTC(2026, 9, 12, 6, 0, 0);
