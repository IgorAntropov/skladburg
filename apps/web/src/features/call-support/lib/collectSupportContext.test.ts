import { create } from '@bufbuild/protobuf';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { validateFormValues } from '@skladburg/contracts/forms';
import {
  SupportDeviceFormRules,
  SupportErrorRefFormRules,
  SupportTicketContextFormRules,
} from '@skladburg/contracts/forms/support/v1/support_ticket';
import {
  DeviceBrowserFamily,
  DeviceFormFactor,
  DeviceOsFamily,
  SupportDeviceSchema,
  type SupportErrorRef,
  SupportErrorRefSchema,
  type SupportTicketContext,
} from '@skladburg/contracts/support/v1/support_ticket';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ErrorJournalEntryValue } from '@/shared/api';
import type { AppAddressValue } from '@/shared/routing';

import type { CollectSupportContextInputValue } from './collectSupportContext';

import { collectSupportContext } from './collectSupportContext';

const TRACE_ID = '8f14e45f-ceea-4b67-8a5c-2d4e6a1b9c01';

const DEAL_ID = '3b9d4c1e-5a2f-4e7b-9c10-0f6a8d2e4b77';

const DEVICE = create(SupportDeviceSchema, {
  browserFamily: DeviceBrowserFamily.SAFARI,
  formFactor: DeviceFormFactor.PHONE,
  isInstalled: true,
  osFamily: DeviceOsFamily.IOS,
});

const BASE_TIME = Date.UTC(2026, 9, 28, 9, 0, 0);

const createEntry = (index: number, overrides: Partial<ErrorJournalEntryValue> = {}): ErrorJournalEntryValue => ({
  code: ErrorCode.UNAVAILABLE,
  method: 'support.v1.SupportTicketService/CreateSupportTicket',
  occurredAt: BASE_TIME + index * 1000,
  params: { case: undefined },
  traceId: TRACE_ID,
  ...overrides,
});

const createJournal = (count: number): ErrorJournalEntryValue[] => Array.from({ length: count }, (_, index) => createEntry(index));

const SECTION_ADDRESS: AppAddressValue = { kind: 'section', section: 'network' };

const collect = (
  overrides: Partial<CollectSupportContextInputValue> = {},
): SupportTicketContext => collectSupportContext({
  address: SECTION_ADDRESS,
  appVersion: 'c9ee506',
  device: DEVICE,
  errors: [],
  ...overrides,
});

const TOP_LEVEL_FIELDS = ['screenPath', 'errors', 'appVersion', 'device'] as const;

const ERROR_FIELDS = ['code', 'traceId', 'method', 'occurredAt'] as const;

const withoutTypeName = (message: object): string[] => Object.keys(message).filter(key => key !== '$typeName').sort();

const toMs = (entry: SupportErrorRef | undefined): number => Number(entry?.occurredAt?.seconds) * 1000;

const DEVICE_FIELDS = ['formFactor', 'osFamily', 'browserFamily'] as const;

