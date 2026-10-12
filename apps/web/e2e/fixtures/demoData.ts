import type { SectionValue } from './routes.ts';

export interface PersonaValue {
  id: string;
  organizationName: string;
  roleName: string;
  sections: readonly SectionValue[];
  userDisplayName: string;
}

const ALL_SECTIONS: readonly SectionValue[] = ['network', 'catalog', 'deals', 'warehouse'];

const ADMINISTRATOR_ROLE = 'Администратор';

export const PERSONAS = {
  constructionSupplier: {
    id: '90000006-0000-4000-8000-000000000000',
    organizationName: 'Поставщик 3',
    roleName: ADMINISTRATOR_ROLE,
    sections: ALL_SECTIONS,
    userDisplayName: 'Андрей Новиков',
  },
  freshCarrier: {
    id: '90000003-0000-4000-8000-000000000000',
    organizationName: 'Перевозчик 1',
    roleName: ADMINISTRATOR_ROLE,
    sections: ['network', 'deals'],
    userDisplayName: 'Дмитрий Васильев',
  },
  freshCustomer: {
    id: '90000001-0000-4000-8000-000000000000',
    organizationName: 'Заказчик 1',
    roleName: ADMINISTRATOR_ROLE,
    sections: ALL_SECTIONS,
    userDisplayName: 'Анна Смирнова',
  },
} as const satisfies Record<string, PersonaValue>;

export const DEFAULT_PERSONA: PersonaValue = PERSONAS.freshCustomer;

export const ORGANIZATION_NAME = DEFAULT_PERSONA.organizationName;

export const WAREHOUSE_NAMES = ['Склад 1', 'Склад 2', 'Склад 3'] as const;
