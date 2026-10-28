import { timestampMs } from '@bufbuild/protobuf/wkt';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  SupportAccessCloseReason,
  SupportAccessStatus,
  SupportAuditAction,
  SupportAuditOutcome,
} from '@skladburg/contracts/support/v1/support_access';
import {
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../testing/moduleHarness';
import type { SupportAuditEntryInputValue } from './supportAuditRecords';

import { SEED_WORLD_START_MS } from '../../seed/index';
import { createTestSupportAuditEntry } from '../../state/testRecords';
import { createModuleHarness } from '../testing/moduleHarness';
import { createSequencedId } from './supportAccessRecords';
import {
  appendSupportAuditEntry,
  listSupportAuditEntries,
} from './supportAuditRecords';
import {
  CLIENT_ID,
  createSessionId,
  OTHER_CLIENT_ID,
  putSession,
} from './testing/supportAccessFixtures';

const SOURCE_ROOT = join(import.meta.dirname, '..', '..', '..');

const listSourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);

    if (statSync(path).isDirectory()) {
      return listSourceFiles(path);
    }

    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });

const READ_INPUT = { action: SupportAuditAction.READ, actorUserId: '', outcome: SupportAuditOutcome.ALLOWED };

const append = (
  harness: ModuleHarnessValue,
  input: Omit<SupportAuditEntryInputValue, 'session'>,
  sessionId: string,
): Promise<string> =>
  harness.runtime.command((transaction) => {
    const session = transaction.get('supportAccessSessions', sessionId);

    if (session === undefined) {
      throw new Error('The session is missing');
    }

    return appendSupportAuditEntry(transaction, harness.random, { ...input, session }).id;
  });

