import type { ReactElement } from 'react';

import { SearchX } from 'lucide-react';

import { EmptyState } from '@/shared/ui';

import { useCatalogTexts } from '../../model/useCatalogTexts';

export const ListingNotFound = (): ReactElement => {
  const { listingT } = useCatalogTexts();

  return (
    <EmptyState
      className="py-4"
      data-testid="listing-inspector-not-found"
      hint={listingT('listing.notFound.hint')}
      icon={SearchX}
      text={listingT('listing.notFound.title')}
    />
  );
};
