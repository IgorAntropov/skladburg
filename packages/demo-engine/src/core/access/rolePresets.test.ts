import { create } from '@bufbuild/protobuf';
import { PermissionAction } from '@skladburg/contracts/access/v1/access';
import {
  type Organization,
  OrganizationSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  findPermissionCode,
  getPermissionName,
  getPermissionTraits,
  listPermissionCodes,
} from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { PLATFORM_OPERATOR_ORGANIZATION_ID } from '../platform/index';
import { isPlatformPermission } from './permissionArea';
import { splitPermissionName } from './permissionParts';
import {
  createOperatorPresetRole,
  createPresetRole,
  listOperatorPresets,
  listPermissionsForOperator,
  listPermissionsForProfiles,
  listPresetsForProfiles,
  listRolePresets,
  OperatorPresetKey,
  RolePresetKey,
} from './rolePresets';

const ROLE_ID = '30000001-0000-4000-8000-000000000000';

const PROFILE_SETS: readonly (readonly ProfileKind[])[] = [
  [ProfileKind.CUSTOMER],
  [ProfileKind.SUPPLIER],
  [ProfileKind.CARRIER],
  [ProfileKind.CUSTOMER, ProfileKind.SUPPLIER],
  [ProfileKind.SUPPLIER, ProfileKind.CARRIER],
  [ProfileKind.CUSTOMER, ProfileKind.CARRIER],
  [ProfileKind.CUSTOMER, ProfileKind.SUPPLIER, ProfileKind.CARRIER],
];

const createOrganization = (profiles: readonly ProfileKind[]): Organization =>
  create(OrganizationSchema, {
    id: '10000001-0000-4000-8000-000000000000',
    profiles: profiles.map(kind => ({ kind })),
  });

const catalogNames = new Set<string>(listPermissionCodes().map(getPermissionName));

const appliedRoles = PROFILE_SETS.flatMap(profiles =>
  listPresetsForProfiles(profiles).map(preset => ({
    profiles,
    role: createPresetRole(preset, createOrganization(profiles), ROLE_ID),
  })));

