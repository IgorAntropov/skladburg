import {
  describe,
  expect,
  it,
} from 'vitest';

import { isTimeoutError } from './isTimeoutError.ts';

describe('isTimeoutError', () => {
  it('recognises the timeout Playwright throws while waiting', () => {
    const error = new Error('Timeout 90000ms exceeded');

    error.name = 'TimeoutError';

    expect(isTimeoutError(error)).toBe(true);
  });

  it('leaves every other failure to be rethrown', () => {
    expect(isTimeoutError(new Error('Target page, context or browser has been closed'))).toBe(false);
    expect(isTimeoutError('TimeoutError')).toBe(false);
  });
});
