import type { ConnectRouter } from '@connectrpc/connect';
import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';

import { create } from '@bufbuild/protobuf';
import {
  AccessService,
  EffectivePermissionSchema,
  GetSessionResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  OrganizationProfileSchema,
  OrganizationSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';

export interface SessionFixtureOptionsValue {
  permissions?: readonly string[];
  profiles?: readonly ProfileKind[];
}

export const SESSION_ORGANIZATION_ID = 'f0000001-0000-4000-8000-000000000000';
export const SESSION_ORGANIZATION_NAME = 'Покупатель 1';
export const SESSION_USER_ID = 'f0000002-0000-4000-8000-000000000000';
export const SESSION_USER_DISPLAY_NAME = 'Анна Смирнова';
const ALL_PERMISSIONS: readonly string[] = ['deal_view', 'warehouse_view'];

export const createSessionFixture = ({
  permissions = ALL_PERMISSIONS,
  profiles = [ProfileKind.BUYER],
}: SessionFixtureOptionsValue = {}): GetSessionResponse => create(GetSessionResponseSchema, {
  actingOrganizationId: SESSION_ORGANIZATION_ID,
  organizations: [
    create(OrganizationSchema, {
      id: SESSION_ORGANIZATION_ID,
      name: SESSION_ORGANIZATION_NAME,
      profiles: profiles.map(kind => create(OrganizationProfileSchema, { kind })),
    }),
  ],
  permissions: permissions.map(permission => create(EffectivePermissionSchema, { isOrganizationWide: true, permission })),
  user: { displayName: SESSION_USER_DISPLAY_NAME, id: SESSION_USER_ID },
});

export const registerSessionRoute = (router: ConnectRouter, session: GetSessionResponse = createSessionFixture()): void => {
  router.service(AccessService, { getSession: () => session });
};

export const createSessionRoutes = (session?: GetSessionResponse): (router: ConnectRouter) => void => (router) => {
  registerSessionRoute(router, session);
};
