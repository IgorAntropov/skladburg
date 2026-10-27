import type { Client } from '@connectrpc/connect';
import type { DigestItem } from '@skladburg/contracts/notification/v1/notification';

import { createClient } from '@connectrpc/connect';
import { createRouterTransport } from '@connectrpc/connect';
import { ObjectKind } from '@skladburg/contracts/common/v1/object_link';
import {
  DigestItemKind,
  NotificationService,
} from '@skladburg/contracts/notification/v1/notification';
import {
  OrganizationService,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import { OrganizationShowcaseService } from '@skladburg/contracts/organization/v1/showcase';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/index';
import { createOrganizationShowcaseService } from '../identity/index';
import { createOrganizationService } from '../organizationService';
import { callAs } from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import { createNotificationService } from './notificationService';
import {
  storeNotification,
  withoutNotifications,
} from './testing/notificationFixtures';

const NOTIFICATION_ID = '5a000001-0000-4000-8000-000000000000';
const READ_NOTIFICATION_ID = '5a000002-0000-4000-8000-000000000000';
const MIN_VERIFICATION_LEVEL = 1;

const DIRECTOR = { organizationId: SeedOrganizationId.CUSTOMER_1, userId: SeedUserId.ADMIN_1 };
const STOREKEEPER = { organizationId: SeedOrganizationId.CUSTOMER_1, userId: SeedUserId.STOREKEEPER_1 };
const SUPPLIER = { organizationId: SeedOrganizationId.SUPPLIER_1, userId: SeedUserId.ADMIN_2 };
const CARRIER = { organizationId: SeedOrganizationId.CARRIER_1, userId: SeedUserId.ADMIN_4 };
const UNVERIFIED_SUPPLIER = { organizationId: SeedOrganizationId.SUPPLIER_5, userId: SeedUserId.ADMIN_9 };

interface DigestHarnessValue {
  digest: Client<typeof NotificationService>;
  harness: ReturnType<typeof createTestRuntime>;
  organization: Client<typeof OrganizationService>;
  showcase: Client<typeof OrganizationShowcaseService>;
}

const DIRECTOR_NOTIFICATION = { createdAtMs: 1, organizationId: DIRECTOR.organizationId, userId: DIRECTOR.userId };

interface PersonaValue {
  organizationId: string;
  userId: string;
}

const createDigestHarness = async (): Promise<DigestHarnessValue> => {
  const harness = await withoutNotifications(createTestRuntime());
  const transport = createRouterTransport(({ service }) => {
    service(NotificationService, createNotificationService(harness.runtime));
    service(OrganizationService, createOrganizationService(harness.runtime));
    service(OrganizationShowcaseService, createOrganizationShowcaseService(harness.runtime));
  });

  return {
    digest: createClient(NotificationService, transport),
    harness,
    organization: createClient(OrganizationService, transport),
    showcase: createClient(OrganizationShowcaseService, transport),
  };
};

const readDigest = async (kit: DigestHarnessValue, persona: PersonaValue): Promise<DigestItem[]> =>
  (await kit.digest.getDigest({}, callAs(persona.userId, persona.organizationId))).items;

const findItem = (items: readonly DigestItem[], kind: DigestItemKind): DigestItem | undefined =>
  items.find(item => item.kind === kind);

describe('NotificationService.getDigest', () => {
  it('gives the director of a customer the warehouses, the verified suppliers and the next level, in that order', async () => {
    const kit = await createDigestHarness();
    const items = await readDigest(kit, DIRECTOR);

    expect(items.map(item => item.kind)).toEqual([
      DigestItemKind.OWN_WAREHOUSES,
      DigestItemKind.VERIFIED_PARTNERS,
      DigestItemKind.VERIFICATION_NEXT_LEVEL,
    ]);
  });

  it('counts the unread notifications of the user in the organization and leaves the item out at zero', async () => {
    const kit = await createDigestHarness();

    expect(findItem(await readDigest(kit, DIRECTOR), DigestItemKind.UNREAD_NOTIFICATIONS)).toBeUndefined();

    await storeNotification(kit.harness, { ...DIRECTOR_NOTIFICATION, id: NOTIFICATION_ID });
    await storeNotification(kit.harness, { ...DIRECTOR_NOTIFICATION, id: READ_NOTIFICATION_ID, isRead: true });

    const item = findItem(await readDigest(kit, DIRECTOR), DigestItemKind.UNREAD_NOTIFICATIONS);

    expect(item?.count).toBe(1);
    expect(item?.link).toBeUndefined();
    expect(findItem(await readDigest(kit, STOREKEEPER), DigestItemKind.UNREAD_NOTIFICATIONS)).toBeUndefined();
  });

  it('counts the own warehouses like the list of the same persona and links the first of them as a site', async () => {
    const kit = await createDigestHarness();

    for (const persona of [DIRECTOR, STOREKEEPER, SUPPLIER]) {
      const listed = await kit.organization.listWarehouses({}, callAs(persona.userId, persona.organizationId));
      const item = findItem(await readDigest(kit, persona), DigestItemKind.OWN_WAREHOUSES);

      expect(item?.count).toBe(listed.warehouses.length);
      expect(item?.link?.target?.kind).toBe(ObjectKind.SITE);
      expect(item?.link?.target?.id).toBe(listed.warehouses[0]?.id);
      expect(item?.link?.cameraFocus).toBeUndefined();
    }

    const firstLink = findItem(await readDigest(kit, DIRECTOR), DigestItemKind.OWN_WAREHOUSES)?.link;

    expect(firstLink?.target?.id).toBe(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1);
  });

  it('gives a storekeeper without the network_view permission no partners', async () => {
    const kit = await createDigestHarness();
    const items = await readDigest(kit, STOREKEEPER);

    expect(findItem(items, DigestItemKind.VERIFIED_PARTNERS)).toBeUndefined();
    expect(items.map(item => item.kind)).toEqual([DigestItemKind.OWN_WAREHOUSES]);
  });

  it('counts the partners like the company directory of the same persona, without the own organization', async () => {
    const kit = await createDigestHarness();
    const expectations = [
      { partnerSide: ProfileKind.SUPPLIER, persona: DIRECTOR },
      { partnerSide: ProfileKind.CUSTOMER, persona: SUPPLIER },
      { partnerSide: ProfileKind.UNSPECIFIED, persona: CARRIER },
    ];

    for (const { partnerSide, persona } of expectations) {
      const { organizations } = await kit.showcase.listOrganizationShowcases(
        { minVerificationLevel: MIN_VERIFICATION_LEVEL, profileKind: partnerSide },
        callAs(persona.userId, persona.organizationId),
      );
      const item = findItem(await readDigest(kit, persona), DigestItemKind.VERIFIED_PARTNERS);

      expect(item?.partnerSide).toBe(partnerSide);
      expect(item?.count).toBe(organizations.filter(organization => organization.id !== persona.organizationId).length);
      expect(item?.count).toBeGreaterThan(0);
      expect(item?.link).toBeUndefined();
    }
  });

  it('shows the next level only to those who edit or manage the organization profile', async () => {
    const kit = await createDigestHarness();

    expect(findItem(await readDigest(kit, STOREKEEPER), DigestItemKind.VERIFICATION_NEXT_LEVEL)).toBeUndefined();

    for (const persona of [DIRECTOR, CARRIER, SUPPLIER]) {
      expect(findItem(await readDigest(kit, persona), DigestItemKind.VERIFICATION_NEXT_LEVEL)).toBeDefined();
    }
  });

  it('points the next level at the own organization and names the level to reach apart from the count', async () => {
    const kit = await createDigestHarness();
    const carrier = findItem(await readDigest(kit, CARRIER), DigestItemKind.VERIFICATION_NEXT_LEVEL);
    const supplier = findItem(await readDigest(kit, UNVERIFIED_SUPPLIER), DigestItemKind.VERIFICATION_NEXT_LEVEL);

    expect(carrier?.count).toBe(0);
    expect(carrier?.nextLevel).toBe(2);
    expect(carrier?.link?.target?.kind).toBe(ObjectKind.ORGANIZATION);
    expect(carrier?.link?.target?.id).toBe(CARRIER.organizationId);
    expect(supplier?.count).toBe(0);
    expect(supplier?.nextLevel).toBe(1);
  });

  it('shows an unverified organization neither partners nor a zero count', async () => {
    const kit = await createDigestHarness();
    const items = await readDigest(kit, UNVERIFIED_SUPPLIER);

    expect(findItem(items, DigestItemKind.VERIFIED_PARTNERS)).toBeUndefined();
    expect(items.filter(item => item.kind !== DigestItemKind.VERIFICATION_NEXT_LEVEL).every(item => item.count > 0)).toBe(true);
    expect(items.filter(item => item.kind !== DigestItemKind.VERIFICATION_NEXT_LEVEL).every(item => item.nextLevel === 0)).toBe(true);
  });
});
