import type {
  DescMethod,
  DescMethodUnary,
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
  CreateWarehouseRequestSchema,
  OrganizationService,
  WarehouseCapability,
} from '@skladburg/contracts/organization/v1/organization';
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
import {
  createSeedRecords,
  SeedBoardNodeId,
  SeedCityId,
  SeedOrganizationId,
  SeedUserId,
} from '../seed/index';
import {
  listPermissionsForProfiles,
  listRolePresets,
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
  preset: RolePresetValue;
  role: Role;
  userId: string;
}

interface PermissionMethodValue {
  method: DescMethodUnary;
  permissionName: string;
  scopeField: string;
}

const CREATE_WAREHOUSE_KEY = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';

const records = createSeedRecords();
const presets = listRolePresets();

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

const findPreset = (role: Role): RolePresetValue => {
  const preset = presets.find(candidate => candidate.key === role.presetKey);

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

      if (preset.isWarehouseScoped && warehouseId === undefined) {
        return [];
      }

      const applicable = listPermissionsForProfiles(organization.profiles.map(profile => profile.kind));

      return [{
        assignmentWarehouseIds: preset.isWarehouseScoped && warehouseId !== undefined ? [warehouseId] : [],
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
    const expectedOutcome = isReachable(subject, entry) ? 'allowed' : 'denied';

    return {
      assignmentWarehouseIds: subject.assignmentWarehouseIds,
      expectedOutcome,
      method: entry.method,
      organizationId: subject.organization.id,
      permissionName: entry.permissionName,
      title: `${subject.organization.name} / ${subject.role.name} / ${entry.method.name} (${entry.permissionName}): ${expectedOutcome}`,
      userId: subject.userId,
    };
  }));

const SUBJECTS = createSubjects();
const PERMISSION_METHODS = listPermissionMethods();
const CASES = createCases(SUBJECTS, PERMISSION_METHODS);

describe('role preset matrix: inputs', () => {
  it('covers every organization and every role of the seed', () => {
    expect(SUBJECTS).toHaveLength(records.roles.length);
    expect(new Set(SUBJECTS.map(subject => subject.organization.id)).size).toBe(records.organizations.length);
    expect(PERMISSION_METHODS.length).toBeGreaterThan(0);
    expect(CASES).toHaveLength(SUBJECTS.length * PERMISSION_METHODS.length);
  });

  it('gives every organization with a warehouse-scoped preset a warehouse to assign it to', () => {
    for (const organization of records.organizations) {
      const scopedRoles = records.roles.filter(role => role.tenantId === organization.id && findPreset(role).isWarehouseScoped);

      if (scopedRoles.length > 0) {
        expect(findFirstWarehouseId(organization.id), organization.name).toBeDefined();
      }
    }
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
    const outcome = await callForOutcome(harness.transport, item.method, callAs(item.userId, item.organizationId));

    if (item.expectedOutcome === 'allowed') {
      expect(outcome.code).not.toBe(ErrorCode.PERMISSION_DENIED);
      expect(outcome.code).not.toBe(ErrorCode.LIMIT_EXCEEDED);
    }
    else {
      expect(outcome.code).toBe(ErrorCode.PERMISSION_DENIED);
      expect(outcome.permission).toBe(item.permissionName);
    }
  });
});

describe('warehouse_create needs the whole organization', () => {
  const request = create(CreateWarehouseRequestSchema, {
    address: 'ул. Вымышленная, 1',
    boardNodeId: SeedBoardNodeId.KAZAN,
    capabilities: [WarehouseCapability.RAMP],
    cityId: SeedCityId.KAZAN,
    idempotencyKey: CREATE_WAREHOUSE_KEY,
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
