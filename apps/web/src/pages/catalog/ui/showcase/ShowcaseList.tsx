import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';
import type {
  ReactElement,
  Ref,
} from 'react';

import { ShowcaseRow } from './ShowcaseRow';

interface ShowcaseListProps {
  isBusy: boolean;
  listings: readonly ShowcaseListing[];
  listRef: Ref<HTMLUListElement>;
  selectedListingId: string | undefined;
}

export const ShowcaseList = ({
  isBusy,
  listings,
  listRef,
  selectedListingId,
}: ShowcaseListProps): ReactElement => (
  <ul
    aria-busy={isBusy ? 'true' : undefined}
    className="flex flex-col gap-2"
    data-testid="catalog-showcase-list"
    ref={listRef}
  >
    {listings.map(listing => (
      <ShowcaseRow isSelected={listing.id === selectedListingId} key={listing.id} listing={listing} />
    ))}
  </ul>
);