describe('appendSupportAuditEntry', () => {
  it('copies the identity of the session, the world time and the given fields into the entry', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1), status: SupportAccessStatus.ACTIVE });

    const id = await append(harness, {
      action: SupportAuditAction.READ,
      actorUserId: session.staffUserId,
      errorCode: ErrorCode.PERMISSION_DENIED,
      method: 'organization.v1.OrganizationService/ListWarehouses',
      outcome: SupportAuditOutcome.DENIED,
      permission: 'warehouse_view',
    }, session.id);

    expect(harness.state.read.get('supportAuditEntries', id)).toMatchObject({
      action: SupportAuditAction.READ,
      actorUserId: session.staffUserId,
      closeReason: SupportAccessCloseReason.UNSPECIFIED,
      errorCode: ErrorCode.PERMISSION_DENIED,
      method: 'organization.v1.OrganizationService/ListWarehouses',
      organizationId: CLIENT_ID,
      outcome: SupportAuditOutcome.DENIED,
      permission: 'warehouse_view',
      sessionId: session.id,
      staffDisplayName: 'Илья Г.',
      staffUserId: session.staffUserId,
    });
    const occurredAt = harness.state.read.get('supportAuditEntries', id)?.occurredAt;

    expect(occurredAt === undefined ? undefined : timestampMs(occurredAt)).toBe(SEED_WORLD_START_MS);
  });

  it('never replaces a written entry: a second append gets a new id and the first stays as it was', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1), status: SupportAccessStatus.ACTIVE });

    const first = await append(harness, READ_INPUT, session.id);
    const written = harness.state.read.get('supportAuditEntries', first);
    const second = await append(harness, { ...READ_INPUT, action: SupportAuditAction.CHANGE }, session.id);

    expect(second).not.toBe(first);
    expect(harness.state.read.get('supportAuditEntries', first)).toEqual(written);
    expect(harness.state.read.list('supportAuditEntries')).toHaveLength(2);
  });

  it('refuses to write over an id that is already taken', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1), status: SupportAccessStatus.ACTIVE });
    const takenId = '00000001-0000-4000-8000-000000000000';
    const fixedRandom = { ...harness.random, uuid: () => takenId };
    const taken = createTestSupportAuditEntry(takenId, OTHER_CLIENT_ID, { occurredAtMs: 7 });

    await harness.runtime.command((transaction) => {
      transaction.put('supportAuditEntries', taken);
    });

    await expect(harness.runtime.command(transaction => appendSupportAuditEntry(transaction, fixedRandom, {
      action: SupportAuditAction.READ,
      actorUserId: '',
      outcome: SupportAuditOutcome.ALLOWED,
      session,
    }))).rejects.toThrow();
    expect(harness.state.read.get('supportAuditEntries', takenId)).toEqual(taken);
  });

  it('writes the entries in one organization in an order the ids reproduce, also within one millisecond', async () => {
    const harness = createModuleHarness();
    const session = await putSession(harness, { id: createSessionId(1), status: SupportAccessStatus.ACTIVE });
    const ids: string[] = [];

    for (let index = 0; index < 12; index += 1) {
      ids.push(await append(harness, READ_INPUT, session.id));
    }

    expect([...ids].sort()).toEqual(ids);
    expect(listSupportAuditEntries(harness.state.read, CLIENT_ID, '').map(entry => entry.id)).toEqual([...ids].reverse());
  });

  it('orders by the time first and by the reverse order of writing when the times are equal', async () => {
    const harness = createModuleHarness();

    await harness.runtime.command((transaction) => {
      transaction.put('supportAuditEntries', createTestSupportAuditEntry('00000001-a', CLIENT_ID, { occurredAtMs: 5_000 }));
      transaction.put('supportAuditEntries', createTestSupportAuditEntry('00000002-a', CLIENT_ID, { occurredAtMs: 5_000 }));
      transaction.put('supportAuditEntries', createTestSupportAuditEntry('00000003-a', CLIENT_ID, { occurredAtMs: 1_000 }));
      transaction.put('supportAuditEntries', createTestSupportAuditEntry('00000004-a', CLIENT_ID, { occurredAtMs: 9_000 }));
      transaction.put('supportAuditEntries', createTestSupportAuditEntry('00000005-a', OTHER_CLIENT_ID, { occurredAtMs: 9_000 }));
    });

    expect(listSupportAuditEntries(harness.state.read, CLIENT_ID, '').map(entry => entry.id)).toEqual([
      '00000004-a',
      '00000002-a',
      '00000001-a',
      '00000003-a',
    ]);
  });

  it('filters by the session and returns nothing for a session of another organization', async () => {
    const harness = createModuleHarness();
    const own = await putSession(harness, { id: createSessionId(1), status: SupportAccessStatus.ACTIVE });
    const foreign = await putSession(harness, {
      id: createSessionId(2),
      organizationId: OTHER_CLIENT_ID,
      status: SupportAccessStatus.ACTIVE,
    });
    const ownId = await append(harness, READ_INPUT, own.id);
    await append(harness, READ_INPUT, foreign.id);

    expect(listSupportAuditEntries(harness.state.read, CLIENT_ID, own.id).map(entry => entry.id)).toEqual([ownId]);
    expect(listSupportAuditEntries(harness.state.read, CLIENT_ID, foreign.id)).toEqual([]);
  });
});

describe('createSequencedId', () => {
  it('puts the number of the write into the first eight digits and keeps the rest random', () => {
    const harness = createModuleHarness();

    const first = createSequencedId(harness.random, 0);
    const tenth = createSequencedId(harness.random, 9);
    const big = createSequencedId(harness.random, 255);

    expect(first.slice(0, 8)).toBe('00000001');
    expect(tenth.slice(0, 8)).toBe('0000000a');
    expect(big.slice(0, 8)).toBe('00000100');
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(first.slice(8)).not.toBe(tenth.slice(8));
  });
});

describe('the support audit log is only ever appended to', () => {
  const sources = listSourceFiles(SOURCE_ROOT).map(path => ({
    name: path.slice(SOURCE_ROOT.length + 1),
    text: readFileSync(path, 'utf8'),
  }));

  it('is written by the audit records module only', () => {
    const writers = sources.filter(source => source.text.includes('.put(\'supportAuditEntries\''));

    expect(writers.map(source => source.name)).toEqual([join('core', 'modules', 'platform', 'supportAuditRecords.ts')]);
    expect(writers[0]?.text.match(/\.put\('supportAuditEntries'/g)).toHaveLength(1);
  });

  it('is never deleted from', () => {
    expect(sources.filter(source => source.text.includes('.delete(\'supportAuditEntries\''))).toEqual([]);
  });
});
