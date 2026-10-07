import type {
  CallOptions,
  Client,
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
import {
  ErrorCode,
  type ErrorDetail,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';

import type { TestRuntimeValue } from './testRuntime';

import { DEMO_USER_HEADER } from '../../protocol';
import { createAccessService } from '../identity/index';
import { createOrganizationService } from '../organizationService';
import { createTestRuntime } from './testRuntime';

export interface ModuleHarnessValue extends TestRuntimeValue {
  access: Client<typeof AccessService>;
  organization: Client<typeof OrganizationService>;
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

export const createModuleHarness = (): ModuleHarnessValue => {
  const testRuntime = createTestRuntime();
  const transport = createRouterTransport(({ service }) => {
    service(AccessService, createAccessService(testRuntime.runtime));
    service(OrganizationService, createOrganizationService(testRuntime.runtime));
  });

  return {
    ...testRuntime,
    access: createClient(AccessService, transport),
    organization: createClient(OrganizationService, transport),
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
