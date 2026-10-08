import type { ReactElement } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { LandingLinkScreen } from './LandingLinkScreen';

interface NotFoundScreenProps {
  landingSection: AppSectionValue;
}

export const NotFoundScreen = ({ landingSection }: NotFoundScreenProps): ReactElement => {
  return <LandingLinkScreen actionKey="routing.notFound.action" landingSection={landingSection} titleKey="routing.notFound.title" />;
};
