import type {
  DescMessage,
  DescMethod,
  DescMethodUnary,
  MessageShape,
} from '@bufbuild/protobuf';
import type { Role } from '@skladburg/contracts/access/v1/access';
import type { Organization } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import { MethodOptions_IdempotencyLevel } from '@bufbuild/protobuf/wkt';
import {
  MembershipSchema,
  UserSchema,
} from '@skladburg/contracts/access/v1/access';
import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  AcceptCounterOfferRequestSchema,
  ConfirmDealRequestSchema,
  DealService,
  SubmitDealRequestSchema,
} from '@skladburg/contracts/deal/v1/deal';
import { SelectTransportOfferRequestSchema } from '@skladburg/contracts/logistics/v1/logistics';
import {
  CreateWarehouseRequestSchema,
  OrganizationService,
  WarehouseCapability,
} from '@skladburg/contracts/organization/v1/organization';
import {
  FundDealRequestSchema,
  PaymentService,
} from '@skladburg/contracts/payment/v1/payment';
import {
  findPermissionCode,
  getMethodAccess,
  getPermissionName,
  getPermissionTraits,
  type KnownPermissionCode,
} from '@skladburg/contracts/runtime';
import {
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  callAs,
  callForOutcome,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../modules/testing/moduleHarness';
import { isPlatformOperator } from '../platform/index';
import {
  createSeedRecords,
  SeedCityId,
  SeedMapNodeId,
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../seed/index';
import { isPermissionInOrganizationArea } from './permissionArea';
import {
  listOperatorPresets,
  listPermissionsForOperator,
  listPermissionsForProfiles,
  listRolePresets,
  type OperatorPresetValue,
  type RolePresetValue,
} from './rolePresets';
import { ENGINE_SERVICES } from './serviceCatalog';

interface MatrixCaseValue {
  assignmentWarehouseIds: readonly string[];
  expectedOutcome: 'allowed' | 'denied';
  method: DescMethodUnary;
  organizationId: string;
  permissionName: string;
  title: string;
  userId: string;
}

interface MatrixSubjectValue {
  assignmentWarehouseIds: readonly string[];
  grantedPermissions: ReadonlySet<string>;
  organization: Organization;
  preset: OperatorPresetValue | RolePresetValue;
  role: Role;
  userId: string;
}

interface PermissionMethodValue {
  method: DescMethodUnary;
  permissionName: string;
  scopeField: string;
}

const CREATE_WAREHOUSE_KEY = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const UNKNOWN_DEAL_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const LIMITED_REQUESTS: ReadonlyMap<string, MessageShape<DescMessage>> = new Map<string, MessageShape<DescMessage>>([
  ['deal.v1.DealService.AcceptCounterOffer', create(AcceptCounterOfferRequestSchema, {
    dealId: UNKNOWN_DEAL_ID,
    expectedVersion: 1,
    goodsTotal: { amountMinor: 100n, currencyCode: 'RUB' },
    idempotencyKey: CREATE_WAREHOUSE_KEY,
  })],
  ['deal.v1.DealService.ConfirmDeal', create(ConfirmDealRequestSchema, {
    dealId: UNKNOWN_DEAL_ID,
    expectedVersion: 1,
    goodsTotal: { amountMinor: 100n, currencyCode: 'RUB' },
    idempotencyKey: CREATE_WAREHOUSE_KEY,
    shipFromWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1,
  })],
  ['deal.v1.DealService.SubmitDeal', create(SubmitDealRequestSchema, {
    dealId: UNKNOWN_DEAL_ID,
    expectedVersion: 1,
    goodsTotal: { amountMinor: 100n, currencyCode: 'RUB' },
    idempotencyKey: CREATE_WAREHOUSE_KEY,
  })],
  ['logistics.v1.LogisticsService.SelectTransportOffer', create(SelectTransportOfferRequestSchema, {
    confirmedAmount: { amountMinor: 100n, currencyCode: 'RUB' },
    expectedVersion: 1,
    idempotencyKey: CREATE_WAREHOUSE_KEY,
    transportOfferId: UNKNOWN_DEAL_ID,
    transportRequestId: UNKNOWN_DEAL_ID,
  })],
  ['payment.v1.PaymentService.FundDeal', create(FundDealRequestSchema, {
    amount: { amountMinor: 100n, currencyCode: 'RUB' },
    dealId: UNKNOWN_DEAL_ID,
    expectedVersion: 1,
    idempotencyKey: CREATE_WAREHOUSE_KEY,
  })],
]);

const records = createSeedRecords();
const presets = listRolePresets();
const operatorPresets = listOperatorPresets();

const isUnary = (method: DescMethod): method is DescMethodUnary => method.methodKind === 'unary';

const listPermissionMethods = (): PermissionMethodValue[] =>
  ENGINE_SERVICES.flatMap(service => service.methods.flatMap((method) => {
    const requirement = getMethodAccess(method)?.requirement;

    if (!isUnary(method) || requirement?.case !== 'permission') {
      return [];
    }

    return [{ method, permissionName: requirement.value.name, scopeField: requirement.value.scopeField }];
  }));

const deriveId = (prefix: string, roleId: string): string => `${prefix}${roleId.slice(1)}`;

const isWarehouseScopedPreset = (preset: OperatorPresetValue | RolePresetValue): boolean =>
  'isWarehouseScoped' in preset && preset.isWarehouseScoped;

const findPreset = (role: Role): OperatorPresetValue | RolePresetValue => {
  const candidates = isPlatformOperator(role.tenantId) ? operatorPresets : presets;
  const preset = candidates.find(candidate => candidate.key === role.presetKey);

  if (preset === undefined) {
    throw new Error(`The role ${role.name} refers to an unknown preset ${role.presetKey}`);
  }

  return preset;
};

const findFirstWarehouseId = (organizationId: string): string | undefined =>
  records.warehouses.find(warehouse => warehouse.tenantId === organizationId)?.id;

const createSubjects = (): MatrixSubjectValue[] =>
  records.organizations.flatMap(organization => records.roles
    .filter(role => role.tenantId === organization.id)
    .flatMap((role) => {
      const preset = findPreset(role);
      const warehouseId = findFirstWarehouseId(organization.id);

      const isScoped = isWarehouseScopedPreset(preset);

      if (isScoped && warehouseId === undefined) {
        return [];
      }

      const applicable = isPlatformOperator(organization.id)
        ? listPermissionsForOperator()
        : listPermissionsForProfiles(organization.profiles.map(profile => profile.kind));

      return [{
        assignmentWarehouseIds: isScoped && warehouseId !== undefined ? [warehouseId] : [],
        grantedPermissions: new Set(preset.selectPermissions(applicable).map(code => getPermissionName(code))),
        organization,
        preset,
        role,
        userId: deriveId('a', role.id),
      }];
    }));

const findCode = (permissionName: string): KnownPermissionCode => {
  const code = findPermissionCode(permissionName);

  if (code === undefined) {
    throw new Error(`The permission ${permissionName} is not in the catalog`);
  }

  return code;
};

const isReachable = (subject: MatrixSubjectValue, entry: PermissionMethodValue): boolean => {
  if (!subject.grantedPermissions.has(entry.permissionName)) {
    return false;
  }

  if (subject.assignmentWarehouseIds.length === 0) {
    return true;
  }

  const isScopeApplicable = getPermissionTraits(findCode(entry.permissionName)).isScopeApplicable;
  const isScopeAware = entry.method.idempotency === MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS || entry.scopeField !== '';

  return isScopeApplicable && isScopeAware;
};

const createCases = (subjects: readonly MatrixSubjectValue[], methods: readonly PermissionMethodValue[]): MatrixCaseValue[] =>
  subjects.flatMap(subject => methods.map((entry) => {
    const missingImportPermission = entry.method.parent.typeName === 'import.v1.ImportService'
      && entry.method.name === 'ListImportJobs' && isReachable(subject, entry)
      ? ['catalog_view', 'price_list_view'].find(permission => !subject.grantedPermissions.has(permission))
      : undefined;
    const expectedOutcome = isReachable(subject, entry) && missingImportPermission === undefined ? 'allowed' : 'denied';

    return {
      assignmentWarehouseIds: subject.assignmentWarehouseIds,
      expectedOutcome,
      method: entry.method,
      organizationId: subject.organization.id,
      permissionName: missingImportPermission ?? entry.permissionName,
      title: `${subject.organization.name} / ${subject.role.name} / ${entry.method.name} (${entry.permissionName}): ${expectedOutcome}`,
      userId: subject.userId,
    };
  }));

const SUBJECTS = createSubjects();
const PERMISSION_METHODS = listPermissionMethods();
const CASES = createCases(SUBJECTS, PERMISSION_METHODS);
const LIMITED_METHODS = PERMISSION_METHODS.filter(({ method }) => {
  const requirement = getMethodAccess(method)?.requirement;

  return requirement?.case === 'permission' && requirement.value.limitField !== '';
});

const findLimitedRequest = (method: DescMethodUnary): MessageShape<DescMessage> | undefined =>
  LIMITED_REQUESTS.get(`${method.parent.typeName}.${method.name}`);

describe('role preset matrix: inputs', () => {
  it('supplies every method with a limit field a request that passes contract validation', () => {
    const harness = createModuleHarness();

    expect(LIMITED_METHODS.map(({ method }) => `${method.parent.typeName}.${method.name}`).sort())
      .toEqual([...LIMITED_REQUESTS.keys()].sort());

    for (const { method } of LIMITED_METHODS) {
      const request = findLimitedRequest(method);

      expect(request, method.name).toBeDefined();

      if (request !== undefined) {
        const userId = method.parent.typeName === PaymentService.typeName ? SeedUserId.ADMIN_1 : SeedUserId.BUYER_1;
        expect(() => harness.runtime.guard.guardPermissionCall(
          harness.state.read,
          method,
          request,
          new Headers(callAs(userId, SeedOrganizationId.CUSTOMER_1).headers),
        )).not.toThrow();
      }
    }
  });

  it('covers every organization and every role of the seed', () => {
    expect(SUBJECTS).toHaveLength(records.roles.length);
    expect(new Set(SUBJECTS.map(subject => subject.organization.id)).size).toBe(records.organizations.length);
    expect(PERMISSION_METHODS.length).toBeGreaterThan(0);
    expect(CASES).toHaveLength(SUBJECTS.length * PERMISSION_METHODS.length);
  });

  it('gives every organization with a warehouse-scoped preset a warehouse to assign it to', () => {
    for (const organization of records.organizations) {
      const scopedRoles = records.roles.filter(role => role.tenantId === organization.id && isWarehouseScopedPreset(findPreset(role)));

      if (scopedRoles.length > 0) {
        expect(findFirstWarehouseId(organization.id), organization.name).toBeDefined();
      }
    }
  });

  it('grants every subject only permissions of the area of its organization', () => {
    for (const subject of SUBJECTS) {
      for (const permissionName of subject.grantedPermissions) {
        const isInArea = isPermissionInOrganizationArea(permissionName, subject.organization.id);

        expect(isInArea, `${subject.role.name}: ${permissionName}`).toBe(true);
      }
    }
  });

  it('gives support_access_approve and support_access_view to the director and the admin of a client only', () => {
    const holders = SUBJECTS.filter(subject =>
      subject.grantedPermissions.has('support_access_approve') || subject.grantedPermissions.has('support_access_view'));

    expect(holders.length).toBeGreaterThan(0);
    expect(new Set(holders.map(subject => subject.role.presetKey))).toEqual(new Set(['admin', 'director']));
    expect(holders.every(subject =>
      subject.grantedPermissions.has('support_access_approve') && subject.grantedPermissions.has('support_access_view'))).toBe(true);
  });

  it('produces both outcomes', () => {
    expect(CASES.some(item => item.expectedOutcome === 'allowed')).toBe(true);
    expect(CASES.some(item => item.expectedOutcome === 'denied')).toBe(true);
  });
});

describe('role preset matrix: permission x preset x organization', () => {
  const harness = createModuleHarness();

  beforeAll(async () => {
    await harness.runtime.command((transaction) => {
      for (const subject of SUBJECTS) {
        transaction.put('users', create(UserSchema, { displayName: 'Участник матрицы', id: subject.userId }));
        transaction.put('memberships', create(MembershipSchema, {
          id: deriveId('b', subject.role.id),
          organizationId: subject.organization.id,
          roleAssignments: [{ roleId: subject.role.id, warehouseIds: [...subject.assignmentWarehouseIds] }],
          userId: subject.userId,
        }));
      }
    });
  });

  it.each(CASES)('$title', async (item) => {
    const limitedRequest = findLimitedRequest(item.method);
    const outcome = await callForOutcome(harness.transport, item.method, callAs(item.userId, item.organizationId), limitedRequest);

    if (item.expectedOutcome === 'allowed') {
      expect(outcome.code).not.toBe(ErrorCode.PERMISSION_DENIED);
      expect(outcome.code).not.toBe(ErrorCode.LIMIT_EXCEEDED);

      if (limitedRequest !== undefined) {
        expect(outcome.code).not.toBe(ErrorCode.INTERNAL);
        expect(outcome.code).not.toBe(ErrorCode.VALIDATION_FAILED);
      }
    }
    else {
      expect(outcome.code).toBe(ErrorCode.PERMISSION_DENIED);
      expect(outcome.permission).toBe(item.permissionName);
    }
  });
});

describe('deal approval methods: real amount limits', () => {
  const methods: readonly DescMethodUnary[] = [
    DealService.method.submitDeal,
    DealService.method.confirmDeal,
    DealService.method.acceptCounterOffer,
  ];
  const harness = createModuleHarness();
  const headers = new Headers(callAs(SeedUserId.BUYER_1, SeedOrganizationId.CUSTOMER_1).headers);

  it.each(methods)('$name allows the exact limit and rejects an amount above it', async (method) => {
    const template = findLimitedRequest(method);

    if (template === undefined) {
      throw new Error(`Missing limited request for ${method.name}`);
    }

    const { $typeName: _, ...fields } = template;
    const accepted = create(method.input, { ...fields, goodsTotal: { amountMinor: 10_000_000n, currencyCode: 'RUB' } });
    const rejected = create(method.input, { ...fields, goodsTotal: { amountMinor: 10_000_001n, currencyCode: 'RUB' } });

    expect(() => harness.runtime.guard.guardPermissionCall(harness.state.read, method, accepted, headers)).not.toThrow();

    const error = await captureError(Promise.resolve().then(() =>
      harness.runtime.guard.guardPermissionCall(harness.state.read, method, rejected, headers)));
    const detail = readErrorDetail(error);

    expect(detail.code).toBe(ErrorCode.LIMIT_EXCEEDED);
    expect(detail.params.case === 'limitExceeded' ? detail.params.value : undefined).toMatchObject({
      limit: { amountMinor: 10_000_000n, currencyCode: 'RUB' },
      permission: 'deal_approve',
      requested: { amountMinor: 10_000_001n, currencyCode: 'RUB' },
    });
  });
});

describe('warehouse_create needs the whole organization', () => {
  const request = create(CreateWarehouseRequestSchema, {
    address: 'ул. Вымышленная, 1',
    capabilities: [WarehouseCapability.RAMP],
    cityId: SeedCityId.KAZAN,
    idempotencyKey: CREATE_WAREHOUSE_KEY,
    mapNodeId: SeedMapNodeId.KAZAN,
    name: 'Склад 9',
    timeZone: 'Europe/Moscow',
  });

  it('is not applicable to a warehouse area in the catalog and in the method option', () => {
    const requirement = getMethodAccess(OrganizationService.method.createWarehouse)?.requirement;

    expect(getPermissionTraits(PermissionCode.WAREHOUSE_CREATE).isScopeApplicable).toBe(false);
    expect(requirement?.case === 'permission' ? requirement.value.scopeField : undefined).toBe('');
  });

  it('is not part of any warehouse-scoped preset', () => {
    for (const preset of presets.filter(candidate => candidate.isWarehouseScoped)) {
      const names = preset.selectPermissions(listPermissionsForProfiles(preset.profiles)).map(code => getPermissionName(code));

      expect(names, preset.key).not.toContain('warehouse_create');
    }
  });

  it('denies a storekeeper limited to one warehouse and lets a director create a warehouse', async () => {
    const { organization } = createModuleHarness();

    const storekeeper = callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
    const error = await captureError(organization.createWarehouse(request, storekeeper));
    const detail = readErrorDetail(error);
    const created = await organization.createWarehouse(request, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined).toBe('warehouse_create');
    expect(created.warehouse?.tenantId).toBe(SeedOrganizationId.CUSTOMER_1);
  });
});
