import type { Client } from '@connectrpc/connect';
import type { ErrorDetail } from '@skladburg/contracts/common/v1/error';

import {
  toBinary,
  toJsonString,
} from '@bufbuild/protobuf';
import { base64Encode } from '@bufbuild/protobuf/wire';
import { createClient } from '@connectrpc/connect';
import {
  AccessService,
  GetSessionResponseSchema,
  ListRolesResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import { UserProfileService } from '@skladburg/contracts/access/v1/profile';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  type Event,
  EventSchema,
} from '@skladburg/contracts/event/v1/event';
import { GetOrganizationResponseSchema } from '@skladburg/contracts/organization/v1/organization';
import {
  GetOrganizationShowcaseResponseSchema,
  ListOrganizationShowcasesResponseSchema,
  OrganizationShowcaseService,
} from '@skladburg/contracts/organization/v1/showcase';
import { userChannel } from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createEngineTransport,
  createSpyStorage,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../../seed/index';
import { TABLE_DEFINITIONS } from '../../state/index';
import {
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import { TEST_EPOCH } from '../testing/testRuntime';

const KEY = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const OTHER_KEY = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';
const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const MAX_IMAGE_SIZE = 65_536;
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 0x49, 0x48, 0x44, 0x52]);
const JPEG = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 1]);
const WAVE = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45, 0, 0]);
const WEBP_ADDRESS = `data:image/webp;base64,${base64Encode(WEBP)}`;

const CUSTOMER_ID = SeedOrganizationId.CUSTOMER_1;
const ADMIN_1 = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

const getViolations = (detail: ErrorDetail): { fieldPath: string; ruleId: string }[] =>
  detail.params.case === 'validationFailed'
    ? detail.params.value.violations.map(violation => ({ fieldPath: violation.fieldPath, ruleId: violation.ruleId }))
    : [];

const createProfileHarness = (): ReturnType<typeof createModuleHarness> & { profile: Client<typeof UserProfileService> } => {
  const harness = createModuleHarness();

  return { ...harness, profile: createClient(UserProfileService, harness.transport) };
};

const createSignedImage = (signature: Uint8Array, size: number): Uint8Array => {
  const image = new Uint8Array(size);
  image.set(signature);

  return image;
};

const SET_AVATAR_METHOD = 'access.v1.UserProfileService/SetMyAvatar';

const containsBytes = (haystack: Uint8Array, needle: Uint8Array): boolean =>
  haystack.some((_byte, start) => needle.every((byte, offset) => haystack[start + offset] === byte));

const readUserChangedId = (event: Event | undefined): string | undefined =>
  event?.payload.case === 'userChanged' ? event.payload.value.userId : undefined;

