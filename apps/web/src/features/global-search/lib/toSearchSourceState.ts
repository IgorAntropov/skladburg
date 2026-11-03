import type { SearchSourceStateValue } from '../model/searchSourceTypes';

export interface SearchQuerySnapshotValue<TData> {
  data: TData | undefined;
  error: Error | null;
  isError: boolean;
  isPlaceholderData: boolean;
  refetch: () => Promise<unknown>;
}

export const toSearchSourceState = <TData>({
  data,
  error,
  isError,
  isPlaceholderData,
  refetch,
}: SearchQuerySnapshotValue<TData>): SearchSourceStateValue<TData> => {
  const retry = (): void => {
    console.log('> toSearchSourceState -> retry:', {});
    void refetch();
  };

  if (data !== undefined) {
    return { data, error: null, isStale: isPlaceholderData, retry, status: 'ready' };
  }

  if (isError) {
    return { data: undefined, error, isStale: false, retry, status: 'error' };
  }

  return { data: undefined, error: null, isStale: false, retry, status: 'loading' };
};
