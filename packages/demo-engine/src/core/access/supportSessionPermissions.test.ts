import { create } from '@bufbuild/protobuf';
import { PermissionAction } from '@skladburg/contracts/access/v1/access';
import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  getPermissionName,
  getPermissionTraits,
  type KnownPermissionCode,
  listPermissionCodes,
} from '@skladburg/contracts/runtime';
import {
  SupportAccessMode,
  SupportAccessSection,
  SupportAccessSessionSchema,
  SupportAccessStatus,
} from '@skladburg/contracts/support/v1/support_access';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { EffectivePermissionValue } from './permissionScope';

import { isPlatformPermission } from './permissionArea';
import { splitPermissionName } from './permissionParts';
import {
  listOperatorPresets,
  listPermissionsForOperator,
  listPermissionsForProfiles,
  OperatorPresetKey,
} from './rolePresets';
import {
  isNeverForSupport,
  isPermissionNameNeverForSupport,
  listSupportStaffActions,
  resolveSupportSessionPermissions,
  SUPPORT_SECTION_BY_FEATURE,
} from './supportSessionPermissions';

type ConcreteSection = Exclude<SupportAccessSection, SupportAccessSection.ALL | SupportAccessSection.UNSPECIFIED>;

const CONCRETE_SECTIONS: readonly ConcreteSection[] = [
  SupportAccessSection.ORGANIZATION,
  SupportAccessSection.WAREHOUSES,
  SupportAccessSection.CATALOG,
  SupportAccessSection.DEALS,
  SupportAccessSection.LOGISTICS,
];

const ALL_SECTIONS: readonly SupportAccessSection[] = [...CONCRETE_SECTIONS, SupportAccessSection.ALL];

const MODES: readonly SupportAccessMode[] = [SupportAccessMode.VIEW, SupportAccessMode.EDIT];

const VIEW_ACTIONS: readonly PermissionAction[] = [PermissionAction.VIEW];

const EDIT_ACTIONS: readonly PermissionAction[] = [
  PermissionAction.VIEW,
  PermissionAction.CREATE,
  PermissionAction.EDIT,
  PermissionAction.DELETE,
];

const PROFILE_SETS: readonly (readonly ProfileKind[])[] = [
  [ProfileKind.SUPPLIER],
  [ProfileKind.CARRIER],
  [ProfileKind.CUSTOMER],
  [ProfileKind.SUPPLIER, ProfileKind.CARRIER],
  [ProfileKind.CUSTOMER, ProfileKind.SUPPLIER, ProfileKind.CARRIER],
];

const SUPPLIER: readonly ProfileKind[] = [ProfileKind.SUPPLIER];
const CARRIER: readonly ProfileKind[] = [ProfileKind.CARRIER];

const toStaffPermissions = (names: readonly string[]): EffectivePermissionValue[] =>
  names.map(permission => ({ isOrganizationWide: true, permission, warehouseIds: [] }));

const staffPermissionsOf = (key: OperatorPresetKey): EffectivePermissionValue[] => {
  const preset = listOperatorPresets().find(candidate => candidate.key === key);

  if (preset === undefined) {
    throw new Error(`The operator preset ${key} is not defined`);
  }

  return toStaffPermissions(preset.selectPermissions(listPermissionsForOperator()).map(code => getPermissionName(code)));
};

const resolveFor = (
  staffPermissions: readonly EffectivePermissionValue[],
  organizationProfiles: readonly ProfileKind[],
  section: SupportAccessSection,
  mode: SupportAccessMode,
): string[] => resolveSupportSessionPermissions({
  organizationProfiles,
  session: create(SupportAccessSessionSchema, { mode, section, status: SupportAccessStatus.ACTIVE }),
  staffPermissions,
}).map(effective => effective.permission);

const featureOf = (code: KnownPermissionCode): string => splitPermissionName(getPermissionName(code)).feature;

