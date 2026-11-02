import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { ShowcaseDestinationGate } from './ShowcaseDestinationGate';
import { ShowcaseUnverified } from './ShowcaseUnverified';

interface ShowcaseTabProps {
  focus: ObjectRefValue | undefined;
  isVerified: boolean;
}

export const ShowcaseTab = ({ focus, isVerified }: ShowcaseTabProps): ReactElement => (
  <div className="flex flex-1 flex-col" data-testid="catalog-tab-showcase">
    {isVerified ? <ShowcaseDestinationGate focus={focus} /> : <ShowcaseUnverified />}
  </div>
);
