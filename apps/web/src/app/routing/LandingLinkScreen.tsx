import type { ReactElement } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import { AddressLink } from '@/shared/routing';

import { SECTION_TITLE_KEYS } from './sections';

const ACTION_LINK_CLASS_NAME = [
  'inline-flex min-h-12 items-center rounded-md bg-primary px-6 py-2 text-base font-medium text-on-primary',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
].join(' ');

interface LandingLinkScreenProps {
  actionKey: 'routing.notFound.action' | 'routing.objectUnavailable.action';
  landingSection: AppSectionValue;
  titleKey: 'routing.notFound.title' | 'routing.objectUnavailable.title';
}

export const LandingLinkScreen = ({ actionKey, landingSection, titleKey }: LandingLinkScreenProps): ReactElement => {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h1>
      <AddressLink className={ACTION_LINK_CLASS_NAME} to={{ kind: 'section', section: landingSection }}>
        {t(actionKey, { section: t(SECTION_TITLE_KEYS[landingSection]) })}
      </AddressLink>
    </div>
  );
};
