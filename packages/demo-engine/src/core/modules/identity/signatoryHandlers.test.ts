import {
  create,
  type MessageInitShape,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import {
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  BankAccountSchema,
  OrganizationRequisitesSchema,
  OrganizationRequisitesService,
  type RemoveSignatoryRequest,
  RemoveSignatoryRequestSchema,
  type SaveSignatoryRequest,
  SaveSignatoryRequestSchema,
  type Signatory,
  SignatoryBasis,
  SignatorySchema,
  VatMode,
} from '@skladburg/contracts/organization/v1/requisites';
import {
  ACTING_ORGANIZATION_HEADER,
  getPermissionName,
  type KnownPermissionCode,
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
import { createCommandRunner } from '../../engine/index';
import { createEventBus } from '../../events/index';
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
import { createOrganizationRequisitesService } from './requisitesHandlers';

const KEY = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const OTHER_KEY = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';
const SUPPORT_SESSION_ID = 'd0000000-0000-4000-8000-000000000001';
const HOUR_MS = 3_600_000;
const DIRECTOR = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

const signatoryId = (index: number): string => `c00000${String(index).padStart(2, '0')}-0000-4000-8000-000000000000`;

const FIRST_ID = signatoryId(1);
const SECOND_ID = signatoryId(2);
const NEW_ID = signatoryId(50);

const createCharterSignatory = (id: string, isDefault: boolean): Signatory =>
  create(SignatorySchema, {
    basis: SignatoryBasis.CHARTER,
    fullName: 'Тестов Тест Тестович',
    id,
    isDefault,
    position: 'генеральный директор',
  });

const createAttorneySignatory = (
  id: string,
  overrides: MessageInitShape<typeof SignatorySchema> = {},
): Signatory =>
  create(SignatorySchema, {
    basis: SignatoryBasis.POWER_OF_ATTORNEY,
    fullName: 'Пробов Проб Пробович',
    id,
    position: 'менеджер',
    powerOfAttorneyDate: create(CalendarDateSchema, { day: 12, month: 1, year: 2026 }),
    powerOfAttorneyNumber: '№ 7',
    ...overrides,
  });

const createRequisites = (
  organizationId: string,
  signatories: Signatory[],
  timeZone = 'Europe/Moscow',
): ReturnType<typeof create<typeof OrganizationRequisitesSchema>> =>
  create(OrganizationRequisitesSchema, {
    bank: create(BankAccountSchema, {
      bankName: 'АО «Тестовый банк»',
      bik: '040000501',
      correspondentAccount: '30101810600000000501',
      settlementAccount: '40702810300000000001',
    }),
    legalAddress: '000000, г. Первый, ул. Тестовая, д. 1',
    organizationId,
    signatories,
    timeZone,
    vatMode: VatMode.GENERAL,
    version: 1n,
  });

const createDefaultSignatories = (): Signatory[] => [
  createCharterSignatory(FIRST_ID, true),
  createAttorneySignatory(SECOND_ID),
];

const createHarnessWithRequisites = async (
  signatories: Signatory[] = createDefaultSignatories(),
  timeZone = 'Europe/Moscow',
): Promise<ModuleHarnessValue> => {
  const harness = createModuleHarness();

  await harness.runtime.command((transaction) => {
    transaction.put('organizationRequisites', createRequisites(SeedOrganizationId.CUSTOMER_1, signatories, timeZone));
    transaction.put(
      'organizationRequisites',
      createRequisites(SeedOrganizationId.SUPPLIER_1, [createCharterSignatory(signatoryId(90), true)]),
    );
  });

  return harness;
};

const createSaveRequest = (
  signatory: Signatory,
  overrides: Partial<SaveSignatoryRequest> = {},
): SaveSignatoryRequest =>
  create(SaveSignatoryRequestSchema, {
    expectedVersion: 1n,
    idempotencyKey: KEY,
    signatory,
    ...overrides,
  });

const createRemoveRequest = (
  id: string,
  overrides: Partial<RemoveSignatoryRequest> = {},
): RemoveSignatoryRequest =>
  create(RemoveSignatoryRequestSchema, {
    expectedVersion: 1n,
    idempotencyKey: KEY,
    signatoryId: id,
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

const readStored = (
  harness: ModuleHarnessValue,
  organizationId: string = SeedOrganizationId.CUSTOMER_1,
): ReturnType<typeof createRequisites> => {
  const requisites = harness.state.read.get('organizationRequisites', organizationId);

  if (requisites === undefined) {
    throw new Error('The requisites record is missing');
  }

  return requisites;
};

const listIds = (harness: ModuleHarnessValue): string[] => readStored(harness).signatories.map(signatory => signatory.id);

const listDefaultIds = (harness: ModuleHarnessValue): string[] =>
  readStored(harness).signatories.filter(signatory => signatory.isDefault).map(signatory => signatory.id);

const createClientAtWorldTime = (harness: ModuleHarnessValue, worldTimeMs: number): ModuleHarnessValue['organizationRequisites'] => {
  const command = createCommandRunner({
    bus: createEventBus({ getEpoch: () => 'test-epoch' }),
    errors: harness.runtime.errors,
    readLiveMeta: () => ({
      randomState: harness.random.getState(),
      schedulerDueAtMs: {},
      timeScale: 1,
      traceRandomState: harness.random.getState(),
    }),
    readWorldTimeMs: () => worldTimeMs,
    state: harness.state,
    storage: harness.storage,
  });
  const transport = createRouterTransport(({ service }) => {
    service(OrganizationRequisitesService, createOrganizationRequisitesService({ ...harness.runtime, command }));
  });

  return createClient(OrganizationRequisitesService, transport);
};

const createSupportEditHeaders = async (harness: ModuleHarnessValue): Promise<Headers> => {
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

  return headers;
};

describe('OrganizationRequisitesService.saveSignatory access and consistency', () => {
  it('lets the director save and raises the version by one', async () => {
    const harness = await createHarnessWithRequisites();

    const response = await harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID)),
      DIRECTOR,
    );

    expect(response.requisites?.version).toBe(2n);
    expect(response.requisites).toEqual(readStored(harness));
    expect(response.requisites?.bank?.bik).toBe('040000501');
  });

  it('lets an administrator save', async () => {
    const harness = await createHarnessWithRequisites();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: listAdminPresetPermissions(),
      warehouseIds: [],
    });

    const response = await harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID)),
      callAs(userId, SeedOrganizationId.CUSTOMER_1),
    );

    expect(response.requisites?.version).toBe(2n);
  });

  it('denies organization_edit alone and writes nothing', async () => {
    const harness = await createHarnessWithRequisites();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: ['organization_edit'],
      warehouseIds: [],
    });

    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID)),
      callAs(userId, SeedOrganizationId.CUSTOMER_1),
    ));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.PermissionDenied);
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined).toBe('organization_manage');
    expect(readStored(harness).version).toBe(1n);
  });

  it('denies a support session in the edit mode', async () => {
    const harness = await createHarnessWithRequisites();
    const headers = await createSupportEditHeaders(harness);

    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID)),
      { headers },
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(readStored(harness).version).toBe(1n);
  });

  it('does not let a foreign organization be addressed', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID)),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.SUPPLIER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('writes the acting organization only and leaves the neighbour alone', async () => {
    const harness = await createHarnessWithRequisites();
    const neighbourBefore = readStored(harness, SeedOrganizationId.SUPPLIER_1);

    await harness.organizationRequisites.saveSignatory(createSaveRequest(createAttorneySignatory(NEW_ID)), DIRECTOR);

    expect(readStored(harness, SeedOrganizationId.SUPPLIER_1)).toEqual(neighbourBefore);
  });

  it('answers version_conflict with the current version when the expected one is stale', async () => {
    const harness = await createHarnessWithRequisites();

    await harness.organizationRequisites.saveSignatory(createSaveRequest(createAttorneySignatory(NEW_ID)), DIRECTOR);
    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(signatoryId(51)), { idempotencyKey: OTHER_KEY }),
      DIRECTOR,
    ));
    const detail = readErrorDetail(error);

    expect(error.code).toBe(Code.Aborted);
    expect(detail.code).toBe(ErrorCode.VERSION_CONFLICT);
    expect(detail.params.case === 'versionConflict' ? detail.params.value : undefined).toMatchObject({
      currentVersion: 2,
      entity: EntityKind.ORGANIZATION,
    });
    expect(listIds(harness)).toEqual([FIRST_ID, SECOND_ID, NEW_ID]);
  });

  it('does not revive a removed signatory by a stale edit', async () => {
    const harness = await createHarnessWithRequisites();

    await harness.organizationRequisites.removeSignatory(createRemoveRequest(SECOND_ID), DIRECTOR);
    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(SECOND_ID), { idempotencyKey: OTHER_KEY }),
      DIRECTOR,
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.VERSION_CONFLICT);
    expect(listIds(harness)).toEqual([FIRST_ID]);
  });

  it('answers a repeated request with the same key by the same response and writes nothing more', async () => {
    const harness = await createHarnessWithRequisites();
    const request = createSaveRequest(createAttorneySignatory(NEW_ID));

    const first = await harness.organizationRequisites.saveSignatory(request, DIRECTOR);
    const commitsAfterFirst = harness.commits.length;
    const second = await harness.organizationRequisites.saveSignatory(request, DIRECTOR);

    expect(second).toEqual(first);
    expect(harness.commits).toHaveLength(commitsAfterFirst);
    expect(readStored(harness).version).toBe(2n);
    expect(listIds(harness)).toEqual([FIRST_ID, SECOND_ID, NEW_ID]);
  });

  it('rejects the same key with another request', async () => {
    const harness = await createHarnessWithRequisites();

    await harness.organizationRequisites.saveSignatory(createSaveRequest(createAttorneySignatory(NEW_ID)), DIRECTOR);
    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(signatoryId(51))),
      DIRECTOR,
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
  });

  it('answers not_found for an organization without a requisites record', async () => {
    const harness = createModuleHarness();

    await harness.runtime.command((transaction) => {
      transaction.delete('organizationRequisites', SeedOrganizationId.CUSTOMER_1);
    });
    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID)),
      DIRECTOR,
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.NOT_FOUND);
  });
});

