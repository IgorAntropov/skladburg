import type { Timestamp } from '@bufbuild/protobuf/wkt';

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
import {
  SupportAccessKind,
  SupportAccessMode,
  SupportAccessSection,
  type SupportAccessSession,
  SupportAccessSessionSchema,
  SupportAccessStatus,
} from '@skladburg/contracts/support/v1/support_access';

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

export interface TestSupportAccessSessionOptionsValue {
  expiresAt?: Timestamp | undefined;
  mode?: SupportAccessMode;
  section?: SupportAccessSection;
}

export const createTestSupportAccessSession = (
  id: string,
  organizationId: string,
  staffUserId: string,
  status: SupportAccessStatus = SupportAccessStatus.REQUESTED,
  options: TestSupportAccessSessionOptionsValue = {},
): SupportAccessSession => create(SupportAccessSessionSchema, {
  expiresAt: options.expiresAt,
  id,
  kind: SupportAccessKind.NORMAL,
  mode: options.mode ?? SupportAccessMode.VIEW,
  organizationId,
  section: options.section ?? SupportAccessSection.ORGANIZATION,
  staffUserId,
  status,
  version: 1,
});

export const TEST_WORLD_TIME_MS = 1_000;

export const createLiveMeta = (): LiveMetaValue => ({
  randomState: { a: 1, b: 2, c: 3, d: 4 },
  schedulerDueAtMs: {},
  timeScale: 1,
  traceRandomState: { a: 5, b: 6, c: 7, d: 8 },
});

export const createVolatileMeta = (worldTimeMs = TEST_WORLD_TIME_MS): VolatileMetaValue => ({
  ...createLiveMeta(),
  worldTimeMs,
});
