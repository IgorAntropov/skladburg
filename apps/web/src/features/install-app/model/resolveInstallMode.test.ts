import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  InstallEnvironmentValue,
  InstallModeValue,
} from './installTypes';

import { resolveInstallMode } from './resolveInstallMode';

const APPLE_WEBKIT = 'AppleWebKit/605.1.15 (KHTML, like Gecko)';
const IPHONE_PLATFORM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)';
const MOBILE_SAFARI_TAIL = 'Mobile/15E148 Safari/604.1';

const IPHONE_SAFARI = `${IPHONE_PLATFORM} ${APPLE_WEBKIT} Version/18.1 ${MOBILE_SAFARI_TAIL}`;
const IPHONE_CHROME = `${IPHONE_PLATFORM} ${APPLE_WEBKIT} CriOS/130.0.6723.37 ${MOBILE_SAFARI_TAIL}`;
const IPHONE_YANDEX = `${IPHONE_PLATFORM} ${APPLE_WEBKIT} Version/18.1 YaBrowser/24.10.5.1060.10 SA/3 ${MOBILE_SAFARI_TAIL}`;
const IPAD_DESKTOP_SAFARI = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ${APPLE_WEBKIT} Version/18.1 Safari/605.1.15`;
const MAC_SAFARI = IPAD_DESKTOP_SAFARI;
const CHROMIUM_WEBKIT = 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0';
const CHROME_WINDOWS = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${CHROMIUM_WEBKIT} Safari/537.36`;
const ANDROID_CHROME = `Mozilla/5.0 (Linux; Android 14; Pixel 8) ${CHROMIUM_WEBKIT} Mobile Safari/537.36`;
const FIREFOX_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0';

interface CaseValue {
  environment: InstallEnvironmentValue;
  expected: InstallModeValue;
  name: string;
}

const createEnvironment = (overrides: Partial<InstallEnvironmentValue>): InstallEnvironmentValue => ({
  hasDeferredPrompt: false,
  isStandalone: false,
  maxTouchPoints: 0,
  userAgent: CHROME_WINDOWS,
  ...overrides,
});

const CASES: CaseValue[] = [
  {
    environment: createEnvironment({ maxTouchPoints: 5, userAgent: IPHONE_SAFARI }),
    expected: 'instructions',
    name: 'iPhone Safari',
  },
  {
    environment: createEnvironment({ maxTouchPoints: 5, userAgent: IPHONE_CHROME }),
    expected: 'instructions',
    name: 'iPhone Chrome',
  },
  {
    environment: createEnvironment({ maxTouchPoints: 5, userAgent: IPHONE_YANDEX }),
    expected: 'instructions',
    name: 'iPhone Yandex Browser',
  },
  {
    environment: createEnvironment({ maxTouchPoints: 5, userAgent: IPAD_DESKTOP_SAFARI }),
    expected: 'instructions',
    name: 'iPad Safari with the Mac user agent and touch',
  },
  {
    environment: createEnvironment({ maxTouchPoints: 0, userAgent: MAC_SAFARI }),
    expected: 'unavailable',
    name: 'Mac Safari without touch',
  },
  {
    environment: createEnvironment({ maxTouchPoints: 1, userAgent: MAC_SAFARI }),
    expected: 'unavailable',
    name: 'Mac Safari with a single touch point',
  },
  {
    environment: createEnvironment({ hasDeferredPrompt: true }),
    expected: 'prompt',
    name: 'Chrome on Windows with the install event',
  },
  {
    environment: createEnvironment({}),
    expected: 'unavailable',
    name: 'Chrome on Windows without the install event',
  },
  {
    environment: createEnvironment({ userAgent: FIREFOX_WINDOWS }),
    expected: 'unavailable',
    name: 'Firefox on Windows',
  },
  {
    environment: createEnvironment({ hasDeferredPrompt: true, maxTouchPoints: 5, userAgent: ANDROID_CHROME }),
    expected: 'prompt',
    name: 'Android Chrome with the install event',
  },
  {
    environment: createEnvironment({ maxTouchPoints: 5, userAgent: ANDROID_CHROME }),
    expected: 'unavailable',
    name: 'Android Chrome without the install event',
  },
  {
    environment: createEnvironment({ isStandalone: true, maxTouchPoints: 5, userAgent: IPHONE_SAFARI }),
    expected: 'installed',
    name: 'iPhone launched from the home screen',
  },
  {
    environment: createEnvironment({ hasDeferredPrompt: true, isStandalone: true }),
    expected: 'installed',
    name: 'Chrome on Windows launched as an app',
  },
  {
    environment: createEnvironment({ isStandalone: true, maxTouchPoints: 5, userAgent: IPAD_DESKTOP_SAFARI }),
    expected: 'installed',
    name: 'iPad launched from the home screen',
  },
];

describe('resolveInstallMode', () => {
  it.each(CASES)('$name -> $expected', ({ environment, expected }) => {
    expect(resolveInstallMode(environment)).toBe(expected);
  });
});
