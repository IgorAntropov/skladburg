import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { OwnListingsSection } from './OwnListingsSection';
import { SalesTermsCard } from './SalesTermsCard';

interface OwnCatalogPanelProps {
  focus: ObjectRefValue | undefined;
}

export const OwnCatalogPanel = ({ focus }: OwnCatalogPanelProps): ReactElement => (
  <div className="flex flex-col gap-4">
    <SalesTermsCard />
    <OwnListingsSection focus={focus} />
  </div>
);
