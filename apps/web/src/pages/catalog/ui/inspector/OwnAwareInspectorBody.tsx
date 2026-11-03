import type {
  ReactElement,
  ReactNode,
} from 'react';

import { useMemo } from 'react';

import { useOwnListingQuery } from '@/entities/listing';
import { WidgetStates } from '@/shared/ui';

import type { OwnListingPairValue } from '../../lib/toOwnListingPairs';

import { isNotFoundError } from '../../lib/isNotFoundError';
import { toOwnListingPair } from '../../lib/toOwnListingPairs';
import { useCatalogTexts } from '../../model/useCatalogTexts';
import { useReportedTitle } from '../../model/useReportedTitle';
import { OwnListingInspectorSkeleton } from '../skeleton/OwnListingInspectorSkeleton';
import { OwnListingDetails } from './OwnListingDetails';

interface OwnAwareInspectorBodyProps {
  children: ReactNode;
  listingId: string;
  onTitleChange: (title: string | undefined) => void;
}

interface OwnListingInspectorContentProps {
  onTitleChange: (title: string | undefined) => void;
  pair: OwnListingPairValue;
}

const OwnListingInspectorContent = ({ onTitleChange, pair }: OwnListingInspectorContentProps): ReactElement => {
  useReportedTitle(pair.product.name, onTitleChange);

  return <OwnListingDetails pair={pair} />;
};

export const OwnAwareInspectorBody = ({
  children,
  listingId,
  onTitleChange,
}: OwnAwareInspectorBodyProps): ReactElement => {
  const { listingT } = useCatalogTexts();
  const ownQuery = useOwnListingQuery(listingId);

  const ownListing = ownQuery.data;
  const pair = useMemo(() => (ownListing === undefined ? undefined : toOwnListingPair(ownListing)), [ownListing]);

  const handleRetry = (): void => {
    console.log('> OwnAwareInspectorBody -> handleRetry:', { listingId });
    void ownQuery.refetch();
  };

  if (isNotFoundError(ownQuery.error)) {
    return <>{children}</>;
  }

  return (
    <WidgetStates
      data={pair}
      error={ownQuery.error}
      isRetrying={ownQuery.isFetching}
      loadingLabel={listingT('listing.loading')}
      onRetry={handleRetry}
      skeleton={<OwnListingInspectorSkeleton />}
    >
      {loadedPair => <OwnListingInspectorContent key={loadedPair.listing.id} onTitleChange={onTitleChange} pair={loadedPair} />}
    </WidgetStates>
  );
};
