import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  BankAccountSchema,
  OrganizationRequisitesSchema,
  SignatoryBasis,
  SignatorySchema,
  VatMode,
} from '@skladburg/contracts/organization/v1/requisites';
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

import { DEMO_USER_HEADER } from '../../protocol';
import {
  SEED_WORLD_START_MS,
  SeedOrganizationId,
  SeedUserId,
} from '../../seed/index';
import { createTestSupportAccessSession } from '../../state/testRecords';
import {
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';

const SUPPORT_SESSION_ID = 'd0000000-0000-4000-8000-000000000001';
const HOUR_MS = 3_600_000;

const createRequisites = (organizationId: string, legalAddress: string): ReturnType<typeof create<typeof OrganizationRequisitesSchema>> =>
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
