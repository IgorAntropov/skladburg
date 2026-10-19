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

import { splitPermissionName } from './permissionParts';
import {
  createPresetRole,
  listPresetsForProfiles,
  listRolePresets,
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

const catalogNames = new Set(listPermissionCodes().map(getPermissionName));

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
