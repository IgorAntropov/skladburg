import type {
  DescMethodUnary,
  DescService,
} from '@bufbuild/protobuf';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { getContractRegistry } from '@skladburg/contracts/registry';
import { getMethodAccess } from '@skladburg/contracts/runtime';
import {
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  addTestMember,
  callAs,
  callForOutcome,
  createModuleHarness,
} from '../modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../seed/index';
import { ENGINE_SERVICES } from './serviceCatalog';

interface MethodRowValue {
  label: string;
  method: DescMethodUnary;
  permissionName: string | undefined;
  requirementCase: string | undefined;
}

const UNKNOWN_USER_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const isUnary = (method: DescService['methods'][number]): method is DescMethodUnary => method.methodKind === 'unary';

const listContractServices = (): DescService[] => {
  const services: DescService[] = [];

  for (const descriptor of getContractRegistry()) {
    if (descriptor.kind === 'service') {
      services.push(descriptor);
    }
  }

  return services;
};

const createRows = (services: readonly DescService[]): MethodRowValue[] =>
  services.flatMap(service => service.methods.filter(isUnary).map((method) => {
    const requirement = getMethodAccess(method)?.requirement;

    return {
      label: `${service.typeName}.${method.name}`,
      method,
      permissionName: requirement?.case === 'permission' ? requirement.value.name : undefined,
      requirementCase: requirement?.case,
    };
  }));

const ROWS = createRows(ENGINE_SERVICES);
const MEMBER_ROWS = ROWS.filter(row => row.requirementCase === 'member' || row.requirementCase === 'permission');
const PERMISSION_ROWS = ROWS.filter(row => row.requirementCase === 'permission');

describe('engine method access: coverage', () => {
  it('registers every contract service that has methods in the engine services', () => {
    const contractServices = listContractServices().filter(service => service.methods.length > 0);

    expect(contractServices.length).toBeGreaterThan(0);
    expect(ENGINE_SERVICES.map(service => service.typeName).sort()).toEqual(contractServices.map(service => service.typeName).sort());
  });

  it('serves the three support ticket methods as self methods', () => {
    const supportRows = ROWS.filter(row => row.label.startsWith('support.v1.SupportTicketService.'));

    expect(supportRows.map(row => row.label).sort()).toEqual([
      'support.v1.SupportTicketService.CreateSupportTicket',
      'support.v1.SupportTicketService.GetSupportTicket',
      'support.v1.SupportTicketService.ListMySupportTickets',
    ]);
    expect(supportRows.map(row => row.requirementCase)).toEqual(supportRows.map(() => 'self'));
  });

  it('serves the support access methods by their permissions', () => {
    const accessRows = ROWS.filter(row => row.label.startsWith('support.v1.SupportAccessService.'));

    expect(accessRows.map(row => [row.label, row.permissionName])).toEqual([
      ['support.v1.SupportAccessService.RequestSupportAccess', 'support_session_create'],
      ['support.v1.SupportAccessService.StartEmergencySupportAccess', 'support_emergency_manage'],
      ['support.v1.SupportAccessService.CloseSupportAccess', 'support_session_create'],
      ['support.v1.SupportAccessService.ApproveSupportAccess', 'support_access_approve'],
      ['support.v1.SupportAccessService.DeclineSupportAccess', 'support_access_approve'],
      ['support.v1.SupportAccessService.EndSupportAccess', 'support_access_approve'],
      ['support.v1.SupportAccessService.ListSupportAccessSessions', 'support_access_view'],
      ['support.v1.SupportAccessService.ListSupportAuditEntries', 'support_access_view'],
    ]);
  });

  it('keeps every engine service method unary with an access requirement', () => {
    const methodCount = ENGINE_SERVICES.reduce((count, service) => count + service.methods.length, 0);

    expect(ROWS).toHaveLength(methodCount);
    expect(ROWS.every(row => row.requirementCase !== undefined)).toBe(true);
    expect(PERMISSION_ROWS.length).toBeGreaterThan(0);
    expect(MEMBER_ROWS.length).toBeGreaterThanOrEqual(PERMISSION_ROWS.length);
  });
});

describe('engine method access: every method of the engine services', () => {
  const harness = createModuleHarness();
  let memberWithoutPermissions = '';

  beforeAll(async () => {
    memberWithoutPermissions = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: [],
      warehouseIds: [],
    });
  });

  it.each(ROWS)('$label: answers session_required without a user', async (row) => {
    const withoutHeaders = await callForOutcome(harness.transport, row.method, callAs(undefined));
    const withOrganizationOnly = await callForOutcome(harness.transport, row.method, callAs(undefined, SeedOrganizationId.CUSTOMER_1));
    const unknownUser = await callForOutcome(harness.transport, row.method, callAs(UNKNOWN_USER_ID, SeedOrganizationId.CUSTOMER_1));

    expect(withoutHeaders.code).toBe(ErrorCode.SESSION_REQUIRED);
    expect(withOrganizationOnly.code).toBe(ErrorCode.SESSION_REQUIRED);
    expect(unknownUser.code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it.each(MEMBER_ROWS)('$label: answers membership_required outside the organization', async (row) => {
    const foreignOptions = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.SUPPLIER_1);
    const foreignOrganization = await callForOutcome(harness.transport, row.method, foreignOptions);
    const withoutOrganization = await callForOutcome(harness.transport, row.method, callAs(SeedUserId.ADMIN_1));

    expect(foreignOrganization.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
    expect(withoutOrganization.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it.each(PERMISSION_ROWS)('$label: answers permission_denied naming the permission to a member without it', async (row) => {
    const outcome = await callForOutcome(harness.transport, row.method, callAs(memberWithoutPermissions, SeedOrganizationId.CUSTOMER_1));

    expect(outcome.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(outcome.permission).toBe(row.permissionName);
  });
});