describe('UserProfileService.setMyAvatar', () => {
  it('answers session_required without a session', async () => {
    const { profile } = createProfileHarness();

    for (const options of [callAs(undefined), callAs(undefined, SeedOrganizationId.CUSTOMER_1), callAs(UNKNOWN_ID)]) {
      const error = await captureError(profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, options));

      expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
    }
  });

  it('stores the image as a data address and returns it in the session user', async () => {
    const { access, profile } = createProfileHarness();

    const response = await profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, ADMIN_1);
    const session = await access.getSession({}, ADMIN_1);

    expect(response.user?.id).toBe(SeedUserId.ADMIN_1);
    expect(response.user?.avatarUrl).toBe(WEBP_ADDRESS);
    expect(session.user?.avatarUrl).toBe(WEBP_ADDRESS);
    expect(session.user?.displayName).toBe(response.user?.displayName);
  });

  it('accepts JPEG and PNG images', async () => {
    const { profile } = createProfileHarness();

    const jpeg = await profile.setMyAvatar({ idempotencyKey: KEY, image: JPEG, mediaType: 'image/jpeg' }, ADMIN_1);
    const png = await profile.setMyAvatar({ idempotencyKey: OTHER_KEY, image: PNG, mediaType: 'image/png' }, ADMIN_1);

    expect(jpeg.user?.avatarUrl).toBe(`data:image/jpeg;base64,${base64Encode(JPEG)}`);
    expect(png.user?.avatarUrl).toBe(`data:image/png;base64,${base64Encode(PNG)}`);
  });

  it('needs no membership: works without an organization and with a foreign one', async () => {
    const { profile } = createProfileHarness();

    const withoutOrganization = await profile.setMyAvatar(
      { idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' },
      callAs(SeedUserId.ADMIN_1),
    );
    const foreignOrganization = await profile.setMyAvatar(
      { idempotencyKey: OTHER_KEY, image: WEBP, mediaType: 'image/webp' },
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.SUPPLIER_1),
    );

    expect(withoutOrganization.user?.avatarUrl).toBe(WEBP_ADDRESS);
    expect(foreignOrganization.user?.avatarUrl).toBe(WEBP_ADDRESS);
  });

  it('changes only the record of the caller', async () => {
    const { access, profile } = createProfileHarness();

    await profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, ADMIN_1);
    const colleague = await access.getSession({}, callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1));

    expect(colleague.user?.id).toBe(SeedUserId.STOREKEEPER_1);
    expect(colleague.user?.avatarUrl).toBe('');
  });

  it.each([
    ['PNG bytes declared as WebP', PNG, 'image/webp'],
    ['JPEG bytes declared as PNG', JPEG, 'image/png'],
    ['WebP bytes declared as JPEG', WEBP, 'image/jpeg'],
    ['a RIFF container that is not WebP', WAVE, 'image/webp'],
  ])('rejects %s with avatar_image_signature and writes nothing', async (_name, image, mediaType) => {
    const { commits, events, profile } = createProfileHarness();

    const error = await captureError(profile.setMyAvatar({ idempotencyKey: KEY, image, mediaType }, ADMIN_1));

    expect(readErrorDetail(error).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(getViolations(readErrorDetail(error))).toEqual([{ fieldPath: 'image', ruleId: 'avatar_image_signature' }]);
    expect(commits).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('rejects an image above the size limit by the contract rule', async () => {
    const { commits, profile } = createProfileHarness();
    const image = createSignedImage(WEBP, MAX_IMAGE_SIZE + 1);

    const error = await captureError(profile.setMyAvatar({ idempotencyKey: KEY, image, mediaType: 'image/webp' }, ADMIN_1));

    expect(readErrorDetail(error).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(getViolations(readErrorDetail(error))).toEqual([{ fieldPath: 'image', ruleId: 'bytes.max_len' }]);
    expect(commits).toHaveLength(0);
  });

  it('accepts an image of exactly the size limit', async () => {
    const { profile } = createProfileHarness();
    const image = createSignedImage(WEBP, MAX_IMAGE_SIZE);

    const response = await profile.setMyAvatar({ idempotencyKey: KEY, image, mediaType: 'image/webp' }, ADMIN_1);

    expect(response.user?.avatarUrl).toBe(`data:image/webp;base64,${base64Encode(image)}`);
  });

  it('rejects a too short image, an empty image and a missing image', async () => {
    const { profile } = createProfileHarness();

    const tooShort = await captureError(
      profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP.slice(0, 11), mediaType: 'image/webp' }, ADMIN_1),
    );
    const empty = await captureError(
      profile.setMyAvatar({ idempotencyKey: KEY, image: new Uint8Array(), mediaType: 'image/webp' }, ADMIN_1),
    );

    expect(getViolations(readErrorDetail(tooShort))).toEqual([{ fieldPath: 'image', ruleId: 'bytes.min_len' }]);
    expect(getViolations(readErrorDetail(empty))).toEqual(expect.arrayContaining([{ fieldPath: 'image', ruleId: 'required' }]));
  });

  it.each(['image/gif', 'image/svg+xml', 'text/html', ''])('rejects the media type "%s" by the contract rule', async (mediaType) => {
    const { profile } = createProfileHarness();

    const error = await captureError(profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType }, ADMIN_1));

    expect(readErrorDetail(error).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(getViolations(readErrorDetail(error)).map(violation => violation.fieldPath)).toContain('media_type');
  });

  it('rejects an idempotency key that is not a UUID', async () => {
    const { profile } = createProfileHarness();

    const error = await captureError(profile.setMyAvatar({ idempotencyKey: 'not-a-uuid', image: WEBP, mediaType: 'image/webp' }, ADMIN_1));

    expect(getViolations(readErrorDetail(error))).toEqual([{ fieldPath: 'idempotency_key', ruleId: 'string.uuid' }]);
  });

  it('replays the stored answer for the same key and the same request and publishes one event', async () => {
    const { events, profile } = createProfileHarness();
    const request = { idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' };

    const first = await profile.setMyAvatar(request, ADMIN_1);
    const second = await profile.setMyAvatar(request, ADMIN_1);

    expect(second.user).toEqual(first.user);
    expect(events).toHaveLength(1);
  });

  it('rejects the same key with another request', async () => {
    const { profile } = createProfileHarness();

    await profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, ADMIN_1);
    const error = await captureError(profile.setMyAvatar({ idempotencyKey: KEY, image: PNG, mediaType: 'image/png' }, ADMIN_1));

    expect(readErrorDetail(error).code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
  });

  it('publishes UserChanged with the user id only to the channel of the user', async () => {
    const { clock, events, profile } = createProfileHarness();

    await profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, ADMIN_1);
    const [changed] = events;
    const serialized = changed === undefined ? '' : toJsonString(EventSchema, changed);
    const serializedBytes = changed === undefined ? '' : new TextDecoder().decode(toBinary(EventSchema, changed));

    expect(events).toHaveLength(1);
    expect(changed?.channel).toBe(userChannel(SeedUserId.ADMIN_1));
    expect(changed?.seq).toBe(1n);
    expect(changed?.epoch).toBe(TEST_EPOCH);
    expect(readUserChangedId(changed)).toBe(SeedUserId.ADMIN_1);
    expect(changed?.occurredAt?.seconds).toBe(BigInt(Math.floor(clock.now() / 1000)));

    for (const text of [serialized, serializedBytes]) {
      expect(text).not.toContain('data:image');
      expect(text).not.toContain(base64Encode(WEBP));
    }
  });
});

