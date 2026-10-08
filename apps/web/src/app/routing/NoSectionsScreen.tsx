import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';

export const NoSectionsScreen = (): ReactElement => {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-8">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">{t('session.noSections')}</h1>
    </div>
  );
};
