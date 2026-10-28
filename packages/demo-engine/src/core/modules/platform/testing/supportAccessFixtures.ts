import type { Notification } from '@skladburg/contracts/notification/v1/notification';
import type { SupportAccessSession } from '@skladburg/contracts/support/v1/support_access';

import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  SupportAccessMode,
  SupportAccessSection,
  SupportAccessStatus,
} from '@skladburg/contracts/support/v1/support_access';
import { expect } from 'vitest';

import type { ModuleHarnessValue } from '../../testing/moduleHarness';

import { PLATFORM_OPERATOR_ORGANIZATION_ID } from '../../../platform/index';
import {
  SEED_WORLD_START_MS,
  SeedOrganizationId,
  SeedUserId,
} from '../../../seed/index';
import { createTestSupportAccessSession } from '../../../state/testRecords';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../../testing/moduleHarness';

export const CLIENT_ID: string = SeedOrganizationId.CUSTOMER_1;
export const OTHER_CLIENT_ID: string = SeedOrganizationId.CUSTOMER_2;

export const STAFF = {
  admin: callAs(SeedUserId.OPERATOR_PLATFORM_ADMIN, PLATFORM_OPERATOR_ORGANIZATION_ID),
  agent: callAs(SeedUserId.OPERATOR_SUPPORT_AGENT, PLATFORM_OPERATOR_ORGANIZATION_ID),
  engineer: callAs(SeedUserId.OPERATOR_SUPPORT_ENGINEER, PLATFORM_OPERATOR_ORGANIZATION_ID),
  superAdmin: callAs(SeedUserId.OPERATOR_SUPER_ADMIN_1, PLATFORM_OPERATOR_ORGANIZATION_ID),
  superAdminOther: callAs(SeedUserId.OPERATOR_SUPER_ADMIN_2, PLATFORM_OPERATOR_ORGANIZATION_ID),
} as const;

export const STAFF_ID = {
  engineer: SeedUserId.OPERATOR_SUPPORT_ENGINEER,
  superAdmin: SeedUserId.OPERATOR_SUPER_ADMIN_1,
  superAdminOther: SeedUserId.OPERATOR_SUPER_ADMIN_2,
} as const;

export const CLIENT_USER_ID: string = SeedUserId.ADMIN_1;
export const OPERATOR_ID: string = PLATFORM_OPERATOR_ORGANIZATION_ID;

export const CLIENT = {
  admin: callAs(SeedUserId.ADMIN_1, CLIENT_ID),
  otherAdmin: callAs(SeedUserId.ADMIN_5, OTHER_CLIENT_ID),
  storekeeper: callAs(SeedUserId.STOREKEEPER_1, CLIENT_ID),
} as const;

export const createKey = (index: number): string => `3f2b8c1e-5a47-4d9b-8e21-${String(index).padStart(12, '0')}`;

export interface PutSessionOptionsValue {
  expiresAtMs?: number | undefined;
  id: string;
  mode?: SupportAccessMode | undefined;
  organizationId?: string | undefined;
  requestedAtMs?: number | undefined;
  section?: SupportAccessSection | undefined;
  staffUserId?: string | undefined;
  status?: SupportAccessStatus | undefined;
}

export const putSession = async (harness: ModuleHarnessValue, options: PutSessionOptionsValue): Promise<SupportAccessSession> => {
  const session = createTestSupportAccessSession(
    options.id,
    options.organizationId ?? CLIENT_ID,
    options.staffUserId ?? SeedUserId.OPERATOR_SUPPORT_ENGINEER,
    options.status ?? SupportAccessStatus.REQUESTED,
    {
      expiresAt: options.expiresAtMs === undefined ? undefined : timestampFromMs(options.expiresAtMs),
      mode: options.mode ?? SupportAccessMode.VIEW,
      section: options.section ?? SupportAccessSection.ALL,
    },
  );
  session.durationMinutes = 30;
  session.requestedAt = timestampFromMs(options.requestedAtMs ?? SEED_WORLD_START_MS);
  session.staffDisplayName = 'Илья Г.';

  await harness.runtime.command((transaction) => {
    transaction.put('supportAccessSessions', session);
  });

  return session;
};

export const createSessionId = (index: number): string => `d0000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

export const readDeniedPermission = async (call: Promise<unknown>): Promise<string | undefined> => {
  const detail = readErrorDetail(await captureError(call));

  expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);

  return detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined;
};

export const readNotFoundEntity = async (call: Promise<unknown>): Promise<EntityKind | undefined> => {
  const detail = readErrorDetail(await captureError(call));

  expect(detail.code).toBe(ErrorCode.NOT_FOUND);

  return detail.params.case === 'notFound' ? detail.params.value.entity : undefined;
};

export const readErrorCode = async (call: Promise<unknown>): Promise<ErrorCode> =>
  readErrorDetail(await captureError(call)).code;

export const listNotifications = (harness: ModuleHarnessValue): { notification: Notification; userId: string }[] =>
  harness.state.read.list('notifications');
