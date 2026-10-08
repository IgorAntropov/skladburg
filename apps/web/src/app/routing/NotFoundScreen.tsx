import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { AddressLink } from '@/shared/routing';

import {
  DEFAULT_SECTION,
  SECTION_TITLE_KEYS,
} from './sections';

const ACTION_LINK_CLASS_NAME = [
  'inline-flex min-h-12 items-center rounded-md bg-primary px-6 py-2 text-base font-medium text-on-primary',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
].join(' ');

export const NotFoundScreen = (): ReactElement => {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t('routing.notFound.title')}</h1>
      <AddressLink className={ACTION_LINK_CLASS_NAME} to={{ kind: 'section', section: DEFAULT_SECTION }}>
        {t('routing.notFound.action', { section: t(SECTION_TITLE_KEYS[DEFAULT_SECTION]) })}
      </AddressLink>
    </div>
  );
};
