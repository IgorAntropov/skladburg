import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';

import { useShowcaseListingQuery } from '@/entities/listing';
import { parseApiError } from '@/shared/api';

import type { DestinationOptionValue } from '../lib/destinationOptions';

import { useCatalogAccess } from './useCatalogAccess';
import { useShowcaseDestination } from './useShowcaseDestination';

export interface ListingInspectorGateValue {
  cityNames: ReadonlyMap<string, string>;
  destination: DestinationOptionValue | undefined;
  error: Error | null;
  isClosed: boolean;
  isOpen: boolean;
  isRetrying: boolean;
  retry: () => void;
}

export interface ListingInspectorStateValue {
  cityNames: ReadonlyMap<string, string>;
  destination: DestinationOptionValue | undefined;
  error: Error | null;
  isNotFound: boolean;
  isRetrying: boolean;
  listing: ShowcaseListing | undefined;
  retry: () => void;
}

const isNotFoundError = (error: Error | null): boolean => error !== null && parseApiError(error).code === ErrorCode.NOT_FOUND;

export const useListingInspectorGate = (): ListingInspectorGateValue => {
  const catalogAccess = useCatalogAccess();
  const destinationState = useShowcaseDestination();

  const { access } = catalogAccess;
  const error = catalogAccess.error ?? destinationState.error;
  const isShowcaseOpen = access?.isShowcaseVerified === true;
  const isClosed = access !== undefined && !isShowcaseOpen;
  const isOpen = isShowcaseOpen && error === null && !destinationState.isPending;

  const retry = (): void => {
    console.log('> useListingInspectorGate -> retry:', {});

    if (catalogAccess.error !== null) {
      catalogAccess.retry();
    }
    else if (destinationState.error !== null) {
      destinationState.retry();
    }
  };

  return {
    cityNames: destinationState.cityNames,
    destination: destinationState.destination,
    error,
    isClosed,
    isOpen,
    isRetrying: catalogAccess.isRetrying || destinationState.isRetrying,
    retry,
  };
};

export const toGateInspectorState = (gate: ListingInspectorGateValue): ListingInspectorStateValue => ({
  cityNames: gate.cityNames,
  destination: gate.destination,
  error: gate.isClosed ? null : gate.error,
  isNotFound: gate.isClosed,
  isRetrying: gate.isRetrying,
  listing: undefined,
  retry: gate.retry,
});

export const useOpenListingInspectorState = (
  listingId: string,
  gate: ListingInspectorGateValue,
): ListingInspectorStateValue => {
  const listingQuery = useShowcaseListingQuery(listingId, gate.destination?.id ?? '');

  const isNotFound = isNotFoundError(listingQuery.error);

  const retry = (): void => {
    console.log('> useOpenListingInspectorState -> retry:', { listingId });
    void listingQuery.refetch();
  };

  return {
    cityNames: gate.cityNames,
    destination: gate.destination,
    error: isNotFound ? null : listingQuery.error,
    isNotFound,
    isRetrying: gate.isRetrying || listingQuery.isFetching,
    listing: listingQuery.data,
    retry,
  };
};