describe('OrganizationRequisitesService.saveSignatory content', () => {
  it('appends a signatory with a new id to the end of the list', async () => {
    const harness = await createHarnessWithRequisites();

    await harness.organizationRequisites.saveSignatory(createSaveRequest(createAttorneySignatory(NEW_ID)), DIRECTOR);

    expect(listIds(harness)).toEqual([FIRST_ID, SECOND_ID, NEW_ID]);
    expect(listDefaultIds(harness)).toEqual([FIRST_ID]);
  });

  it('replaces a signatory with a known id on its place', async () => {
    const harness = await createHarnessWithRequisites();

    const response = await harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(FIRST_ID, { fullName: 'Иванов Иван Иванович', isDefault: true })),
      DIRECTOR,
    );

    expect(response.requisites?.signatories.map(signatory => signatory.id)).toEqual([FIRST_ID, SECOND_ID]);
    expect(response.requisites?.signatories[0]?.fullName).toBe('Иванов Иван Иванович');
    expect(response.requisites?.signatories[0]?.basis).toBe(SignatoryBasis.POWER_OF_ATTORNEY);
    expect(response.requisites?.signatories[1]).toEqual(createDefaultSignatories()[1]);
  });

  it('takes the default mark away from the others when a signatory becomes the default one', async () => {
    const harness = await createHarnessWithRequisites();

    await harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(SECOND_ID, { isDefault: true })),
      DIRECTOR,
    );

    expect(listDefaultIds(harness)).toEqual([SECOND_ID]);
    expect(listIds(harness)).toEqual([FIRST_ID, SECOND_ID]);
  });

  it('adds a new default signatory and leaves one default only', async () => {
    const harness = await createHarnessWithRequisites();

    await harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID, { isDefault: true })),
      DIRECTOR,
    );

    expect(listDefaultIds(harness)).toEqual([NEW_ID]);
  });

  it('refuses to take the default mark away from the current default signatory', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createCharterSignatory(FIRST_ID, false)),
      DIRECTOR,
    ));

    expect(error.code).toBe(Code.InvalidArgument);
    expect(getViolations(error)).toEqual([{ fieldPath: 'signatory.is_default', ruleId: 'signatory.default_required' }]);
    expect(readStored(harness).version).toBe(1n);
  });

  it('refuses an eleventh signatory and accepts the tenth', async () => {
    const signatories = [
      createCharterSignatory(FIRST_ID, true),
      ...Array.from({ length: 8 }, (_, index) => createAttorneySignatory(signatoryId(index + 2))),
    ];
    const harness = await createHarnessWithRequisites(signatories);

    await harness.organizationRequisites.saveSignatory(createSaveRequest(createAttorneySignatory(signatoryId(60))), DIRECTOR);
    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(signatoryId(61)), { expectedVersion: 2n, idempotencyKey: OTHER_KEY }),
      DIRECTOR,
    ));

    expect(listIds(harness)).toHaveLength(10);
    expect(getViolations(error)).toEqual([{ fieldPath: 'signatory', ruleId: 'signatory.count_max' }]);
    expect(readStored(harness).version).toBe(2n);
  });

  it('lets the tenth signatory be replaced', async () => {
    const signatories = [
      createCharterSignatory(FIRST_ID, true),
      ...Array.from({ length: 9 }, (_, index) => createAttorneySignatory(signatoryId(index + 2))),
    ];
    const harness = await createHarnessWithRequisites(signatories);

    const response = await harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(signatoryId(5), { position: 'бухгалтер' })),
      DIRECTOR,
    );

    expect(response.requisites?.signatories).toHaveLength(10);
  });

  it('clears the number and the date of the power of attorney for the basis charter', async () => {
    const harness = await createHarnessWithRequisites();

    const response = await harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(SECOND_ID, { basis: SignatoryBasis.CHARTER })),
      DIRECTOR,
    );
    const saved = response.requisites?.signatories.find(signatory => signatory.id === SECOND_ID);

    expect(saved?.basis).toBe(SignatoryBasis.CHARTER);
    expect(saved?.powerOfAttorneyNumber).toBe('');
    expect(saved?.powerOfAttorneyDate).toBeUndefined();
  });

  it('keeps the number and the date for the basis power of attorney', async () => {
    const harness = await createHarnessWithRequisites();

    const response = await harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID, {
        powerOfAttorneyDate: { day: 29, month: 2, year: 2024 },
        powerOfAttorneyNumber: '№ 9',
      })),
      DIRECTOR,
    );
    const saved = response.requisites?.signatories.find(signatory => signatory.id === NEW_ID);

    expect(saved?.powerOfAttorneyNumber).toBe('№ 9');
    expect(saved?.powerOfAttorneyDate).toMatchObject({ day: 29, month: 2, year: 2024 });
  });
});

