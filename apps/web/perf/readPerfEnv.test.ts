import {
  describe,
  expect,
  it,
} from 'vitest';

import { readPerfEnv } from './readPerfEnv.ts';

describe('readPerfEnv', () => {
  it('falls back to seven cold and five warm runs on all profiles', () => {
    expect(readPerfEnv({})).toEqual({
      baseUrl: undefined,
      coldRunCount: 7,
      profileNames: undefined,
      reportFile: undefined,
      warmRunCount: 5,
    });
  });

  it('caps warm runs by the cold run count', () => {
    expect(readPerfEnv({ PERF_RUNS: '3' })).toMatchObject({ coldRunCount: 3, warmRunCount: 3 });
    expect(readPerfEnv({ PERF_RUNS: '12' })).toMatchObject({ coldRunCount: 12, warmRunCount: 5 });
  });

  it.each(['0', '-2', '1.5', 'many'])('rejects PERF_RUNS "%s"', (runs) => {
    expect(() => readPerfEnv({ PERF_RUNS: runs })).toThrow(/PERF_RUNS/);
  });

  it('splits and trims profile names and drops blanks', () => {
    expect(readPerfEnv({ PERF_PROFILES: ' mobile-fast-4g , ,desktop-fast-4g ' }).profileNames).toEqual([
      'mobile-fast-4g',
      'desktop-fast-4g',
    ]);
  });

  it('treats blank variables as unset', () => {
    expect(readPerfEnv({ PERF_BASE_URL: '  ', PERF_PROFILES: '', PERF_REPORT_FILE: '' })).toMatchObject({
      baseUrl: undefined,
      profileNames: undefined,
      reportFile: undefined,
    });
  });

  it('ends the base address with a slash exactly once', () => {
    expect(readPerfEnv({ PERF_BASE_URL: 'https://example.test/app' }).baseUrl).toBe('https://example.test/app/');
    expect(readPerfEnv({ PERF_BASE_URL: 'https://example.test/app/' }).baseUrl).toBe('https://example.test/app/');
  });
});
