import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { StatusScreen } from '@/shared/ui';

export const NoSectionsScreen = (): ReactElement => {
  const { t } = useI18n();

  return <StatusScreen layout="section" title={t('session.noSections')} tone="neutral" />;
};
