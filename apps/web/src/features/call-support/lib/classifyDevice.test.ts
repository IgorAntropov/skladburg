import { validateFormValues } from '@skladburg/contracts/forms';
import { SupportDeviceFormRules } from '@skladburg/contracts/forms/support/v1/support_ticket';
import {
  DeviceBrowserFamily,
  DeviceFormFactor,
  DeviceOsFamily,
} from '@skladburg/contracts/support/v1/support_ticket';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ClassifyDeviceInputValue } from './classifyDevice';

import { classifyDevice } from './classifyDevice';

const WEBKIT = 'AppleWebKit/605.1.15 (KHTML, like Gecko)';

const BLINK = 'AppleWebKit/537.36 (KHTML, like Gecko)';

const IPHONE_SAFARI = `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ${WEBKIT} Version/17.5 Mobile/15E148 Safari/604.1`;

const IPHONE_STANDALONE = `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ${WEBKIT} Mobile/15E148`;

const IPHONE_CHROME = `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ${WEBKIT} CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1`;

const ANDROID_CHROME = `Mozilla/5.0 (Linux; Android 14; Pixel 8) ${BLINK} Chrome/126.0.0.0 Mobile Safari/537.36`;

const ANDROID_TABLET_CHROME = `Mozilla/5.0 (Linux; Android 14; SM-X710) ${BLINK} Chrome/126.0.0.0 Safari/537.36`;

const YANDEX_WINDOWS = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${BLINK} Chrome/124.0.0.0 YaBrowser/24.6.0.0 Safari/537.36`;

const MAC_SAFARI = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ${WEBKIT} Version/17.5 Safari/605.1.15`;

const IPAD_SAFARI = `Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) ${WEBKIT} Version/17.5 Mobile/15E148 Safari/604.1`;

const EDGE_WINDOWS = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${BLINK} Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0`;

const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';

const OPERA_WINDOWS = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${BLINK} Chrome/126.0.0.0 Safari/537.36 OPR/111.0.0.0`;

const classify = (input: Partial<ClassifyDeviceInputValue> & { userAgent: string }): ReturnType<typeof classifyDevice> => classifyDevice({
  isStandalone: false,
  maxTouchPoints: 0,
  viewportWidth: 1440,
  ...input,
});

