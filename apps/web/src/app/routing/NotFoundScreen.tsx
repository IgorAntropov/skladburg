import type { ReactElement } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { LandingLinkScreen } from './LandingLinkScreen';

interface NotFoundScreenProps {
  landingSection: AppSectionValue;
}

export const NotFoundScreen = ({ landingSection }: NotFoundScreenProps): ReactElement => {
  return (
    <div className="contents" data-testid="not-found">
      <LandingLinkScreen
        actionKey="routing.notFound.action"
        actionTestId="not-found-action"
        landingSection={landingSection}
        titleKey="routing.notFound.title"
      />
    </div>
  );
};