describe('OrganizationRequisitesService.saveSignatory validation', () => {
  it('requires a number made of more than spaces', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID, { powerOfAttorneyNumber: '   ' })),
      DIRECTOR,
    ));

    expect(getViolations(error)).toEqual([
      { fieldPath: 'signatory.power_of_attorney_number', ruleId: 'signatory.power_of_attorney_number_required' },
    ]);
    expect(readStored(harness).version).toBe(1n);
  });

  it('requires a date of the power of attorney', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID, { powerOfAttorneyDate: undefined })),
      DIRECTOR,
    ));

    expect(getViolations(error)).toEqual([
      { fieldPath: 'signatory.power_of_attorney_date', ruleId: 'signatory.power_of_attorney_date_required' },
    ]);
  });

  it('rejects a date after today of the world', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID, { powerOfAttorneyDate: { day: 13, month: 10, year: 2026 } })),
      DIRECTOR,
    ));

    expect(getViolations(error)).toEqual([
      { fieldPath: 'signatory.power_of_attorney_date', ruleId: 'signatory.power_of_attorney_date_not_future' },
    ]);
  });

  it('accepts the date of today of the world', async () => {
    const harness = await createHarnessWithRequisites();

    const response = await harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID, { powerOfAttorneyDate: { day: 12, month: 10, year: 2026 } })),
      DIRECTOR,
    );

    expect(response.requisites?.version).toBe(2n);
  });

  it('answers a date that does not exist with calendar_date.exists on the path of the date', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID, { powerOfAttorneyDate: { day: 31, month: 4, year: 2026 } })),
      DIRECTOR,
    ));

    expect(getViolations(error)).toEqual([
      { fieldPath: 'signatory.power_of_attorney_date', ruleId: 'calendar_date.exists' },
    ]);
  });

  it('answers a year out of range by the range rule only', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID, { powerOfAttorneyDate: { day: 12, month: 1, year: 1999 } })),
      DIRECTOR,
    ));

    expect(getViolations(error)).toEqual([
      { fieldPath: 'signatory.power_of_attorney_date.year', ruleId: 'int32.gte_lte' },
    ]);
  });

  it('answers a request without a signatory with the required rule', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.saveSignatory(
      create(SaveSignatoryRequestSchema, { expectedVersion: 1n, idempotencyKey: KEY }),
      DIRECTOR,
    ));

    expect(getViolations(error)).toEqual([{ fieldPath: 'signatory', ruleId: 'required' }]);
  });

  it('takes today in the time zone of the organization: at 21:30 UTC it is already tomorrow in Moscow', async () => {
    const harness = await createHarnessWithRequisites();
    const client = createClientAtWorldTime(harness, Date.UTC(2026, 9, 12, 21, 30, 0));

    const tomorrowInMoscow = await client.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID, { powerOfAttorneyDate: { day: 13, month: 10, year: 2026 } })),
      DIRECTOR,
    );
    const error = await captureError(client.saveSignatory(
      createSaveRequest(
        createAttorneySignatory(signatoryId(51), { powerOfAttorneyDate: { day: 14, month: 10, year: 2026 } }),
        { expectedVersion: 2n, idempotencyKey: OTHER_KEY },
      ),
      DIRECTOR,
    ));

    expect(tomorrowInMoscow.requisites?.version).toBe(2n);
    expect(getViolations(error)).toEqual([
      { fieldPath: 'signatory.power_of_attorney_date', ruleId: 'signatory.power_of_attorney_date_not_future' },
    ]);
  });

  it('takes today behind the date line when the zone of the organization is west of it', async () => {
    const harness = await createHarnessWithRequisites(createDefaultSignatories(), 'Pacific/Pago_Pago');

    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID, { powerOfAttorneyDate: { day: 12, month: 10, year: 2026 } })),
      DIRECTOR,
    ));
    const response = await harness.organizationRequisites.saveSignatory(
      createSaveRequest(
        createAttorneySignatory(NEW_ID, { powerOfAttorneyDate: { day: 11, month: 10, year: 2026 } }),
        { idempotencyKey: OTHER_KEY },
      ),
      DIRECTOR,
    );

    expect(getViolations(error).map(violation => violation.ruleId)).toEqual(['signatory.power_of_attorney_date_not_future']);
    expect(response.requisites?.version).toBe(2n);
  });

  it('reports the number and the date together with the limit', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID, {
        powerOfAttorneyDate: { day: 1, month: 1, year: 2030 },
        powerOfAttorneyNumber: '',
      })),
      DIRECTOR,
    ));

    expect(getViolations(error).map(violation => violation.ruleId)).toEqual([
      'signatory.power_of_attorney_number_required',
      'signatory.power_of_attorney_date_not_future',
    ]);
  });
});

