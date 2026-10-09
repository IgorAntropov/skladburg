import type { DemoPersonaListItemValue } from '@/shared/api';

import {
  DemoPersonaGroup,
  DemoPersonaKind,
} from '@/shared/api';

const ADMINISTRATOR_ROLE = 'Администратор';
const STOREKEEPER_ROLE = 'Кладовщик';

const toId = (prefix: string, index: number): string => `${prefix}${String(index).padStart(5, '0')}-0000-4000-8000-000000000000`;

interface PersonaFixtureArgsValue {
  group: DemoPersonaGroup;
  index: number;
  kind: DemoPersonaKind;
  organizationIndex: number;
  organizationName: string;
  roleName: string;
  userDisplayName: string;
}

const createPersonaFixture = (args: PersonaFixtureArgsValue): DemoPersonaListItemValue => ({
  group: args.group,
  id: toId('f9000', args.index),
  kind: args.kind,
  organizationId: toId('f9100', args.organizationIndex),
  organizationName: args.organizationName,
  roleName: args.roleName,
  userDisplayName: args.userDisplayName,
  userId: toId('f9200', args.index),
});

export const FRESH_BUYER_FIXTURE = createPersonaFixture({
  group: DemoPersonaGroup.FRESH,
  index: 1,
  kind: DemoPersonaKind.BUYER,
  organizationIndex: 1,
  organizationName: 'Покупатель 1',
  roleName: ADMINISTRATOR_ROLE,
  userDisplayName: 'Анна Смирнова',
});

export const FRESH_SELLER_FIXTURE = createPersonaFixture({
  group: DemoPersonaGroup.FRESH,
  index: 2,
  kind: DemoPersonaKind.SELLER,
  organizationIndex: 2,
  organizationName: 'Продавец 1',
  roleName: ADMINISTRATOR_ROLE,
  userDisplayName: 'Сергей Кузнецов',
});

export const FRESH_CARRIER_FIXTURE = createPersonaFixture({
  group: DemoPersonaGroup.FRESH,
  index: 3,
  kind: DemoPersonaKind.CARRIER,
  organizationIndex: 3,
  organizationName: 'Логист 1',
  roleName: ADMINISTRATOR_ROLE,
  userDisplayName: 'Дмитрий Васильев',
});

export const FRESH_STOREKEEPER_FIXTURE = createPersonaFixture({
  group: DemoPersonaGroup.FRESH,
  index: 4,
  kind: DemoPersonaKind.STOREKEEPER,
  organizationIndex: 1,
  organizationName: 'Покупатель 1',
  roleName: STOREKEEPER_ROLE,
  userDisplayName: 'Иван Соколов',
});

export const CONSTRUCTION_BUYER_FIXTURE = createPersonaFixture({
  group: DemoPersonaGroup.CONSTRUCTION,
  index: 5,
  kind: DemoPersonaKind.BUYER,
  organizationIndex: 4,
  organizationName: 'Покупатель 2',
  roleName: ADMINISTRATOR_ROLE,
  userDisplayName: 'Елена Морозова',
});

export const CONSTRUCTION_SELLER_FIXTURE = createPersonaFixture({
  group: DemoPersonaGroup.CONSTRUCTION,
  index: 6,
  kind: DemoPersonaKind.SELLER,
  organizationIndex: 5,
  organizationName: 'Продавец 3',
  roleName: ADMINISTRATOR_ROLE,
  userDisplayName: 'Андрей Новиков',
});

export const CONSTRUCTION_CARRIER_FIXTURE = createPersonaFixture({
  group: DemoPersonaGroup.CONSTRUCTION,
  index: 7,
  kind: DemoPersonaKind.CARRIER,
  organizationIndex: 6,
  organizationName: 'Логист 2',
  roleName: ADMINISTRATOR_ROLE,
  userDisplayName: 'Павел Волков',
});

export const CONSTRUCTION_STOREKEEPER_FIXTURE = createPersonaFixture({
  group: DemoPersonaGroup.CONSTRUCTION,
  index: 8,
  kind: DemoPersonaKind.STOREKEEPER,
  organizationIndex: 4,
  organizationName: 'Покупатель 2',
  roleName: STOREKEEPER_ROLE,
  userDisplayName: 'Мария Лебедева',
});

export const PERSONA_FIXTURES: readonly DemoPersonaListItemValue[] = [
  FRESH_BUYER_FIXTURE,
  FRESH_SELLER_FIXTURE,
  FRESH_CARRIER_FIXTURE,
  FRESH_STOREKEEPER_FIXTURE,
  CONSTRUCTION_BUYER_FIXTURE,
  CONSTRUCTION_SELLER_FIXTURE,
  CONSTRUCTION_CARRIER_FIXTURE,
  CONSTRUCTION_STOREKEEPER_FIXTURE,
];