describe('listRolePresets', () => {
  it('lists every preset key once', () => {
    const keys = listRolePresets().map(preset => preset.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(Object.values(RolePresetKey).sort());
  });

  it('keeps only catalog permissions in every preset', () => {
    for (const { role } of appliedRoles) {
      expect(role.permissions.every(name => catalogNames.has(name))).toBe(true);
    }
  });
});

describe('listPresetsForProfiles', () => {
  it('offers the presets of a single profile', () => {
    expect(listPresetsForProfiles([ProfileKind.CUSTOMER]).map(preset => preset.key)).toEqual([
      RolePresetKey.DIRECTOR,
      RolePresetKey.ADMIN,
      RolePresetKey.ACCOUNTANT,
      RolePresetKey.BUYER,
      RolePresetKey.STOREKEEPER,
    ]);
    expect(listPresetsForProfiles([ProfileKind.SUPPLIER]).map(preset => preset.key)).toEqual([
      RolePresetKey.DIRECTOR,
      RolePresetKey.ADMIN,
      RolePresetKey.ACCOUNTANT,
      RolePresetKey.SALES_MANAGER,
      RolePresetKey.STOREKEEPER,
    ]);
    expect(listPresetsForProfiles([ProfileKind.CARRIER]).map(preset => preset.key)).toEqual([
      RolePresetKey.DIRECTOR,
      RolePresetKey.ADMIN,
      RolePresetKey.ACCOUNTANT,
      RolePresetKey.DISPATCHER,
    ]);
  });

  it('unites the presets of several profiles without duplicates', () => {
    const keys = listPresetsForProfiles([ProfileKind.SUPPLIER, ProfileKind.CARRIER]).map(preset => preset.key);

    expect(keys).toHaveLength(6);
    expect(new Set(keys).size).toBe(6);
  });

  it('offers nothing to an organization without profiles', () => {
    expect(listPresetsForProfiles([])).toEqual([]);
  });
});

describe('createPresetRole', () => {
  it('names the role after the preset and binds it to the organization', () => {
    const preset = listRolePresets().find(candidate => candidate.key === RolePresetKey.ACCOUNTANT);
    const organization = createOrganization([ProfileKind.CUSTOMER]);

    const role = preset === undefined ? undefined : createPresetRole(preset, organization, ROLE_ID);

    expect(role).toMatchObject({ id: ROLE_ID, name: 'Бухгалтер', presetKey: 'accountant', tenantId: organization.id });
  });

  it('gives the accountant of a supplier and a carrier the permissions of both profiles', () => {
    const preset = listRolePresets().find(candidate => candidate.key === RolePresetKey.ACCOUNTANT);

    const supplier = preset === undefined ? undefined : createPresetRole(preset, createOrganization([ProfileKind.SUPPLIER]), ROLE_ID);
    const both = preset === undefined
      ? undefined
      : createPresetRole(preset, createOrganization([ProfileKind.SUPPLIER, ProfileKind.CARRIER]), ROLE_ID);

    expect(supplier?.permissions).toContain('payment_release');
    expect(both?.permissions).toEqual(expect.arrayContaining(supplier?.permissions ?? []));
  });
});

describe('role preset invariants', () => {
  it('give an applied preset only permissions of the profiles of the organization', () => {
    for (const { profiles, role } of appliedRoles) {
      for (const name of role.permissions) {
        const code = findPermissionCode(name);
        const traitProfiles = code === undefined ? [] : getPermissionTraits(code).profiles;

        expect(traitProfiles.some(profile => profiles.includes(profile))).toBe(true);
      }
    }
  });

  it('never give one preset both deal_approve and payment_release', () => {
    for (const { role } of appliedRoles) {
      expect(role.permissions.includes('deal_approve') && role.permissions.includes('payment_release')).toBe(false);
    }
  });

  it('give member_manage to the director and the admin only', () => {
    const holderRoles = appliedRoles.filter(({ role }) => role.permissions.includes('member_manage'));
    const holders = new Set(holderRoles.map(({ role }) => role.presetKey));

    expect([...holders].sort()).toEqual([RolePresetKey.ADMIN, RolePresetKey.DIRECTOR]);
  });

  it('give a warehouse-scoped preset only permissions that can be limited to warehouses', () => {
    const scoped = listRolePresets().filter(preset => preset.isWarehouseScoped);

    expect(scoped.map(preset => preset.key)).toEqual([RolePresetKey.STOREKEEPER]);

    for (const { role } of appliedRoles.filter(({ role: candidate }) => scoped.some(preset => preset.key === candidate.presetKey))) {
      expect(role.permissions.length).toBeGreaterThan(0);

      for (const name of role.permissions) {
        const code = findPermissionCode(name);

        expect(code === undefined ? false : getPermissionTraits(code).isScopeApplicable).toBe(true);
      }
    }
  });

  it('keep the money actions fund and release away from the director', () => {
    const directors = appliedRoles.filter(({ role }) => role.presetKey === RolePresetKey.DIRECTOR);

    expect(directors.length).toBeGreaterThan(0);

    for (const { role } of directors) {
      const actions = role.permissions.map(name => splitPermissionName(name).action);

      expect(actions).not.toContain(PermissionAction.FUND);
      expect(actions).not.toContain(PermissionAction.RELEASE);
    }
  });

  it('give the director every other permission of the profiles of the organization', () => {
    for (const profiles of PROFILE_SETS) {
      const director = appliedRoles.find(applied => applied.profiles === profiles && applied.role.presetKey === RolePresetKey.DIRECTOR);
      const expected = listPermissionCodes()
        .filter(code => getPermissionTraits(code).profiles.some(profile => profiles.includes(profile)))
        .map(getPermissionName)
        .filter(name => ![PermissionAction.FUND, PermissionAction.RELEASE].includes(splitPermissionName(name).action));

      expect([...(director?.role.permissions ?? [])].sort()).toEqual([...expected].sort());
    }
  });

  it('give the payment actions fund and release to the accountant of every profile', () => {
    for (const profiles of PROFILE_SETS) {
      const accountant = appliedRoles.find(applied => applied.profiles === profiles && applied.role.presetKey === RolePresetKey.ACCOUNTANT);
      const supportsMoney = profiles.includes(ProfileKind.CUSTOMER) || profiles.includes(ProfileKind.SUPPLIER);

      expect(accountant?.role.permissions.includes('payment_release')).toBe(supportsMoney);
      expect(accountant?.role.permissions.includes('payment_fund')).toBe(supportsMoney);
    }
  });
});

describe('client presets and the platform area', () => {
  it('never contain a platform permission', () => {
    for (const { role } of appliedRoles) {
      expect(role.permissions.filter(isPlatformPermission), role.presetKey).toEqual([]);
    }
  });

  it('are not offered a platform permission by the profile catalog', () => {
    for (const profiles of PROFILE_SETS) {
      expect(listPermissionsForProfiles(profiles).map(getPermissionName).filter(isPlatformPermission)).toEqual([]);
    }

    expect(listPermissionsForProfiles([])).toEqual([]);
  });

  it('give support_access_approve and support_access_view to the director and the admin only', () => {
    const holders = appliedRoles.filter(({ role }) =>
      role.permissions.includes('support_access_approve') || role.permissions.includes('support_access_view'));

    expect(new Set(holders.map(({ role }) => role.presetKey))).toEqual(new Set([RolePresetKey.ADMIN, RolePresetKey.DIRECTOR]));

    for (const { role } of holders) {
      expect(role.permissions).toContain('support_access_approve');
      expect(role.permissions).toContain('support_access_view');
    }
  });

  it('keep support_access_approve and support_access_view away from the other presets', () => {
    const others = appliedRoles.filter(({ role }) => role.presetKey !== RolePresetKey.DIRECTOR && role.presetKey !== RolePresetKey.ADMIN);

    expect(others.length).toBeGreaterThan(0);

    for (const { role } of others) {
      expect(role.permissions, role.presetKey).not.toContain('support_access_approve');
      expect(role.permissions, role.presetKey).not.toContain('support_access_view');
    }
  });

  it('give the admin of every profile set both support_access permissions', () => {
    for (const profiles of PROFILE_SETS) {
      const admin = appliedRoles.find(applied => applied.profiles === profiles && applied.role.presetKey === RolePresetKey.ADMIN);

      expect(admin?.role.permissions).toEqual(expect.arrayContaining(['support_access_approve', 'support_access_view']));
    }
  });
});

describe('listOperatorPresets', () => {
  const operatorRoles = listOperatorPresets().map(preset => createOperatorPresetRole(preset, preset.key));
  const permissionsOf = (key: OperatorPresetKey): string[] =>
    [...(operatorRoles.find(role => role.presetKey === key)?.permissions ?? [])].sort();

  it('lists the four operator presets once, apart from the client presets', () => {
    const keys = listOperatorPresets().map(preset => preset.key);

    expect(keys).toEqual([
      OperatorPresetKey.SUPPORT_AGENT,
      OperatorPresetKey.SUPPORT_ENGINEER,
      OperatorPresetKey.PLATFORM_ADMIN,
      OperatorPresetKey.SUPER_ADMIN,
    ]);
    expect(listOperatorPresets().map(preset => preset.name)).toEqual([
      'Агент поддержки',
      'Инженер поддержки',
      'Администратор платформы',
      'Супер-администратор',
    ]);

    const operatorKeys: string[] = keys;
    const offeredToClients: string[] = PROFILE_SETS.flatMap(profiles => listPresetsForProfiles(profiles)).map(preset => preset.key);
    const clientKeys: string[] = listRolePresets().map(preset => preset.key);

    expect(operatorKeys.some(key => clientKeys.includes(key))).toBe(false);
    expect(operatorKeys.some(key => offeredToClients.includes(key))).toBe(false);
  });

  it('gives the roles only platform permissions of the catalog and binds them to the operator', () => {
    for (const role of operatorRoles) {
      expect(role.permissions.length, role.presetKey).toBeGreaterThan(0);
      expect(role.permissions.every(name => catalogNames.has(name))).toBe(true);
      expect(role.permissions.every(isPlatformPermission), role.presetKey).toBe(true);
      expect(role.tenantId).toBe(PLATFORM_OPERATOR_ORGANIZATION_ID);
    }
  });

  it('lists the platform permissions of the catalog', () => {
    expect(listPermissionsForOperator().map(getPermissionName).sort()).toEqual([
      'platform_dispute_approve',
      'platform_verification_approve',
      'support_emergency_manage',
      'support_session_create',
      'support_settings_edit',
      'support_ticket_edit',
      'support_ticket_view',
    ]);
  });

  it('gives each preset its documented permissions', () => {
    expect(permissionsOf(OperatorPresetKey.SUPPORT_AGENT)).toEqual(['support_ticket_edit', 'support_ticket_view']);
    expect(permissionsOf(OperatorPresetKey.SUPPORT_ENGINEER)).toEqual([
      'support_session_create',
      'support_settings_edit',
      'support_ticket_edit',
      'support_ticket_view',
    ]);
    expect(permissionsOf(OperatorPresetKey.PLATFORM_ADMIN)).toEqual([
      'platform_dispute_approve',
      'platform_verification_approve',
      'support_ticket_view',
    ]);
    expect(permissionsOf(OperatorPresetKey.SUPER_ADMIN)).toEqual([
      'support_emergency_manage',
      'support_session_create',
      'support_settings_edit',
      'support_ticket_edit',
      'support_ticket_view',
    ]);
  });

  it('never gives an operator role a client permission', () => {
    const clientNames: string[] = listPermissionCodes().map(getPermissionName).filter(name => !isPlatformPermission(name));

    for (const role of operatorRoles) {
      expect(role.permissions.filter(name => clientNames.includes(name)), role.presetKey).toEqual([]);
    }
  });

  it('names the role after the preset', () => {
    const preset = listOperatorPresets().find(candidate => candidate.key === OperatorPresetKey.SUPER_ADMIN);
    const role = preset === undefined ? undefined : createOperatorPresetRole(preset, ROLE_ID);

    expect(role).toMatchObject({ id: ROLE_ID, name: 'Супер-администратор', presetKey: 'super_admin' });
  });
});