describe('OrganizationRequisitesService.removeSignatory', () => {
  it('removes a signatory that is not the default one and raises the version by one', async () => {
    const harness = await createHarnessWithRequisites();

    const response = await harness.organizationRequisites.removeSignatory(createRemoveRequest(SECOND_ID), DIRECTOR);

    expect(response.requisites?.signatories.map(signatory => signatory.id)).toEqual([FIRST_ID]);
    expect(response.requisites?.version).toBe(2n);
    expect(response.requisites).toEqual(readStored(harness));
  });

  it('lets an administrator remove', async () => {
    const harness = await createHarnessWithRequisites();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: listAdminPresetPermissions(),
      warehouseIds: [],
    });

    const response = await harness.organizationRequisites.removeSignatory(
      createRemoveRequest(SECOND_ID),
      callAs(userId, SeedOrganizationId.CUSTOMER_1),
    );

    expect(response.requisites?.signatories).toHaveLength(1);
  });

  it('refuses to remove the default signatory', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.removeSignatory(createRemoveRequest(FIRST_ID), DIRECTOR));

    expect(error.code).toBe(Code.InvalidArgument);
    expect(getViolations(error)).toEqual([{ fieldPath: 'signatory_id', ruleId: 'signatory.default_required' }]);
    expect(listIds(harness)).toEqual([FIRST_ID, SECOND_ID]);
  });

  it('refuses to remove the only signatory', async () => {
    const harness = await createHarnessWithRequisites([createCharterSignatory(FIRST_ID, true)]);

    const error = await captureError(harness.organizationRequisites.removeSignatory(createRemoveRequest(FIRST_ID), DIRECTOR));

    expect(getViolations(error)).toEqual([{ fieldPath: 'signatory_id', ruleId: 'signatory.default_required' }]);
  });

  it('answers an unknown id with signatory.exists', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.removeSignatory(createRemoveRequest(NEW_ID), DIRECTOR));

    expect(getViolations(error)).toEqual([{ fieldPath: 'signatory_id', ruleId: 'signatory.exists' }]);
    expect(readStored(harness).version).toBe(1n);
  });

  it('denies a member without organization_manage', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.removeSignatory(
      createRemoveRequest(SECOND_ID),
      callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(readErrorDetail(error).code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(listIds(harness)).toEqual([FIRST_ID, SECOND_ID]);
  });

  it('denies a support session in the edit mode', async () => {
    const harness = await createHarnessWithRequisites();
    const headers = await createSupportEditHeaders(harness);

    const error = await captureError(harness.organizationRequisites.removeSignatory(createRemoveRequest(SECOND_ID), { headers }));

    expect(readErrorDetail(error).code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(listIds(harness)).toEqual([FIRST_ID, SECOND_ID]);
  });

  it('answers version_conflict with the current version when the expected one is stale', async () => {
    const harness = await createHarnessWithRequisites();

    await harness.organizationRequisites.saveSignatory(createSaveRequest(createAttorneySignatory(NEW_ID)), DIRECTOR);
    const error = await captureError(harness.organizationRequisites.removeSignatory(
      createRemoveRequest(SECOND_ID, { idempotencyKey: OTHER_KEY }),
      DIRECTOR,
    ));
    const detail = readErrorDetail(error);

    expect(detail.code).toBe(ErrorCode.VERSION_CONFLICT);
    expect(detail.params.case === 'versionConflict' ? detail.params.value : undefined).toMatchObject({
      currentVersion: 2,
      entity: EntityKind.ORGANIZATION,
    });
  });

  it('answers a repeated request with the same key by the same response and writes nothing more', async () => {
    const harness = await createHarnessWithRequisites();
    const request = createRemoveRequest(SECOND_ID);

    const first = await harness.organizationRequisites.removeSignatory(request, DIRECTOR);
    const commitsAfterFirst = harness.commits.length;
    const second = await harness.organizationRequisites.removeSignatory(request, DIRECTOR);

    expect(second).toEqual(first);
    expect(harness.commits).toHaveLength(commitsAfterFirst);
    expect(readStored(harness).version).toBe(2n);
  });

  it('writes the acting organization only', async () => {
    const harness = await createHarnessWithRequisites();
    const neighbourBefore = readStored(harness, SeedOrganizationId.SUPPLIER_1);

    await harness.organizationRequisites.removeSignatory(createRemoveRequest(SECOND_ID), DIRECTOR);

    expect(readStored(harness, SeedOrganizationId.SUPPLIER_1)).toEqual(neighbourBefore);
  });

  it('does not reach the signatory of another organization by its id', async () => {
    const harness = await createHarnessWithRequisites();

    const error = await captureError(harness.organizationRequisites.removeSignatory(createRemoveRequest(signatoryId(90)), DIRECTOR));

    expect(getViolations(error)).toEqual([{ fieldPath: 'signatory_id', ruleId: 'signatory.exists' }]);
    expect(listIds(harness)).toEqual([FIRST_ID, SECOND_ID]);
  });
});