describe('UserProfileService.removeMyAvatar', () => {
  it('answers session_required without a session', async () => {
    const { profile } = createProfileHarness();

    const error = await captureError(profile.removeMyAvatar({ idempotencyKey: KEY }, callAs(undefined)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('clears the address and the session shows no photo', async () => {
    const { access, profile } = createProfileHarness();
    await profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, ADMIN_1);

    const response = await profile.removeMyAvatar({ idempotencyKey: OTHER_KEY }, ADMIN_1);
    const session = await access.getSession({}, ADMIN_1);

    expect(response.user?.id).toBe(SeedUserId.ADMIN_1);
    expect(response.user?.avatarUrl).toBe('');
    expect(session.user?.avatarUrl).toBe('');
  });

  it('succeeds when there is no photo and works without a membership', async () => {
    const { profile } = createProfileHarness();

    const response = await profile.removeMyAvatar({ idempotencyKey: KEY }, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.SUPPLIER_1));

    expect(response.user?.avatarUrl).toBe('');
  });

  it('publishes UserChanged to the channel of the user', async () => {
    const { events, profile } = createProfileHarness();
    await profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, ADMIN_1);

    await profile.removeMyAvatar({ idempotencyKey: OTHER_KEY }, ADMIN_1);

    expect(events.map(event => [event.channel, event.seq, readUserChangedId(event)])).toEqual([
      [userChannel(SeedUserId.ADMIN_1), 1n, SeedUserId.ADMIN_1],
      [userChannel(SeedUserId.ADMIN_1), 2n, SeedUserId.ADMIN_1],
    ]);
  });

  it('rejects an idempotency key that is not a UUID', async () => {
    const { profile } = createProfileHarness();

    const error = await captureError(profile.removeMyAvatar({ idempotencyKey: '' }, ADMIN_1));

    expect(readErrorDetail(error).code).toBe(ErrorCode.VALIDATION_FAILED);
  });
});

describe('photo in the idempotency journal', () => {
  it('leaves no record and no image bytes after the photo is removed', async () => {
    const { profile, state } = createProfileHarness();
    await profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, ADMIN_1);
    await profile.removeMyAvatar({ idempotencyKey: OTHER_KEY }, ADMIN_1);

    const records = state.read.list('idempotency');

    expect(records.filter(record => record.method === SET_AVATAR_METHOD)).toEqual([]);

    for (const record of records) {
      expect(containsBytes(record.requestBytes, WEBP)).toBe(false);
      expect(containsBytes(record.responseBytes, WEBP)).toBe(false);
      expect(new TextDecoder().decode(record.responseBytes)).not.toContain('data:image');
      expect(new TextDecoder().decode(record.requestBytes)).not.toContain(base64Encode(WEBP));
    }
  });

  it('keeps only the record of the latest set and replays it', async () => {
    const { events, profile, state } = createProfileHarness();
    await profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, ADMIN_1);
    const second = await profile.setMyAvatar({ idempotencyKey: OTHER_KEY, image: PNG, mediaType: 'image/png' }, ADMIN_1);

    const records = state.read.list('idempotency').filter(record => record.method === SET_AVATAR_METHOD);
    const replay = await profile.setMyAvatar({ idempotencyKey: OTHER_KEY, image: PNG, mediaType: 'image/png' }, ADMIN_1);

    expect(records.map(record => record.id)).toEqual([`${SeedUserId.ADMIN_1}:${SET_AVATAR_METHOD}:${OTHER_KEY}`]);
    expect(containsBytes(records[0]?.requestBytes ?? new Uint8Array(), WEBP)).toBe(false);
    expect(replay.user).toEqual(second.user);
    expect(events).toHaveLength(2);
  });

  it('runs a purged key again as a new command', async () => {
    const { events, profile, state } = createProfileHarness();
    await profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, ADMIN_1);
    await profile.setMyAvatar({ idempotencyKey: OTHER_KEY, image: PNG, mediaType: 'image/png' }, ADMIN_1);

    const again = await profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, ADMIN_1);
    const records = state.read.list('idempotency').filter(record => record.method === SET_AVATAR_METHOD);

    expect(again.user?.avatarUrl).toBe(WEBP_ADDRESS);
    expect(events).toHaveLength(3);
    expect(records.map(record => record.id)).toEqual([`${SeedUserId.ADMIN_1}:${SET_AVATAR_METHOD}:${KEY}`]);
  });

  it('keeps the old record when the new image fails the signature check', async () => {
    const { profile, state } = createProfileHarness();
    await profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, ADMIN_1);

    const error = await captureError(profile.setMyAvatar({ idempotencyKey: OTHER_KEY, image: PNG, mediaType: 'image/webp' }, ADMIN_1));
    const records = state.read.list('idempotency').filter(record => record.method === SET_AVATAR_METHOD);

    expect(readErrorDetail(error).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(records.map(record => record.id)).toEqual([`${SeedUserId.ADMIN_1}:${SET_AVATAR_METHOD}:${KEY}`]);
  });
});