const actionOf = (code: KnownPermissionCode): PermissionAction => splitPermissionName(getPermissionName(code)).action;

const CLIENT_CODES = listPermissionCodes().filter(code => !isPlatformPermission(getPermissionName(code)));

interface IntersectionRowValue {
  expected: readonly string[];
  mode: SupportAccessMode;
  profiles: readonly ProfileKind[];
  roleKey: OperatorPresetKey;
  section: SupportAccessSection;
  title: string;
}

const INTERSECTION_ROWS: readonly IntersectionRowValue[] = [
  {
    expected: ['member_view'],
    mode: SupportAccessMode.VIEW,
    profiles: SUPPLIER,
    roleKey: OperatorPresetKey.SUPPORT_ENGINEER,
    section: SupportAccessSection.ORGANIZATION,
    title: 'supplier, organization, view',
  },
  {
    expected: ['member_view', 'organization_edit'],
    mode: SupportAccessMode.EDIT,
    profiles: SUPPLIER,
    roleKey: OperatorPresetKey.SUPPORT_ENGINEER,
    section: SupportAccessSection.ORGANIZATION,
    title: 'supplier, organization, edit',
  },
  {
    expected: ['inventory_view', 'sensor_view', 'staff_view', 'task_view', 'warehouse_view', 'yard_view'],
    mode: SupportAccessMode.VIEW,
    profiles: SUPPLIER,
    roleKey: OperatorPresetKey.SUPER_ADMIN,
    section: SupportAccessSection.WAREHOUSES,
    title: 'supplier, warehouses, view',
  },
  {
    expected: [
      'inventory_edit',
      'inventory_view',
      'layout_edit',
      'sensor_view',
      'staff_view',
      'task_create',
      'task_edit',
      'task_view',
      'warehouse_create',
      'warehouse_edit',
      'warehouse_view',
      'yard_view',
    ],
    mode: SupportAccessMode.EDIT,
    profiles: SUPPLIER,
    roleKey: OperatorPresetKey.SUPER_ADMIN,
    section: SupportAccessSection.WAREHOUSES,
    title: 'supplier, warehouses, edit',
  },
  {
    expected: [
      'catalog_edit',
      'catalog_view',
      'network_view',
      'price_list_edit',
      'price_list_view',
      'promotion_edit',
      'promotion_view',
    ],
    mode: SupportAccessMode.EDIT,
    profiles: SUPPLIER,
    roleKey: OperatorPresetKey.SUPPORT_ENGINEER,
    section: SupportAccessSection.CATALOG,
    title: 'supplier, catalog, edit',
  },
  {
    expected: ['analytics_view', 'claim_view', 'contract_view', 'deal_view', 'document_view', 'payment_view'],
    mode: SupportAccessMode.EDIT,
    profiles: SUPPLIER,
    roleKey: OperatorPresetKey.SUPPORT_ENGINEER,
    section: SupportAccessSection.DEALS,
    title: 'supplier, deals, edit: no sign, no fund, no transitions',
  },
  {
    expected: ['transport_request_view', 'trip_view'],
    mode: SupportAccessMode.EDIT,
    profiles: SUPPLIER,
    roleKey: OperatorPresetKey.SUPER_ADMIN,
    section: SupportAccessSection.LOGISTICS,
    title: 'supplier, logistics, edit',
  },
  {
    expected: ['member_view', 'organization_edit'],
    mode: SupportAccessMode.EDIT,
    profiles: CARRIER,
    roleKey: OperatorPresetKey.SUPER_ADMIN,
    section: SupportAccessSection.ORGANIZATION,
    title: 'carrier, organization, edit',
  },
  {
    expected: [],
    mode: SupportAccessMode.EDIT,
    profiles: CARRIER,
    roleKey: OperatorPresetKey.SUPER_ADMIN,
    section: SupportAccessSection.WAREHOUSES,
    title: 'carrier, warehouses, edit: a carrier has no warehouse permissions',
  },
  {
    expected: ['network_view'],
    mode: SupportAccessMode.EDIT,
    profiles: CARRIER,
    roleKey: OperatorPresetKey.SUPPORT_ENGINEER,
    section: SupportAccessSection.CATALOG,
    title: 'carrier, catalog, edit',
  },
  {
    expected: ['analytics_view', 'claim_view', 'contract_view', 'deal_view', 'document_view', 'payment_view'],
    mode: SupportAccessMode.VIEW,
    profiles: CARRIER,
    roleKey: OperatorPresetKey.SUPPORT_ENGINEER,
    section: SupportAccessSection.DEALS,
    title: 'carrier, deals, view',
  },
  {
    expected: ['fleet_view', 'transport_request_view', 'trip_view'],
    mode: SupportAccessMode.VIEW,
    profiles: CARRIER,
    roleKey: OperatorPresetKey.SUPPORT_ENGINEER,
    section: SupportAccessSection.LOGISTICS,
    title: 'carrier, logistics, view',
  },
  {
    expected: ['fleet_edit', 'fleet_view', 'transport_request_view', 'trip_view'],
    mode: SupportAccessMode.EDIT,
    profiles: CARRIER,
    roleKey: OperatorPresetKey.SUPER_ADMIN,
    section: SupportAccessSection.LOGISTICS,
    title: 'carrier, logistics, edit: no trip_edit and no transport_offer_create',
  },
];

