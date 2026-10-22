import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';

const OWN_MARK_CLASS_NAME
  = 'inline-flex shrink-0 items-center rounded-full border border-line-strong px-2 text-xs leading-5 font-medium text-on-panel';

export const OrganizationOwnMark = (): ReactElement => {
  const { t } = useI18n();

  return (
    <span className={OWN_MARK_CLASS_NAME}>
      <span aria-hidden>{t('organization.directory.own')}</span>
      <span className="sr-only">{t('organization.directory.ownLabel')}</span>
    </span>
  );
};