describe('collectSupportContext', () => {
  it('fills only the whitelisted fields', () => {
    const context = collect({ errors: createJournal(2) });
    const [first] = context.errors;

    expect(withoutTypeName(context)).toEqual([...TOP_LEVEL_FIELDS].sort());
    expect(first).toBeDefined();
    expect(withoutTypeName(first ?? create(SupportErrorRefSchema))).toEqual([...ERROR_FIELDS].sort());
    expect(first?.code).toBe(ErrorCode.UNAVAILABLE);
    expect(first?.traceId).toBe(TRACE_ID);
    expect(first?.method).toBe('support.v1.SupportTicketService/CreateSupportTicket');
    expect(toMs(first)).toBe(BASE_TIME + 1000);
    expect(context.device).toBe(DEVICE);
    expect(context.appVersion).toBe('c9ee506');
  });

  it('keeps at most five latest errors, newest first', () => {
    const context = collect({ errors: createJournal(20) });

    expect(context.errors).toHaveLength(5);
    expect(context.errors.map(entry => toMs(entry))).toEqual([
      BASE_TIME + 19000,
      BASE_TIME + 18000,
      BASE_TIME + 17000,
      BASE_TIME + 16000,
      BASE_TIME + 15000,
    ]);
  });

  it('keeps a short journal in reverse order', () => {
    const context = collect({ errors: createJournal(3) });

    expect(context.errors.map(entry => toMs(entry))).toEqual([
      BASE_TIME + 2000,
      BASE_TIME + 1000,
      BASE_TIME,
    ]);
  });

  it('drops journal entries with an unspecified code before counting the limit', () => {
    const errors = [
      ...createJournal(5),
      createEntry(5, { code: ErrorCode.UNSPECIFIED }),
    ];
    const context = collect({ errors });

    expect(context.errors).toHaveLength(5);
    expect(context.errors.every(entry => entry.code === ErrorCode.UNAVAILABLE)).toBe(true);
    expect(toMs(context.errors[0])).toBe(BASE_TIME + 4000);
  });

  it('writes the path of a section without a query string or a trailing slash', () => {
    expect(collect({ address: SECTION_ADDRESS }).screenPath).toBe('/network');
  });

  it('writes the path of an object', () => {
    expect(collect({ address: { kind: 'object', object: { id: DEAL_ID, type: 'deal' } } }).screenPath).toBe(`/deals/${DEAL_ID}`);
  });

  it('writes the root path for home and for an unrecognized address', () => {
    expect(collect({ address: { kind: 'home' } }).screenPath).toBe('/');
    expect(collect({ address: undefined }).screenPath).toBe('/');
  });

  it('writes the root path when the object id does not pass the contract rule', () => {
    expect(collect({ address: { kind: 'object', object: { id: 'a'.repeat(65), type: 'deal' } } }).screenPath).toBe('/');
    expect(collect({ address: { kind: 'object', object: { id: 'name with space', type: 'deal' } } }).screenPath).toBe('/');
    expect(collect({ address: { kind: 'object', object: { id: 'a'.repeat(64), type: 'deal' } } }).screenPath).toBe(
      `/deals/${'a'.repeat(64)}`,
    );
  });

  it('empties the method of a command without a descriptor', () => {
    const context = collect({ errors: [createEntry(0, { method: 'unknown' })] });

    expect(context.errors[0]?.method).toBe('');
  });

  it('empties a method that does not match the contract rule', () => {
    const context = collect({
      errors: [createEntry(0, { method: 'not a method' }), createEntry(1, { method: `a.v1.B/${'C'.repeat(200)}` })],
    });

    expect(context.errors.map(entry => entry.method)).toEqual(['', '']);
  });

  it('empties the trace id when it is missing or is not a UUID', () => {
    const context = collect({
      errors: [
        createEntry(0, { traceId: undefined }),
        createEntry(1, { traceId: 'trace-1' }),
        createEntry(2, { traceId: '' }),
        createEntry(3, { traceId: TRACE_ID.toUpperCase() }),
      ],
    });

    expect(context.errors.map(entry => entry.traceId)).toEqual([TRACE_ID.toUpperCase(), '', '', '']);
  });

  it('falls back to dev when the version does not pass the contract rule', () => {
    expect(collect({ appVersion: 'dev' }).appVersion).toBe('dev');
    expect(collect({ appVersion: 'c9ee506-dirty' }).appVersion).toBe('dev');
    expect(collect({ appVersion: '' }).appVersion).toBe('dev');
    expect(collect({ appVersion: 'C9EE506' }).appVersion).toBe('dev');
  });

  describe('against the contract rules', () => {
    const addresses: readonly (AppAddressValue | undefined)[] = [
      SECTION_ADDRESS,
      { kind: 'object', object: { id: DEAL_ID, type: 'deal' } },
      { kind: 'object', object: { id: 'a'.repeat(65), type: 'handling_unit' } },
      { kind: 'home' },
      undefined,
    ];
    const journals: readonly (readonly ErrorJournalEntryValue[])[] = [
      [],
      createJournal(20),
      [createEntry(0, { method: 'unknown' })],
      [createEntry(0, { traceId: undefined })],
      [createEntry(0, { traceId: 'broken' }), createEntry(1, { method: '??' })],
    ];
    const versions = ['dev', 'c9ee506', 'c9ee506-dirty', ''];

    it('passes every combination without a single violation', () => {
      let checked = 0;

      for (const address of addresses) {
        for (const errors of journals) {
          for (const appVersion of versions) {
            const context = collect({ address, appVersion, errors });

            expect(validateFormValues(SupportTicketContextFormRules, { ...context }, ['screenPath', 'appVersion', 'errors'])).toEqual([]);
            expect(context.errors.length).toBeLessThanOrEqual(5);
            expect(context.device).toBeDefined();

            for (const error of context.errors) {
              expect(validateFormValues(SupportErrorRefFormRules, { ...error }, ['code', 'traceId', 'method'])).toEqual([]);
            }

            if (context.device !== undefined) {
              expect(validateFormValues(SupportDeviceFormRules, { ...context.device }, [...DEVICE_FIELDS])).toEqual([]);
            }

            checked += 1;
          }
        }
      }

      expect(checked).toBe(addresses.length * journals.length * versions.length);
    });
  });
});
