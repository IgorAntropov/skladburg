import type { ReactElement } from 'react';

import { OwnListSkeleton } from './OwnListSkeleton';
import { SalesTermsCardSkeleton } from './SalesTermsCardSkeleton';

export const OwnCatalogSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-4">
    <SalesTermsCardSkeleton />
    <OwnListSkeleton />
  </div>
);
