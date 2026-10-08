import type { SectionValue } from './routes.ts';

export type PersonaKindValue = 'buyer' | 'carrier' | 'seller' | 'storekeeper';

export interface PersonaValue {
  id: string;
  kind: PersonaKindValue;
  organizationName: string;
  sections: readonly SectionValue[];
}

const ALL_SECTIONS: readonly SectionValue[] = ['network', 'catalog', 'deals', 'warehouse'];

export const PERSONAS = {
  constructionSeller: {
    id: '90000006-0000-4000-8000-000000000000',
    kind: 'seller',
    organizationName: 'Продавец 3',
    sections: ALL_SECTIONS,
  },
  freshBuyer: {
    id: '90000001-0000-4000-8000-000000000000',
    kind: 'buyer',
    organizationName: 'Покупатель 1',
    sections: ALL_SECTIONS,
  },
  freshCarrier: {
    id: '90000003-0000-4000-8000-000000000000',
    kind: 'carrier',
    organizationName: 'Логист 1',
    sections: ['network', 'deals'],
  },
  freshStorekeeper: {
    id: '90000004-0000-4000-8000-000000000000',
    kind: 'storekeeper',
    organizationName: 'Покупатель 1',
    sections: ['warehouse'],
  },
} as const satisfies Record<string, PersonaValue>;

export const PERSONA_COUNT = 8;

export const DEFAULT_PERSONA: PersonaValue = PERSONAS.freshBuyer;

export const ORGANIZATION_NAME = DEFAULT_PERSONA.organizationName;

export const WAREHOUSE_NAMES = ['Склад 1', 'Склад 2', 'Склад 3'] as const;

export const STOREKEEPER_WAREHOUSE_NAMES = ['Склад 1'] as const;
