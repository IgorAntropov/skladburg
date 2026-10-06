import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { useTenantSettings } from '@/shared/tenant';

export const FieldPage = (): ReactElement => {
  const { t } = useI18n();
  const { brandName } = useTenantSettings();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-surface px-4 text-center text-on-surface">
      <h1 className="text-2xl font-semibold tracking-tight" translate="no">
        {brandName}
      </h1>
      <p className="text-base">{t('field.placeholder')}</p>
    </main>
  );
};
