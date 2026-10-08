import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { readDeviceTimeZone } from './readDeviceTimeZone';

const stubDeviceTimeZone = (timeZone: string): void => {
  const resolved = new Intl.DateTimeFormat().resolvedOptions();

  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ ...resolved, timeZone });
};

describe('readDeviceTimeZone', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the zone of the device', () => {
    stubDeviceTimeZone('Asia/Omsk');

    expect(readDeviceTimeZone()).toBe('Asia/Omsk');
  });

  it('falls back to UTC when the device reports no zone', () => {
    stubDeviceTimeZone('');

    expect(readDeviceTimeZone()).toBe('UTC');
  });

  it('returns a zone that Intl accepts in the real environment', () => {
    const timeZone = readDeviceTimeZone();

    expect(timeZone).not.toBe('');
    expect(() => new Intl.DateTimeFormat('en', { timeZone })).not.toThrow();
  });
});
