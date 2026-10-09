import type { Organization } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import { GetSessionResponseSchema } from '@skladburg/contracts/access/v1/access';
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

import { selectProfileSummary } from './selectProfileSummary';

const USER = { displayName: 'Анна Смирнова', id: 'user-1' };
const ACTING_ORGANIZATION_ID = 'org-acting';

const createOrganization = (id: string, name: string, kinds: readonly ProfileKind[]): Organization =>
  create(OrganizationSchema, {
    id,
    name,
    profiles: kinds.map(kind => create(OrganizationProfileSchema, { kind })),
  });

describe('selectProfileSummary', () => {
  it('returns undefined without a user', () => {
    const session = create(GetSessionResponseSchema, {
      actingOrganizationId: ACTING_ORGANIZATION_ID,
      organizations: [createOrganization(ACTING_ORGANIZATION_ID, 'Заказчик 1', [ProfileKind.CUSTOMER])],
    });

    expect(selectProfileSummary(session)).toBeUndefined();
  });

  it('returns undefined when the acting organization is not among the organizations', () => {
    const session = create(GetSessionResponseSchema, {
      actingOrganizationId: ACTING_ORGANIZATION_ID,
      organizations: [createOrganization('org-other', 'Поставщик 1', [ProfileKind.SUPPLIER])],
      user: USER,
    });

    expect(selectProfileSummary(session)).toBeUndefined();
  });

  it('returns undefined when there is no acting organization', () => {
    const session = create(GetSessionResponseSchema, {
      organizations: [createOrganization('org-other', 'Поставщик 1', [ProfileKind.SUPPLIER])],
      user: USER,
    });

    expect(selectProfileSummary(session)).toBeUndefined();
  });

  it('describes the user and the acting organization with one side', () => {
    const session = create(GetSessionResponseSchema, {
      actingOrganizationId: ACTING_ORGANIZATION_ID,
      organizations: [
        createOrganization('org-other', 'Поставщик 1', [ProfileKind.SUPPLIER]),
        createOrganization(ACTING_ORGANIZATION_ID, 'Заказчик 1', [ProfileKind.CUSTOMER]),
      ],
      user: USER,
    });

    expect(selectProfileSummary(session)).toEqual({
      organizationId: ACTING_ORGANIZATION_ID,
      organizationName: 'Заказчик 1',
      sides: [ProfileKind.CUSTOMER],
      userDisplayName: 'Анна Смирнова',
      userId: 'user-1',
    });
  });

  it('keeps two sides of the acting organization in the order of its profiles', () => {
    const session = create(GetSessionResponseSchema, {
      actingOrganizationId: ACTING_ORGANIZATION_ID,
      organizations: [createOrganization(ACTING_ORGANIZATION_ID, 'Перевозчик и поставщик', [ProfileKind.CARRIER, ProfileKind.SUPPLIER])],
      user: USER,
    });

    expect(selectProfileSummary(session)?.sides).toEqual([ProfileKind.CARRIER, ProfileKind.SUPPLIER]);
  });

  it('drops the unspecified profile kind', () => {
    const session = create(GetSessionResponseSchema, {
      actingOrganizationId: ACTING_ORGANIZATION_ID,
      organizations: [
        createOrganization(ACTING_ORGANIZATION_ID, 'Заказчик 1', [ProfileKind.UNSPECIFIED, ProfileKind.CUSTOMER, ProfileKind.UNSPECIFIED]),
      ],
      user: USER,
    });

    expect(selectProfileSummary(session)?.sides).toEqual([ProfileKind.CUSTOMER]);
  });

  it('returns an empty list of sides for an organization without profiles', () => {
    const session = create(GetSessionResponseSchema, {
      actingOrganizationId: ACTING_ORGANIZATION_ID,
      organizations: [createOrganization(ACTING_ORGANIZATION_ID, 'Заказчик 1', [])],
      user: USER,
    });

    expect(selectProfileSummary(session)?.sides).toEqual([]);
  });
});
