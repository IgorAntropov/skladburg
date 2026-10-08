import {
  describe,
  expect,
  it,
} from 'vitest';

describe('time zone of the engine test process', () => {
  it('runs under Pacific/Kiritimati', () => {
    expect(process.env.TZ).toBe('Pacific/Kiritimati');
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Pacific/Kiritimati');
  });

  it('shifts local dates by fourteen hours from UTC', () => {
    const offsetMinutes = new Date(Date.UTC(2026, 9, 12)).getTimezoneOffset();

    expect(offsetMinutes).toBe(-840);
  });
});
