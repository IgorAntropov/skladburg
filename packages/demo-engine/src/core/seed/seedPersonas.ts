import {
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
    id: SeedPersonaId.FRESH_BUYER,
    kind: DemoPersonaKind.BUYER,
    organizationId: SeedOrganizationId.BUYER_1,
    userId: SeedUserId.ADMIN_1,
  },
  {
    id: SeedPersonaId.FRESH_SELLER,
    kind: DemoPersonaKind.SELLER,
    organizationId: SeedOrganizationId.SELLER_1,
    userId: SeedUserId.ADMIN_2,
  },
  {
    id: SeedPersonaId.FRESH_CARRIER,
    kind: DemoPersonaKind.CARRIER,
    organizationId: SeedOrganizationId.CARRIER_1,
    userId: SeedUserId.ADMIN_4,
  },
  {
    id: SeedPersonaId.FRESH_STOREKEEPER,
    kind: DemoPersonaKind.STOREKEEPER,
    organizationId: SeedOrganizationId.BUYER_1,
    userId: SeedUserId.STOREKEEPER_1,
  },
  {
    id: SeedPersonaId.CONSTRUCTION_BUYER,
    kind: DemoPersonaKind.BUYER,
    organizationId: SeedOrganizationId.BUYER_2,
    userId: SeedUserId.ADMIN_5,
  },
  {
    id: SeedPersonaId.CONSTRUCTION_SELLER,
    kind: DemoPersonaKind.SELLER,
    organizationId: SeedOrganizationId.SELLER_3,
    userId: SeedUserId.ADMIN_6,
  },
  {
    id: SeedPersonaId.CONSTRUCTION_CARRIER,
    kind: DemoPersonaKind.CARRIER,
    organizationId: SeedOrganizationId.CARRIER_2,
    userId: SeedUserId.ADMIN_8,
  },
  {
    id: SeedPersonaId.CONSTRUCTION_STOREKEEPER,
    kind: DemoPersonaKind.STOREKEEPER,
    organizationId: SeedOrganizationId.BUYER_2,
    userId: SeedUserId.STOREKEEPER_2,
  },
];
