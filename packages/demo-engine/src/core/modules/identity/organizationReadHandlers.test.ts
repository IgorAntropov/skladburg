import { Code } from '@connectrpc/connect';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedSphereId,
  SeedUserId,
} from '../../seed/index';
import {
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';

const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

describe('OrganizationService.getOrganization', () => {
  it('returns the full record of the own organization', async () => {
    const { organization } = createModuleHarness();

    const response = await organization.getOrganization(
      { organizationId: SeedOrganizationId.CUSTOMER_1 },
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    );

    expect(response.organization?.id).toBe(SeedOrganizationId.CUSTOMER_1);
    expect(response.organization?.legalName).not.toBe('');
    expect(response.organization?.inn).not.toBe('');
    expect(response.organization?.kpp).not.toBe('');
    expect(response.organization?.ogrn).not.toBe('');
  });

  it('returns the showcase projection of another verified organization without legal details', async () => {
    const { organization } = createModuleHarness();

    const response = await organization.getOrganization(
      { organizationId: SeedOrganizationId.SUPPLIER_1 },
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    );

    expect(response.organization?.id).toBe(SeedOrganizationId.SUPPLIER_1);
    expect(response.organization?.name).toBe('Поставщик 1');
    expect(response.organization?.profiles.length).toBeGreaterThan(0);
    expect(response.organization?.sphereIds).toEqual([SeedSphereId.DAIRY, SeedSphereId.FRUIT_AND_VEGETABLES]);
    expect(response.organization?.legalName).toBe('');
    expect(response.organization?.inn).toBe('');
    expect(response.organization?.kpp).toBe('');
    expect(response.organization?.ogrn).toBe('');
  });

  it('answers not_found for another organization that is not verified', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.getOrganization(
      { organizationId: SeedOrganizationId.SUPPLIER_5 },
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.NotFound);
    expect(detail.code).toBe(ErrorCode.NOT_FOUND);
    expect(detail.params.case === 'notFound' ? detail.params.value.entity : undefined).toBe(EntityKind.ORGANIZATION);
  });

  it('answers not_found for another organization when the viewing organization is not verified', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.getOrganization(
      { organizationId: SeedOrganizationId.CUSTOMER_1 },
      callAs(SeedUserId.ADMIN_9, SeedOrganizationId.SUPPLIER_5),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.NOT_FOUND);
  });

  it('lets an unverified organization read its own full record', async () => {
    const { organization } = createModuleHarness();

    const response = await organization.getOrganization(
      { organizationId: SeedOrganizationId.SUPPLIER_5 },
      callAs(SeedUserId.ADMIN_9, SeedOrganizationId.SUPPLIER_5),
    );

    expect(response.organization?.inn).not.toBe('');
  });

  it('answers a missing organization exactly like a hidden one', async () => {
    const { organization } = createModuleHarness();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    const missing = await captureError(organization.getOrganization({ organizationId: UNKNOWN_ID }, options));
    const hidden = await captureError(organization.getOrganization({ organizationId: SeedOrganizationId.SUPPLIER_5 }, options));

    expect(missing.code).toBe(hidden.code);
    expect(readErrorDetail(missing).code).toBe(readErrorDetail(hidden).code);
    expect(readErrorDetail(missing).params).toEqual(readErrorDetail(hidden).params);
  });

  it('rejects a malformed organization id with validation_failed', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.getOrganization(
      { organizationId: 'not-a-uuid' },
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.InvalidArgument);
    expect(detail.params.case === 'validationFailed' ? detail.params.value.violations[0] : undefined).toMatchObject({
      fieldPath: 'organization_id',
      ruleId: 'string.uuid',
    });
  });

  it('rejects a call without a user with session_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.getOrganization(
      { organizationId: SeedOrganizationId.CUSTOMER_1 },
      callAs(undefined, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('rejects a call without an organization with membership_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.getOrganization(
      { organizationId: SeedOrganizationId.CUSTOMER_1 },
      callAs(SeedUserId.ADMIN_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('rejects a foreign acting organization with membership_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.getOrganization(
      { organizationId: SeedOrganizationId.CUSTOMER_1 },
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.SUPPLIER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });
});

describe('OrganizationService.getOrganizationSettings', () => {
  it('returns the settings of the acting organization', async () => {
    const { organization } = createModuleHarness();

    const response = await organization.getOrganizationSettings({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));

    expect(response.settings?.organizationId).toBe(SeedOrganizationId.CUSTOMER_1);
    expect(response.settings?.brandName).toBe('Заказчик 1');
    expect(response.settings?.defaultLocale).toBe('ru');
  });

  it('returns the settings of the organization the context points at, never of another one', async () => {
    const { organization } = createModuleHarness();

    const response = await organization.getOrganizationSettings({}, callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1));

    expect(response.settings?.organizationId).toBe(SeedOrganizationId.SUPPLIER_1);
  });

  it('answers not_found when the organization has no settings record', async () => {
    const harness = createModuleHarness();
    await harness.runtime.command((transaction) => {
      transaction.delete('organizationSettings', SeedOrganizationId.CUSTOMER_1);
    });

    const error = await captureError(harness.organization.getOrganizationSettings(
      {},
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.NOT_FOUND);
  });

  it('rejects a call without a user with session_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.getOrganizationSettings({}, callAs(undefined, SeedOrganizationId.CUSTOMER_1)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('rejects a call without an organization with membership_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.getOrganizationSettings({}, callAs(SeedUserId.ADMIN_1)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('rejects an organization the user does not belong to with membership_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.getOrganizationSettings(
      {},
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.SUPPLIER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });
});

describe('OrganizationService.listSpheres', () => {
  it('returns the spheres with a session alone', async () => {
    const { organization } = createModuleHarness();

    const response = await organization.listSpheres({}, callAs(SeedUserId.ADMIN_1));

    expect(response.spheres.map(sphere => sphere.id)).toContain(SeedSphereId.DAIRY);
    expect(response.page?.nextPageToken).toBe('');
  });

  it('pages through the spheres', async () => {
    const { organization } = createModuleHarness();
    const options = callAs(SeedUserId.ADMIN_1);
    const all = await organization.listSpheres({}, options);
    const first = await organization.listSpheres({ page: { pageSize: 3 } }, options);
    const second = await organization.listSpheres({ page: { pageSize: 3, pageToken: first.page?.nextPageToken } }, options);
    const third = await organization.listSpheres({ page: { pageSize: 3, pageToken: second.page?.nextPageToken } }, options);

    expect(first.spheres).toHaveLength(3);
    expect([...first.spheres, ...second.spheres, ...third.spheres].map(sphere => sphere.id)).toEqual(all.spheres.map(sphere => sphere.id));
    expect(third.page?.nextPageToken).toBe('');
  });

  it('rejects a call without a user with session_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.listSpheres({}, callAs(undefined)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('rejects an acting organization the user does not belong to with membership_required', async () => {
    const { organization } = createModuleHarness();

    const error = await captureError(organization.listSpheres({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.SUPPLIER_1)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });
});
