import { create } from '@bufbuild/protobuf';
import {
  DeviceBrowserFamily,
  DeviceFormFactor,
  DeviceOsFamily,
  type SupportDevice,
  SupportDeviceSchema,
} from '@skladburg/contracts/support/v1/support_ticket';

export interface ClassifyDeviceInputValue {
  isStandalone: boolean;
  maxTouchPoints: number;
  userAgent: string;
  viewportWidth: number;
}

const PHONE_IOS_PATTERN = /iPhone|iPod/;

const MAC_PATTERN = /Macintosh|Mac OS X/;

const LINUX_PATTERN = /Linux|X11/;

const EDGE_PATTERN = /Edg(?:e|A|iOS)?\//;

const OTHER_BROWSER_PATTERN = /OPR\/|Opera|OPiOS|SamsungBrowser|UCBrowser|DuckDuckGo|Vivaldi/;

const FIREFOX_PATTERN = /Firefox|FxiOS/;

const CHROME_PATTERN = /Chrome|CriOS|Chromium/;

const SAFARI_PATTERN = /Safari|AppleWebKit/;

const MIN_TABLET_TOUCH_POINTS = 2;

const TABLET_MIN_VIEWPORT_WIDTH = 640;

const isIosFamily = (userAgent: string, maxTouchPoints: number): boolean => {
  const isIosUserAgent = PHONE_IOS_PATTERN.test(userAgent) || userAgent.includes('iPad');
  const isTabletInDesktopMode = MAC_PATTERN.test(userAgent) && maxTouchPoints >= MIN_TABLET_TOUCH_POINTS;

  return isIosUserAgent || isTabletInDesktopMode;
};

const resolveOsFamily = (userAgent: string, maxTouchPoints: number): DeviceOsFamily => {
  if (isIosFamily(userAgent, maxTouchPoints)) {
    return DeviceOsFamily.IOS;
  }

  if (userAgent.includes('Android')) {
    return DeviceOsFamily.ANDROID;
  }

  if (userAgent.includes('Windows')) {
    return DeviceOsFamily.WINDOWS;
  }

  if (MAC_PATTERN.test(userAgent)) {
    return DeviceOsFamily.MACOS;
  }

  if (userAgent.includes('CrOS')) {
    return DeviceOsFamily.OTHER;
  }

  return LINUX_PATTERN.test(userAgent) ? DeviceOsFamily.LINUX : DeviceOsFamily.OTHER;
};

const resolveBrowserFamily = (userAgent: string): DeviceBrowserFamily => {
  if (userAgent.includes('YaBrowser')) {
    return DeviceBrowserFamily.YANDEX;
  }

  if (EDGE_PATTERN.test(userAgent)) {
    return DeviceBrowserFamily.EDGE;
  }

  if (OTHER_BROWSER_PATTERN.test(userAgent)) {
    return DeviceBrowserFamily.OTHER;
  }

  if (FIREFOX_PATTERN.test(userAgent)) {
    return DeviceBrowserFamily.FIREFOX;
  }

  if (CHROME_PATTERN.test(userAgent)) {
    return DeviceBrowserFamily.CHROME;
  }

  return SAFARI_PATTERN.test(userAgent) ? DeviceBrowserFamily.SAFARI : DeviceBrowserFamily.OTHER;
};

const resolveFormFactor = (
  osFamily: DeviceOsFamily,
  { userAgent, viewportWidth }: ClassifyDeviceInputValue,
): DeviceFormFactor => {
  if (osFamily === DeviceOsFamily.IOS) {
    return PHONE_IOS_PATTERN.test(userAgent) ? DeviceFormFactor.PHONE : DeviceFormFactor.TABLET;
  }

  if (osFamily === DeviceOsFamily.ANDROID) {
    const isPhone = userAgent.includes('Mobile') && viewportWidth < TABLET_MIN_VIEWPORT_WIDTH;

    return isPhone ? DeviceFormFactor.PHONE : DeviceFormFactor.TABLET;
  }

  return DeviceFormFactor.DESKTOP;
};

export const classifyDevice = (input: ClassifyDeviceInputValue): SupportDevice => {
  const { isStandalone, maxTouchPoints, userAgent } = input;
  const osFamily = resolveOsFamily(userAgent, maxTouchPoints);

  return create(SupportDeviceSchema, {
    browserFamily: resolveBrowserFamily(userAgent),
    formFactor: resolveFormFactor(osFamily, input),
    isInstalled: isStandalone,
    osFamily,
  });
};
