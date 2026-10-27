import type { LocaleCode } from '@/shared/i18n';

import { notificationSection } from '../../i18n/notificationSection';

export { NotificationCenterPanel } from './NotificationCenterPanel';

export const isNotificationTextsReady = (locale: LocaleCode): boolean => notificationSection.read(locale).status === 'ready';

export const loadNotificationTexts = async (locale: LocaleCode): Promise<void> => {
  await notificationSection.load(locale);
};

export const requestNotificationTexts = (locale: LocaleCode): void => {
  notificationSection.request(locale);
};
