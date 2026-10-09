import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';

import { create } from '@bufbuild/protobuf';
import {
  EffectivePermissionSchema,
  GetSessionResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  OrganizationProfileSchema,
  OrganizationSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveAvailableSections } from './resolveAvailableSections';

const ORGANIZATION_ID = 'a0000001-0000-4000-8000-000000000000';
const OTHER_ORGANIZATION_ID = 'a0000002-0000-4000-8000-000000000000';
const WAREHOUSE_ID = 'a0000003-0000-4000-8000-000000000000';

interface SessionOptionsValue {
  actingOrganizationId?: string;
  permissions: { isOrganizationWide: boolean; permission: string; warehouseIds?: string[] }[];
  profiles: ProfileKind[];
}

const createSession = (options: SessionOptionsValue): GetSessionResponse => create(GetSessionResponseSchema, {
  actingOrganizationId: options.actingOrganizationId ?? ORGANIZATION_ID,
  organizations: [
    create(OrganizationSchema, {
      id: ORGANIZATION_ID,
      profiles: options.profiles.map(kind => create(OrganizationProfileSchema, { kind })),
    }),
  ],
  permissions: options.permissions.map(permission => create(EffectivePermissionSchema, permission)),
});

const ORGANIZATION_WIDE_PERMISSIONS = [
  { isOrganizationWide: true, permission: 'deal_view' },
  { isOrganizationWide: true, permission: 'warehouse_view' },
];

describe('resolveAvailableSections', () => {
  it('returns nothing for an organization without profiles', () => {
    const session = createSession({ permissions: ORGANIZATION_WIDE_PERMISSIONS, profiles: [] });

    expect(resolveAvailableSections(session)).toEqual([]);
  });

  it('returns nothing when the acting organization is not in the list', () => {
    const session = createSession({
      actingOrganizationId: OTHER_ORGANIZATION_ID,
      permissions: ORGANIZATION_WIDE_PERMISSIONS,
      profiles: [ProfileKind.CUSTOMER],
    });

    expect(resolveAvailableSections(session)).toEqual([]);
  });

  it('returns nothing for an empty session', () => {
    expect(resolveAvailableSections(create(GetSessionResponseSchema))).toEqual([]);
  });

  it('gives a customer with organization-wide permissions all four sections in the order of sections', () => {
    const session = createSession({ permissions: ORGANIZATION_WIDE_PERMISSIONS, profiles: [ProfileKind.CUSTOMER] });

    expect(resolveAvailableSections(session)).toEqual(['network', 'catalog', 'deals', 'warehouse']);
  });

  it('hides the warehouse from a carrier even with the warehouse permission', () => {
    const session = createSession({ permissions: ORGANIZATION_WIDE_PERMISSIONS, profiles: [ProfileKind.CARRIER] });

    expect(resolveAvailableSections(session)).toEqual(['network', 'deals']);
  });

  it('keeps the warehouse for an organization that is both supplier and carrier', () => {
    const session = createSession({
      permissions: ORGANIZATION_WIDE_PERMISSIONS,
      profiles: [ProfileKind.SUPPLIER, ProfileKind.CARRIER],
    });

    expect(resolveAvailableSections(session)).toEqual(['network', 'catalog', 'deals', 'warehouse']);
  });

  it('gives only the warehouse for a permission limited to warehouses', () => {
    const session = createSession({
      permissions: [{ isOrganizationWide: false, permission: 'warehouse_view', warehouseIds: [WAREHOUSE_ID] }],
      profiles: [ProfileKind.CUSTOMER],
    });

    expect(resolveAvailableSections(session)).toEqual(['warehouse']);
  });

  it('hides the warehouse without the warehouse permission', () => {
    const session = createSession({
      permissions: [{ isOrganizationWide: true, permission: 'deal_view' }],
      profiles: [ProfileKind.SUPPLIER],
    });

    expect(resolveAvailableSections(session)).toEqual(['network', 'catalog', 'deals']);
  });

  it('returns nothing without any permission', () => {
    const session = createSession({ permissions: [], profiles: [ProfileKind.CUSTOMER, ProfileKind.SUPPLIER, ProfileKind.CARRIER] });

    expect(resolveAvailableSections(session)).toEqual([]);
  });

  it('ignores profiles of other organizations of the session', () => {
    const session = create(GetSessionResponseSchema, {
      actingOrganizationId: ORGANIZATION_ID,
      organizations: [
        create(OrganizationSchema, { id: ORGANIZATION_ID, profiles: [] }),
        create(OrganizationSchema, {
          id: OTHER_ORGANIZATION_ID,
          profiles: [create(OrganizationProfileSchema, { kind: ProfileKind.CUSTOMER })],
        }),
      ],
      permissions: ORGANIZATION_WIDE_PERMISSIONS.map(permission => create(EffectivePermissionSchema, permission)),
    });

    expect(resolveAvailableSections(session)).toEqual([]);
  });
});