describe('classifyDevice', () => {
  it('recognizes Safari on an iPhone', () => {
    const device = classify({ maxTouchPoints: 5, userAgent: IPHONE_SAFARI, viewportWidth: 390 });

    expect(device.formFactor).toBe(DeviceFormFactor.PHONE);
    expect(device.osFamily).toBe(DeviceOsFamily.IOS);
    expect(device.browserFamily).toBe(DeviceBrowserFamily.SAFARI);
    expect(device.isInstalled).toBe(false);
  });

  it('recognizes Chrome on an iPhone', () => {
    const device = classify({ maxTouchPoints: 5, userAgent: IPHONE_CHROME, viewportWidth: 390 });

    expect(device.osFamily).toBe(DeviceOsFamily.IOS);
    expect(device.browserFamily).toBe(DeviceBrowserFamily.CHROME);
  });

  it('recognizes Chrome on an Android phone', () => {
    const device = classify({ maxTouchPoints: 5, userAgent: ANDROID_CHROME, viewportWidth: 412 });

    expect(device.formFactor).toBe(DeviceFormFactor.PHONE);
    expect(device.osFamily).toBe(DeviceOsFamily.ANDROID);
    expect(device.browserFamily).toBe(DeviceBrowserFamily.CHROME);
  });

  it('recognizes an Android tablet by the missing mobile token and by a wide viewport', () => {
    expect(classify({ maxTouchPoints: 5, userAgent: ANDROID_TABLET_CHROME, viewportWidth: 800 }).formFactor).toBe(DeviceFormFactor.TABLET);
    expect(classify({ maxTouchPoints: 5, userAgent: ANDROID_CHROME, viewportWidth: 840 }).formFactor).toBe(DeviceFormFactor.TABLET);
  });

  it('recognizes Yandex Browser on Windows', () => {
    const device = classify({ userAgent: YANDEX_WINDOWS });

    expect(device.formFactor).toBe(DeviceFormFactor.DESKTOP);
    expect(device.osFamily).toBe(DeviceOsFamily.WINDOWS);
    expect(device.browserFamily).toBe(DeviceBrowserFamily.YANDEX);
  });

  it('recognizes Safari on macOS', () => {
    const device = classify({ userAgent: MAC_SAFARI });

    expect(device.formFactor).toBe(DeviceFormFactor.DESKTOP);
    expect(device.osFamily).toBe(DeviceOsFamily.MACOS);
    expect(device.browserFamily).toBe(DeviceBrowserFamily.SAFARI);
  });

  it('recognizes an iPad', () => {
    const device = classify({ maxTouchPoints: 5, userAgent: IPAD_SAFARI, viewportWidth: 820 });

    expect(device.formFactor).toBe(DeviceFormFactor.TABLET);
    expect(device.osFamily).toBe(DeviceOsFamily.IOS);
    expect(device.browserFamily).toBe(DeviceBrowserFamily.SAFARI);
  });

  it('recognizes iPadOS that presents itself as a Mac only by its touch points', () => {
    const device = classify({ maxTouchPoints: 5, userAgent: MAC_SAFARI, viewportWidth: 1024 });

    expect(device.formFactor).toBe(DeviceFormFactor.TABLET);
    expect(device.osFamily).toBe(DeviceOsFamily.IOS);
    expect(device.browserFamily).toBe(DeviceBrowserFamily.SAFARI);
  });

  it('keeps a Mac with one touch point on macOS', () => {
    expect(classify({ maxTouchPoints: 1, userAgent: MAC_SAFARI }).osFamily).toBe(DeviceOsFamily.MACOS);
  });

  it('recognizes Edge on Windows', () => {
    const device = classify({ userAgent: EDGE_WINDOWS });

    expect(device.osFamily).toBe(DeviceOsFamily.WINDOWS);
    expect(device.browserFamily).toBe(DeviceBrowserFamily.EDGE);
  });

  it('recognizes Firefox on Linux', () => {
    const device = classify({ userAgent: FIREFOX_LINUX });

    expect(device.formFactor).toBe(DeviceFormFactor.DESKTOP);
    expect(device.osFamily).toBe(DeviceOsFamily.LINUX);
    expect(device.browserFamily).toBe(DeviceBrowserFamily.FIREFOX);
  });

  it('puts an unlisted browser into the other family', () => {
    expect(classify({ userAgent: OPERA_WINDOWS }).browserFamily).toBe(DeviceBrowserFamily.OTHER);
    expect(classify({ userAgent: '' }).browserFamily).toBe(DeviceBrowserFamily.OTHER);
    expect(classify({ userAgent: '' }).osFamily).toBe(DeviceOsFamily.OTHER);
  });

  it('marks the installed application and still finds Safari without a browser token', () => {
    const device = classify({ isStandalone: true, maxTouchPoints: 5, userAgent: IPHONE_STANDALONE, viewportWidth: 390 });

    expect(device.isInstalled).toBe(true);
    expect(device.browserFamily).toBe(DeviceBrowserFamily.SAFARI);
  });

  it('produces a device accepted by the contract rules', () => {
    const userAgents = [
      IPHONE_SAFARI,
      ANDROID_CHROME,
      YANDEX_WINDOWS,
      MAC_SAFARI,
      IPAD_SAFARI,
      EDGE_WINDOWS,
      FIREFOX_LINUX,
      OPERA_WINDOWS,
      '',
    ];

    for (const userAgent of userAgents) {
      const device = classify({ maxTouchPoints: 5, userAgent, viewportWidth: 390 });

      expect(validateFormValues(SupportDeviceFormRules, { ...device }, ['formFactor', 'osFamily', 'browserFamily'])).toEqual([]);
      expect(device.formFactor).not.toBe(DeviceFormFactor.UNSPECIFIED);
      expect(device.osFamily).not.toBe(DeviceOsFamily.UNSPECIFIED);
      expect(device.browserFamily).not.toBe(DeviceBrowserFamily.UNSPECIFIED);
    }
  });
});
