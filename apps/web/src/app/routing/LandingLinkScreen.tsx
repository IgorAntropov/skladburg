import type { ReactElement } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import {
  AddressLink,
  SECTION_TITLE_KEYS,
} from '@/shared/routing';
import {
  buttonClassName,
  StatusScreen,
} from '@/shared/ui';

const ACTION_LINK_CLASS_NAME = buttonClassName({ size: 'lg' });

interface LandingLinkScreenProps {
  actionKey: 'routing.notFound.action' | 'routing.objectUnavailable.action';
  landingSection: AppSectionValue;
  titleKey: 'routing.notFound.title' | 'routing.objectUnavailable.title';
}

export const LandingLinkScreen = ({ actionKey, landingSection, titleKey }: LandingLinkScreenProps): ReactElement => {
  const { t } = useI18n();

  const landingAction = (
    <AddressLink className={ACTION_LINK_CLASS_NAME} to={{ kind: 'section', section: landingSection }}>
      {t(actionKey, { section: t(SECTION_TITLE_KEYS[landingSection]) })}
    </AddressLink>
  );

  return <StatusScreen action={landingAction} layout="section" title={t(titleKey)} tone="neutral" />;
};
