import type {
  Client,
  ConnectError,
} from '@connectrpc/connect';
import type { FieldViolation } from '@skladburg/contracts/common/v1/error';

import { fromJson } from '@bufbuild/protobuf';
import {
  Code,
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  ListOrganizationShowcasesRequestSchema,
  OrganizationShowcaseService,
} from '@skladburg/contracts/organization/v1/showcase';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createEngineTransport,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import {
  SeedOrganizationId,
  SeedSphereId,
  SeedUserId,
} from '../../seed/index';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import { createOrganizationShowcaseService } from './showcaseHandlers';

const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const SMALL_PAGE_SIZE = 3;
const CUSTOMER_1_VISIBLE_COUNT = 8;
const FRESH_CUSTOMER = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
const UNVERIFIED_SUPPLIER = callAs(SeedUserId.ADMIN_9, SeedOrganizationId.SUPPLIER_5);

const readNotFoundEntity = (error: ConnectError): EntityKind | undefined => {
  const { params } = readErrorDetail(error);

  return params.case === 'notFound' ? params.value.entity : undefined;
};

const readFirstViolation = (error: ConnectError): FieldViolation | undefined => {
  const { params } = readErrorDetail(error);

  return params.case === 'validationFailed' ? params.value.violations[0] : undefined;
};

const createShowcaseClient = (): Client<typeof OrganizationShowcaseService> => {
  const { runtime } = createTestRuntime();

  return createClient(OrganizationShowcaseService, createRouterTransport(({ service }) => {
    service(OrganizationShowcaseService, createOrganizationShowcaseService(runtime));
  }));
};

