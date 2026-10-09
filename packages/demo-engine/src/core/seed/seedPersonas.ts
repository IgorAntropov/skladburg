import {
  DemoPersonaGroup,
  DemoPersonaKind,
  type DemoPersonaValue,
} from '../state/index';
import {
  SeedOrganizationId,
  SeedPersonaId,
  SeedUserId,
} from './seedIds';

export const createSeedPersonas = (): DemoPersonaValue[] => [
  {
    group: DemoPersonaGroup.FRESH,
    id: SeedPersonaId.FRESH_BUYER,
    kind: DemoPersonaKind.BUYER,
    organizationId: SeedOrganizationId.BUYER_1,
    userId: SeedUserId.ADMIN_1,
  },
  {
    group: DemoPersonaGroup.FRESH,
    id: SeedPersonaId.FRESH_SELLER,
    kind: DemoPersonaKind.SELLER,
    organizationId: SeedOrganizationId.SELLER_1,
    userId: SeedUserId.ADMIN_2,
  },
  {
    group: DemoPersonaGroup.FRESH,
    id: SeedPersonaId.FRESH_CARRIER,
    kind: DemoPersonaKind.CARRIER,
    organizationId: SeedOrganizationId.CARRIER_1,
    userId: SeedUserId.ADMIN_4,
  },
  {
    group: DemoPersonaGroup.FRESH,
    id: SeedPersonaId.FRESH_STOREKEEPER,
    kind: DemoPersonaKind.STOREKEEPER,
    organizationId: SeedOrganizationId.BUYER_1,
    userId: SeedUserId.STOREKEEPER_1,
  },
  {
    group: DemoPersonaGroup.CONSTRUCTION,
    id: SeedPersonaId.CONSTRUCTION_BUYER,
    kind: DemoPersonaKind.BUYER,
    organizationId: SeedOrganizationId.BUYER_2,
    userId: SeedUserId.ADMIN_5,
  },
  {
    group: DemoPersonaGroup.CONSTRUCTION,
    id: SeedPersonaId.CONSTRUCTION_SELLER,
    kind: DemoPersonaKind.SELLER,
    organizationId: SeedOrganizationId.SELLER_3,
    userId: SeedUserId.ADMIN_6,
  },
  {
    group: DemoPersonaGroup.CONSTRUCTION,
    id: SeedPersonaId.CONSTRUCTION_CARRIER,
    kind: DemoPersonaKind.CARRIER,
    organizationId: SeedOrganizationId.CARRIER_2,
    userId: SeedUserId.ADMIN_8,
  },
  {
    group: DemoPersonaGroup.CONSTRUCTION,
    id: SeedPersonaId.CONSTRUCTION_STOREKEEPER,
    kind: DemoPersonaKind.STOREKEEPER,
    organizationId: SeedOrganizationId.BUYER_2,
    userId: SeedUserId.STOREKEEPER_2,
  },
];
