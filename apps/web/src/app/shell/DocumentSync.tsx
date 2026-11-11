import { useLayoutEffect } from 'react';

import { useI18n } from '@/shared/i18n';
import {
  getAddressSection,
  getSectionTitleKey,
  useAddress,
} from '@/shared/routing';
import { useTenantSettings } from '@/shared/tenant';

interface DocumentSyncProps {
  unreadCount: number;
}

export const DocumentSync = ({ unreadCount }: DocumentSyncProps): null => {
  const { locale, t } = useI18n();
  const { brandName } = useTenantSettings();
  const { address } = useAddress();

  const section = address === undefined ? undefined : getAddressSection(address);
  const sectionTitle = address === undefined
    ? t('routing.notFound.title')
    : section === undefined ? undefined : t(getSectionTitleKey(section));
  const title = sectionTitle === undefined ? brandName : t('app.documentTitle', { brand: brandName, section: sectionTitle });
  const hasUnread = unreadCount > 0;
  const tabTitle = hasUnread ? t('app.documentTitleWithUnread', { count: unreadCount, title }) : title;

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useLayoutEffect(() => {
    document.title = tabTitle;

    return (): void => {
      document.title = title;
    };
  }, [tabTitle, title]);

  useLayoutEffect(() => {
    if (!hasUnread) {
      return;
    }

    const icons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[data-unread-href]'), (icon) => {
      const href = icon.getAttribute('href') ?? '';
      icon.setAttribute('href', icon.dataset.unreadHref ?? href);

      return { href, icon };
    });

    return (): void => {
      for (const { href, icon } of icons) {
        icon.setAttribute('href', href);
      }
    };
  }, [hasUnread]);

  return null;
};
