import type { ReactElement } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import {
  AddressLink,
  getSectionTitleKey,
} from '@/shared/routing';
import {
  buttonClassName,
  StatusScreen,
} from '@/shared/ui';

const ACTION_LINK_CLASS_NAME = buttonClassName({ size: 'lg' });

interface LandingLinkScreenProps {
  kind: 'notFound' | 'objectUnavailable';
  landingSection: AppSectionValue;
}

export const LandingLinkScreen = ({ kind, landingSection }: LandingLinkScreenProps): ReactElement => {
  const { t } = useI18n();
  const isNotFound = kind === 'notFound';

  const landingAction = (
    <AddressLink
      className={ACTION_LINK_CLASS_NAME}
      data-testid={isNotFound ? 'not-found-action' : undefined}
      to={{ kind: 'section', section: landingSection }}
    >
      {t(`routing.${kind}.action`, { section: t(getSectionTitleKey(landingSection)) })}
    </AddressLink>
  );
  const screen = <StatusScreen action={landingAction} layout="section" title={t(`routing.${kind}.title`)} tone="neutral" />;

  return isNotFound ? <div className="contents" data-testid="not-found">{screen}</div> : screen;
};