describe('signatory invariant of exactly one default signatory', () => {
  it('holds after adding a default signatory, removing the previous one and returning the default mark to the first', async () => {
    const harness = await createHarnessWithRequisites();

    await harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(NEW_ID, { isDefault: true }), { idempotencyKey: signatoryId(70) }),
      DIRECTOR,
    );

    expect(listDefaultIds(harness)).toEqual([NEW_ID]);

    await harness.organizationRequisites.removeSignatory(
      createRemoveRequest(FIRST_ID, { expectedVersion: 2n, idempotencyKey: signatoryId(71) }),
      DIRECTOR,
    );

    expect(listDefaultIds(harness)).toEqual([NEW_ID]);
    expect(listIds(harness)).toEqual([SECOND_ID, NEW_ID]);

    await harness.organizationRequisites.saveSignatory(
      createSaveRequest(createAttorneySignatory(SECOND_ID, { isDefault: true }), { expectedVersion: 3n, idempotencyKey: signatoryId(72) }),
      DIRECTOR,
    );

    expect(listDefaultIds(harness)).toEqual([SECOND_ID]);
    expect(readStored(harness).signatories).toHaveLength(2);
    expect(readStored(harness).version).toBe(4n);
  });

  it('keeps one default signatory after rejected commands', async () => {
    const harness = await createHarnessWithRequisites();

    await captureError(harness.organizationRequisites.removeSignatory(createRemoveRequest(FIRST_ID), DIRECTOR));
    await captureError(harness.organizationRequisites.saveSignatory(
      createSaveRequest(createCharterSignatory(FIRST_ID, false), { idempotencyKey: OTHER_KEY }),
      DIRECTOR,
    ));

    expect(listDefaultIds(harness)).toEqual([FIRST_ID]);
    expect(readStored(harness).version).toBe(1n);
  });
});
