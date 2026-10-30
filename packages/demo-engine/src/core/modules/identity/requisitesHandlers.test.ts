import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  type BankAccount,
  BankAccountSchema,
  type OrganizationRequisites,
  OrganizationRequisitesSchema,
  SignatoryBasis,
  SignatorySchema,
  type UpdateOrganizationRequisitesRequest,
  UpdateOrganizationRequisitesRequestSchema,
  VatMode,
} from '@skladburg/contracts/organization/v1/requisites';
import {
  getPermissionName,
  type KnownPermissionCode,
} from '@skladburg/contracts/runtime';
import {
  ACTING_ORGANIZATION_HEADER,
  SUPPORT_SESSION_HEADER,
} from '@skladburg/contracts/runtime';
import {
  SupportAccessMode,
  SupportAccessSection,
  SupportAccessStatus,
} from '@skladburg/contracts/support/v1/support_access';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../testing/moduleHarness';

import {
  listPermissionsForProfiles,
  listRolePresets,
  RolePresetKey,
} from '../../access/index';
import { DEMO_USER_HEADER } from '../../protocol';
import {
  SEED_WORLD_START_MS,
  SeedOrganizationId,
  SeedUserId,
} from '../../seed/index';
import { createTestSupportAccessSession } from '../../state/testRecords';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';

const KEY = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const OTHER_KEY = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';
const NEW_LEGAL_ADDRESS = '000000, г. Третий, ул. Новая, д. 3';
const SUPPORT_SESSION_ID = 'd0000000-0000-4000-8000-000000000001';
const HOUR_MS = 3_600_000;

const createRequisites = (organizationId: string, legalAddress: string): OrganizationRequisites =>
  create(OrganizationRequisitesSchema, {
    bank: create(BankAccountSchema, {
      bankName: 'АО «Тестовый банк»',
      bik: '040000501',
      correspondentAccount: '30101810600000000501',
      settlementAccount: '40702810300000000001',
    }),
    legalAddress,
    organizationId,
    signatories: [
      create(SignatorySchema, {
        basis: SignatoryBasis.CHARTER,
        fullName: 'Тестов Тест Тестович',
        id: 'c0000001-0000-4000-8000-000000000000',
        isDefault: true,
        position: 'генеральный директор',
      }),
    ],
    timeZone: 'Europe/Moscow',
    vatMode: VatMode.GENERAL,
    version: 1n,
  });

const createHarnessWithRequisites = async (): Promise<ModuleHarnessValue> => {
  const harness = createModuleHarness();

  await harness.runtime.command((transaction) => {
    transaction.put('organizationRequisites', createRequisites(SeedOrganizationId.CUSTOMER_1, '000000, г. Первый, ул. Тестовая, д. 1'));
    transaction.put('organizationRequisites', createRequisites(SeedOrganizationId.SUPPLIER_1, '000000, г. Второй, ул. Пробная, д. 2'));
  });

  return harness;
};

