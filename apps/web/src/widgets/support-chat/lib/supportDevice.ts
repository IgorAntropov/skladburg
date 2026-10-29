import {
  DeviceBrowserFamily,
  DeviceFormFactor,
  DeviceOsFamily,
  type SupportDevice,
} from '@skladburg/contracts/support/v1/support_ticket';

import type { SupportCatalogValue } from '../i18n/supportSection';
import type { SupportTranslate } from './supportTranslate';

export const SUPPORT_BROWSER_KEYS = {
  [DeviceBrowserFamily.CHROME]: 'support.device.browser.chrome',
  [DeviceBrowserFamily.EDGE]: 'support.device.browser.edge',
  [DeviceBrowserFamily.FIREFOX]: 'support.device.browser.firefox',
  [DeviceBrowserFamily.OTHER]: 'support.device.browser.other',
  [DeviceBrowserFamily.SAFARI]: 'support.device.browser.safari',
  [DeviceBrowserFamily.YANDEX]: 'support.device.browser.yandex',
} as const satisfies Record<Exclude<DeviceBrowserFamily, DeviceBrowserFamily.UNSPECIFIED>, keyof SupportCatalogValue>;

export const SUPPORT_FORM_FACTOR_KEYS = {
  [DeviceFormFactor.DESKTOP]: 'support.device.formFactor.desktop',
  [DeviceFormFactor.PHONE]: 'support.device.formFactor.phone',
  [DeviceFormFactor.TABLET]: 'support.device.formFactor.tablet',
} as const satisfies Record<Exclude<DeviceFormFactor, DeviceFormFactor.UNSPECIFIED>, keyof SupportCatalogValue>;

export const SUPPORT_OS_KEYS = {
  [DeviceOsFamily.ANDROID]: 'support.device.os.android',
  [DeviceOsFamily.IOS]: 'support.device.os.ios',
  [DeviceOsFamily.LINUX]: 'support.device.os.linux',
  [DeviceOsFamily.MACOS]: 'support.device.os.macos',
  [DeviceOsFamily.OTHER]: 'support.device.os.other',
  [DeviceOsFamily.WINDOWS]: 'support.device.os.windows',
} as const satisfies Record<Exclude<DeviceOsFamily, DeviceOsFamily.UNSPECIFIED>, keyof SupportCatalogValue>;

export const formatSupportDevice = (t: SupportTranslate, device: SupportDevice): string => {
  const { browserFamily, formFactor, isInstalled, osFamily } = device;

  if (
    browserFamily === DeviceBrowserFamily.UNSPECIFIED
    || formFactor === DeviceFormFactor.UNSPECIFIED
    || osFamily === DeviceOsFamily.UNSPECIFIED
  ) {
    return t('support.device.unknown');
  }

  const parts = {
    browser: t(SUPPORT_BROWSER_KEYS[browserFamily]),
    formFactor: t(SUPPORT_FORM_FACTOR_KEYS[formFactor]),
    os: t(SUPPORT_OS_KEYS[osFamily]),
  };

  return isInstalled ? t('support.device.summary.installed', parts) : t('support.device.summary', parts);
};