describe('resolveSupportSessionPermissions: table', () => {
  it.each(INTERSECTION_ROWS)('$title', ({ expected, mode, profiles, roleKey, section }) => {
    expect(resolveFor(staffPermissionsOf(roleKey), profiles, section, mode)).toEqual(expected);
  });

  it('keeps the whole organization and no warehouse list on every permission', () => {
    const result = resolveSupportSessionPermissions({
      organizationProfiles: [ProfileKind.CUSTOMER, ProfileKind.SUPPLIER, ProfileKind.CARRIER],
      session: create(SupportAccessSessionSchema, { mode: SupportAccessMode.EDIT, section: SupportAccessSection.ALL }),
      staffPermissions: staffPermissionsOf(OperatorPresetKey.SUPER_ADMIN),
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every(effective => effective.isOrganizationWide && effective.warehouseIds.length === 0)).toBe(true);
  });

  it('returns nothing for an unspecified mode or an unspecified section', () => {
    const staffPermissions = staffPermissionsOf(OperatorPresetKey.SUPER_ADMIN);

    expect(resolveFor(staffPermissions, SUPPLIER, SupportAccessSection.ALL, SupportAccessMode.UNSPECIFIED)).toEqual([]);
    expect(resolveFor(staffPermissions, SUPPLIER, SupportAccessSection.UNSPECIFIED, SupportAccessMode.EDIT)).toEqual([]);
  });

  it('returns nothing for an organization without profiles', () => {
    expect(resolveFor(staffPermissionsOf(OperatorPresetKey.SUPER_ADMIN), [], SupportAccessSection.ALL, SupportAccessMode.EDIT)).toEqual([]);
  });
});

describe('resolveSupportSessionPermissions: the intersection of every factor', () => {
  const staffRoles: readonly OperatorPresetKey[] = [
    OperatorPresetKey.SUPPORT_ENGINEER,
    OperatorPresetKey.SUPER_ADMIN,
  ];

  const combinations = staffRoles.flatMap(roleKey => PROFILE_SETS.flatMap(profiles =>
    MODES.flatMap(mode => ALL_SECTIONS.map(section => ({ mode, profiles, roleKey, section })))));

  it('stays inside the applicable, section, mode and role factors and outside the never list on all combinations', () => {
    expect(combinations).toHaveLength(2 * PROFILE_SETS.length * 2 * 6);

    for (const { mode, profiles, roleKey, section } of combinations) {
      const staffPermissions = staffPermissionsOf(roleKey);
      const result = resolveFor(staffPermissions, profiles, section, mode);
      const applicable = listPermissionsForProfiles(profiles).map(code => getPermissionName(code));
      const sectionNames = CLIENT_CODES
        .filter(code => section === SupportAccessSection.ALL || SUPPORT_SECTION_BY_FEATURE.get(featureOf(code)) === section)
        .map(code => getPermissionName(code));
      const modeActions = mode === SupportAccessMode.EDIT ? EDIT_ACTIONS : VIEW_ACTIONS;
      const hasSettingsEdit = staffPermissions.some(candidate => candidate.permission === 'support_settings_edit');
      const roleActions = hasSettingsEdit ? EDIT_ACTIONS : VIEW_ACTIONS;

      for (const name of result) {
        const { action } = splitPermissionName(name);
        const code = CLIENT_CODES.find(candidate => getPermissionName(candidate) === name);

        expect(applicable).toContain(name);
        expect(sectionNames).toContain(name);
        expect(modeActions).toContain(action);
        expect(roleActions).toContain(action);
        expect(code !== undefined && isNeverForSupport(code)).toBe(false);
      }

      expect(new Set(result).size).toBe(result.length);
    }
  });

  it('gives the section all the union of the five concrete sections', () => {
    for (const profiles of PROFILE_SETS) {
      for (const mode of MODES) {
        const staffPermissions = staffPermissionsOf(OperatorPresetKey.SUPER_ADMIN);
        const union = new Set(CONCRETE_SECTIONS.flatMap(section => resolveFor(staffPermissions, profiles, section, mode)));

        expect(new Set(resolveFor(staffPermissions, profiles, SupportAccessSection.ALL, mode))).toEqual(union);
      }
    }
  });

  it('gives a support agent and a platform administrator nothing', () => {
    for (const roleKey of [OperatorPresetKey.SUPPORT_AGENT, OperatorPresetKey.PLATFORM_ADMIN]) {
      for (const profiles of PROFILE_SETS) {
        for (const mode of MODES) {
          for (const section of ALL_SECTIONS) {
            expect(resolveFor(staffPermissionsOf(roleKey), profiles, section, mode)).toEqual([]);
          }
        }
      }
    }
  });

  it('gives edit mode the same permissions as view mode without support_settings_edit', () => {
    const withoutSettings = staffPermissionsOf(OperatorPresetKey.SUPER_ADMIN)
      .filter(candidate => candidate.permission !== 'support_settings_edit');

    expect(withoutSettings.some(candidate => candidate.permission === 'support_session_create')).toBe(true);

    for (const profiles of PROFILE_SETS) {
      for (const section of ALL_SECTIONS) {
        const edit = resolveFor(withoutSettings, profiles, section, SupportAccessMode.EDIT);
        const view = resolveFor(withoutSettings, profiles, section, SupportAccessMode.VIEW);

        expect(edit).toEqual(view);
        expect(edit.every(name => splitPermissionName(name).action === PermissionAction.VIEW)).toBe(true);
      }
    }
  });

  it('keeps the edit mode strictly wider than the view mode for the engineer where edit rights exist', () => {
    const engineer = staffPermissionsOf(OperatorPresetKey.SUPPORT_ENGINEER);
    const edit = resolveFor(engineer, SUPPLIER, SupportAccessSection.ALL, SupportAccessMode.EDIT);
    const view = resolveFor(engineer, SUPPLIER, SupportAccessSection.ALL, SupportAccessMode.VIEW);

    expect(view.every(name => edit.includes(name))).toBe(true);
    expect(edit.length).toBeGreaterThan(view.length);
  });
});

describe('listSupportStaffActions', () => {
  it('gives nothing without support_session_create', () => {
    expect(listSupportStaffActions([])).toEqual([]);
    expect(listSupportStaffActions(toStaffPermissions(['support_settings_edit', 'support_ticket_view']))).toEqual([]);
  });

  it('gives view with support_session_create', () => {
    expect(listSupportStaffActions(toStaffPermissions(['support_session_create']))).toEqual(VIEW_ACTIONS);
  });

  it('adds create, edit and delete with support_settings_edit', () => {
    expect(listSupportStaffActions(toStaffPermissions(['support_session_create', 'support_settings_edit']))).toEqual(EDIT_ACTIONS);
  });

  it('follows the operator presets', () => {
    expect(listSupportStaffActions(staffPermissionsOf(OperatorPresetKey.SUPPORT_AGENT))).toEqual([]);
    expect(listSupportStaffActions(staffPermissionsOf(OperatorPresetKey.PLATFORM_ADMIN))).toEqual([]);
    expect(listSupportStaffActions(staffPermissionsOf(OperatorPresetKey.SUPPORT_ENGINEER))).toEqual(EDIT_ACTIONS);
    expect(listSupportStaffActions(staffPermissionsOf(OperatorPresetKey.SUPER_ADMIN))).toEqual(EDIT_ACTIONS);
  });
});

describe('support sections', () => {
  it('puts every client feature of the catalog into exactly one concrete section', () => {
    const features = new Set(CLIENT_CODES.map(code => featureOf(code)));

    expect(features.size).toBeGreaterThan(0);

    for (const feature of features) {
      expect(CONCRETE_SECTIONS).toContain(SUPPORT_SECTION_BY_FEATURE.get(feature));
    }
  });

  it('puts every client permission into exactly one section', () => {
    for (const code of CLIENT_CODES) {
      const matched = CONCRETE_SECTIONS.filter(section => SUPPORT_SECTION_BY_FEATURE.get(featureOf(code)) === section);

      expect(matched).toHaveLength(1);
    }
  });

  it('lists no feature that is absent from the client catalog', () => {
    const features = new Set(CLIENT_CODES.map(code => featureOf(code)));

    expect([...SUPPORT_SECTION_BY_FEATURE.keys()].filter(feature => !features.has(feature))).toEqual([]);
  });

  it('keeps platform permissions out of the sections', () => {
    for (const code of listPermissionsForOperator()) {
      expect(SUPPORT_SECTION_BY_FEATURE.has(featureOf(code))).toBe(false);
    }
  });

  it('uses every concrete section at least once', () => {
    for (const section of CONCRETE_SECTIONS) {
      expect([...SUPPORT_SECTION_BY_FEATURE.values()]).toContain(section);
    }
  });
});

describe('isNeverForSupport: the rule against the list of the document', () => {
  const NAMED_CODES: readonly KnownPermissionCode[] = [
    PermissionCode.CONTRACT_SIGN,
    PermissionCode.DOCUMENT_SIGN,
    PermissionCode.PAYMENT_FUND,
    PermissionCode.PAYMENT_RELEASE,
    PermissionCode.DEAL_CREATE,
    PermissionCode.DEAL_EDIT,
    PermissionCode.DEAL_APPROVE,
    PermissionCode.MEMBER_MANAGE,
    PermissionCode.REVIEW_CREATE,
  ];

  const DEAL_FEATURES: readonly string[] = [
    'deal',
    'contract',
    'document',
    'payment',
    'claim',
    'review',
    'transport_request',
    'transport_offer',
    'trip',
  ];

  const NEVER_ACTIONS: readonly PermissionAction[] = [
    PermissionAction.APPROVE,
    PermissionAction.EXPORT,
    PermissionAction.FUND,
    PermissionAction.MANAGE,
    PermissionAction.RELEASE,
    PermissionAction.SIGN,
  ];

  it.each(NAMED_CODES.map(code => ({ code, name: getPermissionName(code) })))('covers $name', ({ code }) => {
    expect(isNeverForSupport(code)).toBe(true);
  });

  it('covers signatures, money, approvals, grants and exports by action', () => {
    const covered = CLIENT_CODES.filter(code => NEVER_ACTIONS.includes(actionOf(code)));

    expect(covered.length).toBeGreaterThan(0);
    expect(covered.every(code => isNeverForSupport(code))).toBe(true);
  });

  it('covers every name ending in _approve, _manage or _export', () => {
    const covered = listPermissionCodes().filter(code => /_(?:approve|manage|export)$/u.test(getPermissionName(code)));

    expect(covered.length).toBeGreaterThan(0);
    expect(covered.every(code => isNeverForSupport(code))).toBe(true);
  });

  it('covers every change of a deal feature and none of their views', () => {
    const dealCodes = CLIENT_CODES.filter(code => DEAL_FEATURES.includes(featureOf(code)));

    expect(dealCodes.length).toBeGreaterThan(0);

    for (const code of dealCodes) {
      expect(isNeverForSupport(code)).toBe(actionOf(code) !== PermissionAction.VIEW);
    }

    const views = dealCodes.filter(code => actionOf(code) === PermissionAction.VIEW);

    expect(views.map(code => getPermissionName(code))).toEqual([
      'claim_view',
      'contract_view',
      'deal_view',
      'document_view',
      'payment_view',
      'transport_request_view',
      'trip_view',
    ]);
    expect(views.some(code => isNeverForSupport(code))).toBe(false);
  });

  it('covers the whole support_access feature', () => {
    const accessCodes = CLIENT_CODES.filter(code => featureOf(code) === 'support_access');

    expect(accessCodes.map(code => getPermissionName(code))).toEqual(['support_access_approve', 'support_access_view']);
    expect(accessCodes.every(code => isNeverForSupport(code))).toBe(true);
  });

  it('covers the platform permissions', () => {
    const platformCodes = listPermissionsForOperator();

    expect(platformCodes.length).toBeGreaterThan(0);
    expect(platformCodes.every(code => isNeverForSupport(code))).toBe(true);
  });

  it('covers every permission with an applicable limit', () => {
    const limited = listPermissionCodes().filter(code => getPermissionTraits(code).isLimitApplicable);

    expect(limited.length).toBeGreaterThan(0);
    expect(limited.every(code => isNeverForSupport(code))).toBe(true);
  });

  it('covers a limited create permission of an allowed section that no other rule covers', () => {
    const name = 'warehouse_create';
    const { action, feature } = splitPermissionName(name);

    expect(SUPPORT_SECTION_BY_FEATURE.get(feature)).toBe(SupportAccessSection.WAREHOUSES);
    expect(EDIT_ACTIONS).toContain(action);
    expect(isPermissionNameNeverForSupport(name, false)).toBe(false);
    expect(isPermissionNameNeverForSupport(name, true)).toBe(true);
  });

  it('issues no permission with an applicable limit in any session', () => {
    const limitedNames = new Set<string>(
      listPermissionCodes().filter(code => getPermissionTraits(code).isLimitApplicable).map(code => getPermissionName(code)),
    );
    const staffPermissions = staffPermissionsOf(OperatorPresetKey.SUPER_ADMIN);

    for (const profiles of PROFILE_SETS) {
      for (const mode of MODES) {
        for (const section of ALL_SECTIONS) {
          expect(resolveFor(staffPermissions, profiles, section, mode).filter(name => limitedNames.has(name))).toEqual([]);
        }
      }
    }
  });

  it('leaves ordinary view and edit permissions outside the rule', () => {
    const allowed: readonly KnownPermissionCode[] = [
      PermissionCode.WAREHOUSE_VIEW,
      PermissionCode.WAREHOUSE_EDIT,
      PermissionCode.CATALOG_EDIT,
      PermissionCode.ORGANIZATION_EDIT,
      PermissionCode.MEMBER_VIEW,
      PermissionCode.FLEET_EDIT,
      PermissionCode.DEAL_VIEW,
      PermissionCode.PAYMENT_VIEW,
    ];

    expect(allowed.some(code => isNeverForSupport(code))).toBe(false);
  });
});
