import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';

export const SessionPendingScreen = (): ReactElement => {
  const { t } = useI18n();

  return (
    <main aria-busy="true" className="flex-1">
      <p className="sr-only">{t('session.loading')}</p>
    </main>
  );
};
