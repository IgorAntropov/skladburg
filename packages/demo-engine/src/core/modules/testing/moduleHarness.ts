import type { DescMethodUnary } from '@bufbuild/protobuf';
import type {
  CallOptions,
  Client,
  Transport,
} from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import {
  ConnectError,
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import {
  AccessService,
  MembershipSchema,
  RoleSchema,
  UserSchema,
} from '@skladburg/contracts/access/v1/access';
import { UserProfileService } from '@skladburg/contracts/access/v1/profile';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import {
  ErrorCode,
  type ErrorDetail,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { NetworkService } from '@skladburg/contracts/network/v1/network';
import { NotificationService } from '@skladburg/contracts/notification/v1/notification';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import { OrganizationShowcaseService } from '@skladburg/contracts/organization/v1/showcase';
import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';

import type { TestRuntimeValue } from './testRuntime';

import { DEMO_USER_HEADER } from '../../protocol';
import { createClockService } from '../clock/index';
import {
  createAccessService,
  createOrganizationShowcaseService,
  createUserProfileService,
} from '../identity/index';
import { createNetworkService } from '../network/index';
import { createNotificationService } from '../notifications/index';
import { createOrganizationService } from '../organizationService';
import { createTestRuntime } from './testRuntime';

export interface ModuleHarnessValue extends TestRuntimeValue {
  access: Client<typeof AccessService>;
  notification: Client<typeof NotificationService>;
  organization: Client<typeof OrganizationService>;
  transport: Transport;
}

export const callAs = (userId: string | undefined, organizationId?: string): CallOptions => {
  const headers = new Headers();

  if (userId !== undefined) {
    headers.set(DEMO_USER_HEADER, userId);
  }

  if (organizationId !== undefined) {
    headers.set(ACTING_ORGANIZATION_HEADER, organizationId);
  }

  return { headers };
};

export const captureError = async (call: Promise<unknown>): Promise<ConnectError> => {
  try {
    await call;
  }
  catch (error) {
    return ConnectError.from(error);
  }

  throw new Error('The call was expected to fail');
};

export const readErrorDetail = (error: ConnectError): ErrorDetail => {
  const [detail] = error.findDetails(ErrorDetailSchema);

  return detail ?? create(ErrorDetailSchema, { code: ErrorCode.UNSPECIFIED });
};

export interface CallOutcomeValue {
  code: ErrorCode | undefined;
  permission: string | undefined;
}

export const callForOutcome = async (
  transport: Transport,
  method: DescMethodUnary,
  options: CallOptions,
): Promise<CallOutcomeValue> => {
  try {
    await transport.unary(method, undefined, undefined, options.headers, create(method.input));
  }
  catch (error) {
    const detail = readErrorDetail(ConnectError.from(error));

    return {
      code: detail.code,
      permission: detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined,
    };
  }

  return { code: undefined, permission: undefined };
};

export const createModuleHarness = (): ModuleHarnessValue => {
  const testRuntime = createTestRuntime();
  const transport = createRouterTransport(({ service }) => {
    service(AccessService, createAccessService(testRuntime.runtime));
    service(ClockService, createClockService(testRuntime.runtime, () => testRuntime.clock.getSnapshot()));
    service(NetworkService, createNetworkService(testRuntime.runtime));
    service(NotificationService, createNotificationService(testRuntime.runtime));
    service(OrganizationService, createOrganizationService(testRuntime.runtime));
    service(OrganizationShowcaseService, createOrganizationShowcaseService(testRuntime.runtime));
    service(UserProfileService, createUserProfileService(testRuntime.runtime));
  });

  return {
    ...testRuntime,
    access: createClient(AccessService, transport),
    notification: createClient(NotificationService, transport),
    organization: createClient(OrganizationService, transport),
    transport,
  };
};

export interface TestMemberOptionsValue {
  organizationId: string;
  permissions: readonly string[];
  warehouseIds: readonly string[];
}

export const addTestMember = async (harness: TestRuntimeValue, options: TestMemberOptionsValue): Promise<string> => {
  const { random, runtime } = harness;
  const userId = random.uuid();
  const roleId = random.uuid();

  await runtime.command((transaction) => {
    transaction.put('users', create(UserSchema, { displayName: 'Тестовый пользователь', id: userId }));
    transaction.put('roles', create(RoleSchema, {
      id: roleId,
      name: 'Тестовая роль',
      permissions: [...options.permissions],
      tenantId: options.organizationId,
    }));
    transaction.put('memberships', create(MembershipSchema, {
      id: random.uuid(),
      organizationId: options.organizationId,
      roleAssignments: [{ roleId, warehouseIds: [...options.warehouseIds] }],
      userId,
    }));
  });

  return userId;
};
