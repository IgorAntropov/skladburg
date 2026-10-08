import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import { FocusedObjectNote } from '@/shared/routing';

interface NetworkPageProps {
  focus: ObjectRefValue | undefined;
}

export const NetworkPage = ({ focus }: NetworkPageProps): ReactElement => {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t('section.network.title')}</h1>
      {focus !== undefined && <FocusedObjectNote focus={focus} />}
      <p className="text-base">{t('section.network.placeholder')}</p>
    </div>
  );
};