describe('photo visibility', () => {
  it('never reaches a counterparty or a colleague through the session, the organization and the showcase', async () => {
    const { access, organization, profile, transport } = createProfileHarness();
    const showcase = createClient(OrganizationShowcaseService, transport);
    await profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, ADMIN_1);
    const supplier = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
    const colleague = callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);

    const responses = [
      toJsonString(GetSessionResponseSchema, await access.getSession({}, supplier)),
      toJsonString(GetSessionResponseSchema, await access.getSession({}, colleague)),
      toJsonString(ListRolesResponseSchema, await access.listRoles({}, supplier)),
      toJsonString(GetOrganizationResponseSchema, await organization.getOrganization({ organizationId: CUSTOMER_ID }, supplier)),
      toJsonString(GetOrganizationResponseSchema, await organization.getOrganization({ organizationId: CUSTOMER_ID }, colleague)),
      toJsonString(ListOrganizationShowcasesResponseSchema, await showcase.listOrganizationShowcases({}, supplier)),
      toJsonString(
        GetOrganizationShowcaseResponseSchema,
        await showcase.getOrganizationShowcase({ organizationId: SeedOrganizationId.CUSTOMER_1 }, supplier),
      ),
    ];

    expect(responses).toHaveLength(7);

    for (const response of responses) {
      expect(response).not.toContain('avatar');
      expect(response).not.toContain('data:image');
      expect(response).not.toContain(base64Encode(WEBP));
    }
  });
});

describe('avatar in the stored record', () => {
  it('reads a record stored before the field existed with an empty address', () => {
    const storedBeforeTheField = Uint8Array.from([0x0A, 0x01, 0x75, 0x12, 0x01, 0x4E]);

    const user = TABLE_DEFINITIONS.users.decode(storedBeforeTheField);

    expect(user.id).toBe('u');
    expect(user.displayName).toBe('N');
    expect(user.avatarUrl).toBe('');
  });
});

describe('photo in the engine', () => {
  it('survives a restart, shows in the persona list and disappears after a reset', async () => {
    const storage = createSpyStorage();
    const { engine } = await createTestEngine({ storage });
    const profile = createClient(UserProfileService, createEngineTransport(engine, true));
    const findPersona = (target: typeof engine): string | undefined =>
      target.listPersonas().find(persona => persona.userId === SeedUserId.ADMIN_1)?.userAvatarUrl;

    expect(findPersona(engine)).toBeUndefined();
    await profile.setMyAvatar({ idempotencyKey: KEY, image: WEBP, mediaType: 'image/webp' }, ADMIN_1);
    expect(findPersona(engine)).toBe(WEBP_ADDRESS);

    const restarted = await createTestEngine({ storage });
    const restartedAccess = createClient(AccessService, createEngineTransport(restarted.engine, true));
    const afterRestart = await restartedAccess.getSession({}, ADMIN_1);

    expect(afterRestart.user?.avatarUrl).toBe(WEBP_ADDRESS);
    expect(findPersona(restarted.engine)).toBe(WEBP_ADDRESS);

    await restarted.engine.reset('epoch-2');
    const afterReset = await restartedAccess.getSession({}, ADMIN_1);

    expect(afterReset.user?.avatarUrl).toBe('');
    expect(findPersona(restarted.engine)).toBeUndefined();
  });
});