describe('OrganizationShowcaseService.listOrganizationShowcases', () => {
  it('lists the verified organizations to the first customer sorted by the name', async () => {
    const { organizations } = await createShowcaseClient().listOrganizationShowcases({}, FRESH_CUSTOMER);
    const names = organizations.map(organization => organization.name);

    expect(organizations).toHaveLength(CUSTOMER_1_VISIBLE_COUNT);
    expect(names).toEqual([...names].sort(new Intl.Collator('ru').compare));
    expect(names).not.toContain('Поставщик 5');
  });

  it('passes the side, the sphere and the level of the request to the filter', async () => {
    const { organizations } = await createShowcaseClient().listOrganizationShowcases(
      { minVerificationLevel: 1, profileKind: ProfileKind.CARRIER, sphereId: SeedSphereId.FOOD },
      FRESH_CUSTOMER,
    );

    expect(organizations.map(organization => organization.name)).toEqual(['Перевозчик 1']);
  });

  it('shows an unverified viewer only its own organization', async () => {
    const { organizations } = await createShowcaseClient().listOrganizationShowcases({}, UNVERIFIED_SUPPLIER);

    expect(organizations.map(organization => organization.id)).toEqual([SeedOrganizationId.SUPPLIER_5]);
  });

  it('pages through the list without gaps and duplicates in the order of the names', async () => {
    const client = createShowcaseClient();
    const all = await client.listOrganizationShowcases({}, FRESH_CUSTOMER);
    const first = await client.listOrganizationShowcases({ page: { pageSize: SMALL_PAGE_SIZE } }, FRESH_CUSTOMER);
    const second = await client.listOrganizationShowcases(
      { page: { pageSize: SMALL_PAGE_SIZE, pageToken: first.page?.nextPageToken } },
      FRESH_CUSTOMER,
    );
    const third = await client.listOrganizationShowcases(
      { page: { pageSize: SMALL_PAGE_SIZE, pageToken: second.page?.nextPageToken } },
      FRESH_CUSTOMER,
    );
    const pagedIds = [...first.organizations, ...second.organizations, ...third.organizations].map(organization => organization.id);

    expect(first.organizations).toHaveLength(SMALL_PAGE_SIZE);
    expect(first.page?.nextPageToken).not.toBe('');
    expect(third.organizations).toHaveLength(CUSTOMER_1_VISIBLE_COUNT - 2 * SMALL_PAGE_SIZE);
    expect(third.page?.nextPageToken).toBe('');
    expect(pagedIds).toEqual(all.organizations.map(organization => organization.id));
  });

  it('rejects a storekeeper without network_view with permission_denied', async () => {
    const options = callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
    const detail = readErrorDetail(await captureError(createShowcaseClient().listOrganizationShowcases({}, options)));

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined).toBe('network_view');
  });

  it('rejects a call without a user with session_required', async () => {
    const error = await captureError(createShowcaseClient().listOrganizationShowcases({}, callAs(undefined)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('rejects a level above 4 and a malformed sphere id with validation_failed', async () => {
    const client = createShowcaseClient();
    const tooHigh = await captureError(client.listOrganizationShowcases({ minVerificationLevel: 5 }, FRESH_CUSTOMER));
    const malformed = await captureError(client.listOrganizationShowcases({ sphereId: 'not-a-uuid' }, FRESH_CUSTOMER));

    expect(tooHigh.code).toBe(Code.InvalidArgument);
    expect(readErrorDetail(tooHigh).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(readFirstViolation(malformed)).toMatchObject({ fieldPath: 'sphere_id', ruleId: 'string.uuid' });
  });

  it('rejects an undefined side with validation_failed', async () => {
    const request = fromJson(ListOrganizationShowcasesRequestSchema, { profileKind: 99 });
    const error = await captureError(createShowcaseClient().listOrganizationShowcases(request, FRESH_CUSTOMER));

    expect(readErrorDetail(error).code).toBe(ErrorCode.VALIDATION_FAILED);
  });
});

describe('OrganizationShowcaseService.getOrganizationShowcase', () => {
  it('returns the projection of a verified organization', async () => {
    const { organization } = await createShowcaseClient().getOrganizationShowcase(
      { organizationId: SeedOrganizationId.SUPPLIER_1 },
      FRESH_CUSTOMER,
    );

    expect(organization?.name).toBe('Поставщик 1');
    expect(organization?.sphereIds).toEqual([SeedSphereId.DAIRY, SeedSphereId.FRUIT_AND_VEGETABLES]);
  });

  it('returns the own organization to an unverified viewer', async () => {
    const { organization } = await createShowcaseClient().getOrganizationShowcase(
      { organizationId: SeedOrganizationId.SUPPLIER_5 },
      UNVERIFIED_SUPPLIER,
    );

    expect(organization?.id).toBe(SeedOrganizationId.SUPPLIER_5);
  });

  it('answers a hidden and a missing organization with the same not_found', async () => {
    const client = createShowcaseClient();
    const hidden = await captureError(client.getOrganizationShowcase({ organizationId: SeedOrganizationId.SUPPLIER_5 }, FRESH_CUSTOMER));
    const missing = await captureError(client.getOrganizationShowcase({ organizationId: UNKNOWN_ID }, FRESH_CUSTOMER));
    const hiddenFromUnverified = await captureError(
      client.getOrganizationShowcase({ organizationId: SeedOrganizationId.CUSTOMER_1 }, UNVERIFIED_SUPPLIER),
    );

    expect(hidden.code).toBe(Code.NotFound);
    expect(readErrorDetail(hidden).code).toBe(ErrorCode.NOT_FOUND);
    expect(readNotFoundEntity(hidden)).toBe(EntityKind.ORGANIZATION);
    expect(readErrorDetail(missing).params).toEqual(readErrorDetail(hidden).params);
    expect(readErrorDetail(hiddenFromUnverified).params).toEqual(readErrorDetail(hidden).params);
  });

  it('rejects a storekeeper without network_view with permission_denied', async () => {
    const options = callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
    const error = await captureError(
      createShowcaseClient().getOrganizationShowcase({ organizationId: SeedOrganizationId.SUPPLIER_1 }, options),
    );

    expect(readErrorDetail(error).code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('rejects a malformed organization id with validation_failed', async () => {
    const error = await captureError(createShowcaseClient().getOrganizationShowcase({ organizationId: 'not-a-uuid' }, FRESH_CUSTOMER));

    expect(readErrorDetail(error).code).toBe(ErrorCode.VALIDATION_FAILED);
  });
});

describe.each([
  ['binary', true],
  ['JSON', false],
])('OrganizationShowcaseService through the engine in the %s format', (_name, useBinaryFormat) => {
  it('serves the filtered list and the single projection', async () => {
    const { engine } = await createTestEngine();
    const client = createClient(OrganizationShowcaseService, createEngineTransport(engine, useBinaryFormat));

    const list = await client.listOrganizationShowcases({ sphereId: SeedSphereId.DAIRY }, FRESH_CUSTOMER);
    const single = await client.getOrganizationShowcase({ organizationId: SeedOrganizationId.SUPPLIER_1 }, FRESH_CUSTOMER);

    expect(list.organizations.map(organization => organization.name)).toEqual(['Поставщик 1']);
    expect(single.organization?.name).toBe('Поставщик 1');
  });
});
