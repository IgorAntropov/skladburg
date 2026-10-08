import type { ReactElement } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { LandingLinkScreen } from './LandingLinkScreen';

interface ObjectUnavailableScreenProps {
  landingSection: AppSectionValue;
}

export const ObjectUnavailableScreen = ({ landingSection }: ObjectUnavailableScreenProps): ReactElement => {
  return (
    <LandingLinkScreen
      actionKey="routing.objectUnavailable.action"
      landingSection={landingSection}
      titleKey="routing.objectUnavailable.title"
    />
  );
};
