import { create } from '@bufbuild/protobuf';
import {
  type Membership,
  MembershipSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  type Warehouse,
  WarehouseCapability,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';

import type {
  LiveMetaValue,
  VolatileMetaValue,
} from './engineState';

export const FIRST_TENANT_ID = '10000001-0000-4000-8000-000000000000';
export const SECOND_TENANT_ID = '10000002-0000-4000-8000-000000000000';

export const createTestWarehouse = (id: string, tenantId: string, name = 'Склад 1'): Warehouse => create(WarehouseSchema, {
  capabilities: [WarehouseCapability.RAMP],
  id,
  isWmsEnabled: true,
  name,
  tenantId,
  timeZone: 'Europe/Moscow',
});

export const createTestMembership = (id: string, userId: string, organizationId: string): Membership => create(MembershipSchema, {
  id,
  organizationId,
  roleAssignments: [],
  userId,
});

export const TEST_WORLD_TIME_MS = 1_000;

export const createLiveMeta = (): LiveMetaValue => ({
  randomState: { a: 1, b: 2, c: 3, d: 4 },
  timeScale: 1,
  traceRandomState: { a: 5, b: 6, c: 7, d: 8 },
});

export const createVolatileMeta = (worldTimeMs = TEST_WORLD_TIME_MS): VolatileMetaValue => ({
  ...createLiveMeta(),
  worldTimeMs,
});