describe('OrganizationRequisitesService.getOrganizationRequisites', () => {
  it('returns the requisites of the own organization', async () => {
    const harness = await createHarnessWithRequisites();

    const response = await harness.organizationRequisites.getOrganizationRequisites(
      {},
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    );

    expect(response.requisites?.organizationId).toBe(SeedOrganizationId.CUSTOMER_1);
    expect(response.requisites?.legalAddress).toBe('000000, г. Первый, ул. Тестовая, д. 1');
    expect(response.requisites?.bank?.bik).toBe('040000501');
    expect(response.requisites?.signatories).toHaveLength(1);
  });

  it('returns the own requisites to a member of another organization, never the neighbour ones', async () => {
    const harness = await createHarnessWithRequisites();

    const response = await harness.organizationRequisites.getOrganizationRequisites(
      {},
      callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1),
    );

    expect(response.requisites?.organizationId).toBe(SeedOrganizationId.SUPPLIER_1);
    expect(response.requisites?.legalAddress).toBe('000000, г. Второй, ул. Пробная, д. 2');
  });

  it('lets a member without special permissions read the requisites', async () => {
    const harness = await createHarnessWithRequisites();

    const response = await harness.organizationRequisites.getOrganizationRequisites(
      {},
      callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
    );

    expect(response.requisites?.organizationId).toBe(SeedOrganizationId.CUSTOMER_1);
  });

  it('answers not_found for an organization without a requisites record', async () => {
    const harness = await createHarnessWithRequisites();

    await harness.runtime.command((transaction) => {
      transaction.delete('organizationRequisites', SeedOrganizationId.SUPPLIER_2);
    });

    const error = await captureError(harness.organizationRequisites.getOrganizationRequisites(
      {},
      callAs(SeedUserId.ADMIN_3, SeedOrganizationId.SUPPLIER_2),
    ));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.NotFound);
    expect(detail.code).toBe(ErrorCode.NOT_FOUND);
    expect(detail.params.case === 'notFound' ? detail.params.value.entity : undefined).toBe(EntityKind.ORGANIZATION);
  });

  it('rejects a call without a session with session_required', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.getOrganizationRequisites(
      {},
      callAs(undefined, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('rejects a foreign acting organization with membership_required', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.getOrganizationRequisites(
      {},
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.SUPPLIER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('rejects a support session without membership with membership_required', async () => {
    const harness = await createHarnessWithRequisites();

    await harness.runtime.command((transaction) => {
      transaction.put('supportAccessSessions', createTestSupportAccessSession(
        SUPPORT_SESSION_ID,
        SeedOrganizationId.CUSTOMER_1,
        SeedUserId.OPERATOR_SUPER_ADMIN_1,
        SupportAccessStatus.ACTIVE,
        {
          expiresAt: timestampFromMs(SEED_WORLD_START_MS + HOUR_MS),
          mode: SupportAccessMode.EDIT,
          section: SupportAccessSection.ALL,
        },
      ));
    });
    const headers = new Headers();
    headers.set(DEMO_USER_HEADER, SeedUserId.OPERATOR_SUPER_ADMIN_1);
    headers.set(ACTING_ORGANIZATION_HEADER, SeedOrganizationId.CUSTOMER_1);
    headers.set(SUPPORT_SESSION_HEADER, SUPPORT_SESSION_ID);

    const error = await captureError(harness.organizationRequisites.getOrganizationRequisites({}, { headers }));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('rejects a staff member without a session with membership_required', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.getOrganizationRequisites(
      {},
      callAs(SeedUserId.OPERATOR_SUPPORT_AGENT, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });
});

const createBank = (overrides: Partial<BankAccount> = {}): BankAccount =>
  create(BankAccountSchema, {
    bankName: 'АО «Новый банк»',
    bik: '040000777',
    correspondentAccount: '30101810900000000777',
    settlementAccount: '40702810700000000123',
    ...overrides,
  });

const createUpdateRequest = (
  overrides: Partial<UpdateOrganizationRequisitesRequest> = {},
): UpdateOrganizationRequisitesRequest =>
  create(UpdateOrganizationRequisitesRequestSchema, {
    bank: createBank(),
    expectedVersion: 1n,
    idempotencyKey: KEY,
    legalAddress: NEW_LEGAL_ADDRESS,
    vatMode: VatMode.WITHOUT_VAT,
    ...overrides,
  });

const getViolations = (error: Awaited<ReturnType<typeof captureError>>): { fieldPath: string; ruleId: string }[] => {
  const detail = readErrorDetail(error);

  return detail.params.case === 'validationFailed'
    ? detail.params.value.violations.map(violation => ({ fieldPath: violation.fieldPath, ruleId: violation.ruleId }))
    : [];
};

const listAdminPresetPermissions = (): string[] => {
  const preset = listRolePresets().find(candidate => candidate.key === RolePresetKey.ADMIN);

  if (preset === undefined) {
    throw new Error('The administrator preset is missing');
  }

  const codes: readonly KnownPermissionCode[] = preset.selectPermissions(listPermissionsForProfiles(preset.profiles));

  return codes.map(code => getPermissionName(code));
};

describe('OrganizationRequisitesService.updateOrganizationRequisites', () => {
  it('lets the director save the address, the VAT mode and the bank and raises the version by one', async () => {
    const harness = await createHarnessWithRequisites();

    const response = await harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest(),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    );
    const read = await harness.organizationRequisites.getOrganizationRequisites(
      {},
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    );

    expect(response.requisites?.legalAddress).toBe(NEW_LEGAL_ADDRESS);
    expect(response.requisites?.vatMode).toBe(VatMode.WITHOUT_VAT);
    expect(response.requisites?.bank?.bik).toBe('040000777');
    expect(response.requisites?.bank?.settlementAccount).toBe('40702810700000000123');
    expect(response.requisites?.version).toBe(2n);
    expect(read.requisites).toEqual(response.requisites);
  });

  it('lets an administrator save', async () => {
    const harness = await createHarnessWithRequisites();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: listAdminPresetPermissions(),
      warehouseIds: [],
    });

    const response = await harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest(),
      callAs(userId, SeedOrganizationId.CUSTOMER_1),
    );

    expect(response.requisites?.version).toBe(2n);
  });

  it('keeps the signatories, the time zone and the organization id as they were', async () => {
    const harness = await createHarnessWithRequisites();
    const before = harness.state.read.get('organizationRequisites', SeedOrganizationId.CUSTOMER_1);

    const response = await harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest(),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    );

    expect(response.requisites?.signatories).toEqual(before?.signatories);
    expect(response.requisites?.timeZone).toBe('Europe/Moscow');
    expect(response.requisites?.organizationId).toBe(SeedOrganizationId.CUSTOMER_1);
  });

  it('writes the requisites of the acting organization only and leaves the neighbour ones alone', async () => {
    const harness = await createHarnessWithRequisites();
    const neighbourBefore = harness.state.read.get('organizationRequisites', SeedOrganizationId.SUPPLIER_1);

    await harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest(),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    );

    expect(harness.state.read.get('organizationRequisites', SeedOrganizationId.SUPPLIER_1)).toEqual(neighbourBefore);
    expect(harness.state.read.get('organizationRequisites', SeedOrganizationId.CUSTOMER_1)?.legalAddress).toBe(NEW_LEGAL_ADDRESS);
  });

  it('does not let a foreign organization be addressed', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest(),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.SUPPLIER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
    expect(harness.state.read.get('organizationRequisites', SeedOrganizationId.SUPPLIER_1)?.version).toBe(1n);
  });

  it('denies a member without organization_manage and writes nothing', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest(),
      callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
    ));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.PermissionDenied);
    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined).toBe('organization_manage');
    expect(harness.state.read.get('organizationRequisites', SeedOrganizationId.CUSTOMER_1)?.version).toBe(1n);
  });

  it('denies organization_edit alone', async () => {
    const harness = await createHarnessWithRequisites();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: ['organization_edit'],
      warehouseIds: [],
    });

    const error = await captureError(harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest(),
      callAs(userId, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('denies a support session in the edit mode', async () => {
    const harness = await createHarnessWithRequisites();

    await harness.runtime.command((transaction) => {
      transaction.put('supportAccessSessions', createTestSupportAccessSession(
        SUPPORT_SESSION_ID,
        SeedOrganizationId.CUSTOMER_1,
        SeedUserId.OPERATOR_SUPER_ADMIN_1,
        SupportAccessStatus.ACTIVE,
        {
          expiresAt: timestampFromMs(SEED_WORLD_START_MS + HOUR_MS),
          mode: SupportAccessMode.EDIT,
          section: SupportAccessSection.ALL,
        },
      ));
    });
    const headers = new Headers();
    headers.set(DEMO_USER_HEADER, SeedUserId.OPERATOR_SUPER_ADMIN_1);
    headers.set(ACTING_ORGANIZATION_HEADER, SeedOrganizationId.CUSTOMER_1);
    headers.set(SUPPORT_SESSION_HEADER, SUPPORT_SESSION_ID);

    const error = await captureError(harness.organizationRequisites.updateOrganizationRequisites(createUpdateRequest(), { headers }));

    const detail = readErrorDetail(error);

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined).toBe('organization_manage');
    expect(harness.state.read.get('organizationRequisites', SeedOrganizationId.CUSTOMER_1)?.version).toBe(1n);
  });

  it('rejects a call without a session', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest(),
      callAs(undefined, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('answers version_conflict with the current version when the expected one is stale', async () => {
    const harness = await createHarnessWithRequisites();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    await harness.organizationRequisites.updateOrganizationRequisites(createUpdateRequest(), options);
    const error = await captureError(harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest({ idempotencyKey: OTHER_KEY, legalAddress: '000000, г. Четвёртый, ул. Старая, д. 4' }),
      options,
    ));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.Aborted);
    expect(detail.code).toBe(ErrorCode.VERSION_CONFLICT);
    expect(detail.params.case === 'versionConflict' ? detail.params.value : undefined).toMatchObject({
      currentVersion: 2,
      entity: EntityKind.ORGANIZATION,
    });
    expect(harness.state.read.get('organizationRequisites', SeedOrganizationId.CUSTOMER_1)?.legalAddress).toBe(NEW_LEGAL_ADDRESS);
  });

  it('rejects an expected version from the future too', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest({ expectedVersion: 5n }),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.VERSION_CONFLICT);
  });

  it('answers a repeated request with the same key by the same response and writes nothing more', async () => {
    const harness = await createHarnessWithRequisites();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    const first = await harness.organizationRequisites.updateOrganizationRequisites(createUpdateRequest(), options);
    const commitsAfterFirst = harness.commits.length;
    const second = await harness.organizationRequisites.updateOrganizationRequisites(createUpdateRequest(), options);

    expect(second).toEqual(first);
    expect(second.requisites?.version).toBe(2n);
    expect(harness.commits).toHaveLength(commitsAfterFirst);
    expect(harness.state.read.get('organizationRequisites', SeedOrganizationId.CUSTOMER_1)?.version).toBe(2n);
  });

  it('rejects the same key with another request', async () => {
    const harness = await createHarnessWithRequisites();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    await harness.organizationRequisites.updateOrganizationRequisites(createUpdateRequest(), options);
    const error = await captureError(harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest({ legalAddress: '000000, г. Пятый, ул. Другая, д. 5' }),
      options,
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
  });

  it('answers a wrong key of the settlement account with validation_failed on the nested path', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest({ bank: createBank({ settlementAccount: '40702810800000000123' }) }),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(error.code).toBe(Code.InvalidArgument);
    expect(readErrorDetail(error).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(getViolations(error)).toEqual([
      { fieldPath: 'bank.settlement_account', ruleId: 'field_check.settlement_account' },
    ]);
    expect(harness.state.read.get('organizationRequisites', SeedOrganizationId.CUSTOMER_1)?.version).toBe(1n);
  });

  it('answers a wrong key of the correspondent account with its own rule id', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest({ bank: createBank({ correspondentAccount: '30101810800000000777' }) }),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(getViolations(error)).toEqual([
      { fieldPath: 'bank.correspondent_account', ruleId: 'field_check.correspondent_account' },
    ]);
  });

  it('reports contract violations of the request and writes nothing', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest({ legalAddress: '', vatMode: VatMode.UNSPECIFIED }),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(getViolations(error)).toEqual([
      { fieldPath: 'legal_address', ruleId: 'required' },
      { fieldPath: 'vat_mode', ruleId: 'enum.not_in' },
    ]);
  });

  it('answers not_found for an organization without a requisites record', async () => {
    const harness = createModuleHarness();

    await harness.runtime.command((transaction) => {
      transaction.delete('organizationRequisites', SeedOrganizationId.CUSTOMER_1);
    });
    const error = await captureError(harness.organizationRequisites.updateOrganizationRequisites(
      createUpdateRequest(),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.NOT_FOUND);
  });
});
